import { describe, expect, it } from 'vitest';
import { Reminder } from '../../../src/domain/entities/reminder.js';
import { InMemoryReminderRepository } from '../../../src/infrastructure/persistence/in-memory/in-memory-reminder-repository.js';
import { InMemoryReminderService } from '../../../src/infrastructure/samsung-bridge/in-memory-reminder-service.js';
import { SyncRemindersUseCase } from '../../../src/use-cases/sync-reminders.js';
import { SequentialIdGenerator, makeUser } from '../../helpers/fakes.js';

function build() {
  const reminders = new InMemoryReminderRepository();
  const service = new InMemoryReminderService();
  const useCase = new SyncRemindersUseCase(reminders, service, new SequentialIdGenerator());
  return { reminders, service, useCase, user: makeUser() };
}

describe('SyncRemindersUseCase', () => {
  it('imports tasks created directly in the external app', async () => {
    const { reminders, service, useCase, user } = build();
    service.simulateExternalReminder({
      externalId: 'todo-1',
      content: 'comprar pilas',
      dueAt: new Date('2026-07-06T09:00:00Z'),
      completed: false,
    });

    const result = await useCase.execute(user);

    expect(result).toEqual({ created: 1, updated: 0 });
    const imported = await reminders.findByExternalId('todo-1');
    expect(imported?.content).toBe('comprar pilas');
    expect(imported?.userId).toBe(user.id);
  });

  it('is idempotent when nothing changed', async () => {
    const { service, useCase, user } = build();
    service.simulateExternalReminder({
      externalId: 'todo-1',
      content: 'comprar pilas',
      completed: false,
    });

    await useCase.execute(user);
    const second = await useCase.execute(user);

    expect(second).toEqual({ created: 0, updated: 0 });
  });

  it('marks bot-created reminders completed when finished on the phone', async () => {
    const { reminders, service, useCase, user } = build();

    // Bot-created reminder, already synced outbound.
    const created = Reminder.create({
      id: 'local-1',
      userId: user.id,
      content: 'llamar al médico',
      dueAt: new Date('2026-07-05T10:00:00Z'),
      completed: false,
    });
    const { externalId } = await service.createReminder(created);
    await reminders.save(created.withExternalId(externalId));

    // User taps "done" in Samsung Reminder → propagated by To Do.
    await service.completeReminder(externalId);

    const result = await useCase.execute(user);

    expect(result).toEqual({ created: 0, updated: 1 });
    const synced = await reminders.findByExternalId(externalId);
    expect(synced?.completed).toBe(true);
    expect(synced?.id).toBe('local-1'); // same local identity, no duplicate
  });

  it('picks up edits made in the external app', async () => {
    const { reminders, service, useCase, user } = build();
    service.simulateExternalReminder({
      externalId: 'todo-2',
      content: 'regar plantas',
      completed: false,
    });
    await useCase.execute(user);

    service.simulateExternalReminder({
      externalId: 'todo-2',
      content: 'regar plantas del balcón',
      dueAt: new Date('2026-07-07T08:00:00Z'),
      completed: false,
    });
    const result = await useCase.execute(user);

    expect(result).toEqual({ created: 0, updated: 1 });
    const updated = await reminders.findByExternalId('todo-2');
    expect(updated?.content).toBe('regar plantas del balcón');
    expect(updated?.dueAt?.toISOString()).toBe('2026-07-07T08:00:00.000Z');
  });

  it('skips external tasks with empty titles', async () => {
    const { service, useCase, user } = build();
    service.simulateExternalReminder({ externalId: 'todo-3', content: '   ', completed: false });

    const result = await useCase.execute(user);

    expect(result).toEqual({ created: 0, updated: 0 });
  });
});
