export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {}

export class NotFoundError extends DomainError {}

export class ExternalServiceError extends DomainError {
  constructor(
    readonly service: string,
    message: string,
  ) {
    super(`[${service}] ${message}`);
  }
}
