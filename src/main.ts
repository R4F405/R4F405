/**
 * Composition Root — the only file where concrete adapters meet the ports.
 * Everything below main() is pure wiring; no business logic lives here.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { CalendarProviderPort } from './domain/ports/calendar-provider.js';
import type { UnifiedReminderServicePort } from './domain/ports/unified-reminder-service.js';
import { AnthropicIntentExtractor } from './infrastructure/ai/anthropic-intent-extractor.js';
import { loadConfig, type AppConfig } from './infrastructure/config/env.js';
import {
  GoogleCalendarAdapter,
  staticTokenProvider,
} from './infrastructure/google/google-calendar-adapter.js';
import { MockCalendarProvider } from './infrastructure/google/mock-calendar-provider.js';
import { InMemoryCalendarEventRepository } from './infrastructure/persistence/in-memory/in-memory-calendar-event-repository.js';
import { InMemoryNoteRepository } from './infrastructure/persistence/in-memory/in-memory-note-repository.js';
import { InMemoryReminderRepository } from './infrastructure/persistence/in-memory/in-memory-reminder-repository.js';
import { InMemoryUserRepository } from './infrastructure/persistence/in-memory/in-memory-user-repository.js';
import { InMemoryReminderService } from './infrastructure/samsung-bridge/in-memory-reminder-service.js';
import { MsGraphReminderBridge } from './infrastructure/samsung-bridge/ms-graph-reminder-bridge.js';
import { SystemClock } from './infrastructure/system/system-clock.js';
import { UuidIdGenerator } from './infrastructure/system/uuid-id-generator.js';
import { TelegramBotAdapter } from './infrastructure/telegram/telegram-bot-adapter.js';
import { CreateCalendarEventUseCase } from './use-cases/create-calendar-event.js';
import { CreateNoteUseCase } from './use-cases/create-note.js';
import { CreateReminderUseCase } from './use-cases/create-reminder.js';
import { ExtractIntentUseCase } from './use-cases/extract-intent.js';
import { HandleIncomingMessageUseCase } from './use-cases/handle-incoming-message.js';

function buildCalendarProvider(config: AppConfig): CalendarProviderPort {
  if (config.google.accessToken) {
    return new GoogleCalendarAdapter(
      staticTokenProvider(config.google.accessToken),
      config.google.calendarId,
    );
  }
  console.warn('[bootstrap] GOOGLE_ACCESS_TOKEN not set — using mock calendar provider');
  return new MockCalendarProvider();
}

function buildReminderService(config: AppConfig): UnifiedReminderServicePort {
  if (config.msGraph.accessToken && config.msGraph.todoListId) {
    return new MsGraphReminderBridge(
      staticTokenProvider(config.msGraph.accessToken),
      config.msGraph.todoListId,
    );
  }
  console.warn('[bootstrap] MS Graph credentials not set — using in-memory reminder service');
  return new InMemoryReminderService();
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Shared system adapters
  const clock = new SystemClock();
  const idGenerator = new UuidIdGenerator();

  // Persistence (in-memory today; swap for Postgres/Mongo implementations
  // of the same repository interfaces without touching domain or use-cases)
  const users = new InMemoryUserRepository();
  const calendarEvents = new InMemoryCalendarEventRepository();
  const reminders = new InMemoryReminderRepository();
  const notes = new InMemoryNoteRepository();

  // Driven adapters
  const intentExtractor = new AnthropicIntentExtractor(
    new Anthropic({ apiKey: config.anthropic.apiKey }),
    config.anthropic.model,
  );
  const calendarProvider = buildCalendarProvider(config);
  const reminderService = buildReminderService(config);
  const telegram = new TelegramBotAdapter(config.telegramBotToken);

  // Use-cases
  const handleIncomingMessage = new HandleIncomingMessageUseCase(
    users,
    new ExtractIntentUseCase(intentExtractor, clock),
    new CreateCalendarEventUseCase(calendarEvents, calendarProvider, idGenerator),
    new CreateReminderUseCase(reminders, reminderService, idGenerator),
    new CreateNoteUseCase(notes, reminderService, idGenerator, clock),
    telegram,
    idGenerator,
    clock,
    config.defaults,
  );

  // Driving adapter
  telegram.onMessage((message) => handleIncomingMessage.execute(message));

  const shutdown = (signal: string): void => {
    console.info(`[bootstrap] received ${signal}, shutting down`);
    telegram.stop();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.info(`[bootstrap] Memorae started (model: ${config.anthropic.model})`);
  await telegram.start();
  console.info('[bootstrap] Memorae stopped');
}

main().catch((error) => {
  console.error('[bootstrap] fatal:', error);
  process.exitCode = 1;
});
