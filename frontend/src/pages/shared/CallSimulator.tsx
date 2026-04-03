import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

/* ─── Browser Speech API shim ────────────────────────────────────────── */

const SpeechRecognitionCtor: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

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

interface SpeechFeedback {
  fillerVerdict: string;
  pacingVerdict: string;
  confidenceVerdict: string;
  topFix: string;
}

interface Scores {
  overall: number;
  scores: Record<string, number>;
  headline: string;
  summary: string;
  wins: string[];
  misses: string[];
  bestLine: string;
  worstLine?: string;
  wouldHaveBooked: boolean;
  speechFeedback?: SpeechFeedback;
  rewrittenOpener?: string;
}

interface SpeechAnalytics {
  totalWords: number;
  fillerWords: Record<string, number>;
  totalFillers: number;
  pauseCount: number;
  avgPauseDuration: number;
  longestPause: number;
  callDuration: number;
  wordsPerMinute: number;
  turnCount: number;
  avgWordsPerTurn: number;
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

/* ─── Filler word patterns ───────────────────────────────────────────── */

const FILLER_PATTERNS = [
  'um', 'uh', 'uhh', 'umm', 'hmm', 'hm',
  'like', 'you know', 'basically', 'literally',
  'actually', 'so', 'right', 'i mean',
  'kind of', 'sort of', 'i guess', 'whatever',
  'honestly', 'obviously', 'just',
];

function countFillers(text: string): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {};
  for (const filler of FILLER_PATTERNS) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      counts[filler] = matches.length;
    }
  }
  return counts;
}

function mergeFillerCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const merged = { ...a };
  for (const [k, v] of Object.entries(b)) {
    merged[k] = (merged[k] || 0) + v;
  }
  return merged;
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
  const [scores, setScores] = useState<Scores | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [currentHint, setCurrentHint] = useState<typeof COACHING_HINTS[0] | null>(null);
  const [callStartTime, setCallStartTime] = useState(0);
  const [callTimer, setCallTimer] = useState(0);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Speech analytics tracking
  const [analytics, setAnalytics] = useState<SpeechAnalytics>({
    totalWords: 0, fillerWords: {}, totalFillers: 0,
    pauseCount: 0, avgPauseDuration: 0, longestPause: 0,
    callDuration: 0, wordsPerMinute: 0, turnCount: 0, avgWordsPerTurn: 0,
  });
  const lastSpeechEndRef = useRef<number>(0);
  const pauseDurationsRef = useRef<number[]>([]);
  const wordsPerTurnRef = useRef<number[]>([]);
  const pendingTranscriptRef = useRef('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

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

  /* ─── Audio level visualizer ──────────────────────────────────────── */

  const startAudioVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(avg / 128, 1));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }, []);

  const stopAudioVisualizer = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  /* ─── Speech Recognition setup ──────────────────────────────────────── */

  useEffect(() => {
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e: any) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalText) {
        pendingTranscriptRef.current = (pendingTranscriptRef.current ? pendingTranscriptRef.current + ' ' : '') + finalText.trim();
        setInterimText('');
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── TTS helpers ──────────────────────────────────────────────────── */

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = speechSynthesis.getVoices();
    const preferred = ['Google US English', 'Microsoft David', 'Alex', 'Daniel'];
    for (const name of preferred) {
      const v = voices.find((v) => v.name.includes(name) && v.lang.startsWith('en'));
      if (v) return v;
    }
    return voices.find((v) => v.lang.startsWith('en')) || null;
  }, []);

  const speakText = useCallback((text: string) => {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // After AI finishes speaking, auto-start listening again
      if (recognitionRef.current && screen === 'call') {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
            lastSpeechEndRef.current = Date.now();
          } catch {}
        }, 300);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
  }, [pickVoice, screen]);

  const stopSpeaking = useCallback(() => {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  /* ─── Auto-speak AI messages ──────────────────────────────────────── */

  useEffect(() => {
    if (screen !== 'call' || !ttsEnabledRef.current || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && !last.content.startsWith('[')) {
      speakText(last.content);
    }
  }, [messages, screen, speakText]);

  /* ─── Cleanup TTS on unmount / screen change ──────────────────────── */

  useEffect(() => {
    return () => {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      stopAudioVisualizer();
    };
  }, [screen, stopAudioVisualizer]);

  /* ─── Send voice message ──────────────────────────────────────────── */

  const sendVoiceMessage = useCallback(async () => {
    const text = pendingTranscriptRef.current.trim();
    if (!text || isLoading) return;

    // Stop listening while AI processes
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }
    stopSpeaking();

    // Track pause from last speech end
    if (lastSpeechEndRef.current > 0) {
      const pauseMs = Date.now() - lastSpeechEndRef.current;
      if (pauseMs > 2000) {
        pauseDurationsRef.current.push(pauseMs / 1000);
      }
    }

    // Track filler words and word count for this turn
    const turnFillers = countFillers(text);
    const turnWordCount = text.split(/\s+/).filter(Boolean).length;
    wordsPerTurnRef.current.push(turnWordCount);

    setAnalytics(prev => {
      const newFillers = mergeFillerCounts(prev.fillerWords, turnFillers);
      const newTotalFillers = Object.values(newFillers).reduce((a, b) => a + b, 0);
      const newTotalWords = prev.totalWords + turnWordCount;
      const newTurnCount = prev.turnCount + 1;
      return {
        ...prev,
        totalWords: newTotalWords,
        fillerWords: newFillers,
        totalFillers: newTotalFillers,
        turnCount: newTurnCount,
        avgWordsPerTurn: Math.round(newTotalWords / newTurnCount),
      };
    });

    pendingTranscriptRef.current = '';
    setInterimText('');

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

    setIsLoading(true);
    try {
      const res = await api.post<{ response: string }>('/simulator/chat', {
        niche: selNiche,
        difficulty: selDiff,
        messages: newMessages,
      });
      const aiMsg: Message = { role: 'assistant', content: res.response };
      setMessages((prev) => [...prev, aiMsg]);
      lastSpeechEndRef.current = Date.now();
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '[Connection lost — try again]' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, turn, isLoading, selNiche, selDiff, stopSpeaking]);

  /* ─── Mic toggle for push-to-talk ─────────────────────────────────── */

  function toggleMic() {
    if (!recognitionRef.current) return;

    if (isListening) {
      // Stop listening and send what we have
      recognitionRef.current.stop();
      setIsListening(false);
      setTimeout(() => sendVoiceMessage(), 200);
    } else {
      stopSpeaking();
      setInterimText('');
      pendingTranscriptRef.current = '';
      startAudioVisualizer();
      try {
        recognitionRef.current.start();
        setIsListening(true);
        if (lastSpeechEndRef.current === 0) lastSpeechEndRef.current = Date.now();
      } catch {
        setIsListening(false);
      }
    }
  }

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

  async function startCall() {
    if (!selNiche) return;
    const seedMsg: Message = { role: 'user', content: '[Phone rings and you pick up. Give your natural phone answer — just your name or business name, nothing else.]' };
    setMessages([seedMsg]);
    setTurn(0);
    setScores(null);
    setCurrentHint(null);
    setCallStartTime(Date.now());
    setCallTimer(0);
    setAnalytics({
      totalWords: 0, fillerWords: {}, totalFillers: 0,
      pauseCount: 0, avgPauseDuration: 0, longestPause: 0,
      callDuration: 0, wordsPerMinute: 0, turnCount: 0, avgWordsPerTurn: 0,
    });
    lastSpeechEndRef.current = 0;
    pauseDurationsRef.current = [];
    wordsPerTurnRef.current = [];
    pendingTranscriptRef.current = '';
    setScreen('call');

    setIsLoading(true);
    try {
      const res = await api.post<{ response: string }>('/simulator/chat', {
        niche: selNiche,
        difficulty: selDiff,
        messages: [seedMsg],
      });
      const aiMsg: Message = { role: 'assistant', content: res.response };
      setMessages((prev) => [...prev, aiMsg]);
      lastSpeechEndRef.current = Date.now();
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '[Connection lost — try again]' }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function endCall() {
    if (timerRef.current) clearInterval(timerRef.current);
    stopSpeaking();
    stopAudioVisualizer();
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    }

    // Finalize analytics
    const pauses = pauseDurationsRef.current;
    const finalCallDuration = Math.floor((Date.now() - callStartTime) / 1000);
    const finalAnalytics: SpeechAnalytics = {
      ...analytics,
      pauseCount: pauses.length,
      avgPauseDuration: pauses.length > 0 ? Math.round((pauses.reduce((a, b) => a + b, 0) / pauses.length) * 10) / 10 : 0,
      longestPause: pauses.length > 0 ? Math.round(Math.max(...pauses) * 10) / 10 : 0,
      callDuration: finalCallDuration,
      wordsPerMinute: finalCallDuration > 0 ? Math.round((analytics.totalWords / finalCallDuration) * 60) : 0,
    };
    setAnalytics(finalAnalytics);

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
        speechAnalytics: finalAnalytics,
      });
      setScores(res.scores);
      await saveSession(res.scores, finalAnalytics);
    } catch {
      setScores(null);
    } finally {
      setEvaluating(false);
    }
  }

  async function saveSession(evalScores: Scores, finalAnalytics: SpeechAnalytics) {
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
        duration_seconds: finalAnalytics.callDuration,
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
    stopAudioVisualizer();
  }

  const prospect = prospects.find((p) => p.id === selNiche);
  const fmtTimer = `${Math.floor(callTimer / 60)}:${(callTimer % 60).toString().padStart(2, '0')}`;

  const visibleMessages = messages.filter(
    (m) => m.content !== '[Phone rings and you pick up. Give your natural phone answer — just your name or business name, nothing else.]'
  );

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
                <p className="text-sm text-gray-500 dark:text-gray-400">Voice-only cold call practice with AI</p>
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
          {stats && parseInt(stats.total_sessions) > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Sessions" value={stats.total_sessions} />
              <StatBox label="Avg Score" value={stats.avg_score ? `${stats.avg_score}/10` : '—'} />
              <StatBox label="Best Score" value={stats.best_score != null ? `${stats.best_score}/10` : '—'} />
              <StatBox label="Book Rate" value={parseInt(stats.total_sessions) > 0 ? `${Math.round((parseInt(stats.booked_count) / parseInt(stats.total_sessions)) * 100)}%` : '—'} />
            </div>
          )}

          {showHistory ? (
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
            <>
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

              {!SpeechRecognitionCtor && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/10 dark:text-amber-300">
                  Voice recognition is not supported in this browser. Please use Chrome or Edge for the full voice experience.
                </div>
              )}

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

  /* ═══ CALL SCREEN — Voice Only ═════════════════════════════════════ */

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

            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${DIFF_CONFIG[selDiff].color} ${selDiff === 'easy' ? 'bg-green-100 dark:bg-green-900/20' : selDiff === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                {selDiff}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-gray-700 dark:text-gray-300">{fmtTimer}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">Turn {turn}</span>

              <button
                onClick={() => { setTtsEnabled(!ttsEnabled); if (ttsEnabled) stopSpeaking(); }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  ttsEnabled
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-[#111] dark:text-gray-500'
                }`}
                title={ttsEnabled ? 'Voice on — click to mute' : 'Voice off — click to unmute'}
              >
                {ttsEnabled ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
                {ttsEnabled ? 'Voice' : 'Muted'}
              </button>

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

        {/* Scrollable transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mx-auto max-w-3xl space-y-3">
            {visibleMessages.map((msg, i) => (
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

        {/* Voice control area — no text input */}
        <div className="border-t border-gray-200 bg-white px-6 py-6 dark:border-[#1a1a1a] dark:bg-black">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
            {/* Interim transcript preview */}
            {(isListening && (interimText || pendingTranscriptRef.current)) && (
              <div className="w-full rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                {pendingTranscriptRef.current}{interimText && <span className="opacity-60"> {interimText}</span>}
              </div>
            )}

            {/* AI speaking indicator */}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-0.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="w-1 rounded-full bg-blue-500 animate-pulse" style={{
                      height: `${8 + Math.random() * 16}px`,
                      animationDelay: `${i * 100}ms`,
                    }} />
                  ))}
                </div>
                <span>{prospect?.name} is speaking...</span>
              </div>
            )}

            {/* Large mic button */}
            <button
              onClick={toggleMic}
              disabled={isLoading || isSpeaking}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 disabled:opacity-40 ${
                isListening
                  ? 'bg-red-600 text-white shadow-xl shadow-red-600/40 scale-110'
                  : 'bg-neutral-900 text-white hover:bg-black hover:scale-105 dark:bg-white dark:text-black dark:hover:bg-neutral-200'
              }`}
            >
              {/* Audio level ring */}
              {isListening && (
                <span
                  className="absolute inset-0 rounded-full border-4 border-red-400 transition-transform duration-75"
                  style={{ transform: `scale(${1 + audioLevel * 0.5})`, opacity: 0.4 + audioLevel * 0.6 }}
                />
              )}
              {isListening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-red-600 opacity-15" />
              )}
              <svg className="relative w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-500">
              {isLoading
                ? 'Waiting for response...'
                : isSpeaking
                  ? 'Prospect is speaking — wait for them to finish'
                  : isListening
                    ? 'Listening — tap to send your response'
                    : 'Tap to speak'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══ FEEDBACK SCREEN — Enhanced ════════════════════════════════════ */

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

            {/* Speech Analytics Panel */}
            <Card>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Speech Analytics</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <AnalyticBox
                  label="Words Per Min"
                  value={analytics.wordsPerMinute.toString()}
                  status={analytics.wordsPerMinute >= 130 && analytics.wordsPerMinute <= 170 ? 'good' : analytics.wordsPerMinute > 0 ? 'warn' : 'neutral'}
                  hint="Target: 140-160 WPM"
                />
                <AnalyticBox
                  label="Filler Words"
                  value={analytics.totalFillers.toString()}
                  status={analytics.totalFillers <= 3 ? 'good' : analytics.totalFillers <= 8 ? 'warn' : 'bad'}
                  hint={analytics.totalFillers > 0 ? Object.entries(analytics.fillerWords).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w, c]) => `"${w}" ×${c}`).join(', ') : 'None detected'}
                />
                <AnalyticBox
                  label="Total Words"
                  value={analytics.totalWords.toString()}
                  status="neutral"
                  hint={`${analytics.avgWordsPerTurn} avg/turn`}
                />
                <AnalyticBox
                  label="Pauses (>2s)"
                  value={analytics.pauseCount.toString()}
                  status="neutral"
                  hint={analytics.longestPause > 0 ? `Longest: ${analytics.longestPause}s` : 'No long pauses'}
                />
              </div>

              {/* Filler word breakdown */}
              {analytics.totalFillers > 0 && (
                <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-[#1a1a1a]">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Filler Word Breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analytics.fillerWords)
                      .sort((a, b) => b[1] - a[1])
                      .map(([word, count]) => (
                        <span key={word} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                          "{word}" <span className="font-bold">×{count}</span>
                        </span>
                      ))
                    }
                  </div>
                </div>
              )}
            </Card>

            {/* AI Speech Feedback */}
            {scores.speechFeedback && (
              <Card className="!border-purple-200 dark:!border-purple-900/50">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Voice & Delivery Analysis
                </h3>
                <div className="space-y-3">
                  {scores.speechFeedback.fillerVerdict && (
                    <FeedbackItem icon="filler" title="Filler Words" text={scores.speechFeedback.fillerVerdict} />
                  )}
                  {scores.speechFeedback.pacingVerdict && (
                    <FeedbackItem icon="pace" title="Pacing & Pauses" text={scores.speechFeedback.pacingVerdict} />
                  )}
                  {scores.speechFeedback.confidenceVerdict && (
                    <FeedbackItem icon="confidence" title="Confidence" text={scores.speechFeedback.confidenceVerdict} />
                  )}
                  {scores.speechFeedback.topFix && (
                    <div className="mt-4 rounded-lg border-2 border-purple-300 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/10">
                      <p className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Top Fix for Next Call</p>
                      <p className="mt-1 text-sm font-medium text-purple-900 dark:text-purple-200">{scores.speechFeedback.topFix}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Category scores */}
            <Card>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Skill Breakdown</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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

            {/* Best & Worst lines */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {scores.bestLine && (
                <Card className="!border-amber-200 dark:!border-amber-900/50">
                  <h3 className="mb-2 text-sm font-bold text-amber-700 dark:text-amber-400">Best Line</h3>
                  <blockquote className="border-l-4 border-amber-300 pl-4 text-sm italic text-gray-700 dark:border-amber-700 dark:text-gray-300">
                    "{scores.bestLine}"
                  </blockquote>
                </Card>
              )}
              {scores.worstLine && (
                <Card className="!border-gray-300 dark:!border-gray-700">
                  <h3 className="mb-2 text-sm font-bold text-gray-600 dark:text-gray-400">Weakest Moment</h3>
                  <blockquote className="border-l-4 border-gray-300 pl-4 text-sm italic text-gray-600 dark:border-gray-600 dark:text-gray-400">
                    "{scores.worstLine}"
                  </blockquote>
                </Card>
              )}
            </div>

            {/* Rewritten opener */}
            {scores.rewrittenOpener && (
              <Card className="!border-blue-200 dark:!border-blue-900/50">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  What You Should Have Said Instead
                </h3>
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/10">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">"{scores.rewrittenOpener}"</p>
                </div>
              </Card>
            )}

            {/* Full transcript */}
            <Card>
              <details>
                <summary className="cursor-pointer text-sm font-bold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
                  View Full Transcript
                </summary>
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                  {visibleMessages.map((msg, i) => (
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

/* ─── Sub-components ─────────────────────────────────────────────────── */

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function AnalyticBox({ label, value, status, hint }: { label: string; value: string; status: 'good' | 'warn' | 'bad' | 'neutral'; hint: string }) {
  const colors = {
    good: 'border-green-200 dark:border-green-900/50',
    warn: 'border-yellow-200 dark:border-yellow-900/50',
    bad: 'border-red-200 dark:border-red-900/50',
    neutral: 'border-gray-200 dark:border-[#1a1a1a]',
  };
  const valueColors = {
    good: 'text-green-600 dark:text-green-400',
    warn: 'text-yellow-600 dark:text-yellow-400',
    bad: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-900 dark:text-gray-100',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[status]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${valueColors[status]}`}>{value}</p>
      <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{hint}</p>
    </div>
  );
}

function FeedbackItem({ icon, title, text }: { icon: string; title: string; text: string }) {
  const icons: Record<string, string> = {
    filler: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    pace: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    confidence: 'M13 10V3L4 14h7v7l9-11h-7z',
  };
  return (
    <div className="flex items-start gap-3 rounded-lg bg-purple-50/50 p-3 dark:bg-purple-900/5">
      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icons[icon] || icons.filler} />
      </svg>
      <div>
        <p className="text-xs font-bold text-purple-700 dark:text-purple-400">{title}</p>
        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{text}</p>
      </div>
    </div>
  );
}
