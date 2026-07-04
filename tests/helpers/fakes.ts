import type { IntentExtraction } from '../../src/domain/entities/memory-intent.js';
import { User } from '../../src/domain/entities/user.js';
import type { Clock } from '../../src/domain/ports/clock.js';
import type { IdGenerator } from '../../src/domain/ports/id-generator.js';
import type {
  IntentExtractionContext,
  IntentExtractorPort,
} from '../../src/domain/ports/intent-extractor.js';
import type { MessagingGatewayPort } from '../../src/domain/ports/messaging-gateway.js';

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date = new Date('2026-07-04T12:00:00Z')) {}
  now(): Date {
    return this.fixed;
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  generate(): string {
    return `id-${++this.counter}`;
  }
}

export class StubIntentExtractor implements IntentExtractorPort {
  lastText?: string;
  lastContext?: IntentExtractionContext;

  constructor(private readonly result: IntentExtraction) {}

  async extract(text: string, context: IntentExtractionContext): Promise<IntentExtraction> {
    this.lastText = text;
    this.lastContext = context;
    return this.result;
  }
}

export class RecordingMessagingGateway implements MessagingGatewayPort {
  readonly sent: Array<{ chatId: string; text: string }> = [];

  async sendMessage(chatId: string, text: string): Promise<void> {
    this.sent.push({ chatId, text });
  }
}

export function makeUser(overrides: Partial<Parameters<typeof User.create>[0]> = {}): User {
  return User.create({
    id: 'user-1',
    telegramId: 'tg-1',
    displayName: 'Rafa',
    locale: 'es-ES',
    timeZone: 'Europe/Madrid',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
}
