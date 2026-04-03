import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Thread {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  messageCount: number;
  isUnread: boolean;
  labelIds: string[];
}

interface Message {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  isHtml: boolean;
  labelIds: string[];
  attachments: { id: string; filename: string; mimeType: string; size: number }[];
}

interface Label {
  id: string;
  name: string;
  type?: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

interface ThreadsResponse {
  threads: Thread[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
}

interface GoogleStatus {
  connected: boolean;
  google_email: string | null;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const SYSTEM_LABELS = [
  { id: 'INBOX', name: 'Inbox', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'STARRED', name: 'Starred', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { id: 'SENT', name: 'Sent', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
  { id: 'DRAFT', name: 'Drafts', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'CATEGORY_PERSONAL', name: 'All Mail', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'SPAM', name: 'Spam', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'TRASH', name: 'Trash', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */

function parseName(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2] };
  return { name: raw, email: raw };
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function fullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ─── Spinner ────────────────────────────────────────────────────────── */

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
  return (
    <svg className={`${px} animate-spin text-blue-500`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ─── HTML Email Renderer ────────────────────────────────────────────── */

function HtmlEmailBody({ html, isHtml }: { html: string; isHtml: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    if (isHtml) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 12px;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            img { max-width: 100%; height: auto; }
            a { color: #2563eb; }
            blockquote {
              border-left: 3px solid #d1d5db;
              margin: 8px 0;
              padding: 4px 12px;
              color: #6b7280;
            }
            pre { background: #f3f4f6; padding: 8px; border-radius: 4px; overflow-x: auto; }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `);
      doc.close();
    } else {
      const escaped = html
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 12px;
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            a { color: #2563eb; }
          </style>
        </head>
        <body>${escaped}</body>
        </html>
      `);
      doc.close();
    }

    const timer = setTimeout(() => {
      try {
        const h = doc.documentElement?.scrollHeight || doc.body?.scrollHeight || 200;
        setHeight(Math.min(Math.max(h + 16, 80), 800));
      } catch { setHeight(200); }
    }, 100);

    return () => clearTimeout(timer);
  }, [html, isHtml]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      title="Email content"
      className="w-full border-0"
      style={{ height: `${height}px` }}
    />
  );
}

/* ─── Compose Modal ──────────────────────────────────────────────────── */

function ComposeModal({
  open,
  onClose,
  onSent,
  replyTo,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  replyTo?: { threadId: string; messageId: string; to: string; cc: string; subject: string } | null;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && replyTo) {
      setTo(replyTo.to);
      setCc(replyTo.cc || '');
      setShowCc(!!replyTo.cc);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
      setBody('');
      setBcc('');
      setShowBcc(false);
    } else if (open) {
      setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('');
      setShowCc(false); setShowBcc(false);
    }
    setError('');
  }, [open, replyTo]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!to.trim()) { setError('Recipient is required'); return; }
    setSending(true);
    setError('');
    try {
      if (replyTo) {
        await api.post(`/gmail/reply/${replyTo.threadId}`, {
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject,
          body,
          messageId: replyTo.messageId,
        });
      } else {
        await api.post('/gmail/send', {
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject,
          body,
        });
      }
      onSent();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-t-xl sm:rounded-xl bg-white dark:bg-[#0a0a0a] shadow-2xl border border-gray-200 dark:border-[#1a1a1a] flex flex-col max-h-[85vh] animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0a0a0a]/80 rounded-t-xl">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {replyTo ? 'Reply' : 'New Message'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-[#111] text-gray-500 dark:text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSend} className="flex flex-col flex-1 min-h-0">
          <div className="px-5 py-3 space-y-2 border-b border-gray-100 dark:border-[#1a1a1a]/60">
            {/* To */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 dark:text-gray-400 w-10 shrink-0">To</label>
              <input
                type="text"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                placeholder="recipient@example.com"
              />
              <div className="flex gap-1 text-xs text-gray-400">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                    Cc
                  </button>
                )}
                {!showBcc && !replyTo && (
                  <button type="button" onClick={() => setShowBcc(true)} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                    Bcc
                  </button>
                )}
              </div>
            </div>

            {/* Cc */}
            {showCc && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 dark:text-gray-400 w-10 shrink-0">Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                  placeholder="cc@example.com"
                />
              </div>
            )}

            {/* Bcc */}
            {showBcc && !replyTo && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 dark:text-gray-400 w-10 shrink-0">Bcc</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={e => setBcc(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                  placeholder="bcc@example.com"
                />
              </div>
            )}

            {/* Subject */}
            {!replyTo && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 dark:text-gray-400 w-10 shrink-0">Subj</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                  placeholder="Subject"
                />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 px-5 py-3">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full h-full min-h-[200px] resize-none bg-transparent text-sm text-gray-900 dark:text-white outline-none placeholder:text-gray-400 leading-relaxed"
              placeholder="Write your message…"
            />
          </div>

          {error && (
            <div className="px-5 pb-2">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <button type="button" title="Bold" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                </svg>
              </button>
              <button type="button" title="Italic" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0v16m-4 0h8" transform="skewX(-12)" />
                </svg>
              </button>
              <button type="button" title="Link" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111] rounded-lg transition-colors">
                Discard
              </button>
              <button
                type="submit"
                disabled={sending || !to.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
              >
                {sending ? <Spinner size="sm" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                Send
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export function EmailPage() {
  const { user } = useAuth();

  // Google connection
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Labels
  const [labels, setLabels] = useState<Label[]>([]);
  const [activeLabel, setActiveLabel] = useState('INBOX');
  const [unreadCount, setUnreadCount] = useState(0);

  // Threads
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Selected thread
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Reply
  const [replyBody, setReplyBody] = useState('');
  const [replySending, setReplySending] = useState(false);

  // Compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeReply, setComposeReply] = useState<{
    threadId: string; messageId: string; to: string; cc: string; subject: string;
  } | null>(null);

  // Sidebar collapsed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ── Fetch Google Status ──────────────────────────────────────────── */

  useEffect(() => {
    api.get<GoogleStatus>('/google/status')
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ connected: false, google_email: null }))
      .finally(() => setStatusLoading(false));
  }, []);

  /* ── Fetch Labels & Unread Count ──────────────────────────────────── */

  useEffect(() => {
    if (!googleStatus?.connected) return;
    api.get<{ labels: Label[] }>('/gmail/labels')
      .then(r => setLabels(r.labels))
      .catch(() => {});
    api.get<{ count: number }>('/gmail/unread-count')
      .then(r => setUnreadCount(r.count))
      .catch(() => {});
  }, [googleStatus?.connected]);

  /* ── Fetch Threads ────────────────────────────────────────────────── */

  const fetchThreads = useCallback(async (label: string, query: string, pageToken?: string) => {
    if (pageToken) {
      setLoadingMore(true);
    } else {
      setThreadsLoading(true);
      setThreads([]);
    }
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (pageToken) params.set('pageToken', pageToken);
      params.set('label', label);
      const res = await api.get<ThreadsResponse>(`/gmail/threads?${params}`);
      if (pageToken) {
        setThreads(prev => [...prev, ...res.threads]);
      } else {
        setThreads(res.threads);
      }
      setNextPageToken(res.nextPageToken);
    } catch {
      if (!pageToken) setThreads([]);
    } finally {
      setThreadsLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!googleStatus?.connected) return;
    fetchThreads(activeLabel, searchQuery);
    setSelectedThreadId(null);
    setMessages([]);
  }, [googleStatus?.connected, activeLabel, searchQuery, fetchThreads]);

  /* ── Fetch Thread Messages ────────────────────────────────────────── */

  const openThread = useCallback(async (thread: Thread) => {
    setSelectedThreadId(thread.id);
    setMessagesLoading(true);
    setReplyBody('');

    if (thread.isUnread) {
      api.patch(`/gmail/threads/${thread.id}`, { markRead: true }).catch(() => {});
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, isUnread: false } : t));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      const res = await api.get<{ messages: Message[] }>(`/gmail/threads/${thread.id}`);
      setMessages(res.messages);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  /* ── Thread Actions ───────────────────────────────────────────────── */

  async function handleArchive(threadId: string) {
    try {
      await api.patch(`/gmail/threads/${threadId}`, { archive: true });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setMessages([]);
      }
    } catch { /* silently fail */ }
  }

  async function handleStar(threadId: string, starred: boolean) {
    try {
      await api.patch(`/gmail/threads/${threadId}`, starred ? { unstar: true } : { star: true });
      setThreads(prev =>
        prev.map(t => {
          if (t.id !== threadId) return t;
          const newLabels = starred
            ? t.labelIds.filter(l => l !== 'STARRED')
            : [...t.labelIds, 'STARRED'];
          return { ...t, labelIds: newLabels };
        }),
      );
    } catch { /* silently fail */ }
  }

  async function handleToggleRead(threadId: string, isUnread: boolean) {
    try {
      await api.patch(`/gmail/threads/${threadId}`, { markRead: isUnread });
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isUnread: !isUnread } : t));
      setUnreadCount(prev => isUnread ? Math.max(0, prev - 1) : prev + 1);
    } catch { /* silently fail */ }
  }

  /* ── Reply ────────────────────────────────────────────────────────── */

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !selectedThreadId || messages.length === 0) return;
    setReplySending(true);
    try {
      const lastMsg = messages[messages.length - 1];
      await api.post(`/gmail/reply/${selectedThreadId}`, {
        to: lastMsg.from,
        cc: lastMsg.cc || undefined,
        subject: lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`,
        body: replyBody,
        messageId: lastMsg.id,
      });
      setReplyBody('');
      const res = await api.get<{ messages: Message[] }>(`/gmail/threads/${selectedThreadId}`);
      setMessages(res.messages);
    } catch { /* silently fail */ }
    finally { setReplySending(false); }
  }

  /* ── Connect Gmail ────────────────────────────────────────────────── */

  async function handleConnectGmail() {
    try {
      const { url } = await api.get<{ url: string }>('/google/auth-url');
      window.location.href = url;
    } catch { /* silently fail */ }
  }

  /* ── Search ───────────────────────────────────────────────────────── */

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput);
  }

  /* ── Helpers ──────────────────────────────────────────────────────── */

  function getLabelUnread(labelId: string): number {
    if (labelId === 'INBOX') return unreadCount;
    const found = labels.find(l => l.id === labelId);
    return found?.messagesUnread || 0;
  }

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  /* ─── Loading / Not Connected ─────────────────────────────────────── */

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-black">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading email…</p>
        </div>
      </div>
    );
  }

  if (!googleStatus?.connected) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-black">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect your Gmail</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Link your Google account to send and receive emails directly from your CRM.
          </p>
          <button
            onClick={handleConnectGmail}
            className="inline-flex items-center gap-3 px-6 py-3 bg-white dark:bg-[#0a0a0a] border border-gray-300 dark:border-[#262626] rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-500 transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect with Google
          </button>
        </div>
      </div>
    );
  }

