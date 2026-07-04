import { describe, expect, it } from 'vitest';
import { CalendarEvent } from '../../../src/domain/entities/calendar-event.js';
import { ValidationError } from '../../../src/domain/errors.js';

const validProps = {
  id: 'evt-1',
  userId: 'user-1',
  title: 'Comprar café',
  startsAt: new Date('2026-07-05T08:00:00Z'),
  endsAt: new Date('2026-07-05T09:00:00Z'),
};

describe('CalendarEvent', () => {
  it('creates a valid event', () => {
    const event = CalendarEvent.create(validProps);
    expect(event.title).toBe('Comprar café');
    expect(event.externalId).toBeUndefined();
  });

  it('rejects an empty title', () => {
    expect(() => CalendarEvent.create({ ...validProps, title: '   ' })).toThrow(ValidationError);
  });

  it('rejects an event that ends before it starts', () => {
    expect(() =>
      CalendarEvent.create({ ...validProps, endsAt: new Date('2026-07-05T07:00:00Z') }),
    ).toThrow(ValidationError);
  });

  it('rejects invalid dates', () => {
    expect(() =>
      CalendarEvent.create({ ...validProps, startsAt: new Date('not-a-date') }),
    ).toThrow(ValidationError);
  });

  it('withExternalId returns a new synced instance', () => {
    const event = CalendarEvent.create(validProps);
    const synced = event.withExternalId('gcal-123');
    expect(synced.externalId).toBe('gcal-123');
    expect(event.externalId).toBeUndefined();
  });
});
