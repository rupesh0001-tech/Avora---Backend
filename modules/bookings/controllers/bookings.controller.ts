import type { Request, Response } from "express";
import { BookingsService } from "../services/bookings.service";

const bookingsService = new BookingsService();

export async function createBooking(req: Request, res: Response) {
  try {
    const { eventTypeId, startTime, attendeeName, attendeeEmail, attendeePhone, bookingFieldsData } = req.body;

    if (!eventTypeId || !startTime || !attendeeName || !attendeeEmail) {
      return res.status(400).json({ error: "Missing required booking details." });
    }

    const booking = await bookingsService.createBooking({
      eventTypeId,
      startTime,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      bookingFieldsData,
    });

    return res.status(201).json({ success: true, booking });
  } catch (err: any) {
    console.error("Error creating booking:", err);
    return res.status(500).json({ error: err.message || "Failed to create booking." });
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
