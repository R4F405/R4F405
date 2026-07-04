import type { IntentExtraction } from '../entities/memory-intent.js';
import type { User } from '../entities/user.js';

export interface IntentExtractionContext {
  readonly user: User;
  /** Reference instant for resolving relative dates ("mañana a las 10am"). */
  readonly now: Date;
}

/** Driven port for the LLM that turns raw text into actionable intents. */
export interface IntentExtractorPort {
  extract(text: string, context: IntentExtractionContext): Promise<IntentExtraction>;
}
