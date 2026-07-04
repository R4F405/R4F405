import type { IntentExtraction } from '../domain/entities/memory-intent.js';
import type { User } from '../domain/entities/user.js';
import { ValidationError } from '../domain/errors.js';
import type { Clock } from '../domain/ports/clock.js';
import type { IntentExtractorPort } from '../domain/ports/intent-extractor.js';

export interface ExtractIntentInput {
  readonly text: string;
  readonly user: User;
}

export class ExtractIntentUseCase {
  constructor(
    private readonly extractor: IntentExtractorPort,
    private readonly clock: Clock,
  ) {}

  async execute(input: ExtractIntentInput): Promise<IntentExtraction> {
    if (!input.text.trim()) {
      throw new ValidationError('Cannot extract intent from an empty message');
    }
    return this.extractor.extract(input.text, {
      user: input.user,
      now: this.clock.now(),
    });
  }
}
