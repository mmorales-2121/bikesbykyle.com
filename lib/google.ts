import { calendar as gcal } from "@googleapis/calendar";
import { OAuth2Client } from "google-auth-library";

export const calendarEnabled = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

function calendar() {
  const auth = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return gcal({ version: "v3", auth });
}
const calendarId = () => process.env.GOOGLE_CALENDAR_ID || "primary";

/** Busy ranges from the owner's Google Calendar. */
export async function getBusy(timeMin: Date, timeMax: Date) {
  if (!calendarEnabled()) return [];
  const res = await calendar().freebusy.query({
    requestBody: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: calendarId() }] },
  });
  const busy = res.data.calendars?.[calendarId()]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
}

export async function createEvent(e: { summary: string; description: string; start: Date; end: Date; attendeeEmail?: string }) {
  if (!calendarEnabled()) return null;
  const res = await calendar().events.insert({
    calendarId: calendarId(),
    requestBody: {
      summary: e.summary,
      description: e.description,
      start: { dateTime: e.start.toISOString() },
      end: { dateTime: e.end.toISOString() },
      attendees: e.attendeeEmail ? [{ email: e.attendeeEmail }] : undefined,
    },
  });
  return res.data.id ?? null;
}

export async function deleteEvent(eventId: string) {
  if (!calendarEnabled()) return;
  await calendar().events.delete({ calendarId: calendarId(), eventId }).catch(() => {});
}
