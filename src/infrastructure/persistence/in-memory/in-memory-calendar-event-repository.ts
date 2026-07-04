import type { CalendarEvent } from '../../../domain/entities/calendar-event.js';
import type { CalendarEventRepository } from '../../../domain/ports/repositories/calendar-event-repository.js';

export class InMemoryCalendarEventRepository implements CalendarEventRepository {
  private readonly byId = new Map<string, CalendarEvent>();

  async save(event: CalendarEvent): Promise<void> {
    this.byId.set(event.id, event);
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    return this.byId.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<CalendarEvent[]> {
    return [...this.byId.values()].filter((event) => event.userId === userId);
  }
}
