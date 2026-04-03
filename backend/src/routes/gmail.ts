import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAuthenticatedClient } from '../services/googleAuth';

const router = Router();
router.use(authenticateToken);

function getGmail(client: any) {
  const { google } = require('googleapis');
  return google.gmail({ version: 'v1', auth: client });
}

router.get('/threads', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { q, pageToken, label } = req.query;

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);

    const labelIds = label ? [label as string] : ['INBOX'];
    const listParams: any = {
      userId: 'me',
      maxResults: 25,
      labelIds,
    };
    if (q) listParams.q = q;
    if (pageToken) listParams.pageToken = pageToken;

    const list = await gmail.users.threads.list(listParams);
    const threads = list.data.threads || [];
    const nextPageToken = list.data.nextPageToken || null;
    const resultSizeEstimate = list.data.resultSizeEstimate || 0;

    const detailed = await Promise.all(
      threads.slice(0, 25).map(async (t: any) => {
        try {
          const thread = await gmail.users.threads.get({
            userId: 'me',
            id: t.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });

          const messages = thread.data.messages || [];
          const lastMsg = messages[messages.length - 1];
          const headers = lastMsg?.payload?.headers || [];

          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          const isUnread = lastMsg?.labelIds?.includes('UNREAD') || false;

          return {
            id: t.id,
            snippet: thread.data.messages?.[0]?.snippet || t.snippet || '',
            subject: getHeader('Subject') || '(No subject)',
            from: getHeader('From'),
            to: getHeader('To'),
            date: getHeader('Date'),
            messageCount: messages.length,
            isUnread,
            labelIds: lastMsg?.labelIds || [],
          };
        } catch {
          return {
            id: t.id,
            snippet: t.snippet || '',
            subject: '(Error loading)',
            from: '',
            to: '',
            date: '',
            messageCount: 0,
            isUnread: false,
            labelIds: [],
          };
        }
      })
    );

    res.json({ threads: detailed, nextPageToken, resultSizeEstimate });
  } catch (err: any) {
    console.error('Gmail threads error:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

router.get('/threads/:id', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id,
      format: 'full',
    });

    const messages = (thread.data.messages || []).map((msg: any) => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      let body = '';
      const parts = msg.payload?.parts || [];

      if (parts.length > 0) {
        const htmlPart = parts.find((p: any) => p.mimeType === 'text/html');
        const textPart = parts.find((p: any) => p.mimeType === 'text/plain');
        const part = htmlPart || textPart;
        if (part?.body?.data) {
          body = Buffer.from(part.body.data, 'base64url').toString('utf8');
        }
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64url').toString('utf8');
      }

      const attachments = parts
        .filter((p: any) => p.filename && p.body?.attachmentId)
        .map((p: any) => ({
          id: p.body.attachmentId,
          filename: p.filename,
          mimeType: p.mimeType,
          size: p.body.size,
        }));

      return {
        id: msg.id,
        threadId: msg.threadId,
        from: getHeader('From'),
        to: getHeader('To'),
        cc: getHeader('Cc'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        body,
        isHtml: !!parts.find((p: any) => p.mimeType === 'text/html'),
        labelIds: msg.labelIds || [],
        attachments,
      };
    });

    res.json({ messages });
  } catch (err) {
    console.error('Gmail thread detail error:', err);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

router.get('/attachment/:messageId/:attachmentId', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { messageId, attachmentId } = req.params;

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });

    const data = Buffer.from(attachment.data.data, 'base64url');
    res.set('Content-Type', 'application/octet-stream');
    res.send(data);
  } catch (err) {
    console.error('Gmail attachment error:', err);
    res.status(500).json({ error: 'Failed to fetch attachment' });
  }
});

router.post('/send', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { to, cc, bcc, subject, body } = req.body;

  if (!to || !subject || !body) {
    res.status(400).json({ error: 'to, subject, and body are required' });
    return;
  }

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);

    const headers = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
    ].filter(Boolean).join('\r\n');

    const raw = Buffer.from(headers).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    res.json({ messageId: result.data.id, threadId: result.data.threadId });
  } catch (err) {
    console.error('Gmail send error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.post('/reply/:threadId', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { threadId } = req.params;
  const { to, cc, subject, body, messageId } = req.body;

  if (!to || !body) {
    res.status(400).json({ error: 'to and body are required' });
    return;
  }

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);

    const headers = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      `Subject: ${subject || 'Re:'}`,
      messageId ? `In-Reply-To: ${messageId}` : '',
      messageId ? `References: ${messageId}` : '',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
    ].filter(Boolean).join('\r\n');

    const raw = Buffer.from(headers).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId },
    });

    res.json({ messageId: result.data.id, threadId: result.data.threadId });
  } catch (err) {
    console.error('Gmail reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.patch('/threads/:id', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { markRead, archive, star, unstar } = req.body;

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);

    const addLabels: string[] = [];
    const removeLabels: string[] = [];

    if (markRead === true) removeLabels.push('UNREAD');
    if (markRead === false) addLabels.push('UNREAD');
    if (archive) removeLabels.push('INBOX');
    if (star) addLabels.push('STARRED');
    if (unstar) removeLabels.push('STARRED');

    if (addLabels.length > 0 || removeLabels.length > 0) {
      await gmail.users.threads.modify({
        userId: 'me',
        id,
        requestBody: {
          addLabelIds: addLabels.length > 0 ? addLabels : undefined,
          removeLabelIds: removeLabels.length > 0 ? removeLabels : undefined,
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Gmail modify error:', err);
    res.status(500).json({ error: 'Failed to modify thread' });
  }
});

router.get('/labels', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.status(400).json({ error: 'Google not connected' }); return; }

    const gmail = getGmail(client);
    const result = await gmail.users.labels.list({ userId: 'me' });

    const labels = (result.data.labels || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type,
    }));

    res.json({ labels });
  } catch (err) {
    console.error('Gmail labels error:', err);
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

router.get('/unread-count', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const client = await getAuthenticatedClient(userId);
    if (!client) { res.json({ count: 0 }); return; }

    const gmail = getGmail(client);
    const result = await gmail.users.labels.get({ userId: 'me', id: 'INBOX' });
    res.json({ count: result.data.messagesUnread || 0 });
  } catch (err) {
    console.error('Gmail unread count error:', err);
    res.json({ count: 0 });
  }
});

export default router;
