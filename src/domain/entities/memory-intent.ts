/**
 * MemoryIntent is the actionable interpretation of a raw user utterance.
 * One message may produce several intents, e.g.
 * "Recuérdame mañana a las 10am comprar café y anótalo en el calendario"
 * yields a `create_reminder` AND a `create_calendar_event`.
 */

export interface CreateCalendarEventIntent {
  readonly type: 'create_calendar_event';
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt?: Date;
  readonly description?: string;
  readonly location?: string;
}

export interface CreateReminderIntent {
  readonly type: 'create_reminder';
  readonly content: string;
  readonly dueAt: Date;
}

export interface CreateNoteIntent {
  readonly type: 'create_note';
  readonly content: string;
  readonly title?: string;
}

/** Emitted when the utterance is not actionable or could not be understood. */
export interface UnknownIntent {
  readonly type: 'unknown';
  readonly reason: string;
}

export type MemoryIntent =
  | CreateCalendarEventIntent
  | CreateReminderIntent
  | CreateNoteIntent
  | UnknownIntent;

/** Full result of interpreting one user message. */
export interface IntentExtraction {
  readonly intents: readonly MemoryIntent[];
  /** Natural-language reply drafted in the user's own language. */
  readonly reply: string;
}
