/**
 * Minimal shapes for the loosely-typed entities returned by the Corsair ORM
 * (`tenant.gmail.db.messages.*`, `tenant.googlecalendar.db.events.*`). Cast
 * Corsair return values to these so the rest of the code is type-safe.
 */

export interface CorsairMessage {
  entity_id: string;
  data: {
    threadId?: string;
    snippet?: string;
    subject?: string;
    from?: string;
    to?: string;
    body?: string;
    internalDate?: string;
    createdAt?: Date | null;
  };
}

export interface CorsairEvent {
  entity_id: string;
  data: {
    summary?: string;
    description?: string;
    location?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: { email?: string; displayName?: string }[];
    htmlLink?: string;
    createdAt?: Date | null;
  };
}
