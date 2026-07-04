import type { Reminder } from '../../entities/reminder.js';

export interface ReminderRepository {
  save(reminder: Reminder): Promise<void>;
  findById(id: string): Promise<Reminder | null>;
  findByExternalId(externalId: string): Promise<Reminder | null>;
  findPendingByUserId(userId: string): Promise<Reminder[]>;
}
