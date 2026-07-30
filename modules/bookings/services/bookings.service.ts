import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "../../../config/env";
import { BookingsRepository } from "../repositories/bookings.repository";
import { prisma } from "../../../config/database";
import { emailQueue, calendarQueue, analyticsQueue } from "../../../queues/booking-queues";

if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️ [bookings.service] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing. Paid bookings will be disabled until credentials are provided.");
}

const razorpay = (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    })
  : null;

export class BookingsService {
  private bookingsRepository: BookingsRepository;

  constructor() {
    this.bookingsRepository = new BookingsRepository();
  }

  // Helper to convert HH:MM to minutes
  private timeToMinutes(t: string): number {
    const parts = t.split(":");
    const h = Number(parts[0] ?? 0);
    const m = Number(parts[1] ?? 0);
    return h * 60 + m;
  }

  // Create booking
  async createBooking(data: {
    eventTypeId: string;
    startTime: string; // ISO String
    attendeeName: string;
    attendeeEmail: string;
    attendeePhone?: string;
    bookingFieldsData?: any;
  }) {
    const eventType = await prisma.eventType.findUnique({
      where: { id: data.eventTypeId },
      include: { user: true },
    });

    if (!eventType || !eventType.isActive) {
      throw new Error("Event type not found or inactive.");
    }

    const hostUser = eventType.user;

    const start = new Date(data.startTime);
    const duration = eventType.duration;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const now = Date.now();

    // 1. Minimum Notice Validation
    const minNoticeMinutes = eventType.minimumNotice ?? 120;
    if (start.getTime() < now + minNoticeMinutes * 60 * 1000) {
      throw new Error(
        `Cannot book on short notice. Minimum notice required is ${minNoticeMinutes} minutes.`
      );
    }

    // 2. Future Bookings Limit Validation
    if (eventType.limitFutureBookings) {
      const config = eventType.limitFutureBookings as any;
      if (config.enabled && config.days) {
        const maxFutureDate = now + config.days * 24 * 60 * 60 * 1000;
        if (start.getTime() > maxFutureDate) {
          throw new Error(
            `Cannot schedule events more than ${config.days} days in the future.`
          );
        }
      }
    }

    // 3. Upcoming Bookings Limit per Booker Validation
    if (eventType.limitUpcomingBookings) {
      const config = eventType.limitUpcomingBookings as any;
      if (config.enabled && config.maxBookings) {
        const count = await prisma.booking.count({
          where: {
            eventTypeId: eventType.id,
            attendeeEmail: data.attendeeEmail,
            startTime: { gte: new Date() },
            status: { in: ["confirmed", "pending_payment"] },
          },
        });
        if (count >= config.maxBookings) {
          throw new Error(
            `You have reached the maximum limit of ${config.maxBookings} upcoming bookings for this event.`
          );
        }
      }
    }

    // 4. Booking Frequency Validation
    if (eventType.limitBookingFrequency) {
      const config = eventType.limitBookingFrequency as any;
      if (config.enabled && config.maxBookings && config.period) {
        let periodStart = new Date(start);
        if (config.period === "day") {
          periodStart.setUTCHours(0, 0, 0, 0);
        } else if (config.period === "week") {
          const day = periodStart.getUTCDay();
          periodStart.setUTCDate(periodStart.getUTCDate() - day);
          periodStart.setUTCHours(0, 0, 0, 0);
        } else if (config.period === "month") {
          periodStart.setUTCDate(1);
          periodStart.setUTCHours(0, 0, 0, 0);
        }

        // Fetch all bookings in the period
        const periodBookings = await prisma.booking.findMany({
          where: {
            eventTypeId: eventType.id,
            startTime: { gte: periodStart },
            status: { in: ["confirmed", "pending_payment"] },
          },
          select: {
            startTime: true,
          },
        });

        // Determine unique times that have been booked
        const uniqueTimes = new Set(periodBookings.map((b) => b.startTime.getTime()));
        const uniqueSlotsCount = uniqueTimes.size;

        // Check if the current slot is a new slot (not already booked)
        const isNewSlot = !uniqueTimes.has(start.getTime());
        const projectedSlotsCount = uniqueSlotsCount + (isNewSlot ? 1 : 0);

        if (projectedSlotsCount > config.maxBookings) {
          throw new Error(
            `Booking limit exceeded for this ${config.period}. Only ${config.maxBookings} slots/meetings are allowed.`
          );
        }
      }
    }

    // 5. Total Booking Duration Validation
    if (eventType.limitTotalBookingDuration) {
      const config = eventType.limitTotalBookingDuration as any;
      if (config.enabled && config.maxMinutes && config.period) {
        let periodStart = new Date(start);
        if (config.period === "day") {
          periodStart.setUTCHours(0, 0, 0, 0);
        } else if (config.period === "week") {
          const day = periodStart.getUTCDay();
          periodStart.setUTCDate(periodStart.getUTCDate() - day);
          periodStart.setUTCHours(0, 0, 0, 0);
        } else if (config.period === "month") {
          periodStart.setUTCDate(1);
          periodStart.setUTCHours(0, 0, 0, 0);
        }

        const existingBookings = await prisma.booking.findMany({
          where: {
            eventTypeId: eventType.id,
            startTime: { gte: periodStart },
            status: { in: ["confirmed", "pending_payment"] },
          },
          include: { eventType: true },
        });

        const totalMinutes = existingBookings.reduce((sum, b) => sum + b.eventType.duration, 0);
        if (totalMinutes + duration > config.maxMinutes) {
          throw new Error(
            `This booking would exceed the allowed total booking duration limit of ${config.maxMinutes} minutes for this ${config.period}.`
          );
        }
      }
    }

    // 6. Availability Schedule Validation
    const availability = eventType.availability as Array<{
      day: string;
      enabled: boolean;
      slots: Array<{ startTime: string; endTime: string }>;
    }> | null;

    if (availability && availability.length > 0) {
      const hostTimezone = hostUser.timezone || "UTC";
      const weekdayName = start.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: hostTimezone,
      });