  /* ─── Main Layout ─────────────────────────────────────────────────── */

  return (
    <div className="flex h-full bg-gray-50 dark:bg-black overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Left Sidebar: Labels ─────────────────────────────────────── */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 fixed lg:static z-40 inset-y-0 left-0
        w-60 bg-white dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-[#1a1a1a]
        flex flex-col transition-transform duration-200 ease-in-out
      `}>
        {/* Compose Button */}
        <div className="p-4">
          <button
            onClick={() => { setComposeReply(null); setComposeOpen(true); setSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Compose
          </button>
        </div>

        {/* Labels List */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {SYSTEM_LABELS.map(label => {
            const count = getLabelUnread(label.id);
            const isActive = activeLabel === label.id;
            return (
              <button
                key={label.id}
                onClick={() => { setActiveLabel(label.id); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111]'}
                `}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={label.icon} />
                </svg>
                <span className="flex-1 text-left truncate">{label.name}</span>
                {count > 0 && (
                  <span className={`
                    text-xs font-semibold px-2 py-0.5 rounded-full
                    ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'}
                  `}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connected Account */}
        <div className="p-3 border-t border-gray-200 dark:border-[#1a1a1a]">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {googleStatus.google_email?.[0]?.toUpperCase() || 'G'}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {googleStatus.google_email}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Center Panel: Thread List ────────────────────────────────── */}
      <div className={`
        flex flex-col border-r border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a]
        w-full lg:w-96 shrink-0
        ${selectedThreadId ? 'hidden lg:flex' : 'flex'}
      `}>
        {/* Search bar */}
        <div className="p-3 border-b border-gray-200 dark:border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 lg:hidden transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <form onSubmit={handleSearch} className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search mail…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-[#111]/60 border border-transparent focus:border-blue-300 dark:focus:border-blue-600 focus:bg-white dark:focus:bg-gray-700 rounded-lg outline-none text-gray-900 dark:text-white placeholder:text-gray-400 transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {threadsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#111] flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No messages</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {searchQuery ? 'Try a different search' : 'This label is empty'}
              </p>
            </div>
          ) : (
            <>
              {threads.map(thread => {
                const { name: senderName } = parseName(thread.from);
                const isStarred = thread.labelIds.includes('STARRED');
                const isSelected = thread.id === selectedThreadId;
                return (
                  <div
                    key={thread.id}
                    onClick={() => openThread(thread)}
                    className={`
                      group relative flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-[#1a1a1a]/50 transition-colors
                      ${isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-[#111]/30'}
                    `}
                  >
                    {/* Unread indicator */}
                    {thread.isUnread && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                    )}

                    {/* Star */}
                    <button
                      onClick={e => { e.stopPropagation(); handleStar(thread.id, isStarred); }}
                      className={`
                        mt-0.5 shrink-0 transition-colors
                        ${isStarred
                          ? 'text-yellow-400 hover:text-yellow-500'
                          : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100'}
                      `}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isStarred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-sm truncate ${thread.isUnread ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                          {senderName}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                          {relativeTime(thread.date)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${thread.isUnread ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                        {thread.subject || '(no subject)'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 leading-relaxed">
                        {thread.snippet}
                      </p>
                      {/* Thread info row */}
                      <div className="flex items-center gap-2 mt-1">
                        {thread.messageCount > 1 && (
                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#111] px-1.5 py-0.5 rounded">
                            {thread.messageCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg shadow-sm p-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); handleArchive(thread.id); }}
                        title="Archive"
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleRead(thread.id, thread.isUnread); }}
                        title={thread.isUnread ? 'Mark as read' : 'Mark as unread'}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {thread.isUnread ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 19V8l7.89 5.26a2 2 0 002.22 0L21 8v11M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Load More */}
              {nextPageToken && (
                <div className="p-4 text-center">
                  <button
                    onClick={() => fetchThreads(activeLabel, searchQuery, nextPageToken)}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? <Spinner size="sm" /> : null}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right Panel: Message View ────────────────────────────────── */}
      <div className={`
        flex-1 flex flex-col bg-gray-50 dark:bg-black min-w-0
        ${selectedThreadId ? 'flex' : 'hidden lg:flex'}
      `}>
        {!selectedThreadId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Select a conversation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose a thread from the list to read messages
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-[#1a1a1a]">
              {/* Back button (mobile) */}
              <button
                onClick={() => { setSelectedThreadId(null); setMessages([]); }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 lg:hidden transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-white truncate">
                {selectedThread?.subject || '(no subject)'}
              </h2>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => selectedThreadId && handleArchive(selectedThreadId)}
                  title="Archive"
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>
                {selectedThread && (
                  <button
                    onClick={() => handleStar(selectedThread.id, selectedThread.labelIds.includes('STARRED'))}
                    title={selectedThread.labelIds.includes('STARRED') ? 'Unstar' : 'Star'}
                    className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] transition-colors ${
                      selectedThread.labelIds.includes('STARRED') ? 'text-yellow-400' : 'text-gray-500'
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={selectedThread.labelIds.includes('STARRED') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => selectedThreadId && selectedThread && handleToggleRead(selectedThreadId, selectedThread.isUnread)}
                  title={selectedThread?.isUnread ? 'Mark as read' : 'Mark as unread'}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] text-gray-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const { name: fromName, email: fromEmail } = parseName(msg.from);
                  const { name: toName } = parseName(msg.to);
                  const isLast = idx === messages.length - 1;
                  return (
                    <div key={msg.id} className="bg-white dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-[#1a1a1a] shadow-sm overflow-hidden">
                      {/* Message header */}
                      <div className="px-5 py-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5">
                          {fromName[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{fromName}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">&lt;{fromEmail}&gt;</span>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                              {fullDate(msg.date)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            To: {toName}
                            {msg.cc && <span className="ml-2">Cc: {parseName(msg.cc).name}</span>}
                          </div>
                        </div>

                        {/* Reply action on last message */}
                        {isLast && (
                          <button
                            onClick={() => {
                              setComposeReply({
                                threadId: msg.threadId,
                                messageId: msg.id,
                                to: msg.from,
                                cc: msg.cc,
                                subject: msg.subject,
                              });
                              setComposeOpen(true);
                            }}
                            title="Reply in new window"
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Message body */}
                      <div className="px-5 pb-4">
                        <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-[#1a1a1a]/50">
                          <HtmlEmailBody html={msg.body} isHtml={msg.isHtml} />
                        </div>
                      </div>

                      {/* Attachments */}
                      {msg.attachments.length > 0 && (
                        <div className="px-5 pb-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {msg.attachments.length} attachment{msg.attachments.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {msg.attachments.map(att => (
                              <a
                                key={att.id}
                                href={`/api/gmail/attachments/${msg.id}/${att.id}`}
                                download={att.filename}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-[#111] hover:bg-gray-100 dark:hover:bg-[#111] border border-gray-200 dark:border-[#262626] rounded-lg text-sm transition-colors group"
                              >
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-gray-700 dark:text-gray-300 truncate max-w-[160px]">{att.filename}</span>
                                <span className="text-xs text-gray-400">{formatSize(att.size)}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Inline reply box */}
            {messages.length > 0 && !messagesLoading && (
              <div className="border-t border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] p-4">
                <form onSubmit={handleReply} className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      placeholder={`Reply to ${parseName(messages[messages.length - 1].from).name}…`}
                      rows={2}
                      className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#262626] focus:border-blue-300 dark:focus:border-blue-600 rounded-xl outline-none text-gray-900 dark:text-white placeholder:text-gray-400 resize-none transition-colors"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleReply(e as unknown as FormEvent);
                        }
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={replySending || !replyBody.trim()}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm shrink-0"
                  >
                    {replySending ? <Spinner size="sm" /> : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                    Send
                  </button>
                </form>
                <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
                  Press Ctrl+Enter to send
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Compose Modal ────────────────────────────────────────────── */}
      <ComposeModal
        open={composeOpen}
        onClose={() => { setComposeOpen(false); setComposeReply(null); }}
        onSent={() => fetchThreads(activeLabel, searchQuery)}
        replyTo={composeReply}
      />
    </div>
  );
}
