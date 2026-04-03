import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

/* ─── Types ──────────────────────────────────────────────────────────── */

type Screen = 'setup' | 'call' | 'feedback';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
}

interface Scores {
  overall: number;
  scores: Record<string, number>;
  headline: string;
  summary: string;
  wins: string[];
  misses: string[];
  bestLine: string;
  wouldHaveBooked: boolean;
}

interface PastSession {
  id: string;
  niche: string;
  difficulty: string;
  prospect_name: string;
  overall_score: number | null;
  would_have_booked: boolean | null;
  duration_seconds: number | null;
  turn_count: number | null;
  created_at: string;
}

interface Stats {
  total_sessions: string;
  avg_score: string | null;
  best_score: number | null;
  booked_count: string;
  avg_duration: string | null;
}

/* ─── Coaching hints ─────────────────────────────────────────────────── */

const COACHING_HINTS = [
  { phase: 'Opener', tip: 'Use a pattern interrupt — don\'t start with "How are you?" Try a competitor drop, revenue hook, or 30-second ask.' },
  { phase: 'Correction', tip: 'Try: "Correct me if I\'m wrong, but a lot of [niche] owners I talk to are dealing with..."' },
  { phase: 'Gap Building', tip: 'Ask about consequences: "At that pace, where does the business end up in 12 months?" Then PAUSE — silence is your weapon.' },
  { phase: 'Neutral Language', tip: 'Disarm with: "Honestly, I don\'t even know if we can help you yet — that\'s what I\'m trying to figure out."' },
  { phase: 'Close Attempt', tip: 'Assumptive: "Is there any downside to spending 20 minutes going over this together? We could do Tuesday or Thursday — which works?"' },
  { phase: 'Pace & Silence', tip: 'Slow down on discovery questions. Sound like a doctor, not a salesman. After asking about pain — let them sit in the silence.' },
  { phase: 'Objection', tip: 'Don\'t argue. Agree first, reframe: "Totally fair. Quick question though — what does your current lead gen look like?"' },
  { phase: 'Psychology', tip: 'When you say "You\'re probably going to tell me X" — they instinctively say the opposite. Use it to get them to open up.' },
];

/* ─── Difficulty config ──────────────────────────────────────────────── */

const DIFF_CONFIG: Record<Difficulty, { label: string; desc: string; color: string; activeBg: string }> = {
  easy: {
    label: 'Easy',
    desc: 'Friendly prospect, willing to talk. Great for new reps.',
    color: 'text-green-600 dark:text-green-400',
    activeBg: 'bg-green-600 dark:bg-green-500',
  },
  medium: {
    label: 'Medium',
    desc: 'Skeptical but fair — been burned before. 2-3 objections.',
    color: 'text-yellow-600 dark:text-yellow-400',
    activeBg: 'bg-yellow-600 dark:bg-yellow-500',
  },
  hard: {
    label: 'Hard',
    desc: 'Busy, annoyed, ready to hang up. Only masters book this.',
    color: 'text-red-600 dark:text-red-400',
    activeBg: 'bg-red-600 dark:bg-red-500',
  },
};

/* ─── Niche icons (simple SVG paths) ─────────────────────────────────── */

const NICHE_ICONS: Record<string, string> = {
  contractor: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  dentist: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  medspa: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  chiropractor: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  hvac: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  plumber: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  roofing: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  realtor: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  auto_dealer: 'M8 17h.01M16 17h.01M2 11l1.5-4.5A2 2 0 015.4 5h13.2a2 2 0 011.9 1.5L22 11m-20 0v6a1 1 0 001 1h1a2 2 0 004 0h8a2 2 0 004 0h1a1 1 0 001-1v-6m-20 0h20',
  law_firm: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
};

/* ─── Main Component ─────────────────────────────────────────────────── */

