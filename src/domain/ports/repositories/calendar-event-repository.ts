import type { CalendarEvent } from '../../entities/calendar-event.js';

export interface CalendarEventRepository {
  save(event: CalendarEvent): Promise<void>;
  findById(id: string): Promise<CalendarEvent | null>;
  findByUserId(userId: string): Promise<CalendarEvent[]>;
}
