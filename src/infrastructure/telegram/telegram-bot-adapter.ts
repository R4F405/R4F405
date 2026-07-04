import { ExternalServiceError } from '../../domain/errors.js';
import type { MessagingGatewayPort } from '../../domain/ports/messaging-gateway.js';
import type { IncomingMessage } from '../../domain/value-objects/incoming-message.js';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
  };
}

interface TelegramResponse<T> {
  ok: boolean;
  description?: string;
  result: T;
}

export type IncomingMessageHandler = (message: IncomingMessage) => Promise<void>;

const POLL_TIMEOUT_SECONDS = 50;
const ERROR_BACKOFF_MS = 5_000;

/**
 * Driving adapter: receives Telegram updates via long polling and pushes them
 * into the application. Also implements the outbound MessagingGatewayPort, so
 * replies flow back through the same chat.
 */
export class TelegramBotAdapter implements MessagingGatewayPort {
  private handler?: IncomingMessageHandler;
  private running = false;
  private abort?: AbortController;

  constructor(private readonly botToken: string) {}

  onMessage(handler: IncomingMessageHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (!this.handler) {
      throw new ExternalServiceError('telegram', 'start() called before onMessage()');
    }
    this.running = true;
    let offset = 0;

    while (this.running) {
      try {
        const updates = await this.getUpdates(offset);
        for (const update of updates) {
          offset = Math.max(offset, update.update_id + 1);
          await this.handleUpdate(update);
        }
      } catch (error) {
        if (!this.running) break;
        console.error('[telegram] polling error, backing off:', error);
        await sleep(ERROR_BACKOFF_MS);
      }
    }
  }

  stop(): void {
    this.running = false;
    this.abort?.abort();
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text });
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text || !message.from) return;

    const incoming: IncomingMessage = {
      chatId: String(message.chat.id),
      telegramUserId: String(message.from.id),
      displayName:
        [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') ||
        message.from.username ||
        'Unknown',
      text: message.text,
      receivedAt: new Date(message.date * 1000),
    };

    try {
      await this.handler?.(incoming);
    } catch (error) {
      console.error('[telegram] failed to handle message:', error);
      await this.sendMessage(
        incoming.chatId,
        '😕 Algo salió mal procesando tu mensaje. Inténtalo de nuevo.',
      ).catch(() => undefined);
    }
  }

  private async getUpdates(offset: number): Promise<TelegramUpdate[]> {
    this.abort = new AbortController();
    return this.call<TelegramUpdate[]>(
      'getUpdates',
      { offset, timeout: POLL_TIMEOUT_SECONDS, allowed_updates: ['message'] },
      this.abort.signal,
    );
  }

  private async call<T>(method: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: signal ?? null,
    });

    const payload = (await response.json()) as TelegramResponse<T>;
    if (!response.ok || !payload.ok) {
      throw new ExternalServiceError(
        'telegram',
        `${method} failed: ${payload.description ?? response.statusText}`,
      );
    }
    return payload.result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
