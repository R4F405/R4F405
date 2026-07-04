import { ValidationError } from '../errors.js';

export interface ReminderProps {
  readonly id: string;
  readonly userId: string;
  readonly content: string;
  /** Optional: external tasks (Microsoft To Do) may have no due date. */
  readonly dueAt?: Date;
  readonly completed: boolean;
  /** Id assigned by the external reminder service (Samsung/MS Graph bridge). */
  readonly externalId?: string;
}

export interface ExternalReminderState {
  readonly content: string;
  readonly dueAt?: Date;
  readonly completed: boolean;
}

export class Reminder {
  private constructor(private readonly props: ReminderProps) {}

  static create(props: ReminderProps): Reminder {
    if (!props.id) throw new ValidationError('Reminder id is required');
    if (!props.userId) throw new ValidationError('Reminder userId is required');
    if (!props.content.trim()) throw new ValidationError('Reminder content cannot be empty');
    if (props.dueAt && Number.isNaN(props.dueAt.getTime())) {
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

  /** Mirrors changes made in the external app (Samsung Reminder / To Do). */
  applyExternalState(state: ExternalReminderState): Reminder {
    return Reminder.create({
      ...this.props,
      content: state.content,
      dueAt: state.dueAt,
      completed: state.completed,
    });
  }

  differsFrom(state: ExternalReminderState): boolean {
    return (
      this.props.content !== state.content ||
      this.props.completed !== state.completed ||
      (this.props.dueAt?.getTime() ?? null) !== (state.dueAt?.getTime() ?? null)
    );
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

  get dueAt(): Date | undefined {
    return this.props.dueAt;
  }

  get completed(): boolean {
    return this.props.completed;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }
}
