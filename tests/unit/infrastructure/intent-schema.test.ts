import { describe, expect, it } from 'vitest';
import { parseIntentExtraction } from '../../../src/infrastructure/ai/intent-schema.js';

describe('parseIntentExtraction', () => {
  it('parses a multi-intent payload (reminder + calendar event)', () => {
    const result = parseIntentExtraction({
      reply: '¡Hecho! Te lo recuerdo mañana a las 10.',
      intents: [
        { type: 'create_reminder', content: 'comprar café', due_at: '2026-07-05T10:00:00+02:00' },
        {
          type: 'create_calendar_event',
          title: 'Comprar café',
          starts_at: '2026-07-05T10:00:00+02:00',
        },
      ],
    });

    expect(result.reply).toContain('Hecho');
    expect(result.intents).toHaveLength(2);
    expect(result.intents[0]).toMatchObject({ type: 'create_reminder', content: 'comprar café' });
    expect(result.intents[1]).toMatchObject({ type: 'create_calendar_event', title: 'Comprar café' });
    if (result.intents[0]?.type === 'create_reminder') {
      expect(result.intents[0].dueAt.toISOString()).toBe('2026-07-05T08:00:00.000Z');
    }
  });

  it('degrades a calendar intent with an invalid date to unknown', () => {
    const result = parseIntentExtraction({
      reply: '',
      intents: [{ type: 'create_calendar_event', title: 'X', starts_at: 'yesterdayish' }],
    });
    expect(result.intents[0]?.type).toBe('unknown');
  });

  it('degrades a non-object payload to unknown', () => {
    const result = parseIntentExtraction('garbage');
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.type).toBe('unknown');
  });

  it('degrades an empty intent list to unknown', () => {
    const result = parseIntentExtraction({ reply: 'hola', intents: [] });
    expect(result.intents[0]?.type).toBe('unknown');
    expect(result.reply).toBe('hola');
  });

  it('handles unsupported intent types without crashing', () => {
    const result = parseIntentExtraction({
      reply: '',
      intents: [{ type: 'launch_rocket' }],
    });
    expect(result.intents[0]?.type).toBe('unknown');
  });
});
