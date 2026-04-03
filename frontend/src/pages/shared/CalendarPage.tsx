import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../../utils/api';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  source: 'crm' | 'google';
  meetLink?: string;
  status?: string;
  color: string;
  htmlLink?: string;
  allDay?: boolean;
}

interface GoogleStatus {
  connected: boolean;
  google_email: string | null;
}

type ViewMode = 'month' | 'week' | 'day';

interface PositionedEvent {
  event: CalendarEvent;
  column: number;
  totalColumns: number;
}

interface EventForm {
  title: string;
  description: string;
  start: string;
  end: string;
  attendees: string;
}

const EMPTY_FORM: EventForm = { title: '', description: '', start: '', end: '', attendees: '' };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

/* ─── Date Helpers ────────────────────────────────────────────── */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return startOfDay(r);
}
function endOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + (6 - r.getDay()));
  return endOfDay(r);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}
function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function formatDateRange(d: Date, view: ViewMode): string {
  if (view === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (view === 'week') {
    const s = startOfWeek(d);
    const e = endOfWeek(d);
    if (s.getMonth() === e.getMonth())
      return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function toInputDT(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function getMonthGrid(d: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(d));
  const gridEnd = endOfWeek(endOfMonth(d));
  const days: Date[] = [];
  let cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}
function getWeekDays(d: Date): Date[] {
  const s = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/* ─── Event Layout (overlap columns) ─────────────────────────── */

function layoutEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (!events.length) return [];
  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime() ||
      new Date(b.end).getTime() - new Date(b.start).getTime() - (new Date(a.end).getTime() - new Date(a.start).getTime()),
  );
  const groups: { items: { event: CalendarEvent; col: number }[]; maxEnd: number }[] = [];
  for (const event of sorted) {
    const s = new Date(event.start).getTime();
    const e = new Date(event.end).getTime();
    let placed = false;
    for (const g of groups) {
      if (s < g.maxEnd) {
        const taken = new Set(
          g.items
            .filter(p => s < new Date(p.event.end).getTime() && e > new Date(p.event.start).getTime())
            .map(p => p.col),
        );
        let col = 0;
        while (taken.has(col)) col++;
        g.items.push({ event, col });
        g.maxEnd = Math.max(g.maxEnd, e);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ items: [{ event, col: 0 }], maxEnd: e });
  }
  const result: PositionedEvent[] = [];
  for (const g of groups) {
    const total = Math.max(...g.items.map(i => i.col)) + 1;
    for (const { event, col } of g.items) result.push({ event, column: col, totalColumns: total });
  }
  return result;
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const ds = startOfDay(day).getTime();
  const de = endOfDay(day).getTime();
  return events.filter(ev => {
    const es = new Date(ev.start).getTime();
    const ee = new Date(ev.end).getTime();
    return es < de && ee > ds;
  });
}

function eventGeometry(ev: CalendarEvent, day: Date): { top: number; height: number } {
  const es = new Date(ev.start);
  const ee = new Date(ev.end);
  let sh = es < startOfDay(day) ? HOUR_START : es.getHours() + es.getMinutes() / 60;
  let eh = !isSameDay(ee, day) || ee > endOfDay(day) ? HOUR_END : ee.getHours() + ee.getMinutes() / 60;
  sh = Math.max(sh, HOUR_START);
  eh = Math.min(eh, HOUR_END);
  return { top: (sh - HOUR_START) * HOUR_HEIGHT, height: Math.max((eh - sh) * HOUR_HEIGHT, 22) };
}

/* ─── Icons (inline SVG helpers) ──────────────────────────────── */

function ChevronLeft({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function ChevronRight({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Google Connection Banner ────────────────────────────────── */

function GoogleBanner({ status, onRefresh }: { status: GoogleStatus | null; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!status) return null;

  async function connect() {
    try {
      const { url } = await api.get<{ url: string }>('/google/auth-url');
      window.location.href = url;
    } catch { /* swallow */ }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await api.delete('/google/disconnect');
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status.connected)
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Connect Google Calendar to sync your events</span>
        </div>
        <Button size="sm" onClick={connect}>
          Connect Google Calendar
        </Button>
      </div>
    );

  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-3 dark:border-green-900 dark:bg-green-950/30">
      <div className="flex items-center gap-3">
        <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-green-800 dark:text-green-200">
          Connected as <span className="font-semibold">{status.google_email}</span>
        </span>
      </div>
      <button
        onClick={disconnect}
        disabled={busy}
        className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Disconnecting…' : 'Disconnect'}
      </button>
    </div>
  );
}

/* ─── Mini Calendar ───────────────────────────────────────────── */

function MiniCalendar({ currentDate, onSelect }: { currentDate: Date; onSelect: (d: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

  useEffect(() => {
    setMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate.getFullYear(), currentDate.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = useMemo(() => getMonthGrid(month), [month.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-60 shrink-0 hidden lg:block">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonth(addMonths(month, -1))} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#111] transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {MONTHS_SHORT[month.getMonth()]} {month.getFullYear()}
          </span>
          <button onClick={() => setMonth(addMonths(month, 1))} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#111] transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7">
          {DAYS.map(d => (
            <div key={d} className="py-1 text-center text-[11px] font-medium text-gray-500 dark:text-gray-500">
              {d.charAt(0)}
            </div>
          ))}
          {grid.map((day, i) => {
            const inMonth = isSameMonth(day, month);
            const sel = isSameDay(day, currentDate);
            const today = isToday(day);
            return (
              <button
                key={i}
                onClick={() => onSelect(day)}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all ${
                  sel
                    ? 'bg-neutral-900 font-semibold text-white'
                    : today
                      ? 'font-bold text-neutral-700 dark:text-white'
                      : inMonth
                        ? 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#111]'
                        : 'text-gray-300 hover:bg-gray-50 dark:text-gray-600 dark:hover:bg-gray-750'
                }`}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Event Popover ───────────────────────────────────────────── */

function EventPopover({
  event,
  anchor,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  anchor: { top: number; left: number };
  onClose: () => void;
  onEdit: (e: CalendarEvent) => void;
  onDelete: (e: CalendarEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 16) ref.current.style.left = `${anchor.left - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight - 16) ref.current.style.top = `${anchor.top - rect.height - 8}px`;
  }, [anchor]);

  const start = new Date(event.start);
  const end = new Date(event.end);
  const multi = !isSameDay(start, end);

  return (
    <div
      ref={ref}
      style={{ top: anchor.top, left: anchor.left }}
      className="fixed z-[60] w-80 rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-[#1a1a1a] dark:bg-[#0a0a0a] animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{event.title}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {event.allDay
              ? multi
                ? `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`
                : start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
              : multi
                ? `${start.toLocaleDateString()} ${fmtTime(start)} – ${end.toLocaleDateString()} ${fmtTime(end)}`
                : `${start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(start)} – ${fmtTime(end)}`}
          </span>
        </div>

        {/* Description */}
        {event.description && <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{event.description}</p>}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={event.source === 'google' ? 'blue' : 'purple'}>
            {event.source === 'google' ? 'Google Calendar' : 'CRM Meeting'}
          </Badge>
          {event.status && <Badge variant="gray">{event.status}</Badge>}
        </div>

        {/* Meet link */}
        {event.meetLink && (
          <a
            href={event.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Join Google Meet
          </a>
        )}

        {/* Google link */}
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            Open in Google Calendar
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-[#1a1a1a]">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onClose();
              onEdit(event);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              onClose();
              onDelete(event);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Current Time Indicator ──────────────────────────────────── */

function NowLine({ now }: { now: Date }) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < HOUR_START || h > HOUR_END) return null;
  const top = (h - HOUR_START) * HOUR_HEIGHT;
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative flex items-center">
        <div className="h-2.5 w-2.5 -ml-[5px] rounded-full bg-red-500" />
        <div className="flex-1 border-t-2 border-red-500" />
      </div>
    </div>
  );
}

/* ─── Month View ──────────────────────────────────────────────── */

function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent, pos: { top: number; left: number }) => void;
  onDayClick: (d: Date) => void;
}) {
  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate.getFullYear(), currentDate.getMonth()]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventMap = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const s = startOfDay(new Date(ev.start));
      const e = startOfDay(new Date(ev.end));
      let cur = new Date(s);
      while (cur <= e) {
        const k = dateKey(cur);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(ev);
        cur = addDays(cur, 1);
      }
    }
    return m;
  }, [events]);

  const MAX_PILLS = 3;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#1a1a1a]">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {grid.map((day, i) => {
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const dayEvents = eventMap.get(dateKey(day)) ?? [];
          const overflow = dayEvents.length - MAX_PILLS;

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`group relative min-h-[90px] cursor-pointer border-b border-r border-gray-100 p-1.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-[#111]/60 ${
                !inMonth ? 'bg-gray-50/50 dark:bg-black/30' : ''
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
                  today
                    ? 'bg-neutral-900 font-bold text-white'
                    : inMonth
                      ? 'font-medium text-gray-900 group-hover:bg-gray-200 dark:text-gray-100 dark:group-hover:bg-gray-700'
                      : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {day.getDate()}
              </span>

              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, MAX_PILLS).map(ev => (
                  <button
                    key={ev.id + dateKey(day)}
                    onClick={e => {
                      e.stopPropagation();
                      onEventClick(ev, { top: e.clientY, left: e.clientX + 8 });
                    }}
                    className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80"
                    style={{ backgroundColor: ev.color + '22', color: ev.color }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ev.color }} />
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="block px-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Time Grid (shared by Week & Day views) ──────────────────── */

function TimeColumn({
  day,
  events,
  now,
  onEventClick,
  onSlotClick,
  isOnlyColumn,
}: {
  day: Date;
  events: CalendarEvent[];
  now: Date;
  onEventClick: (ev: CalendarEvent, pos: { top: number; left: number }) => void;
  onSlotClick: (d: Date, hour: number) => void;
  isOnlyColumn?: boolean;
}) {
  const timedEvents = events.filter(e => !e.allDay);
  const positioned = layoutEvents(timedEvents);

  return (
    <div className="relative" style={{ height: HOURS.length * HOUR_HEIGHT }}>
      {/* Hour grid lines (clickable slots) */}
      {HOURS.map(h => (
        <div
          key={h}
          onClick={() => onSlotClick(day, h)}
          className="absolute left-0 right-0 border-b border-gray-100 cursor-pointer hover:bg-neutral-50/40 dark:border-gray-800 dark:hover:bg-brand-950/20 transition-colors"
          style={{ top: (h - HOUR_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        />
      ))}

      {/* Current time indicator */}
      {isToday(day) && <NowLine now={now} />}

      {/* Events */}
      {positioned.map(({ event, column, totalColumns }) => {
        const { top, height } = eventGeometry(event, day);
        const widthPct = 100 / totalColumns;
        const leftPct = column * widthPct;
        return (
          <button
            key={event.id}
            onClick={e => {
              e.stopPropagation();
              onEventClick(event, { top: e.clientY, left: e.clientX + 8 });
            }}
            className="absolute z-10 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-xs shadow-sm transition-all hover:shadow-md hover:brightness-95"
            style={{
              top,
              height,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              borderColor: event.color,
              backgroundColor: event.color + '18',
              color: event.color,
            }}
          >
            <p className="font-semibold leading-tight truncate">{event.title}</p>
            {height >= 40 && (
              <p className="mt-0.5 opacity-80 leading-tight truncate">{fmtTime(new Date(event.start))} – {fmtTime(new Date(event.end))}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Week View ───────────────────────────────────────────────── */

function WeekView({
  currentDate,
  events,
  now,
  onEventClick,
  onSlotClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  now: Date;
  onEventClick: (ev: CalendarEvent, pos: { top: number; left: number }) => void;
  onSlotClick: (d: Date, hour: number) => void;
}) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const nowH = new Date().getHours();
      const target = Math.max(0, (nowH - HOUR_START - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = target;
    }
  }, []);

  const allDayEvents = events.filter(e => e.allDay);
  const hasAllDay = allDayEvents.length > 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Day headers */}
      <div className="flex border-b border-gray-200 dark:border-[#1a1a1a]">
        <div className="w-16 shrink-0" />
        <div className="grid flex-1 grid-cols-7">
          {weekDays.map(day => {
            const today = isToday(day);
            return (
              <div key={day.getTime()} className="py-2 text-center">
                <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{DAYS[day.getDay()]}</div>
                <div
                  className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    today ? 'bg-neutral-900 text-white' : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All-day row */}
      {hasAllDay && (
        <div className="flex border-b border-gray-200 dark:border-[#1a1a1a]">
          <div className="w-16 shrink-0 flex items-center justify-end pr-3">
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">ALL DAY</span>
          </div>
          <div className="grid flex-1 grid-cols-7">
            {weekDays.map(day => {
              const dayAllDay = allDayEvents.filter(ev => {
                const es = startOfDay(new Date(ev.start)).getTime();
                const ee = endOfDay(new Date(ev.end)).getTime();
                const ds = startOfDay(day).getTime();
                return ds >= es && ds <= ee;
              });
              return (
                <div key={day.getTime()} className="flex flex-wrap gap-1 p-1 border-r border-gray-100 dark:border-gray-800">
                  {dayAllDay.map(ev => (
                    <button
                      key={ev.id}
                      onClick={e => {
                        e.stopPropagation();
                        onEventClick(ev, { top: e.clientY, left: e.clientX + 8 });
                      }}
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium truncate max-w-full transition-opacity hover:opacity-80"
                      style={{ backgroundColor: ev.color + '22', color: ev.color }}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
        {/* Time gutter */}
        <div className="w-16 shrink-0">
          {HOURS.map(h => (
            <div key={h} className="flex items-start justify-end pr-3" style={{ height: HOUR_HEIGHT }}>
              <span className="relative -top-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">{formatHour(h)}</span>
            </div>
          ))}
        </div>
        {/* Day columns */}
        <div className="grid flex-1 grid-cols-7">
          {weekDays.map(day => (
            <div key={day.getTime()} className="relative border-r border-gray-100 dark:border-gray-800">
              <TimeColumn
                day={day}
                events={eventsForDay(events.filter(e => !e.allDay), day)}
                now={now}
                onEventClick={onEventClick}
                onSlotClick={onSlotClick}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Day View ────────────────────────────────────────────────── */

function DayView({
  currentDate,
  events,
  now,
  onEventClick,
  onSlotClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  now: Date;
  onEventClick: (ev: CalendarEvent, pos: { top: number; left: number }) => void;
  onSlotClick: (d: Date, hour: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const nowH = new Date().getHours();
      const target = Math.max(0, (nowH - HOUR_START - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = target;
    }
  }, []);

  const allDayEvents = events.filter(e => e.allDay);
  const dayEvents = events.filter(e => !e.allDay);
  const today = isToday(currentDate);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex border-b border-gray-200 dark:border-[#1a1a1a]">
        <div className="w-16 shrink-0" />
        <div className="flex-1 py-2 text-center">
          <div className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{DAYS[currentDate.getDay()]}</div>
          <div
            className={`mx-auto mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
              today ? 'bg-neutral-900 text-white' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {currentDate.getDate()}
          </div>
        </div>
      </div>

      {/* All-day */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-gray-200 dark:border-[#1a1a1a]">
          <div className="w-16 shrink-0 flex items-center justify-end pr-3">
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">ALL DAY</span>
          </div>
          <div className="flex flex-wrap gap-1.5 p-2 flex-1">
            {allDayEvents.map(ev => (
              <button
                key={ev.id}
                onClick={e => onEventClick(ev, { top: e.clientY, left: e.clientX + 8 })}
                className="rounded-lg px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: ev.color + '22', color: ev.color }}
              >
                {ev.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
        <div className="w-16 shrink-0">
          {HOURS.map(h => (
            <div key={h} className="flex items-start justify-end pr-3" style={{ height: HOUR_HEIGHT }}>
              <span className="relative -top-2 text-[11px] font-medium text-gray-400 dark:text-gray-500">{formatHour(h)}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1 border-r border-gray-100 dark:border-gray-800">
          <TimeColumn
            day={currentDate}
            events={eventsForDay(dayEvents, currentDate)}
            now={now}
            onEventClick={onEventClick}
            onSlotClick={onSlotClick}
            isOnlyColumn
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/* ─── Main Calendar Page ──────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════ */

export function CalendarPage() {
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [now, setNow] = useState(() => new Date());

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* tick the clock every minute */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  /* fetch window calculation */
  const fetchRange = useMemo(() => {
    if (view === 'month') {
      const g = getMonthGrid(currentDate);
      return { start: startOfDay(g[0]).toISOString(), end: endOfDay(g[g.length - 1]).toISOString() };
    }
    if (view === 'week') {
      return { start: startOfWeek(currentDate).toISOString(), end: endOfWeek(currentDate).toISOString() };
    }
    return { start: startOfDay(currentDate).toISOString(), end: endOfDay(currentDate).toISOString() };
  }, [view, currentDate.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { events: data } = await api.get<{ events: CalendarEvent[] }>(
        `/calendar/events?start=${encodeURIComponent(fetchRange.start)}&end=${encodeURIComponent(fetchRange.end)}`,
      );
      setEvents(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [fetchRange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const status = await api.get<GoogleStatus>('/google/status');
      setGoogleStatus(status);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  /* Navigation */
  function navigate(dir: -1 | 1) {
    setCurrentDate(prev => {
      if (view === 'month') return addMonths(prev, dir);
      if (view === 'week') return addDays(prev, dir * 7);
      return addDays(prev, dir);
    });
  }
  function goToday() {
    setCurrentDate(startOfDay(new Date()));
  }

  /* Event interactions */
  function handleEventClick(ev: CalendarEvent, pos: { top: number; left: number }) {
    setSelectedEvent(ev);
    setPopoverPos(pos);
  }
  function closePopover() {
    setSelectedEvent(null);
  }

  function handleDayClick(day: Date) {
    setCurrentDate(startOfDay(day));
    setView('day');
  }

  function handleSlotClick(day: Date, hour: number) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1, 0);
    setEditingEvent(null);
    setForm({ title: '', description: '', start: toInputDT(start), end: toInputDT(end), attendees: '' });
    setModalOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description,
      start: toInputDT(new Date(ev.start)),
      end: toInputDT(new Date(ev.end)),
      attendees: '',
    });
    setModalOpen(true);
  }

  async function handleDelete(ev: CalendarEvent) {
    try {
      await api.delete(`/calendar/events/${ev.id}?source=${ev.source}`);
      await fetchEvents();
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingEvent) {
        await api.patch(`/calendar/events/${editingEvent.id}?source=${editingEvent.source}`, {
          title: form.title,
          description: form.description,
          start: new Date(form.start).toISOString(),
          end: new Date(form.end).toISOString(),
        });
      } else {
        const attendees = form.attendees
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        await api.post('/calendar/events', {
          title: form.title,
          description: form.description,
          start: new Date(form.start).toISOString(),
          end: new Date(form.end).toISOString(),
          attendees,
        });
      }
      setModalOpen(false);
      setEditingEvent(null);
      setForm({ ...EMPTY_FORM });
      await fetchEvents();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM });
  }

  function openCreate() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    setEditingEvent(null);
    setForm({ title: '', description: '', start: toInputDT(start), end: toInputDT(end), attendees: '' });
    setModalOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Google Banner */}
      <GoogleBanner status={googleStatus} onRefresh={fetchGoogleStatus} />

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Create button */}
          <Button onClick={openCreate} className="gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create
          </Button>

          {/* Today */}
          <Button variant="secondary" onClick={goToday}>
            Today
          </Button>

          {/* Navigation */}
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#111] transition-colors"
            >
              <ChevronLeft />
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#111] transition-colors"
            >
              <ChevronRight />
            </button>
          </div>

          {/* Date range */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatDateRange(currentDate, view)}</h1>
        </div>

        {/* View toggle */}
        <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-[#1a1a1a]">
          {(['month', 'week', 'day'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-[#0a0a0a] dark:text-gray-300 dark:hover:bg-[#111]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900 dark:bg-red-950/30">
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 dark:hover:text-red-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Mini Calendar Sidebar */}
        <MiniCalendar
          currentDate={currentDate}
          onSelect={d => {
            setCurrentDate(startOfDay(d));
          }}
        />

        {/* Main calendar */}
        <div className="flex flex-1 flex-col min-h-0 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#1a1a1a] dark:bg-[#0a0a0a] overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-[#1a1a1a] dark:border-t-brand-400" />
            </div>
          ) : view === 'month' ? (
            <MonthView currentDate={currentDate} events={events} onEventClick={handleEventClick} onDayClick={handleDayClick} />
          ) : view === 'week' ? (
            <WeekView currentDate={currentDate} events={events} now={now} onEventClick={handleEventClick} onSlotClick={handleSlotClick} />
          ) : (
            <DayView currentDate={currentDate} events={events} now={now} onEventClick={handleEventClick} onSlotClick={handleSlotClick} />
          )}
        </div>
      </div>

      {/* Event detail popover */}
      {selectedEvent && (
        <EventPopover
          event={selectedEvent}
          anchor={popoverPos}
          onClose={closePopover}
          onEdit={openEdit}
          onDelete={async ev => {
            closePopover();
            await handleDelete(ev);
          }}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editingEvent ? 'Edit Event' : 'Create Event'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Meeting with client"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Add a description…"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 dark:bg-[#0a0a0a] dark:text-gray-100 dark:placeholder-gray-500 dark:border-[#262626]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start"
              type="datetime-local"
              required
              value={form.start}
              onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
            />
            <Input
              label="End"
              type="datetime-local"
              required
              value={form.end}
              onChange={e => setForm(f => ({ ...f, end: e.target.value }))}
            />
          </div>
          {!editingEvent && (
            <Input
              label="Attendees"
              value={form.attendees}
              onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
              placeholder="email@example.com, another@example.com"
            />
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : editingEvent ? (
                'Save Changes'
              ) : (
                'Create Event'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
