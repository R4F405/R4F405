import { CalendarEvent } from '../domain/entities/calendar-event.js';
import type { CreateCalendarEventIntent } from '../domain/entities/memory-intent.js';
import type { User } from '../domain/entities/user.js';
import type { CalendarProviderPort } from '../domain/ports/calendar-provider.js';
import type { IdGenerator } from '../domain/ports/id-generator.js';
import type { CalendarEventRepository } from '../domain/ports/repositories/calendar-event-repository.js';

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export class CreateCalendarEventUseCase {
  constructor(
    private readonly events: CalendarEventRepository,
    private readonly calendar: CalendarProviderPort,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(user: User, intent: CreateCalendarEventIntent): Promise<CalendarEvent> {
    const endsAt = intent.endsAt ?? new Date(intent.startsAt.getTime() + DEFAULT_DURATION_MS);

    const event = CalendarEvent.create({
      id: this.idGenerator.generate(),
      userId: user.id,
      title: intent.title,
      startsAt: intent.startsAt,
      endsAt,
      description: intent.description,
      location: intent.location,
    });

    const { externalId } = await this.calendar.createEvent(event);
    const synced = event.withExternalId(externalId);
    await this.events.save(synced);
    return synced;
  }
}
