import type { CreateReminderIntent } from '../domain/entities/memory-intent.js';
import { Reminder } from '../domain/entities/reminder.js';
import type { User } from '../domain/entities/user.js';
import type { IdGenerator } from '../domain/ports/id-generator.js';
import type { ReminderRepository } from '../domain/ports/repositories/reminder-repository.js';
import type { UnifiedReminderServicePort } from '../domain/ports/unified-reminder-service.js';

export class CreateReminderUseCase {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly reminderService: UnifiedReminderServicePort,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(user: User, intent: CreateReminderIntent): Promise<Reminder> {
    const reminder = Reminder.create({
      id: this.idGenerator.generate(),
      userId: user.id,
      content: intent.content,
      dueAt: intent.dueAt,
      completed: false,
    });

    const { externalId } = await this.reminderService.createReminder(reminder);
    const synced = reminder.withExternalId(externalId);
    await this.reminders.save(synced);
    return synced;
  }
}
