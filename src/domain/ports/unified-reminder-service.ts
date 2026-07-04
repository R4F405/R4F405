import type { Note } from '../entities/note.js';
import type { Reminder } from '../entities/reminder.js';

/**
 * Unified Reminder & Notes Service.
 *
 * Samsung Reminder/Notes has no public REST API, so this port abstracts the
 * capability instead of the vendor. Implementations can bridge through
 * Microsoft Graph (To Do + OneNote), a mock, or a future native integration —
 * the domain and use-cases never know which.
 */
export interface UnifiedReminderServicePort {
  createReminder(reminder: Reminder): Promise<{ externalId: string }>;
  completeReminder(externalId: string): Promise<void>;
  createNote(note: Note): Promise<{ externalId: string }>;
}
