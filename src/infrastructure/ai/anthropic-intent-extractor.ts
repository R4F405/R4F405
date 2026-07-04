import Anthropic from '@anthropic-ai/sdk';
import type { IntentExtraction } from '../../domain/entities/memory-intent.js';
import { ExternalServiceError } from '../../domain/errors.js';
import type {
  IntentExtractionContext,
  IntentExtractorPort,
} from '../../domain/ports/intent-extractor.js';
import { CAPTURE_INTENTS_TOOL, parseIntentExtraction } from './intent-schema.js';

// Stable prefix (tools + system) — dynamic context goes in the user turn so
// the prompt cache prefix survives across every request.
const SYSTEM_PROMPT = `You are the intent-extraction engine of Memorae, a personal memory assistant.
Users write in natural language (often Spanish) to manage their calendar, reminders and notes.

REMINDER vs NOTE — these are different things, never interchangeable:
- A REMINDER (create_reminder) is something the user must DO or be alerted about, usually
  time-bound: "recuérdame...", "avísame...", "tengo que...", "no me dejes olvidar...".
- A NOTE (create_note) is information the user wants to KEEP, with no action or alarm
  attached: "apunta...", "guarda...", "anota que...", "toma nota de...".
- Each piece of content maps to EXACTLY ONE of them. Never emit a reminder and a note
  for the same content. If the phrasing is ambiguous, prefer: has a time or an action
  to perform → create_reminder; is a fact/idea/text to store → create_note.

How many intents to emit:
- Default is ONE intent per message — that is the normal case.
- Emit several intents ONLY when the user explicitly asks for several distinct things,
  e.g. "recuérdame X **y además ponlo en el calendario**" (reminder + calendar event),
  or two unrelated requests joined in one message. Never pad with extra intents.

Other intent types:
- "Anótalo/agéndalo en el calendario", meetings, appointments → create_calendar_event.
- "¿Qué recordatorios tengo?", "muéstrame mis pendientes" → list_reminders (the app
  fills in the actual list; your reply is just a short lead-in like "Estos son tus
  recordatorios:").
- Greetings, questions or chit-chat produce a single "unknown" intent and a helpful reply.

Dates and replies:
- Resolve relative dates ("mañana a las 10am", "el viernes") against the reference time
  and time zone provided in the message context, and emit ISO 8601 timestamps that
  include the UTC offset.
- If a time of day is missing for a reminder or event, choose a sensible default
  (09:00 local) and mention it in the reply.
- Write the reply in the same language as the user's message. Keep it to one or two
  sentences.`;

export class AnthropicIntentExtractor implements IntentExtractorPort {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async extract(text: string, context: IntentExtractionContext): Promise<IntentExtraction> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [CAPTURE_INTENTS_TOOL],
        tool_choice: { type: 'tool', name: CAPTURE_INTENTS_TOOL.name },
        messages: [{ role: 'user', content: this.buildUserTurn(text, context) }],
      });
    } catch (error) {
      throw new ExternalServiceError(
        'anthropic',
        error instanceof Error ? error.message : String(error),
      );
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      return {
        intents: [{ type: 'unknown', reason: 'Model returned no tool call' }],
        reply: '',
      };
    }
    return parseIntentExtraction(toolUse.input);
  }

  private buildUserTurn(text: string, context: IntentExtractionContext): string {
    const { user, now } = context;
    return [
      `<context>`,
      `reference_time: ${now.toISOString()}`,
      `user_time_zone: ${user.timeZone}`,
      `user_locale: ${user.locale}`,
      `user_name: ${user.displayName}`,
      `</context>`,
      ``,
      text,
    ].join('\n');
  }
}
