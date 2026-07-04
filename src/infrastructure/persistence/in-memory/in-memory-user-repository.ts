import type { User } from '../../../domain/entities/user.js';
import type { UserRepository } from '../../../domain/ports/repositories/user-repository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly byTelegramId = new Map<string, User>();

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.byTelegramId.get(telegramId) ?? null;
  }

  async save(user: User): Promise<void> {
    this.byTelegramId.set(user.telegramId, user);
  }
}
