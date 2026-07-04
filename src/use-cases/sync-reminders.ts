import { Reminder } from '../domain/entities/reminder.js';
import type { User } from '../domain/entities/user.js';
import type { IdGenerator } from '../domain/ports/id-generator.js';
import type { ReminderRepository } from '../domain/ports/repositories/reminder-repository.js';
import type { UnifiedReminderServicePort } from '../domain/ports/unified-reminder-service.js';

export interface SyncRemindersResult {
  readonly created: number;
  readonly updated: number;
}

/**
 * Inbound half of the bidirectional reminder sync.
 *
 * Pulls the current state of the external reminder app (Samsung Reminder via
 * Microsoft To Do) and upserts it into Memorae's repository, keyed by
 * externalId:
 *  - tasks created directly on the phone become new Reminders owned by `user`
 *  - tasks already known (including ones the bot created) are updated when
 *    their content, due date or completion changed externally
 */
export class SyncRemindersUseCase {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly reminderService: UnifiedReminderServicePort,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(user: User): Promise<SyncRemindersResult> {
    const snapshots = await this.reminderService.listReminders();
    let created = 0;
    let updated = 0;

    for (const snapshot of snapshots) {
      if (!snapshot.content.trim()) continue;

      const existing = await this.reminders.findByExternalId(snapshot.externalId);
      if (existing) {
        if (existing.differsFrom(snapshot)) {
          await this.reminders.save(existing.applyExternalState(snapshot));
          updated += 1;
        }
        continue;
      }

      await this.reminders.save(
        Reminder.create({
          id: this.idGenerator.generate(),
          userId: user.id,
          content: snapshot.content,
          dueAt: snapshot.dueAt,
          completed: snapshot.completed,
          externalId: snapshot.externalId,
        }),
      );
      created += 1;
    }

    return { created, updated };
  }
}
