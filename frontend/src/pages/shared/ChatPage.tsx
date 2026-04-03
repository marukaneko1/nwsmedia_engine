import { useState, useEffect, useRef, useCallback, FormEvent, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { Button } from '../../components/ui/Button';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Channel = {
  id: string;
  name: string;
  type: 'team' | 'role' | 'meeting' | 'direct';
  description: string | null;
  member_count: string;
  unread_count: string;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_first: string | null;
  last_message_sender_last: string | null;
};

type Message = {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  created_at: string;
  sender_first: string;
  sender_last: string;
  sender_role: string;
};

type ChatUser = { id: string; first_name: string; last_name: string; role: string };

type Mentionable = { id: string; name: string; type: 'user' | 'client'; role?: string };

/* ─── Helpers ────────────────────────────────────────────────────────── */

function timeStr(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (dt.toDateString() === now.toDateString()) return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fullTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateSeparator(d: string) {
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function channelIcon(type: string) {
  if (type === 'direct') return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
  if (type === 'meeting') return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
  return 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z';
}

function isImage(mimeType: string | null) {
  return mimeType?.startsWith('image/') ?? false;
}

const MENTION_RE = /@\[([^\]]+)\]\((user|client):([^)]+)\)/g;

function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_RE);
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, name, type] = match;
    parts.push(
      <span key={match.index} className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs font-semibold ${
        type === 'client'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-neutral-100 text-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-300'
      }`}>
        @{name}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function ChatPage() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [clients, setClients] = useState<{ id: string; company_name: string; contact_name: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId);

  // ── Socket connection ─────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Update channel list last message
      setChannels(prev => prev.map(c =>
        c.id === msg.channel_id
          ? { ...c, last_message_content: msg.content, last_message_at: msg.created_at, last_message_sender_first: msg.sender_first, last_message_sender_last: msg.sender_last, unread_count: c.id === activeChannelId ? '0' : String(parseInt(c.unread_count || '0') + 1) }
          : c
      ));
    });

    socket.on('user_typing', (data: { channelId: string; userId: string }) => {
      setTypingUsers(prev => {
        const next = new Map(prev);
        next.set(data.userId, data.channelId);
        return next;
      });
      setTimeout(() => {
        setTypingUsers(prev => {
          const next = new Map(prev);
          if (next.get(data.userId) === data.channelId) next.delete(data.userId);
          return next;
        });
      }, 3000);
    });

    socket.on('user_online', (data: { userId: string }) => {
      setOnlineUserIds(prev => new Set(prev).add(data.userId));
    });

    socket.on('user_offline', (data: { userId: string }) => {
      setOnlineUserIds(prev => { const next = new Set(prev); next.delete(data.userId); return next; });
    });

    return () => { socket.disconnect(); };
  }, []);

  // Keep activeChannelId accessible in socket handler
  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;

  // ── Fetch channels ────────────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    try {
      const res = await api.get<{ channels: Channel[] }>('/chat/channels');
      setChannels(res.channels);
      if (!activeChannelId && res.channels.length > 0) {
        setActiveChannelId(res.channels[0].id);
      }
    } catch { /* silent */ }
  }, [activeChannelId]);

  useEffect(() => { fetchChannels(); }, []);

  // ── Fetch online users & clients ─────────────────────────────────
  useEffect(() => {
    api.get<{ online: string[] }>('/chat/online')
      .then(res => setOnlineUserIds(new Set(res.online)))
      .catch(() => {});
    api.get<{ users: ChatUser[] }>('/chat/users')
      .then(res => setAllUsers(res.users))
      .catch(() => {});
    api.get<{ data: { id: string; company_name: string; contact_name: string }[] }>('/clients?limit=200')
      .then(res => setClients(res.data ?? []))
      .catch(() => {});
  }, []);

  const mentionables = useMemo<Mentionable[]>(() => {
    const list: Mentionable[] = allUsers
      .filter(u => u.id !== user?.id)
      .map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, type: 'user' as const, role: u.role }));
    for (const c of clients) {
      list.push({ id: c.id, name: c.company_name || c.contact_name, type: 'client' });
    }
    return list;
  }, [allUsers, clients, user?.id]);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionables.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, mentionables]);

  // ── Fetch messages for active channel ─────────────────────────────
  useEffect(() => {
    if (!activeChannelId) return;
    setLoadingMessages(true);
    api.get<{ messages: Message[] }>(`/chat/channels/${activeChannelId}/messages?limit=50`)
      .then(res => {
        setMessages(res.messages);
        // Mark as read
        api.patch(`/chat/channels/${activeChannelId}/read`).catch(() => {});
        socketRef.current?.emit('mark_read', { channelId: activeChannelId });
        setChannels(prev => prev.map(c => c.id === activeChannelId ? { ...c, unread_count: '0' } : c));
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [activeChannelId]);

  // ── Auto-scroll ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────
  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChannelId || !socketRef.current) return;

    socketRef.current.emit('send_message', { channelId: activeChannelId, content: input.trim() });
    setInput('');
  };

  // ── Typing indicator & @mention detection ────────────────────────
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (value: string) => {
    setInput(value);
    if (!activeChannelId || !socketRef.current) return;

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socketRef.current.emit('typing', { channelId: activeChannelId });
    typingTimeout.current = setTimeout(() => {}, 3000);

    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (m: Mentionable) => {
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx === -1) return;
    const mentionToken = `@[${m.name}](${m.type}:${m.id}) `;
    const newValue = textBefore.slice(0, atIdx) + mentionToken + textAfter;
    setInput(newValue);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  // ── File upload ───────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/chat/channels/${activeChannelId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
        }
        fetchChannels();
      }
    } catch { /* silent */ }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Start DM ──────────────────────────────────────────────────────
  const startDM = async (userId: string) => {
    try {
      const res = await api.get<{ channel: Channel }>(`/chat/dm/${userId}`);
      setShowNewDM(false);
      await fetchChannels();
      setActiveChannelId(res.channel.id);
      socketRef.current?.emit('join_channel', { channelId: res.channel.id });
    } catch { /* silent */ }
  };

  // ── Typing display ────────────────────────────────────────────────
  const typingDisplay = Array.from(typingUsers.entries())
    .filter(([uid, chId]) => chId === activeChannelId && uid !== user?.id)
    .map(([uid]) => allUsers.find(u => u.id === uid))
    .filter(Boolean);

  // ── Group messages by date ────────────────────────────────────────
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at).toDateString();
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: msg.created_at, msgs: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  const teamChannels = channels.filter(c => c.type === 'team' || c.type === 'role');
  const meetingChannels = channels.filter(c => c.type === 'meeting');
  const dmChannels = channels.filter(c => c.type === 'direct');

  return (
    <div className="flex h-full">
      {/* ── Left sidebar: Channel list ─────────────────────────────── */}
      <div className="w-72 flex flex-col border-r border-gray-200 bg-white dark:border-[#1a1a1a] dark:bg-black">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Chat</h2>
          <button
            onClick={() => setShowNewDM(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#111] dark:text-gray-400"
            title="New message"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Team channels */}
          {teamChannels.length > 0 && (
            <div className="px-3 pt-4 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1">Channels</p>
              {teamChannels.map(ch => (
                <ChannelRow key={ch.id} channel={ch} active={ch.id === activeChannelId} onClick={() => setActiveChannelId(ch.id)} />
              ))}
            </div>
          )}

          {/* Meeting threads */}
          {meetingChannels.length > 0 && (
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1">Meetings</p>
              {meetingChannels.map(ch => (
                <ChannelRow key={ch.id} channel={ch} active={ch.id === activeChannelId} onClick={() => setActiveChannelId(ch.id)} />
              ))}
            </div>
          )}

          {/* DMs */}
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between px-1 mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Direct Messages</p>
              <button
                onClick={() => setShowNewDM(true)}
                className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="New direct message"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            </div>
            {dmChannels.length === 0 && (
              <button
                onClick={() => setShowNewDM(true)}
                className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-left text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-[#111] dark:hover:text-gray-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Start a conversation
              </button>
            )}
            {dmChannels.map(ch => (
              <DMChannelRow key={ch.id} channel={ch} active={ch.id === activeChannelId} onClick={() => setActiveChannelId(ch.id)} onlineUserIds={onlineUserIds} currentUserId={user?.id} allUsers={allUsers} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Main chat area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {activeChannel ? (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white dark:border-[#1a1a1a] dark:bg-black">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={channelIcon(activeChannel.type)} />
            </svg>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {activeChannel.type === 'team' || activeChannel.type === 'role' ? `#${activeChannel.name}` : activeChannel.name}
              </h3>
              {activeChannel.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activeChannel.description}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">{activeChannel.member_count} members</span>
          </div>
        ) : (
          <div className="flex items-center px-6 py-3 border-b border-gray-200 dark:border-[#1a1a1a]">
            <p className="text-sm text-gray-500 dark:text-gray-400">Select a channel to start chatting</p>
          </div>
        )}

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-1 bg-gray-50 dark:bg-black">
          {loadingMessages ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
            </div>
          ) : messages.length === 0 && activeChannelId ? (
            <div className="text-center py-20">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {groupedMessages.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 border-t border-gray-200 dark:border-[#1a1a1a]" />
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{dateSeparator(group.date)}</span>
                    <div className="flex-1 border-t border-gray-200 dark:border-[#1a1a1a]" />
                  </div>
                  {group.msgs.map((msg, mi) => {
                    const isMe = msg.sender_id === user?.id;
                    const showAvatar = mi === 0 || group.msgs[mi - 1].sender_id !== msg.sender_id;

                    if (msg.message_type === 'system' || msg.message_type === 'meeting_link') {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <div className="rounded-full bg-blue-50 border border-blue-200 px-4 py-1.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    const bubbleContent = msg.message_type === 'file' && msg.file_url ? (
                      <div>
                        {isImage(msg.file_type) ? (
                          <img src={msg.file_url} alt={msg.file_name || 'image'} className="max-w-[280px] rounded-lg" />
                        ) : (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm underline decoration-dotted">
                            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                            </svg>
                            {msg.file_name || 'Download file'}
                          </a>
                        )}
                        {msg.content && <p className="mt-1 text-sm whitespace-pre-wrap break-words">{renderContent(msg.content)}</p>}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{renderContent(msg.content || '')}</p>
                    );

                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}>
                        <div className={`flex gap-2 max-w-[75%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && showAvatar ? (
                            <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-[#111] flex items-center justify-center text-gray-600 dark:text-gray-300 font-semibold text-[10px] shrink-0 mt-0.5">
                              {msg.sender_first[0]}{msg.sender_last[0]}
                            </div>
                          ) : !isMe ? (
                            <div className="w-7 shrink-0" />
                          ) : null}
                          <div>
                            {showAvatar && !isMe && (
                              <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{msg.sender_first} {msg.sender_last}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{fullTime(msg.created_at)}</span>
                              </div>
                            )}
                            {showAvatar && isMe && (
                              <div className="flex justify-end mb-0.5 mr-1">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{fullTime(msg.created_at)}</span>
                              </div>
                            )}
                            <div className={`rounded-2xl px-3.5 py-2 ${
                              isMe
                                ? 'bg-neutral-900 text-white rounded-br-md'
                                : 'bg-white text-gray-800 border border-gray-200 dark:bg-[#0a0a0a] dark:text-gray-200 dark:border-[#1a1a1a] rounded-bl-md'
                            }`}>
                              {bubbleContent}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingDisplay.length > 0 && (
          <div className="px-6 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            {typingDisplay.map(u => u!.first_name).join(', ')} {typingDisplay.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* Input bar */}
        {activeChannelId && (
          <form onSubmit={sendMessage} className="relative px-6 py-3 border-t border-gray-200 bg-white dark:border-[#1a1a1a] dark:bg-black">
            {/* @mention dropdown */}
            {mentionQuery !== null && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-6 right-6 mb-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-[#1a1a1a] dark:bg-[#0a0a0a] overflow-hidden z-20 max-h-56 overflow-y-auto">
                {filteredMentions.map((m, i) => (
                  <button
                    key={`${m.type}:${m.id}`}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors ${
                      i === mentionIdx ? 'bg-neutral-50 dark:bg-[#111]' : 'hover:bg-gray-50 dark:hover:bg-[#111]'
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      m.type === 'client'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        : 'bg-neutral-100 text-neutral-800 dark:bg-[#1a1a1a] dark:text-white'
                    }`}>
                      {m.type === 'client' ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      ) : (
                        m.name.split(' ').map(w => w[0]).join('').slice(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{m.name}</span>
                    </div>
                    <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                      m.type === 'client'
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-[#111] dark:text-gray-400'
                    }`}>
                      {m.type === 'client' ? 'Client' : m.role}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[#111] dark:hover:text-gray-300 transition-colors"
                title="Attach file"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (mentionQuery !== null && filteredMentions.length > 0) {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMentions.length - 1)); return; }
                      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
                      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentions[mentionIdx]); return; }
                      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e as any);
                    }
                  }}
                  placeholder="Type a message... Use @ to mention people or clients"
                  rows={1}
                  className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 resize-none dark:bg-[#0a0a0a] dark:border-[#262626] dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <Button type="submit" disabled={!input.trim()} size="md">
                Send
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ── New DM modal ───────────────────────────────────────────── */}
      <NewDMModal
        open={showNewDM}
        onClose={() => setShowNewDM(false)}
        users={allUsers}
        onlineUserIds={onlineUserIds}
        onSelect={startDM}
      />
    </div>
  );
}

/* ─── Channel row sub-component ──────────────────────────────────────── */

function ChannelRow({ channel, active, onClick }: {
  channel: Channel;
  active: boolean;
  onClick: () => void;
}) {
  const unread = parseInt(channel.unread_count || '0');
  const displayName = channel.type === 'team' || channel.type === 'role'
    ? `# ${channel.name}`
    : channel.name;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-left text-sm transition-colors ${
        active
          ? 'bg-neutral-50 text-neutral-800 dark:bg-[#1a1a1a] dark:text-white'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#111]'
      }`}
    >
      <svg className={`h-4 w-4 shrink-0 ${active ? 'text-brand-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={channelIcon(channel.type)} />
      </svg>
      <div className="flex-1 min-w-0">
        <p className={`truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{displayName}</p>
        {channel.last_message_content && (
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">
            {channel.last_message_sender_first}: {channel.last_message_content}
          </p>
        )}
      </div>
      {unread > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-xs font-bold text-white">
          {unread}
        </span>
      )}
      {channel.last_message_at && unread === 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{timeStr(channel.last_message_at)}</span>
      )}
    </button>
  );
}

/* ─── DM channel row with other person's name + online dot ──────────── */

function DMChannelRow({ channel, active, onClick, onlineUserIds, currentUserId, allUsers }: {
  channel: Channel;
  active: boolean;
  onClick: () => void;
  onlineUserIds: Set<string>;
  currentUserId?: string;
  allUsers: ChatUser[];
}) {
  const unread = parseInt(channel.unread_count || '0');

  // Extract the other person's name from "FirstA & FirstB"
  const nameParts = channel.name.split(' & ');
  let otherName = channel.name;
  let otherUser: ChatUser | undefined;

  // Try to find who the other user is by matching names against allUsers
  for (const u of allUsers) {
    if (nameParts.some(n => n === u.first_name) && u.id !== currentUserId) {
      otherUser = u;
      otherName = `${u.first_name} ${u.last_name}`;
      break;
    }
  }

  const isOnline = otherUser ? onlineUserIds.has(otherUser.id) : false;
  const initials = otherUser ? `${otherUser.first_name[0]}${otherUser.last_name[0]}` : otherName.slice(0, 2).toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-left text-sm transition-colors ${
        active
          ? 'bg-neutral-50 text-neutral-800 dark:bg-[#1a1a1a] dark:text-white'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#111]'
      }`}
    >
      <div className="relative shrink-0">
        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${
          active
            ? 'bg-brand-200 text-neutral-800 dark:bg-brand-800 dark:text-brand-200'
            : 'bg-gray-200 text-gray-600 dark:bg-[#111] dark:text-gray-300'
        }`}>
          {initials}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 ${
          isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{otherName}</p>
        {channel.last_message_content && (
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">
            {channel.last_message_sender_first}: {channel.last_message_content}
          </p>
        )}
      </div>
      {unread > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-xs font-bold text-white">
          {unread}
        </span>
      )}
      {channel.last_message_at && unread === 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{timeStr(channel.last_message_at)}</span>
      )}
    </button>
  );
}

/* ─── New DM Modal with search ──────────────────────────────────────── */

function NewDMModal({ open, onClose, users, onlineUserIds, onSelect }: {
  open: boolean;
  onClose: () => void;
  users: ChatUser[];
  onlineUserIds: Set<string>;
  onSelect: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const filtered = search.trim()
    ? users.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  // Sort online users first
  const sorted = [...filtered].sort((a, b) => {
    const aOnline = onlineUserIds.has(a.id) ? 0 : 1;
    const bOnline = onlineUserIds.has(b.id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.first_name.localeCompare(b.first_name);
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-[#1a1a1a]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Message</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-6 py-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search people..."
                className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-neutral-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#111] dark:text-gray-100 dark:placeholder-gray-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="px-6 pb-4 space-y-0.5 max-h-80 overflow-y-auto">
            {sorted.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No people found</p>
            )}
            {sorted.map(u => {
              const isOnline = onlineUserIds.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => onSelect(u.id)}
                  className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-[#111] transition-colors"
                >
                  <div className="relative">
                    <div className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-[#1a1a1a] flex items-center justify-center text-neutral-800 dark:text-white font-semibold text-xs">
                      {u.first_name[0]}{u.last_name[0]}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${
                      isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-gray-500 capitalize dark:text-gray-400">{u.role}</p>
                  </div>
                  {isOnline && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Online</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
