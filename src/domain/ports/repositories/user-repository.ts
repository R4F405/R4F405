import type { User } from '../../entities/user.js';

export interface UserRepository {
  findByTelegramId(telegramId: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
