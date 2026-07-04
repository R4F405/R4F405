import { randomUUID } from 'node:crypto';
import type { Note } from '../../domain/entities/note.js';
import type { Reminder } from '../../domain/entities/reminder.js';
import type {
  ExternalReminderSnapshot,
  UnifiedReminderServicePort,
} from '../../domain/ports/unified-reminder-service.js';

/**
 * Stand-in used when no Microsoft Graph credentials are configured.
 * Stateful, so the bidirectional sync flow works end-to-end in dev and tests:
 * `simulateExternalReminder` plays the role of the user typing directly into
 * Samsung Reminder / To Do on their phone.
 */
export class InMemoryReminderService implements UnifiedReminderServicePort {
  private readonly external = new Map<string, ExternalReminderSnapshot>();

  async createReminder(reminder: Reminder): Promise<{ externalId: string }> {
    const externalId = `mock-reminder-${randomUUID()}`;
    this.external.set(externalId, {
      externalId,
      content: reminder.content,
      dueAt: reminder.dueAt,
      completed: reminder.completed,
    });
    console.info(
      `[mock-reminders] created "${reminder.content}"${
        reminder.dueAt ? ` due ${reminder.dueAt.toISOString()}` : ''
      } (${externalId})`,
    );
    return { externalId };
  }

  async completeReminder(externalId: string): Promise<void> {
    const existing = this.external.get(externalId);
    if (existing) {
      this.external.set(externalId, { ...existing, completed: true });
    }
    console.info(`[mock-reminders] completed ${externalId}`);
  }

  async listReminders(): Promise<ExternalReminderSnapshot[]> {
    return [...this.external.values()];
  }

  async createNote(note: Note): Promise<{ externalId: string }> {
    const externalId = `mock-note-${randomUUID()}`;
    console.info(`[mock-reminders] created note "${note.title ?? note.content}" (${externalId})`);
    return { externalId };
  }

  /** Test/dev helper: acts as if the user created/edited a task on the phone. */
  simulateExternalReminder(snapshot: ExternalReminderSnapshot): void {
    this.external.set(snapshot.externalId, snapshot);
  }
}
