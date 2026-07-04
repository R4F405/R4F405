import type {
  IntentExtraction,
  MemoryIntent,
} from '../../domain/entities/memory-intent.js';

/**
 * Tool definition given to Claude. The model is forced to call it, so the
 * response is always structured data instead of free-form prose.
 */
export const CAPTURE_INTENTS_TOOL = {
  name: 'capture_intents',
  description:
    'Record every actionable intent found in the user message, plus a short ' +
    'natural-language reply for the user. A single message can contain several ' +
    'intents (e.g. a reminder AND a calendar event). Resolve all relative dates ' +
    '("mañana", "next Friday") against the reference time and time zone provided, ' +
    'and output them as ISO 8601 timestamps with UTC offset. If nothing is ' +
    'actionable, emit a single intent of type "unknown".',
  input_schema: {
    type: 'object' as const,
    properties: {
      reply: {
        type: 'string',
        description:
          "Short, friendly confirmation or clarification written in the user's own language.",
      },
      intents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'create_calendar_event',
                'create_reminder',
                'create_note',
                'list_reminders',
                'unknown',
              ],
            },
            title: { type: 'string', description: 'Event or note title.' },
            content: { type: 'string', description: 'Reminder or note body.' },
            description: { type: 'string', description: 'Optional event details.' },
            location: { type: 'string', description: 'Optional event location.' },
            starts_at: { type: 'string', description: 'ISO 8601 event start.' },
            ends_at: { type: 'string', description: 'ISO 8601 event end (optional).' },
            due_at: { type: 'string', description: 'ISO 8601 reminder due time.' },
            reason: { type: 'string', description: 'Why the message is not actionable.' },
          },
          required: ['type'],
          additionalProperties: false,
        },
      },
    },
    required: ['reply', 'intents'],
    additionalProperties: false,
  },
};

/**
 * Defensively converts the raw tool input from the LLM into a domain
 * IntentExtraction. Anything malformed degrades into an `unknown` intent —
 * a bad model response must never crash the pipeline.
 */
export function parseIntentExtraction(raw: unknown): IntentExtraction {
  if (!isRecord(raw)) {
    return {
      intents: [{ type: 'unknown', reason: 'Extractor returned a non-object payload' }],
      reply: '',
    };
  }

  const reply = typeof raw.reply === 'string' ? raw.reply : '';
  const rawIntents = Array.isArray(raw.intents) ? raw.intents : [];
  const intents = rawIntents.map(parseIntent);

  if (intents.length === 0) {
    return {
      intents: [{ type: 'unknown', reason: 'Extractor returned no intents' }],
      reply,
    };
  }
  return { intents, reply };
}

function parseIntent(raw: unknown): MemoryIntent {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return { type: 'unknown', reason: 'Malformed intent entry' };
  }

  switch (raw.type) {
    case 'create_calendar_event': {
      const title = asString(raw.title);
      const startsAt = asDate(raw.starts_at);
      if (!title || !startsAt) {
        return { type: 'unknown', reason: 'Calendar event intent missing title or start date' };
      }
      return {
        type: 'create_calendar_event',
        title,
        startsAt,
        endsAt: asDate(raw.ends_at),
        description: asString(raw.description),
        location: asString(raw.location),
      };
    }
    case 'create_reminder': {
      const content = asString(raw.content) ?? asString(raw.title);
      const dueAt = asDate(raw.due_at) ?? asDate(raw.starts_at);
      if (!content || !dueAt) {
        return { type: 'unknown', reason: 'Reminder intent missing content or due date' };
      }
      return { type: 'create_reminder', content, dueAt };
    }
    case 'create_note': {
      const content = asString(raw.content) ?? asString(raw.title);
      if (!content) {
        return { type: 'unknown', reason: 'Note intent missing content' };
      }
      return { type: 'create_note', content, title: asString(raw.title) };
    }
    case 'list_reminders':
      return { type: 'list_reminders' };
    case 'unknown':
      return { type: 'unknown', reason: asString(raw.reason) ?? 'Message was not actionable' };
    default:
      return { type: 'unknown', reason: `Unsupported intent type "${raw.type}"` };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
