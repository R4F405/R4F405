import type { Note } from '../../entities/note.js';

export interface NoteRepository {
  save(note: Note): Promise<void>;
  findById(id: string): Promise<Note | null>;
  findByUserId(userId: string): Promise<Note[]>;
}