export function CallSimulator() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [selNiche, setSelNiche] = useState('');
  const [selDiff, setSelDiff] = useState<Difficulty>('medium');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [turn, setTurn] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [scores, setScores] = useState<Scores | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [currentHint, setCurrentHint] = useState<typeof COACHING_HINTS[0] | null>(null);
  const [callStartTime, setCallStartTime] = useState(0);
  const [callTimer, setCallTimer] = useState(0);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get<{ data: Prospect[] }>('/simulator/prospects')
      .then((res) => setProspects(res.data))
      .catch(() => {});
    loadStats();
    loadHistory();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (screen === 'call' && callStartTime > 0) {
      timerRef.current = setInterval(() => {
        setCallTimer(Math.floor((Date.now() - callStartTime) / 1000));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [screen, callStartTime]);

  async function loadStats() {
    try {
      const res = await api.get<{ data: Stats }>('/simulator/stats');
      setStats(res.data);
    } catch {}
  }

  async function loadHistory() {
    try {
      const res = await api.get<{ data: PastSession[] }>('/simulator/sessions?limit=10');
      setPastSessions(res.data);
    } catch {}
  }

  const sendToAI = useCallback(async (msgs: Message[]) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ response: string }>('/simulator/chat', {
        niche: selNiche,
        difficulty: selDiff,
        messages: msgs,
      });
      const aiMsg: Message = { role: 'assistant', content: res.response };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '[Connection lost — try again]' }]);
    } finally {
      setIsLoading(false);
    }
  }, [selNiche, selDiff]);

  async function startCall() {
    if (!selNiche) return;
    const seedMsg: Message = { role: 'user', content: '[Phone rings and you pick up. Give your natural phone answer — just your name or business name, nothing else.]' };
    setMessages([seedMsg]);
    setTurn(0);
    setScores(null);
    setCurrentHint(null);
    setCallStartTime(Date.now());
    setCallTimer(0);
    setScreen('call');
    await sendToAI([seedMsg]);
  }

  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    const newMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, newMsg];
    setMessages(newMessages);
    const newTurn = turn + 1;
    setTurn(newTurn);

    if (newTurn >= 3 && newTurn % 3 === 0) {
      const hint = COACHING_HINTS[Math.floor(Math.random() * COACHING_HINTS.length)];
      setCurrentHint(hint);
      setTimeout(() => setCurrentHint(null), 8000);
    }

    await sendToAI(newMessages);
  }

  async function endCall() {
    if (timerRef.current) clearInterval(timerRef.current);
    setEvaluating(true);
    setScreen('feedback');

    try {
      const callMessages = messages.filter((m) =>
        m.content !== '[Phone rings and you pick up. Give your natural phone answer — just your name or business name, nothing else.]'
      );
      const res = await api.post<{ scores: Scores }>('/simulator/evaluate', {
        niche: selNiche,
        difficulty: selDiff,
        messages: callMessages,
      });
      setScores(res.scores);
      await saveSession(res.scores);
    } catch {
      setScores(null);
    } finally {
      setEvaluating(false);
    }
  }

  async function saveSession(evalScores: Scores) {
    setSavingSession(true);
    const prospect = prospects.find((p) => p.id === selNiche);
    try {
      await api.post('/simulator/sessions', {
        niche: selNiche,
        difficulty: selDiff,
        prospect_name: prospect?.name || selNiche,
        prospect_title: prospect ? `${prospect.title}, ${prospect.company}` : '',
        transcript: messages,
        scores: evalScores.scores,
        overall_score: evalScores.overall,
        would_have_booked: evalScores.wouldHaveBooked,
        duration_seconds: callTimer,
        turn_count: turn,
      });
      loadHistory();
      loadStats();
    } catch {}
    setSavingSession(false);
  }

  function resetSetup() {
    setScreen('setup');
    setMessages([]);
    setTurn(0);
    setScores(null);
    setCurrentHint(null);
    setCallStartTime(0);
    setCallTimer(0);
    setInputValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const prospect = prospects.find((p) => p.id === selNiche);
  const fmtTimer = `${Math.floor(callTimer / 60)}:${(callTimer % 60).toString().padStart(2, '0')}`;

  /* ═══ SETUP SCREEN ═══════════════════════════════════════════════════ */

  if (screen === 'setup') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-[#1a1a1a] dark:bg-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-[#1a1a1a] dark:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Call Simulator</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Practice cold calls with AI prospects</p>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#111]"
            >
              {showHistory ? 'Back to Setup' : 'Past Sessions'}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl p-6">
          {/* Stats row */}
          {stats && parseInt(stats.total_sessions) > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Sessions" value={stats.total_sessions} />
              <StatBox label="Avg Score" value={stats.avg_score ? `${stats.avg_score}/10` : '—'} />
              <StatBox label="Best Score" value={stats.best_score != null ? `${stats.best_score}/10` : '—'} />
              <StatBox label="Book Rate" value={parseInt(stats.total_sessions) > 0 ? `${Math.round((parseInt(stats.booked_count) / parseInt(stats.total_sessions)) * 100)}%` : '—'} />
            </div>
          )}

          {showHistory ? (
            /* ─── History View ─── */
            <Card>
              <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">Past Sessions</h2>
              {pastSessions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No sessions yet. Start a practice call!</p>
              ) : (
                <div className="space-y-2">
                  {pastSessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 rounded-lg border border-gray-200 px-4 py-3 dark:border-[#1a1a1a]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.prospect_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{s.niche} · {s.difficulty}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {s.overall_score != null && (
                          <span className={`font-bold ${s.overall_score >= 7 ? 'text-green-600 dark:text-green-400' : s.overall_score >= 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                            {s.overall_score}/10
                          </span>
                        )}
                        {s.would_have_booked != null && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.would_have_booked ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                            {s.would_have_booked ? 'Booked' : 'No Book'}
                          </span>
                        )}
                        <span className="text-gray-400 dark:text-gray-500">
                          {new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            /* ─── Setup View ─── */
            <>
              {/* Difficulty selector */}
              <div className="mb-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Difficulty</h2>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(DIFF_CONFIG) as Difficulty[]).map((d) => {
                    const c = DIFF_CONFIG[d];
                    const active = selDiff === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setSelDiff(d)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          active
                            ? 'border-neutral-900 bg-white dark:border-white dark:bg-[#0a0a0a]'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-[#1a1a1a] dark:bg-[#0a0a0a] dark:hover:border-[#333]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${active ? c.activeBg : 'bg-gray-300 dark:bg-gray-600'}`} />
                          <span className={`text-sm font-bold ${active ? c.color : 'text-gray-700 dark:text-gray-300'}`}>{c.label}</span>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{c.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Niche selector */}
              <div className="mb-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Choose a Prospect</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {prospects.map((p) => {
                    const active = selNiche === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelNiche(p.id)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          active
                            ? 'border-neutral-900 bg-white dark:border-white dark:bg-[#0a0a0a]'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-[#1a1a1a] dark:bg-[#0a0a0a] dark:hover:border-[#333]'
                        }`}
                      >
                        <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-[#111] dark:text-gray-400'}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={NICHE_ICONS[p.id] || NICHE_ICONS.contractor} />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{p.title}, {p.company}</p>
                        <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 capitalize">{p.id.replace('_', ' ')}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start button */}
              <div className="flex justify-center">
                <button
                  onClick={startCall}
                  disabled={!selNiche}
                  className="flex items-center gap-3 rounded-2xl bg-green-600 px-10 py-4 text-lg font-bold text-white transition-all hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Start Practice Call
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ═══ CALL SCREEN ════════════════════════════════════════════════════ */

  if (screen === 'call') {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-black">
        {/* Call header */}
        <div className="border-b border-gray-200 bg-white px-6 py-3 dark:border-[#1a1a1a] dark:bg-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{prospect?.name || 'Prospect'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{prospect?.title}, {prospect?.company}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DIFF_CONFIG[selDiff].color} ${selDiff === 'easy' ? 'bg-green-100 dark:bg-green-900/20' : selDiff === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  {selDiff}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-gray-700 dark:text-gray-300">{fmtTimer}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Turn {turn}</span>
              </div>
              <button
                onClick={endCall}
                disabled={turn < 1}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.228 3.684A1 1 0 007.28 3H5z" />
                </svg>
                End Call
              </button>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {messages.filter((m) => m.content !== '[Phone rings and you pick up. Give your natural phone answer — just your name or business name, nothing else.]').map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                    : 'bg-white border border-gray-200 text-gray-800 dark:bg-[#0a0a0a] dark:border-[#1a1a1a] dark:text-gray-200'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">
                    {msg.role === 'user' ? 'You' : prospect?.name || 'Prospect'}
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 dark:bg-[#0a0a0a] dark:border-[#1a1a1a]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Coaching hint */}
        {currentHint && (
          <div className="border-t border-amber-200 bg-amber-50 px-6 py-2.5 dark:border-amber-800/50 dark:bg-amber-900/10">
            <div className="mx-auto flex max-w-3xl items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{currentHint.phase}</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">{currentHint.tip}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-6 py-4 dark:border-[#1a1a1a] dark:bg-black">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response... (Enter to send, Shift+Enter for new line)"
              rows={2}
              disabled={isLoading}
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-50 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-colors hover:bg-black disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══ FEEDBACK SCREEN ════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-[#1a1a1a] dark:bg-black">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Call Review</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {prospect?.name} · {selDiff} difficulty · {fmtTimer} · {turn} turns
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => { resetSetup(); startCall(); }}>
              Try Again
            </Button>
            <Button onClick={resetSetup}>
              New Call
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-6">
        {evaluating ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900 dark:border-gray-600 dark:border-t-white" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Analyzing your call performance...</p>
          </div>
        ) : scores ? (
          <div className="space-y-6">
            {/* Overall score + headline */}
            <Card className="!p-0 overflow-hidden">
              <div className={`flex items-center gap-6 p-6 ${scores.wouldHaveBooked ? 'bg-green-50 dark:bg-green-900/10' : 'bg-gray-50 dark:bg-[#0a0a0a]'}`}>
                <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-3xl font-black ${
                  scores.overall >= 8 ? 'bg-green-600 text-white' :
                  scores.overall >= 6 ? 'bg-yellow-500 text-white' :
                  scores.overall >= 4 ? 'bg-orange-500 text-white' :
                  'bg-red-600 text-white'
                }`}>
                  {scores.overall}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{scores.headline}</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{scores.summary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${scores.wouldHaveBooked ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                      {scores.wouldHaveBooked ? 'Would Have Booked' : 'Would Not Have Booked'}
                    </span>
                    {savingSession && <span className="text-xs text-gray-400">Saving...</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* Category scores */}
            <Card>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Skill Breakdown</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Object.entries(scores.scores).map(([label, score]) => (
                  <div key={label} className="rounded-lg border border-gray-200 p-3 dark:border-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
                      <span className={`text-sm font-black ${
                        score >= 8 ? 'text-green-600 dark:text-green-400' :
                        score >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                        score >= 4 ? 'text-orange-500' :
                        'text-red-600 dark:text-red-400'
                      }`}>{score}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#1a1a1a]">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          score >= 8 ? 'bg-green-500' :
                          score >= 6 ? 'bg-yellow-500' :
                          score >= 4 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Wins & Misses */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="!border-green-200 dark:!border-green-900/50">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  What You Did Well
                </h3>
                <ul className="space-y-2">
                  {scores.wins.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      {w}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="!border-red-200 dark:!border-red-900/50">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Areas to Improve
                </h3>
                <ul className="space-y-2">
                  {scores.misses.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                      {m}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Best line */}
            {scores.bestLine && (
              <Card className="!border-amber-200 dark:!border-amber-900/50">
                <h3 className="mb-2 text-sm font-bold text-amber-700 dark:text-amber-400">Best Line</h3>
                <blockquote className="border-l-4 border-amber-300 pl-4 text-sm italic text-gray-700 dark:border-amber-700 dark:text-gray-300">
                  "{scores.bestLine}"
                </blockquote>
              </Card>
            )}

            {/* Full transcript */}
            <Card>
              <details>
                <summary className="cursor-pointer text-sm font-bold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
                  View Full Transcript
                </summary>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                  {messages.filter((m) => m.content !== '[Phone rings and you pick up. Give your natural phone answer — just your name or business name, nothing else.]').map((msg, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'ml-8 bg-neutral-100 dark:bg-[#111]'
                        : 'mr-8 bg-gray-50 dark:bg-[#0a0a0a]'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {msg.role === 'user' ? 'You' : prospect?.name || 'Prospect'}
                      </span>
                      <p className="mt-0.5 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              </details>
            </Card>
          </div>
        ) : (
          <Card>
            <div className="flex flex-col items-center py-12 text-center">
              <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Could not evaluate this call. Try running another session.</p>
              <Button className="mt-4" onClick={resetSetup}>Start New Call</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── Stat Box ───────────────────────────────────────────────────────── */

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
