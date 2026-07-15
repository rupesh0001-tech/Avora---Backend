import { prisma } from "../../../config/database";

export class EventsRepository {
  async findManyByUserId(userId: string) {
    return prisma.eventType.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.eventType.findUnique({
      where: { id },
    });
  }

  async findByUserAndSlug(userId: string, slug: string) {
    return prisma.eventType.findFirst({
      where: { userId, slug },
    });
  }

  async create(data: {
    userId: string;
    title: string;
    slug: string;
    duration: number;
    price?: number;
    isActive?: boolean;
    locationType?: string;
    locationDetails?: string;
    availability?: any;
    bookingFields?: any;
    appearance?: string;
  }) {
    return prisma.eventType.create({
      data: {
        userId: data.userId,
        title: data.title,
        slug: data.slug,
        duration: data.duration,
        price: data.price ?? 0,
        isActive: data.isActive ?? true,
        locationType: data.locationType ?? "Video",
        locationDetails: data.locationDetails ?? "Google Meet",
        availability: data.availability ?? null,
        bookingFields: data.bookingFields ?? null,
        appearance: data.appearance ?? "classic",
      },
    });
  }

  async update(id: string, data: Partial<{
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
    return prisma.eventType.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.eventType.delete({
      where: { id },
    });
  }
}
export default EventsRepository;
