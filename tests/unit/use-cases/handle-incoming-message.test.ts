import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from '../../../src/domain/value-objects/incoming-message.js';
import { InMemoryCalendarEventRepository } from '../../../src/infrastructure/persistence/in-memory/in-memory-calendar-event-repository.js';
import { InMemoryNoteRepository } from '../../../src/infrastructure/persistence/in-memory/in-memory-note-repository.js';
import { InMemoryReminderRepository } from '../../../src/infrastructure/persistence/in-memory/in-memory-reminder-repository.js';
import { InMemoryUserRepository } from '../../../src/infrastructure/persistence/in-memory/in-memory-user-repository.js';
import { InMemoryReminderService } from '../../../src/infrastructure/samsung-bridge/in-memory-reminder-service.js';
import { MockCalendarProvider } from '../../../src/infrastructure/google/mock-calendar-provider.js';
import { CreateCalendarEventUseCase } from '../../../src/use-cases/create-calendar-event.js';
import { CreateNoteUseCase } from '../../../src/use-cases/create-note.js';
import { CreateReminderUseCase } from '../../../src/use-cases/create-reminder.js';
import { ExtractIntentUseCase } from '../../../src/use-cases/extract-intent.js';
import { HandleIncomingMessageUseCase } from '../../../src/use-cases/handle-incoming-message.js';
import { SyncRemindersUseCase } from '../../../src/use-cases/sync-reminders.js';
import {
  FixedClock,
  RecordingMessagingGateway,
  SequentialIdGenerator,
  StubIntentExtractor,
} from '../../helpers/fakes.js';

const incoming: IncomingMessage = {
  chatId: 'chat-42',
  telegramUserId: 'tg-7',
  displayName: 'Rafa',
  text: 'Recuérdame mañana a las 10am comprar café y anótalo en el calendario',
  receivedAt: new Date('2026-07-04T12:00:00Z'),
};

function buildPipeline(extractor: StubIntentExtractor) {
  const clock = new FixedClock();
  const ids = new SequentialIdGenerator();
  const users = new InMemoryUserRepository();
  const events = new InMemoryCalendarEventRepository();
  const reminders = new InMemoryReminderRepository();
  const notes = new InMemoryNoteRepository();
  const reminderService = new InMemoryReminderService();
  const messaging = new RecordingMessagingGateway();

  const useCase = new HandleIncomingMessageUseCase(
    users,
    reminders,
    new ExtractIntentUseCase(extractor, clock),
    new SyncRemindersUseCase(reminders, reminderService, ids),
    new CreateCalendarEventUseCase(events, new MockCalendarProvider(), ids),
    new CreateReminderUseCase(reminders, reminderService, ids),
    new CreateNoteUseCase(notes, reminderService, ids, clock),
    messaging,
    ids,
    clock,
  );

  return { useCase, users, events, reminders, notes, reminderService, messaging };
}

describe('HandleIncomingMessageUseCase', () => {
  it('executes every extracted intent and replies once', async () => {
    const extractor = new StubIntentExtractor({
      reply: '¡Listo!',
      intents: [
        {
          type: 'create_reminder',
          content: 'comprar café',
          dueAt: new Date('2026-07-05T08:00:00Z'),
        },
        {
          type: 'create_calendar_event',
          title: 'Comprar café',
          startsAt: new Date('2026-07-05T08:00:00Z'),
        },
      ],
    });
    const { useCase, reminders, events, messaging } = buildPipeline(extractor);

    await useCase.execute(incoming);

    const savedReminders = await reminders.findPendingByUserId('id-1');
    expect(savedReminders).toHaveLength(1);
    expect(savedReminders[0]?.externalId).toMatch(/^mock-reminder-/);

    const savedEvents = await events.findByUserId('id-1');
    expect(savedEvents).toHaveLength(1);
    expect(savedEvents[0]?.externalId).toMatch(/^mock-gcal-/);
    // default duration of 1h applied when the intent has no end time
    expect(savedEvents[0]?.endsAt.toISOString()).toBe('2026-07-05T09:00:00.000Z');

    expect(messaging.sent).toHaveLength(1);
    expect(messaging.sent[0]?.chatId).toBe('chat-42');
    expect(messaging.sent[0]?.text).toContain('¡Listo!');
    expect(messaging.sent[0]?.text).toContain('⏰');
    expect(messaging.sent[0]?.text).toContain('📅');
  });

  it('auto-registers unseen Telegram users', async () => {
    const extractor = new StubIntentExtractor({
      reply: 'Hola 👋',
      intents: [{ type: 'unknown', reason: 'greeting' }],
    });
    const { useCase, users } = buildPipeline(extractor);

    await useCase.execute(incoming);

    const user = await users.findByTelegramId('tg-7');
    expect(user).not.toBeNull();
    expect(user?.displayName).toBe('Rafa');
  });

  it('reuses the existing user on subsequent messages', async () => {
    const extractor = new StubIntentExtractor({
      reply: 'ok',
      intents: [{ type: 'unknown', reason: 'chit-chat' }],
    });
    const { useCase, users } = buildPipeline(extractor);

    await useCase.execute(incoming);
    const first = await users.findByTelegramId('tg-7');
    await useCase.execute(incoming);
    const second = await users.findByTelegramId('tg-7');

    expect(second?.id).toBe(first?.id);
  });

  it('passes the user and reference time to the extractor', async () => {
    const extractor = new StubIntentExtractor({
      reply: 'ok',
      intents: [{ type: 'unknown', reason: 'n/a' }],
    });
    const { useCase } = buildPipeline(extractor);

    await useCase.execute(incoming);

    expect(extractor.lastText).toBe(incoming.text);
    expect(extractor.lastContext?.now.toISOString()).toBe('2026-07-04T12:00:00.000Z');
    expect(extractor.lastContext?.user.timeZone).toBe('Europe/Madrid');
  });

  it('lists reminders created directly in the external app (inbound sync)', async () => {
    const extractor = new StubIntentExtractor({
      reply: 'Estos son tus recordatorios:',
      intents: [{ type: 'list_reminders' }],
    });
    const { useCase, reminderService, messaging } = buildPipeline(extractor);

    // The user typed this into Samsung Reminder / To Do, not into the bot.
    reminderService.simulateExternalReminder({
      externalId: 'todo-abc',
      content: 'sacar la basura',
      dueAt: new Date('2026-07-05T18:00:00Z'),
      completed: false,
    });

    await useCase.execute(incoming);

    expect(messaging.sent).toHaveLength(1);
    expect(messaging.sent[0]?.text).toContain('Estos son tus recordatorios:');
    expect(messaging.sent[0]?.text).toContain('sacar la basura');
  });

  it('does not resurface reminders completed in the external app', async () => {
    const extractor = new StubIntentExtractor({
      reply: 'Tus recordatorios:',
      intents: [{ type: 'list_reminders' }],
    });
    const { useCase, reminderService, messaging } = buildPipeline(extractor);

    reminderService.simulateExternalReminder({
      externalId: 'todo-done',
      content: 'ya hecho',
      completed: true,
    });

    await useCase.execute(incoming);

    expect(messaging.sent[0]?.text).not.toContain('ya hecho');
  });
});
