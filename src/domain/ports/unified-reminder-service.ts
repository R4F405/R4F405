import type { Note } from '../entities/note.js';
import type { Reminder } from '../entities/reminder.js';

/** Read model of a reminder as it exists in the external app. */
export interface ExternalReminderSnapshot {
  readonly externalId: string;
  readonly content: string;
  readonly dueAt?: Date;
  readonly completed: boolean;
}

/**
 * Unified Reminder & Notes Service.
 *
 * Samsung Reminder/Notes has no public REST API, so this port abstracts the
 * capability instead of the vendor. Implementations can bridge through
 * Microsoft Graph (To Do + OneNote), a mock, or a future native integration —
 * the domain and use-cases never know which.
 *
 * The port is bidirectional for reminders: `listReminders` exposes tasks the
 * user created or changed directly in the external app (e.g. Samsung Reminder
 * on their phone), so Memorae can ingest them.
 */
export interface UnifiedReminderServicePort {
  createReminder(reminder: Reminder): Promise<{ externalId: string }>;
  completeReminder(externalId: string): Promise<void>;
  listReminders(): Promise<ExternalReminderSnapshot[]>;
  createNote(note: Note): Promise<{ externalId: string }>;
}
