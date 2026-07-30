import type { Request, Response } from "express";
import { BookingsService } from "../services/bookings.service";
import { emailQueue, calendarQueue, analyticsQueue } from "../../../queues/booking-queues";
import { generateBookingToken, verifyBookingToken } from "../../../common/utils/security";
import { prisma } from "../../../config/database";

const bookingsService = new BookingsService();

// Authorization helper to check if requester is host OR has valid cancellation token
async function isAuthorizedForBooking(req: Request, bookingId: string): Promise<boolean> {
  const token = (req.query.token as string) || (req.body.token as string);
  
  // 1. Try token verification
  if (token && verifyBookingToken(bookingId, token)) {
    return true;
  }
  
  // 2. Try host authentication verification
  const userId = (req as any).user?.id || (req as any).auth?.userId;
  if (userId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: true }
    });
    if (booking && booking.eventType.userId === userId) {
      return true;
    }
  }
  
  return false;
}

export async function createBooking(req: Request, res: Response) {
  try {
    const { eventTypeId, startTime, attendeeName, attendeeEmail, attendeePhone, bookingFieldsData } = req.body;

    if (!eventTypeId || !startTime || !attendeeName || !attendeeEmail) {
      return res.status(400).json({ error: "Missing required booking details." });
    }

    const bookingTime = new Date(startTime).getTime();
    if (isNaN(bookingTime)) {
      return res.status(400).json({ error: "Invalid booking start time format." });
    }

    if (bookingTime < Date.now()) {
      return res.status(400).json({ error: "Cannot book a time slot in the past." });
    }

    const { booking, razorpayOrder } = await bookingsService.createBooking({
      eventTypeId,
      startTime,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      bookingFieldsData,
    });

    const token = generateBookingToken(booking.id);

    if (booking.status === "confirmed") {
      // Async non-blocking dispatch to Redis queues for clean worker architecture
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
        console.error("Background job queue dispatch error:", err);
      });
    }

    return res.status(201).json({ success: true, booking, razorpayOrder, token });
  } catch (err: any) {
    console.error("Error creating booking:", err);
    const isValidationError =
      err.message?.includes("not available on") ||
      err.message?.includes("outside available hours") ||
      err.message?.includes("not found or inactive") ||
      err.message?.includes("in the past");
    return res
      .status(isValidationError ? 400 : 500)
      .json({ error: err.message || "Failed to create booking." });
  }
}

export async function getHostBookings(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized host access." });
    }

    const bookings = await bookingsService.getBookingsByHost(userId);
    return res.status(200).json({ success: true, bookings });
  } catch (err: any) {
    console.error("Error fetching host bookings:", err);
    return res.status(500).json({ error: "Failed to fetch bookings list." });
  }
}

export async function getPublicEventDetails(req: Request, res: Response) {
  try {
    const { username, slug } = req.params;
    const dateString = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!username || !slug) {
      return res.status(400).json({ error: "Missing username or event slug parameters." });
    }

    const details = await bookingsService.getEventAndBookingsForPublic(username as string, slug as string, dateString);
    return res.status(200).json({ success: true, ...details });
  } catch (err: any) {
    console.error("Error fetching public event details:", err);
    return res.status(404).json({ error: err.message || "Failed to load event details." });
  }
}

export async function verifyPayment(req: Request, res: Response) {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: "Missing required payment verification details." });
    }

    const booking = await bookingsService.verifyPayment({
      bookingId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    return res.status(200).json({ success: true, booking });
  } catch (err: any) {
    console.error("Payment verification error:", err);
    return res.status(400).json({ error: err.message || "Payment verification failed." });
  }
}

export async function getPublicBookingDetails(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    if (!(await isAuthorizedForBooking(req, bookingId))) {
      return res.status(403).json({ error: "Forbidden: Invalid or missing authorization token." });
    }

    const booking = await bookingsService.getPublicBookingDetails(bookingId as string);
    return res.status(200).json({ success: true, booking });
  } catch (err: any) {
    console.error("Error fetching public booking details:", err);
    return res.status(404).json({ error: err.message || "Booking not found." });
  }
}

export async function cancelBooking(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    if (!(await isAuthorizedForBooking(req, bookingId))) {
      return res.status(403).json({ error: "Forbidden: Invalid or missing authorization token." });
    }

    const { reason } = req.body;
    const booking = await bookingsService.cancelBooking(bookingId as string, reason);
    return res.status(200).json({ success: true, booking });
  } catch (err: any) {
    console.error("Error cancelling booking:", err);
    return res.status(400).json({ error: err.message || "Failed to cancel booking." });
  }
}

export async function rescheduleBooking(req: Request, res: Response) {
  try {
    const { bookingId } = req.params;
    if (!(await isAuthorizedForBooking(req, bookingId))) {
      return res.status(403).json({ error: "Forbidden: Invalid or missing authorization token." });
    }

    const { newStartTime } = req.body;
    const booking = await bookingsService.rescheduleBooking(bookingId as string, newStartTime);
    return res.status(200).json({ success: true, booking });
  } catch (err: any) {
    console.error("Error rescheduling booking:", err);
    return res.status(400).json({ error: err.message || "Failed to reschedule booking." });
  }
}
