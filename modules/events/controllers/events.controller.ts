import type { Response } from "express";
import { EventsService } from "../services/events.service";
import type { AuthenticatedRequest } from "../../../common/middleware/auth.middleware";

export class EventsController {
  private eventsService: EventsService;

  constructor() {
    this.eventsService = new EventsService();
  }

  getEvents = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const events = await this.eventsService.getEventsByUserId(userId);
      return res.json({ events });
    } catch (error) {
      console.error("EventsController.getEvents error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  getEvent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string ;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const event = await this.eventsService.getEventById(id);
      if (!event) {
        return res.status(404).json({ error: "Event type not found" });
      }
      if (event.userId !== userId) {
        return res.status(403).json({ error: "Forbidden: You do not own this event type" });
      }

      return res.json({ event });
    } catch (error) {
      console.error("EventsController.getEvent error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  createEvent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { title, slug, duration, price } = req.body;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!title || !duration) {
        return res.status(400).json({ error: "Title and duration are required" });
      }

      const event = await this.eventsService.createEvent({
        userId,
        title,
        slug: slug || "",
        duration: parseInt(duration, 10),
        price: price ? parseFloat(price) : 0,
      });

      return res.status(201).json({ event });
    } catch (error: any) {
      console.error("EventsController.createEvent error:", error);
      return res.status(400).json({ error: error.message || "Bad Request" });
    }
  };

  updateEvent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;
      const updateData = req.body;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const event = await this.eventsService.updateEvent(id, userId, updateData);
      return res.json({ event });
    } catch (error: any) {
      console.error("EventsController.updateEvent error:", error);
      return res.status(400).json({ error: error.message || "Bad Request" });
    }
  };

  deleteEvent = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = req.params.id as string;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await this.eventsService.deleteEvent(id, userId);
      return res.json({ message: "Event type deleted successfully" });
    } catch (error: any) {
      console.error("EventsController.deleteEvent error:", error);
      return res.status(400).json({ error: error.message || "Bad Request" });
    }
  };
}
export default EventsController;
