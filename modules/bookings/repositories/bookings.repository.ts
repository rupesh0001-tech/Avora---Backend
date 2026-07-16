import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database";

export class BookingsRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  // Create a new booking
  async createBooking(data: {
    eventTypeId: string;
    startTime: Date;
    endTime: Date;
    attendeeName: string;
    attendeeEmail: string;
    attendeePhone?: string;
    bookingFieldsData?: any;
    status?: string;
  }) {
    return this.prisma.booking.create({
      data: {
        eventTypeId: data.eventTypeId,
        startTime: data.startTime,
        endTime: data.endTime,
        attendeeName: data.attendeeName,
        attendeeEmail: data.attendeeEmail,
        attendeePhone: data.attendeePhone,
        bookingFieldsData: data.bookingFieldsData,
        status: data.status || "confirmed",
      },
      include: {
        eventType: true,
      },
    });
  }

  // List all bookings for an event host
  async getBookingsByHost(userId: string) {
    return this.prisma.booking.findMany({
      where: {
        eventType: {
          userId,
        },
      },
      include: {
        eventType: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });
  }

  // Get booked slots for an event type on a specific day range
  async getBookingsByEventAndRange(eventTypeId: string, startRange: Date, endRange: Date) {
    return this.prisma.booking.findMany({
      where: {
        eventTypeId,
        status: "confirmed",
        startTime: {
          gte: startRange,
          lt: endRange,
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });
  }
}
