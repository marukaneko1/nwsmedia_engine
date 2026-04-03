import { env } from '../config/env';

interface MeetLinkParams {
  title: string;
  startTime: string;
  durationMinutes: number;
  attendeeEmails?: string[];
}

export function isGoogleMeetConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
}

export async function createMeetLink(params: MeetLinkParams): Promise<string | null> {
  if (!isGoogleMeetConfigured()) return null;

  try {
    const { google } = await import('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const startDate = new Date(params.startTime);
    const endDate = new Date(startDate.getTime() + params.durationMinutes * 60000);

    const event = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: params.title,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        attendees: params.attendeeEmails?.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: `nws-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    return event.data.conferenceData?.entryPoints?.[0]?.uri || null;
  } catch (error) {
    console.error('Google Meet link creation failed:', error);
    return null;
  }
}
