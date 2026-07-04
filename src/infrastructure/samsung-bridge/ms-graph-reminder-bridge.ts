import type { Note } from '../../domain/entities/note.js';
import type { Reminder } from '../../domain/entities/reminder.js';
import { ExternalServiceError } from '../../domain/errors.js';
import type { UnifiedReminderServicePort } from '../../domain/ports/unified-reminder-service.js';
import type { AccessTokenProvider } from '../google/google-calendar-adapter.js';

const BASE_URL = 'https://graph.microsoft.com/v1.0';

/**
 * Microsoft Graph implementation of the Unified Reminder & Notes Service.
 *
 * Samsung Reminder/Notes exposes no public REST API, but both sync with
 * Microsoft accounts: Samsung Reminder ↔ Microsoft To Do, Samsung Notes ↔
 * OneNote. Bridging through Graph therefore lands items on the user's Samsung
 * devices.
 *
 * Skeleton status: REST calls are complete; auth is delegated to the injected
 * AccessTokenProvider (wire an MSAL OAuth2 flow before production use).
 */
export class MsGraphReminderBridge implements UnifiedReminderServicePort {
  constructor(
    private readonly getAccessToken: AccessTokenProvider,
    /** Microsoft To Do list that mirrors Samsung Reminder. */
    private readonly todoListId: string,
  ) {}

  async createReminder(reminder: Reminder): Promise<{ externalId: string }> {
    const task = await this.request<{ id: string }>(
      'POST',
      `/me/todo/lists/${encodeURIComponent(this.todoListId)}/tasks`,
      {
        title: reminder.content,
        dueDateTime: { dateTime: reminder.dueAt.toISOString(), timeZone: 'UTC' },
        reminderDateTime: { dateTime: reminder.dueAt.toISOString(), timeZone: 'UTC' },
        isReminderOn: true,
      },
    );
    return { externalId: task.id };
  }

  async completeReminder(externalId: string): Promise<void> {
    await this.request(
      'PATCH',
      `/me/todo/lists/${encodeURIComponent(this.todoListId)}/tasks/${encodeURIComponent(externalId)}`,
      { status: 'completed' },
    );
  }

  async createNote(note: Note): Promise<{ externalId: string }> {
    const title = note.title ?? note.content.slice(0, 60);
    const html = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head>` +
      `<body><p>${escapeHtml(note.content)}</p></body></html>`;

    const page = await this.request<{ id: string }>(
      'POST',
      '/me/onenote/pages',
      html,
      'application/xhtml+xml',
    );
    return { externalId: page.id };
  }

  private async request<T = void>(
    method: string,
    path: string,
    body?: unknown,
    contentType = 'application/json',
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': contentType,
      },
      body:
        body === undefined
          ? null
          : contentType === 'application/json'
            ? JSON.stringify(body)
            : String(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ExternalServiceError(
        'ms-graph',
        `${method} ${path} → ${response.status} ${detail}`.trim(),
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
