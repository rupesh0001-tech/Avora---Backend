import Razorpay from "razorpay";
import { env } from "../../../config/env";
import { BookingsRepository } from "../repositories/bookings.repository";
import { prisma } from "../../../config/database";

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || "rzp_test_12345",
  key_secret: env.RAZORPAY_KEY_SECRET || "razorpay_secret_12345",
});

export class BookingsService {
  private bookingsRepository: BookingsRepository;

  constructor() {
    this.bookingsRepository = new BookingsRepository();
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
    });

    if (!eventType || !eventType.isActive) {
      throw new Error("Event type not found or inactive.");
    }

    const start = new Date(data.startTime);
    const end = new Date(start.getTime() + eventType.duration * 60 * 1000);

    const isPaid = eventType.price > 0;
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
    if (isPaid) {
      try {
        const order = await razorpay.orders.create({
          amount: Math.round(eventType.price * 100), // in paise
          currency: "INR",
          receipt: booking.id,
          notes: {
            bookingId: booking.id,
          },
        });
        razorpayOrder = {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: env.RAZORPAY_KEY_ID || "rzp_test_12345",
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

  // Retrieve bookings list for a specific host
  async getBookingsByHost(userId: string) {
    return this.bookingsRepository.getBookingsByHost(userId);
  }

  // Retrieve public event details and booked time ranges for a specific date override
  async getEventAndBookingsForPublic(username: string, slug: string, dateString?: string) {
    // 1. Fetch host user
    const hostUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!hostUser) {
      throw new Error("Host user not found.");
    }

    // 2. Fetch specific event type
    const eventType = await prisma.eventType.findUnique({
      where: {
        userId_slug: {
          userId: hostUser.id,
          slug,
        },
      },
    });

    if (!eventType || !eventType.isActive) {
      throw new Error("Event type not found or inactive.");
    }

    let bookedSlots: Array<{ startTime: Date; endTime: Date }> = [];

    // 3. If specific date is query-filtered, get booked ranges
    if (dateString) {
      const startOfDay = new Date(`${dateString}T00:00:00Z`);
      const endOfDay = new Date(`${dateString}T23:59:59Z`);

      bookedSlots = await this.bookingsRepository.getBookingsByEventAndRange(
        eventType.id,
        startOfDay,
        endOfDay
      );
    }

    return {
      host: {
        firstName: hostUser.firstName,
        lastName: hostUser.lastName,
        imageUrl: hostUser.imageUrl,
        username: hostUser.username,
      },
      eventType,
      bookedSlots,
    };
  }
}
