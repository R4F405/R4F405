import { randomUUID } from 'node:crypto';
import type { CalendarEvent } from '../../domain/entities/calendar-event.js';
import type { CalendarProviderPort } from '../../domain/ports/calendar-provider.js';

/** Stand-in used when no Google credentials are configured. */
export class MockCalendarProvider implements CalendarProviderPort {
  async createEvent(event: CalendarEvent): Promise<{ externalId: string }> {
    const externalId = `mock-gcal-${randomUUID()}`;
    console.info(
      `[mock-calendar] created "${event.title}" at ${event.startsAt.toISOString()} (${externalId})`,
    );
    return { externalId };
  }

  async deleteEvent(externalId: string): Promise<void> {
    console.info(`[mock-calendar] deleted ${externalId}`);
  }
}
