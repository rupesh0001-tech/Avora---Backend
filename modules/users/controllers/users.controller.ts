import type { Request, Response } from "express";
import { UsersService } from "../services/users.service";
import type { AuthenticatedRequest } from "../../../common/middleware/auth.middleware";

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
}
