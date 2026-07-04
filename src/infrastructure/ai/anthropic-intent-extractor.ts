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

Rules:
- Extract EVERY actionable intent in the message; one message can produce several.
- "Recuérdame X" → create_reminder. "Anótalo/agéndalo en el calendario" → create_calendar_event. "Apunta/guarda que..." with no time → create_note.
- Resolve relative dates ("mañana a las 10am", "el viernes") against the reference time and time zone provided in the message context, and emit ISO 8601 timestamps that include the UTC offset.
- If a time of day is missing for a reminder or event, choose a sensible default (09:00 local) and mention it in the reply.
- Write the reply in the same language as the user's message. Keep it to one or two sentences.
- Greetings, questions or chit-chat produce a single "unknown" intent and a helpful reply.`;

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
