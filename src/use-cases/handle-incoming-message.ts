import type { MemoryIntent } from '../domain/entities/memory-intent.js';
import { User } from '../domain/entities/user.js';
import type { Clock } from '../domain/ports/clock.js';
import type { IdGenerator } from '../domain/ports/id-generator.js';
import type { MessagingGatewayPort } from '../domain/ports/messaging-gateway.js';
import type { ReminderRepository } from '../domain/ports/repositories/reminder-repository.js';
import type { UserRepository } from '../domain/ports/repositories/user-repository.js';
import type { IncomingMessage } from '../domain/value-objects/incoming-message.js';
import type { CreateCalendarEventUseCase } from './create-calendar-event.js';
import type { CreateNoteUseCase } from './create-note.js';
import type { CreateReminderUseCase } from './create-reminder.js';
import type { ExtractIntentUseCase } from './extract-intent.js';
import type { SyncRemindersUseCase } from './sync-reminders.js';

export interface HandleIncomingMessageDefaults {
  readonly locale: string;
  readonly timeZone: string;
}

/**
 * Application pipeline for one inbound chat message:
 * resolve user → refresh external reminders → extract intents → execute → reply.
 */
export class HandleIncomingMessageUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly reminders: ReminderRepository,
    private readonly extractIntent: ExtractIntentUseCase,
    private readonly syncReminders: SyncRemindersUseCase,
    private readonly createCalendarEvent: CreateCalendarEventUseCase,
    private readonly createReminder: CreateReminderUseCase,
    private readonly createNote: CreateNoteUseCase,
    private readonly messaging: MessagingGatewayPort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly defaults: HandleIncomingMessageDefaults = {
      locale: 'es-ES',
      timeZone: 'Europe/Madrid',
    },
  ) {}

  async execute(message: IncomingMessage): Promise<void> {
    const user = await this.findOrCreateUser(message);

    // Pull anything the user typed directly into Samsung Reminder / To Do so
    // the bot answers over fresh state. Never fatal for the conversation.
    try {
      await this.syncReminders.execute(user);
    } catch (error) {
      console.error('[sync] inbound reminder sync failed:', error);
    }

    const extraction = await this.extractIntent.execute({ text: message.text, user });

    const confirmations: string[] = [];
    for (const intent of extraction.intents) {
      const confirmation = await this.dispatch(user, intent);
      if (confirmation) confirmations.push(confirmation);
    }

    const reply = [extraction.reply, ...confirmations].filter(Boolean).join('\n');
    await this.messaging.sendMessage(message.chatId, reply || '🤔');
  }

  private async dispatch(user: User, intent: MemoryIntent): Promise<string | null> {
    switch (intent.type) {
      case 'create_calendar_event': {
        const event = await this.createCalendarEvent.execute(user, intent);
        return `📅 ${event.title} — ${this.formatDate(user, event.startsAt)}`;
      }
      case 'create_reminder': {
        const reminder = await this.createReminder.execute(user, intent);
        return `⏰ ${reminder.content}${this.formatDueDate(user, reminder.dueAt)}`;
      }
      case 'create_note': {
        const note = await this.createNote.execute(user, intent);
        return `📝 ${note.title ?? note.content}`;
      }
      case 'list_reminders': {
        const pending = await this.reminders.findPendingByUserId(user.id);
        if (pending.length === 0) return null; // the extractor's reply covers it
        return pending
          .map((r) => `⏰ ${r.content}${this.formatDueDate(user, r.dueAt)}`)
          .join('\n');
      }
      case 'unknown':
        // The extractor's `reply` already explains what it could not do.
        return null;
    }
  }

  private async findOrCreateUser(message: IncomingMessage): Promise<User> {
    const existing = await this.users.findByTelegramId(message.telegramUserId);
    if (existing) return existing;

    const user = User.create({
      id: this.idGenerator.generate(),
      telegramId: message.telegramUserId,
      displayName: message.displayName,
      locale: this.defaults.locale,
      timeZone: this.defaults.timeZone,
      createdAt: this.clock.now(),
    });
    await this.users.save(user);
    return user;
  }

  private formatDueDate(user: User, date: Date | undefined): string {
    return date ? ` — ${this.formatDate(user, date)}` : '';
  }

  private formatDate(user: User, date: Date): string {
    return new Intl.DateTimeFormat(user.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: user.timeZone,
    }).format(date);
  }
}
