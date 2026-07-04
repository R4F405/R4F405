export interface AppConfig {
  readonly telegramBotToken: string;
  readonly anthropic: {
    readonly apiKey: string;
    readonly model: string;
  };
  readonly google: {
    /** When undefined, the mock calendar provider is wired instead. */
    readonly accessToken?: string;
    readonly calendarId: string;
  };
  readonly msGraph: {
    /** When undefined, the in-memory reminder service is wired instead. */
    readonly accessToken?: string;
    readonly todoListId?: string;
  };
  readonly defaults: {
    readonly locale: string;
    readonly timeZone: string;
  };
  readonly sync: {
    /**
     * Telegram user id that owns the linked Microsoft account. Enables the
     * background poller; without it, inbound sync still runs on every
     * incoming message.
     */
    readonly ownerTelegramId?: string;
    readonly intervalSeconds: number;
  };
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const telegramBotToken = required(env, 'TELEGRAM_BOT_TOKEN');
  const anthropicApiKey = required(env, 'ANTHROPIC_API_KEY');

  return {
    telegramBotToken,
    anthropic: {
      apiKey: anthropicApiKey,
      model: env.ANTHROPIC_MODEL?.trim() || 'claude-opus-4-8',
    },
    google: {
      accessToken: optional(env, 'GOOGLE_ACCESS_TOKEN'),
      calendarId: env.GOOGLE_CALENDAR_ID?.trim() || 'primary',
    },
    msGraph: {
      accessToken: optional(env, 'MS_GRAPH_ACCESS_TOKEN'),
      todoListId: optional(env, 'MS_GRAPH_TODO_LIST_ID'),
    },
    defaults: {
      locale: env.DEFAULT_LOCALE?.trim() || 'es-ES',
      timeZone: env.DEFAULT_TIMEZONE?.trim() || 'Europe/Madrid',
    },
    sync: {
      ownerTelegramId: optional(env, 'OWNER_TELEGRAM_ID'),
      intervalSeconds: parsePositiveInt(env.SYNC_INTERVAL_SECONDS, 60),
    },
  };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new ConfigError(`Missing required environment variable ${key} (see .env.example)`);
  }
  return value;
}

function optional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value || undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
