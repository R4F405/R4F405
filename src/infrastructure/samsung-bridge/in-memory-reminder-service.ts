import { randomUUID } from 'node:crypto';
import type { Note } from '../../domain/entities/note.js';
import type { Reminder } from '../../domain/entities/reminder.js';
import type { UnifiedReminderServicePort } from '../../domain/ports/unified-reminder-service.js';

/** Stand-in used when no Microsoft Graph credentials are configured. */
export class InMemoryReminderService implements UnifiedReminderServicePort {
  private readonly completed = new Set<string>();

  async createReminder(reminder: Reminder): Promise<{ externalId: string }> {
    const externalId = `mock-reminder-${randomUUID()}`;
    console.info(
      `[mock-reminders] created "${reminder.content}" due ${reminder.dueAt.toISOString()} (${externalId})`,
    );
    return { externalId };
  }

  async completeReminder(externalId: string): Promise<void> {
    this.completed.add(externalId);
    console.info(`[mock-reminders] completed ${externalId}`);
  }

  async createNote(note: Note): Promise<{ externalId: string }> {
    const externalId = `mock-note-${randomUUID()}`;
    console.info(`[mock-reminders] created note "${note.title ?? note.content}" (${externalId})`);
    return { externalId };
  }
}
