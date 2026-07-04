import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../domain/ports/id-generator.js';

export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
