import { ValidationError } from '../errors.js';

export interface NoteProps {
  readonly id: string;
  readonly userId: string;
  readonly content: string;
  readonly title?: string;
  readonly createdAt: Date;
  /** Id assigned by the external notes service (Samsung/MS Graph bridge). */
  readonly externalId?: string;
}

export class Note {
  private constructor(private readonly props: NoteProps) {}

  static create(props: NoteProps): Note {
    if (!props.id) throw new ValidationError('Note id is required');
    if (!props.userId) throw new ValidationError('Note userId is required');
    if (!props.content.trim()) throw new ValidationError('Note content cannot be empty');
    return new Note({ ...props });
  }

  withExternalId(externalId: string): Note {
    return new Note({ ...this.props, externalId });
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

  get title(): string | undefined {
    return this.props.title;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get externalId(): string | undefined {
    return this.props.externalId;
  }
}
