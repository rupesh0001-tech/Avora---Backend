import type { Request, Response } from "express";
import { UsersService } from "../services/users.service";
import type { AuthenticatedRequest } from "../../../common/middleware/auth.middleware";
import { DEFAULT_AVAILABILITY } from "../../events/services/events.service";

export class UsersController {
  private usersService: UsersService;

  constructor() {
    this.usersService = new UsersService();
  }

  // GET /api/users/username/check?username=xyz
  checkUsername = async (req: Request, res: Response) => {
    try {
      const username = (req.query.username as string || "").trim().toLowerCase();

      if (!username) {
        return res.status(400).json({ error: "Username query parameter is required" });
      }

      // Regex for username: letters, numbers, underscores, hyphens, 3-30 chars
      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ 
          error: "Invalid username format. Must be 3-30 characters containing only letters, numbers, underscores, or hyphens." 
        });
      }

      const existingUser = await this.usersService.getUserByUsername(username);
      return res.json({ available: !existingUser });
    } catch (error) {
      console.error("UsersController.checkUsername error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // PUT /api/users/username (body: { username })
  updateUsername = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const username = (req.body.username as string || "").trim().toLowerCase();

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ 
          error: "Invalid username format. Must be 3-30 characters containing only letters, numbers, underscores, or hyphens." 
        });
      }

      // Check if username is already taken
      const existingUser = await this.usersService.getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Username is already taken" });
      }

      const updatedUser = await this.usersService.updateUser(userId, { username });
      return res.json({ user: updatedUser });
    } catch (error) {
      console.error("UsersController.updateUsername error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // PUT /api/users/profile
  updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { firstName, lastName, timezone, locale } = req.body;

      const updatedUser = await this.usersService.updateUser(userId, {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        timezone: timezone !== undefined ? timezone : undefined,
        locale: locale !== undefined ? locale : undefined,
      });

      return res.json({ user: updatedUser });
    } catch (error) {
      console.error("UsersController.updateProfile error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // GET /api/users/availability
  getAvailability = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await this.usersService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const availability = user.availability || DEFAULT_AVAILABILITY;
      return res.json({ availability });
    } catch (error) {
      console.error("UsersController.getAvailability error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  // PUT /api/users/availability
  updateAvailability = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { availability, timezone } = req.body;
      if (!availability || !Array.isArray(availability)) {
        return res.status(400).json({ error: "Availability array is required" });
      }

      const updatedUser = await this.usersService.updateUser(userId, {
        availability,
        timezone,
      });

      return res.json({ user: updatedUser });
    } catch (error) {
      console.error("UsersController.updateAvailability error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
}
