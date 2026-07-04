import type { CalendarEvent } from '../entities/calendar-event.js';

/** Driven port for an external calendar (Google Calendar today). */
export interface CalendarProviderPort {
  createEvent(event: CalendarEvent): Promise<{ externalId: string }>;
  deleteEvent(externalId: string): Promise<void>;
}
