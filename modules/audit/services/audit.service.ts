import { prisma } from "../../../config/database";

export class AuditService {
  static async logEvent(params: {
    userId?: string;
    bookingId?: string;
    action: string;
    details?: any;
  }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          bookingId: params.bookingId || null,
          action: params.action,
          details: params.details || null,
        },
      });
    } catch (err) {
      console.error("[AuditService] Failed to record audit log:", err);
    }
  }
}
