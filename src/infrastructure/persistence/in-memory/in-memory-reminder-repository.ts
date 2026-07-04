import type { Reminder } from '../../../domain/entities/reminder.js';
import type { ReminderRepository } from '../../../domain/ports/repositories/reminder-repository.js';

export class InMemoryReminderRepository implements ReminderRepository {
  private readonly byId = new Map<string, Reminder>();

  async save(reminder: Reminder): Promise<void> {
    this.byId.set(reminder.id, reminder);
  }

  async findById(id: string): Promise<Reminder | null> {
    return this.byId.get(id) ?? null;
  }

  async findPendingByUserId(userId: string): Promise<Reminder[]> {
    return [...this.byId.values()].filter(
      (reminder) => reminder.userId === userId && !reminder.completed,
    );
  }
}
