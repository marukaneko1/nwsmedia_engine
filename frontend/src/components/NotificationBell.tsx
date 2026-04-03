import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadUnreadCount();

    const token = localStorage.getItem('token');
    if (token && !socketRef.current) {
      const socket = io({ auth: { token }, transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('notification', (notif: Notification) => {
        setNotifications((prev) => [notif, ...prev]);
        setUnread((prev) => prev + 1);
      });
    }

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (dropRef.current && !dropRef.current.contains(target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Position the dropdown using fixed positioning to escape overflow clipping
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dropW = 320;
    const dropH = 380;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropH && rect.top > dropH;

    setPos({
      top: openUp ? rect.top - dropH - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - dropW, window.innerWidth - dropW - 8)),
    });
  }, []);

  async function loadUnreadCount() {
    try {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      setUnread(res.count);
    } catch { /* ignore */ }
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await api.get<{ data: Notification[] }>('/notifications');
      setNotifications(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  function handleOpen() {
    if (!open) {
      loadNotifications();
      updatePos();
    }
    setOpen(!open);
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  async function handleClick(notif: Notification) {
    if (!notif.read_at) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n));
        setUnread((prev) => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
    if (notif.link) {
      setOpen(false);
      navigate(notif.link.startsWith('/') ? `/${user?.role}${notif.link}` : notif.link);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const typeIcons: Record<string, string> = {
    lead: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857',
    deal: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
    commission: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2',
    payment: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    system: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        title="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && pos && (
        <div
          ref={dropRef}
          className="fixed z-[9999] w-80 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-[#1a1a1a] dark:bg-[#0a0a0a]"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#1a1a1a]">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-neutral-600 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-white">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent dark:border-white dark:border-t-transparent" />
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No notifications yet</div>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#111] ${
                  !n.read_at ? 'bg-neutral-50 dark:bg-[#111]' : ''
                }`}
              >
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={typeIcons[n.type] || typeIcons.system} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read_at ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                    {n.title}
                  </p>
                  {n.message && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.message}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read_at && <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-neutral-900 dark:bg-white" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