      const dayConfig = availability.find((a) => a.day === weekdayName);

      if (!dayConfig || !dayConfig.enabled) {
        throw new Error(
          `Bookings are not available on ${weekdayName}. Please choose an available day.`
        );
      }

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: hostTimezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(start);
      const pHour = parts.find((p) => p.type === "hour")?.value ?? "0";
      const pMinute = parts.find((p) => p.type === "minute")?.value ?? "0";

      const slotStartMinutes = (parseInt(pHour) % 24) * 60 + parseInt(pMinute);
      const slotEndMinutes = slotStartMinutes + duration;

      const fitsInASlot = dayConfig.slots?.some((slot) => {
        const windowStart = this.timeToMinutes(slot.startTime);
        const windowEnd = this.timeToMinutes(slot.endTime);
        return slotStartMinutes >= windowStart && slotEndMinutes <= windowEnd;
      });

      if (!fitsInASlot) {
        throw new Error(
          `The selected time is outside available hours for ${weekdayName}.`
        );
      }
    }

    // 7. Overlap, Seats, and Buffers Validation
    const beforeBuffer = eventType.beforeBuffer ?? 0;
    const afterBuffer = eventType.afterBuffer ?? 0;

    // Fetch existing bookings in a surrounding window to check buffers
    const startWindow = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const endWindow = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const conflictingBookings = await prisma.booking.findMany({
      where: {
        eventTypeId: eventType.id,
        status: { in: ["confirmed", "pending_payment"] },
        startTime: { gte: startWindow, lte: endWindow },
      },
    });

    if (eventType.seatsEnabled) {
      // Seats logic: check count of bookings for the exact same start time
      const exactTimeBookingsCount = conflictingBookings.filter(
        (b) => b.startTime.getTime() === start.getTime()
      ).length;

      if (exactTimeBookingsCount >= (eventType.seatsMax ?? 1)) {
        throw new Error("This slot is fully booked.");
      }
    } else {
      // Buffer & normal overlap check:
      // A collision happens if start < b.endTime + b.afterBuffer + new.beforeBuffer
      // AND end > b.startTime - b.beforeBuffer - new.afterBuffer
      const hasOverlap = conflictingBookings.some((b) => {
        const bStart = b.startTime.getTime();
        const bEnd = b.endTime.getTime();
        const combinedAfterBuffer = afterBuffer * 60 * 1000;
        const combinedBeforeBuffer = beforeBuffer * 60 * 1000;

        return (
          start.getTime() < bEnd + combinedAfterBuffer &&
          end.getTime() > bStart - combinedBeforeBuffer
        );
      });

      if (hasOverlap) {
        throw new Error("This slot conflicts with an existing booking or buffer time.");
      }
    }

    // --- Create booking record ---
    const isPaid = eventType.paymentEnabled && eventType.price > 0;
    const status = isPaid ? "pending_payment" : "confirmed";

    const booking = await this.bookingsRepository.createBooking({
      eventTypeId: data.eventTypeId,
      startTime: start,
      endTime: end,
      attendeeName: data.attendeeName,
      attendeeEmail: data.attendeeEmail,
      attendeePhone: data.attendeePhone,
      bookingFieldsData: data.bookingFieldsData,
      status,
    });

    let razorpayOrder = null;
    if (isPaid && razorpay) {
      try {
        const order = await razorpay.orders.create({
          amount: Math.round(eventType.price * 100), // in paise
          currency: eventType.currency || "INR",
          receipt: booking.id,
          notes: {
            bookingId: booking.id,
          },
        });
        razorpayOrder = {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: env.RAZORPAY_KEY_ID,
        };
      } catch (err) {
        console.error("Razorpay order creation failed, proceeding without order details:", err);
      }
    }

    return {
      booking,
      razorpayOrder,
    };
  }

  // Verify Razorpay Payment and Confirm Booking
  async verifyPayment(data: {
    bookingId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { eventType: true },
    });

    if (!booking) {
      throw new Error("Booking not found.");
    }

    // Create HMAC verification signature
    const hmac = crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET);
    hmac.update(`${data.razorpayOrderId}|${data.razorpayPaymentId}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== data.razorpaySignature) {
      throw new Error("Payment signature verification failed.");
    }

    // Update status to confirmed
    const updatedBooking = await prisma.booking.update({
      where: { id: data.bookingId },
      data: { status: "confirmed" },
    });

    // Non-blocking queue dispatch for background processing
    Promise.all([
      emailQueue.add("booking-confirmation", {
        bookingId: booking.id,
        type: "booking-confirmation",
      }),
      calendarQueue.add("create-event", {
        bookingId: booking.id,
        action: "create-event",
      }),
      analyticsQueue.add("update-stats", {
        bookingId: booking.id,
      }),
    ]).catch((err) => {
      console.error("Background job queue dispatch error in verifyPayment:", err);
    });

    return updatedBooking;
  }

  // Retrieve bookings list for a specific host
  async getBookingsByHost(userId: string) {
    return this.bookingsRepository.getBookingsByHost(userId);
  }

  // Retrieve public event details and booked time ranges for a specific date override
  async getEventAndBookingsForPublic(username: string, slug: string, dateString?: string) {
    const hostUser = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
      },
    });

    if (!hostUser) {
      throw new Error("Host user not found.");
    }

    const eventType = await prisma.eventType.findFirst({
      where: {
        userId: hostUser.id,
        slug: { equals: slug, mode: "insensitive" },
      },
    });

    if (!eventType || !eventType.isActive) {
      throw new Error("Event type not found or inactive.");
    }

    let bookedSlots: Array<{ startTime: Date; endTime: Date }> = [];

    if (dateString) {
      const baseDate = new Date(`${dateString}T00:00:00Z`);
      const startWindow = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
      const endWindow = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);

      bookedSlots = await this.bookingsRepository.getBookingsByEventAndRange(
        eventType.id,
        startWindow,
        endWindow
      );
    }

    return {
      host: {
        firstName: hostUser.firstName,
        lastName: hostUser.lastName,
        imageUrl: hostUser.imageUrl,
        username: hostUser.username,
        timezone: hostUser.timezone,
      },
      eventType,
      bookedSlots,
    };
  }

  async getPublicBookingDetails(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        eventType: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                timezone: true,
              }
            }
          }
        }
      }
    });
    if (!booking) {
      throw new Error("Booking not found");
    }
    return booking;
  }

  async cancelBooking(bookingId: string, reason?: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: true }
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled.");
    }

    const eventType = booking.eventType;

    // Check if cancel is enabled
    if (eventType.cancelEnabled === false) {
      throw new Error("Cancellation is not allowed for this meeting type.");
    }

    // Check notice period
    const cancelNoticeMinutes = eventType.cancelNotice ?? 60;
    const startTimeMs = new Date(booking.startTime).getTime();
    if (startTimeMs - cancelNoticeMinutes * 60 * 1000 < Date.now()) {
      const noticeText = cancelNoticeMinutes % 1440 === 0
        ? `${cancelNoticeMinutes / 1440} day(s)`
        : cancelNoticeMinutes % 60 === 0
          ? `${cancelNoticeMinutes / 60} hour(s)`
          : `${cancelNoticeMinutes} minute(s)`;
      throw new Error(`Cannot cancel this booking. Minimum notice required is ${noticeText}.`);
    }

    const fields = (booking.bookingFieldsData as Record<string, any>) || {};
    if (reason) {
      fields.cancellationReason = reason;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
        bookingFieldsData: fields
      }
    });

    // Async non-blocking queue dispatches
    Promise.all([
      emailQueue.add("booking-confirmation", {
        bookingId: booking.id,
        type: "booking-cancellation",
      }),
      calendarQueue.add("delete-event", {
        bookingId: booking.id,
        action: "delete-event",
      }),
    ]).catch((err) => {
      console.error("Background job queue dispatch error in cancelBooking:", err);
    });

    return updatedBooking;
  }

  async rescheduleBooking(bookingId: string, newStartTime: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: { include: { user: true } } }
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("Cannot reschedule a cancelled booking.");
    }

    const eventType = booking.eventType;
    const hostUser = eventType.user;

    // Check if reschedule is enabled
    if (eventType.rescheduleEnabled === false) {
      throw new Error("Rescheduling is not allowed for this meeting type.");
    }

    // Check notice period for the original slot
    const rescheduleNoticeMinutes = eventType.rescheduleNotice ?? 60;
    const originalStartTimeMs = new Date(booking.startTime).getTime();
    if (originalStartTimeMs - rescheduleNoticeMinutes * 60 * 1000 < Date.now()) {
      const noticeText = rescheduleNoticeMinutes % 1440 === 0
        ? `${rescheduleNoticeMinutes / 1440} day(s)`
        : rescheduleNoticeMinutes % 60 === 0
          ? `${rescheduleNoticeMinutes / 60} hour(s)`
          : `${rescheduleNoticeMinutes} minute(s)`;
      throw new Error(`Cannot reschedule this booking. Minimum notice required is ${noticeText}.`);
    }

    // Now validate the new slot availability
    const start = new Date(newStartTime);
    const duration = eventType.duration;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const now = Date.now();

    // 1. Minimum Notice Validation for the new slot
    const minNoticeMinutes = eventType.minimumNotice ?? 120;
    if (start.getTime() < now + minNoticeMinutes * 60 * 1000) {
      throw new Error(
        `Cannot book on short notice. Minimum notice required is ${minNoticeMinutes} minutes.`
      );
    }

    // 2. Future Bookings Limit Validation
    if (eventType.limitFutureBookings) {
      const config = eventType.limitFutureBookings as any;
      if (config.enabled && config.days) {
        const maxFutureDate = now + config.days * 24 * 60 * 60 * 1000;
        if (start.getTime() > maxFutureDate) {
          throw new Error(
            `Cannot schedule events more than ${config.days} days in the future.`
          );
        }
      }
    }

    // 3. Availability Schedule Validation
    const availability = eventType.availability as Array<{
      day: string;
      enabled: boolean;
      slots: Array<{ startTime: string; endTime: string }>;
    }> | null;

    if (availability && availability.length > 0) {
      const hostTimezone = hostUser.timezone || "UTC";
      const weekdayName = start.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: hostTimezone,
      });

      const dayConfig = availability.find((a) => a.day === weekdayName);

      if (!dayConfig || !dayConfig.enabled) {
        throw new Error(
          `Bookings are not available on ${weekdayName}. Please choose an available day.`
        );
      }

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: hostTimezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(start);
      const pHour = parts.find((p) => p.type === "hour")?.value ?? "0";
      const pMinute = parts.find((p) => p.type === "minute")?.value ?? "0";

      const slotStartMinutes = (parseInt(pHour) % 24) * 60 + parseInt(pMinute);
      const slotEndMinutes = slotStartMinutes + duration;

      const fitsInASlot = dayConfig.slots?.some((slot) => {
        const windowStart = this.timeToMinutes(slot.startTime);
        const windowEnd = this.timeToMinutes(slot.endTime);
        return slotStartMinutes >= windowStart && slotEndMinutes <= windowEnd;
      });

      if (!fitsInASlot) {
        throw new Error(
          `The selected time is outside available hours for ${weekdayName}.`
        );
      }
    }

    // 4. Overlap, Seats, and Buffers Validation (excluding THIS booking)
    const beforeBuffer = eventType.beforeBuffer ?? 0;
    const afterBuffer = eventType.afterBuffer ?? 0;

    const startWindow = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const endWindow = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const conflictingBookings = await prisma.booking.findMany({
      where: {
        eventTypeId: eventType.id,
        status: { in: ["confirmed", "pending_payment"] },
        startTime: { gte: startWindow, lte: endWindow },
        id: { not: bookingId }, // exclude self
      },
    });

    if (eventType.seatsEnabled) {
      const exactTimeBookingsCount = conflictingBookings.filter(
        (b) => b.startTime.getTime() === start.getTime()
      ).length;

      if (exactTimeBookingsCount >= (eventType.seatsMax ?? 1)) {
        throw new Error("This slot is fully booked.");
      }
    } else {
      const hasOverlap = conflictingBookings.some((b) => {
        const bStart = b.startTime.getTime();
        const bEnd = b.endTime.getTime();
        const combinedAfterBuffer = afterBuffer * 60 * 1000;
        const combinedBeforeBuffer = beforeBuffer * 60 * 1000;

        return (
          start.getTime() < bEnd + combinedAfterBuffer &&
          end.getTime() > bStart - combinedBeforeBuffer
        );
      });

      if (hasOverlap) {
        throw new Error("This slot conflicts with an existing booking or buffer time.");
      }
    }

    // All validation passed! Perform reschedule
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: start,
        endTime: end,
      }
    });

    // Async non-blocking queue dispatches
    Promise.all([
      emailQueue.add("booking-confirmation", {
        bookingId: booking.id,
        type: "booking-confirmation",
      }),
      calendarQueue.add("update-event", {
        bookingId: booking.id,
        action: "update-event",
      }),
    ]).catch((err) => {
      console.error("Background job queue dispatch error in rescheduleBooking:", err);
    });

    return updatedBooking;
  }
}
