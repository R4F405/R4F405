import type { Note } from '../../domain/entities/note.js';
import type { Reminder } from '../../domain/entities/reminder.js';
import { ExternalServiceError } from '../../domain/errors.js';
import type {
  ExternalReminderSnapshot,
  UnifiedReminderServicePort,
} from '../../domain/ports/unified-reminder-service.js';
import type { AccessTokenProvider } from '../google/google-calendar-adapter.js';

const BASE_URL = 'https://graph.microsoft.com/v1.0';

interface GraphDateTimeTimeZone {
  dateTime: string;
  timeZone: string;
}

interface GraphTodoTask {
  id: string;
  title?: string;
  status?: string;
  dueDateTime?: GraphDateTimeTimeZone;
  reminderDateTime?: GraphDateTimeTimeZone;
}

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
    const body: Record<string, unknown> = { title: reminder.content };
    if (reminder.dueAt) {
      body.dueDateTime = { dateTime: reminder.dueAt.toISOString(), timeZone: 'UTC' };
      body.reminderDateTime = { dateTime: reminder.dueAt.toISOString(), timeZone: 'UTC' };
      body.isReminderOn = true;
    }
    const task = await this.request<{ id: string }>(
      'POST',
      `/me/todo/lists/${encodeURIComponent(this.todoListId)}/tasks`,
      body,
    );
    return { externalId: task.id };
  }

  /**
   * Inbound sync: everything currently in the To Do list, which mirrors what
   * the user typed into Samsung Reminder on their phone.
   *
   * Skeleton note: full-list polling ($top=200). For large lists, switch to
   * Graph delta queries (/tasks/delta) and persist the deltaLink.
   */
  async listReminders(): Promise<ExternalReminderSnapshot[]> {
    const page = await this.request<{ value: GraphTodoTask[] }>(
      'GET',
      `/me/todo/lists/${encodeURIComponent(this.todoListId)}/tasks?$top=200`,
    );

    return page.value
      .filter((task) => Boolean(task.title?.trim()))
      .map((task) => ({
        externalId: task.id,
        content: task.title as string,
        dueAt: parseGraphDate(task.reminderDateTime ?? task.dueDateTime),
        completed: task.status === 'completed',
      }));
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

/**
 * Graph returns { dateTime, timeZone } where dateTime has no offset.
 * UTC is normalized precisely; other zones fall back to local parsing —
 * acceptable for the skeleton, resolve via a tz library in production.
 */
function parseGraphDate(value: GraphDateTimeTimeZone | undefined): Date | undefined {
  if (!value?.dateTime) return undefined;
  const iso = value.timeZone === 'UTC' && !value.dateTime.endsWith('Z')
    ? `${value.dateTime}Z`
    : value.dateTime;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
