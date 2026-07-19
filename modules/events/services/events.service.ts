import { EventsRepository } from "../repositories/events.repository";
import { prisma } from "../../../config/database";

const DEFAULT_BOOKING_FIELDS = [
  { id: "name", label: "Your name", type: "Name", status: "Required", editable: false },
  { id: "email", label: "Email address", type: "Email", status: "Required", editable: false },
  { id: "phone", label: "Phone number", type: "Phone", status: "Hidden", editable: true },
  { id: "about", label: "What is this meeting about?", type: "Short Text", status: "Hidden", editable: true },
  { id: "notes", label: "Additional notes", type: "Long Text", status: "Optional", editable: true },
  { id: "guests", label: "Add guests", type: "Multiple Emails", status: "Optional", editable: true },
  { id: "rescheduleReason", label: "Reason for reschedule", type: "Long Text", status: "Optional", editable: true }
];

export const DEFAULT_AVAILABILITY = [
  { day: "Monday", enabled: true, slots: [{ startTime: "09:00", endTime: "17:00" }] },
  { day: "Tuesday", enabled: true, slots: [{ startTime: "09:00", endTime: "17:00" }] },
  { day: "Wednesday", enabled: true, slots: [{ startTime: "09:00", endTime: "17:00" }] },
  { day: "Thursday", enabled: true, slots: [{ startTime: "09:00", endTime: "17:00" }] },
  { day: "Friday", enabled: true, slots: [{ startTime: "09:00", endTime: "17:00" }] },
  { day: "Saturday", enabled: false, slots: [] },
  { day: "Sunday", enabled: false, slots: [] }
];

export class EventsService {
  private eventsRepository: EventsRepository;

  constructor() {
    this.eventsRepository = new EventsRepository();
  }

  async getEventsByUserId(userId: string) {
    return this.eventsRepository.findManyByUserId(userId);
  }

  async getEventById(id: string) {
    return this.eventsRepository.findById(id);
  }

  async createEvent(data: {
    userId: string;
    title: string;
    slug: string;
    duration: number;
    price?: number;
  }) {
    // Check if slug is unique for this user
    let slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!slug) {
      slug = data.title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    }

    const existingEvent = await this.eventsRepository.findByUserAndSlug(data.userId, slug);
    if (existingEvent) {
      throw new Error(`An event type with slug "${slug}" already exists.`);
    }

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { availability: true }
    });
    const availability = user?.availability || DEFAULT_AVAILABILITY;

    return this.eventsRepository.create({
      ...data,
      slug,
      availability,
      bookingFields: DEFAULT_BOOKING_FIELDS,
    });
  }

  async updateEvent(id: string, userId: string, data: Partial<{
    title: string;
    slug: string;
    duration: number;
    price: number;
    isActive: boolean;
    locationType: string;
    locationDetails: string;
    availability: any;
    bookingFields: any;
    appearance: string;
  }>) {
    const existing = await this.eventsRepository.findById(id);
    if (!existing) {
      throw new Error("Event type not found");
    }
    if (existing.userId !== userId) {
      throw new Error("Unauthorized to edit this event type");
    }

    if (data.slug) {
      const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const duplicate = await this.eventsRepository.findByUserAndSlug(userId, slug);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`An event type with slug "${slug}" already exists.`);
      }
      data.slug = slug;
    }

    return this.eventsRepository.update(id, data);
  }

  async deleteEvent(id: string, userId: string) {
    const existing = await this.eventsRepository.findById(id);
    if (!existing) {
      throw new Error("Event type not found");
    }
    if (existing.userId !== userId) {
      throw new Error("Unauthorized to delete this event type");
    }
    return this.eventsRepository.delete(id);
  }
}
export default EventsService;
