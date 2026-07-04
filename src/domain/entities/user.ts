import { ValidationError } from '../errors.js';

export interface UserProps {
  readonly id: string;
  readonly telegramId: string;
  readonly displayName: string;
  /** BCP 47 tag, e.g. "es-ES". Drives reply formatting. */
  readonly locale: string;
  /** IANA time zone, e.g. "Europe/Madrid". Drives date resolution. */
  readonly timeZone: string;
  readonly createdAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: UserProps): User {
    if (!props.id) throw new ValidationError('User id is required');
    if (!props.telegramId) throw new ValidationError('User telegramId is required');
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get telegramId(): string {
    return this.props.telegramId;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get locale(): string {
    return this.props.locale;
  }

  get timeZone(): string {
    return this.props.timeZone;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
