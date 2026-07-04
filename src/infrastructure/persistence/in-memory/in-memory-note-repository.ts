import type { Note } from '../../../domain/entities/note.js';
import type { NoteRepository } from '../../../domain/ports/repositories/note-repository.js';

export class InMemoryNoteRepository implements NoteRepository {
  private readonly byId = new Map<string, Note>();

  async save(note: Note): Promise<void> {
    this.byId.set(note.id, note);
  }

  async findById(id: string): Promise<Note | null> {
    return this.byId.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Note[]> {
    return [...this.byId.values()].filter((note) => note.userId === userId);
  }
}
