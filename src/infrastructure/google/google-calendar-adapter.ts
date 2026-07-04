import type { CalendarEvent } from '../../domain/entities/calendar-event.js';
import { ExternalServiceError } from '../../domain/errors.js';
import type { CalendarProviderPort } from '../../domain/ports/calendar-provider.js';

/**
 * Supplies a valid OAuth2 access token per request. A production
 * implementation refreshes tokens (service account JWT or refresh-token
 * grant); `staticTokenProvider` covers local development.
 */
export type AccessTokenProvider = () => Promise<string>;

export function staticTokenProvider(token: string): AccessTokenProvider {
  return () => Promise.resolve(token);
}

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

/**
 * Google Calendar implementation of CalendarProviderPort.
 *
 * Skeleton status: the REST calls are complete, but auth is delegated to the
 * injected AccessTokenProvider — wire a real OAuth2 flow there before
 * production use.
 */
export class GoogleCalendarAdapter implements CalendarProviderPort {
  constructor(
    private readonly getAccessToken: AccessTokenProvider,
    private readonly calendarId: string = 'primary',
  ) {}

  async createEvent(event: CalendarEvent): Promise<{ externalId: string }> {
    const created = await this.request<{ id: string }>('POST', '/events', {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: event.startsAt.toISOString() },
      end: { dateTime: event.endsAt.toISOString() },
    });
    return { externalId: created.id };
  }

  async deleteEvent(externalId: string): Promise<void> {
    await this.request('DELETE', `/events/${encodeURIComponent(externalId)}`);
  }

  private async request<T = void>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${BASE_URL}/calendars/${encodeURIComponent(this.calendarId)}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? null : JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ExternalServiceError(
        'google-calendar',
        `${method} ${path} → ${response.status} ${detail}`.trim(),
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
