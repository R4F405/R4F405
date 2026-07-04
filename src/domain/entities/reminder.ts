import { ValidationError } from '../errors.js';

export interface ReminderProps {
  readonly id: string;
  readonly userId: string;
  readonly content: string;
  readonly dueAt: Date;
  readonly completed: boolean;
  /** Id assigned by the external reminder service (Samsung/MS Graph bridge). */
  readonly externalId?: string;
}

export class Reminder {
  private constructor(private readonly props: ReminderProps) {}

  static create(props: ReminderProps): Reminder {
    if (!props.id) throw new ValidationError('Reminder id is required');
    if (!props.userId) throw new ValidationError('Reminder userId is required');
    if (!props.content.trim()) throw new ValidationError('Reminder content cannot be empty');
    if (Number.isNaN(props.dueAt.getTime())) {
      throw new ValidationError('Reminder dueAt must be a valid date');
    }
    return new Reminder({ ...props });
  }

  withExternalId(externalId: string): Reminder {
    return new Reminder({ ...this.props, externalId });
  }

  complete(): Reminder {
    return new Reminder({ ...this.props, completed: true });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get content(): string {
    return this.props.content;
  }

  get dueAt(): Date {
    return this.props.dueAt;
  }

  get completed(): boolean {
    return this.props.completed;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }
}
