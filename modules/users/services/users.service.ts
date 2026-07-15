import { UsersRepository } from "../repositories/users.repository";

export class UsersService {
  private usersRepository: UsersRepository;

  constructor() {
    this.usersRepository = new UsersRepository();
  }

  async getUserById(id: string) {
    return this.usersRepository.findById(id);
  }

  async getUserByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async createUser(data: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    timezone?: string;
    locale?: string;
  }) {
    return this.usersRepository.create(data);
  }

  async getUserByUsername(username: string) {
    return this.usersRepository.findByUsername(username);
  }

  async updateUser(id: string, data: Partial<{
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    timezone: string;
    locale: string;
  }>) {
    return this.usersRepository.update(id, data);
  }
}
