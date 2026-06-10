import crypto from 'crypto';
import { google } from 'googleapis';
import { getGoogleCalendarConfig } from '../config/env.js';

const INTEGRATION_KEY = 'lab-calendar';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const getOAuthClient = () => {
    const { clientId, clientSecret, redirectUri } = getGoogleCalendarConfig();
    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Google Calendar no esta configurado');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const getEncryptionKey = () => {
    const { tokenEncryptionKey } = getGoogleCalendarConfig();
    if (!tokenEncryptionKey) {
        throw new Error('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY es requerido');
    }
    return crypto.createHash('sha256').update(tokenEncryptionKey).digest();
};

const encryptToken = (token) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64')
    };
};

const decryptToken = ({ encrypted, iv, authTag }) => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final()
    ]).toString('utf8');
};

const getMeetLinkFromEvent = (event) => {
    if (event?.hangoutLink) return event.hangoutLink;
    const videoEntry = event?.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video');
    return videoEntry?.uri || null;
};

export const buildGoogleCalendarAuthUrl = () => {
    const oauth2Client = getOAuthClient();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [CALENDAR_SCOPE]
    });
};

export const storeGoogleCalendarCode = async ({ pool, code, actorUserId }) => {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
        throw new Error('Google no devolvio refresh_token. Genera la URL nuevamente con consentimiento.');
    }

    oauth2Client.setCredentials(tokens);
    let connectedEmail = null;
    try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();
        connectedEmail = data?.email || null;
    } catch {
        connectedEmail = null;
    }

    const encrypted = encryptToken(tokens.refresh_token);
    const result = await pool.query(
        `INSERT INTO nl_integraciones_google
            (integration_key, refresh_token_encrypted, token_iv, token_auth_tag, connected_email, connected_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (integration_key)
         DO UPDATE SET
            refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
            token_iv = EXCLUDED.token_iv,
            token_auth_tag = EXCLUDED.token_auth_tag,
            connected_email = EXCLUDED.connected_email,
            connected_by = EXCLUDED.connected_by,
            updated_at = NOW()
         RETURNING integration_key, connected_email, connected_by, updated_at`,
        [INTEGRATION_KEY, encrypted.encrypted, encrypted.iv, encrypted.authTag, connectedEmail, actorUserId]
    );

    return result.rows[0];
};

export const createDesignReviewMeet = async ({ pool, order, approvalLink, scheduledAt, attendees = [] }) => {
    const { calendarId, timezone } = getGoogleCalendarConfig();
    const integration = await pool.query(
        `SELECT refresh_token_encrypted, token_iv, token_auth_tag
         FROM nl_integraciones_google
         WHERE integration_key = $1`,
        [INTEGRATION_KEY]
    );

    if (integration.rows.length === 0) {
        throw new Error('Google Calendar no esta conectado');
    }

    const refreshToken = decryptToken({
        encrypted: integration.rows[0].refresh_token_encrypted,
        iv: integration.rows[0].token_iv,
        authTag: integration.rows[0].token_auth_tag
    });

    const start = new Date(scheduledAt);
    if (Number.isNaN(start.getTime())) {
        throw new Error('Fecha y hora de Meet invalida');
    }
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const uniqueAttendees = [...new Set(attendees.filter(Boolean).map((email) => String(email).trim().toLowerCase()))]
        .map((email) => ({ email }));

    const { data } = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1,
        sendUpdates: uniqueAttendees.length ? 'all' : 'none',
        requestBody: {
            summary: `Revision diseño 3D - ${order.codigo}`,
            description: [
                `Caso: ${order.codigo}`,
                `Paciente: ${order.paciente_nombre || 'Sin paciente'}`,
                `Clinica: ${order.clinica_nombre || 'Sin clinica'}`,
                `Link Exocad: ${approvalLink}`
            ].join('\n'),
            start: { dateTime: start.toISOString(), timeZone: timezone },
            end: { dateTime: end.toISOString(), timeZone: timezone },
            attendees: uniqueAttendees,
            conferenceData: {
                createRequest: {
                    requestId: crypto.randomUUID(),
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            }
        }
    });

    const meetUrl = getMeetLinkFromEvent(data);
    if (!meetUrl) {
        throw new Error('Google Calendar creo el evento pero no devolvio enlace Meet');
    }

    return {
        eventId: data.id,
        meetUrl,
        scheduledAt: start.toISOString()
    };
};
