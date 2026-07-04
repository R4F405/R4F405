import type { CreateNoteIntent } from '../domain/entities/memory-intent.js';
import { Note } from '../domain/entities/note.js';
import type { User } from '../domain/entities/user.js';
import type { Clock } from '../domain/ports/clock.js';
import type { IdGenerator } from '../domain/ports/id-generator.js';
import type { NoteRepository } from '../domain/ports/repositories/note-repository.js';
import type { UnifiedReminderServicePort } from '../domain/ports/unified-reminder-service.js';

export class CreateNoteUseCase {
  constructor(
    private readonly notes: NoteRepository,
    private readonly reminderService: UnifiedReminderServicePort,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(user: User, intent: CreateNoteIntent): Promise<Note> {
    const note = Note.create({
      id: this.idGenerator.generate(),
      userId: user.id,
      content: intent.content,
      title: intent.title,
      createdAt: this.clock.now(),
    });

    const { externalId } = await this.reminderService.createNote(note);
    const synced = note.withExternalId(externalId);
    await this.notes.save(synced);
    return synced;
  }
}
