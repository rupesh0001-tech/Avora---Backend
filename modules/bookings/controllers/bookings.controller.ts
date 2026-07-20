import type { Request, Response } from "express";
import { BookingsService } from "../services/bookings.service";
import { emailQueue, calendarQueue, analyticsQueue } from "../../../queues/booking-queues";

const bookingsService = new BookingsService();

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

    if (booking.status === "confirmed") {
      await emailQueue.add("booking-confirmation", {
        bookingId: booking.id,
        type: "booking-confirmation",
      });

      await calendarQueue.add("create-event", {
        bookingId: booking.id,
        action: "create-event",
      });

      await analyticsQueue.add("update-stats", {
        bookingId: booking.id,
      });
    }

    return res.status(201).json({ success: true, booking, razorpayOrder });
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
    const { newStartTime } = req.body;
    const booking = await bookingsService.rescheduleBooking(bookingId as string, newStartTime);
    return res.status(200).json({ success: true, booking });
  } catch (err: any) {
    console.error("Error rescheduling booking:", err);
    return res.status(400).json({ error: err.message || "Failed to reschedule booking." });
  }
}
