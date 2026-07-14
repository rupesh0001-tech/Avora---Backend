import { prisma } from "../../../config/database";

export class UsersRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    timezone?: string;
    locale?: string;
  }) {
    return prisma.user.create({
      data: {
        id: data.id,
        email: data.email,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        imageUrl: data.imageUrl || null,
        timezone: data.timezone || "UTC",
        locale: data.locale || "en",
      },
    });
  }

  async update(id: string, data: Partial<{
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    timezone: string;
    locale: string;
  }>) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }
}
