import { ValidationError } from '../errors.js';

export interface CalendarEventProps {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly description?: string;
  readonly location?: string;
  /** Id assigned by the external calendar provider once synced. */
  readonly externalId?: string;
}

export class CalendarEvent {
  private constructor(private readonly props: CalendarEventProps) {}

  static create(props: CalendarEventProps): CalendarEvent {
    if (!props.id) throw new ValidationError('CalendarEvent id is required');
    if (!props.userId) throw new ValidationError('CalendarEvent userId is required');
    if (!props.title.trim()) throw new ValidationError('CalendarEvent title cannot be empty');
    if (Number.isNaN(props.startsAt.getTime()) || Number.isNaN(props.endsAt.getTime())) {
      throw new ValidationError('CalendarEvent dates must be valid');
    }
    if (props.endsAt.getTime() <= props.startsAt.getTime()) {
      throw new ValidationError('CalendarEvent must end after it starts');
    }
    return new CalendarEvent({ ...props });
  }

  withExternalId(externalId: string): CalendarEvent {
    return new CalendarEvent({ ...this.props, externalId });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get title(): string {
    return this.props.title;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get location(): string | undefined {
    return this.props.location;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }
}
