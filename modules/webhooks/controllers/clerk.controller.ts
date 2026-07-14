import { Request, Response } from "express";
import { Webhook } from "svix";
import { UsersRepository } from "../../users/repositories/users.repository";

export class ClerkWebhookController {
  private usersRepository: UsersRepository;

  constructor() {
    this.usersRepository = new UsersRepository();
  }

  async handleWebhook(req: Request, res: Response) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("⚠️ Warning: CLERK_WEBHOOK_SECRET is not configured. Webhook processing skipped signature verification.");
    }

    const headers = req.headers;
    const svixId = headers["svix-id"] as string;
    const svixTimestamp = headers["svix-timestamp"] as string;
    const svixSignature = headers["svix-signature"] as string;

    // Check payload
    let payload = req.body;
    // If body is already parsed as JSON, we need the raw string body for svix verification
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);

    if (webhookSecret && (!svixId || !svixTimestamp || !svixSignature)) {
      return res.status(400).json({ error: "Missing required svix headers" });
    }

    let evt: any;

    if (webhookSecret) {
      try {
        const wh = new Webhook(webhookSecret);
        evt = wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch (err) {
        console.error("Clerk Webhook verification failed:", err);
        return res.status(400).json({ error: "Webhook verification failed" });
      }
    } else {
      // Direct parse in dev mode when secret is not configured
      evt = typeof payload === "string" ? JSON.parse(payload) : payload;
    }

    const { type, data } = evt;
    console.log(`Received Clerk Webhook: ${type}`);

    try {
      switch (type) {
        case "user.created": {
          const email = data.email_addresses?.[0]?.email_address;
          if (!email) {
            return res.status(400).json({ error: "Webhook data missing user email" });
          }

          const existingUser = await this.usersRepository.findById(data.id);
          if (!existingUser) {
            await this.usersRepository.create({
              id: data.id,
              email: email,
              firstName: data.first_name,
              lastName: data.last_name,
              imageUrl: data.image_url,
            });
            console.log(`Created user ${email} via Webhook`);
          }
          break;
        }

        case "user.updated": {
          const email = data.email_addresses?.[0]?.email_address;
          await this.usersRepository.update(data.id, {
            firstName: data.first_name,
            lastName: data.last_name,
            imageUrl: data.image_url,
          });
          console.log(`Updated user ${email || data.id} via Webhook`);
          break;
        }

        case "user.deleted": {
          await this.usersRepository.delete(data.id);
          console.log(`Deleted user ${data.id} via Webhook`);
          break;
        }

        default:
          console.log(`Unhandled Clerk webhook event type: ${type}`);
      }

      return res.json({ success: true });
    } catch (error) {
      console.error(`Error processing Clerk webhook event ${type}:`, error);
      return res.status(500).json({ error: "Error processing webhook event" });
    }
  }
}
