import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface CallHistory {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
  direction: string;
  status: string;
  recording_url: string | null;
  recording_sid: string | null;
  user_id: string | null;
  created_at: string;
}

interface PhoneAssignment {
  id: string;
  phone_number: string;
  account_sid: string;
  provider: string;
  friendly_name: string | null;
  number_type: string | null;
  forward_number: string | null;
  signed_in_forward: boolean;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

interface DialerSettings {
  id: string;
  user_id: string;
  max_attempts: number;
  retry_interval: number;
  auto_requeue: boolean;
  call_order: string;
  local_presence: boolean;
  between_call_delay: number;
  local_presence_default: boolean;
  auto_dial_default: boolean;
  audio_input_device_id: string | null;
  audio_output_device_id: string | null;
}

interface ActiveCall {
  callSid: string;
  to: string;
  from: string;
  status: 'ringing' | 'in-progress' | 'completed' | 'failed';
  startTime: number;
  isMuted: boolean;
  isOnHold: boolean;
}

interface CallHistoryResponse {
  data: CallHistory[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface MakeCallResponse {
  callSid: string;
  conferenceName: string;
  status: string;
  from: string;
  to: string;
  direction: string;
  dateCreated: string;
  webCallInfo: unknown;
}

/* ─── Constants ──────────────────────────────────────────────────────── */

type Tab = 'queue' | 'dialer' | 'history' | 'settings';

const NUMPAD_KEYS: { digit: string; letters: string }[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

const STATUS_BADGE: Record<string, 'green' | 'red' | 'yellow' | 'blue' | 'gray'> = {
  completed: 'green',
  'no-answer': 'red',
  missed: 'red',
  failed: 'red',
  busy: 'red',
  canceled: 'red',
  ringing: 'yellow',
  'in-progress': 'yellow',
  queued: 'blue',
  initiated: 'blue',
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function absoluteDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function smartTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffHr = (now.getTime() - d.getTime()) / 3600000;
  return diffHr < 24 ? relativeTime(dateStr) : absoluteDateTime(dateStr);
}

/* ─── SVG Icons ──────────────────────────────────────────────────────── */

function PhoneIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function PhoneOffIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L8.228 3.684A1 1 0 007.28 3H5z" />
    </svg>
  );
}

function MicIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function MicOffIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  );
}

function PauseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BackspaceIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7h11a1 1 0 011 1v12a1 1 0 01-1 1H10l-7-7z" />
    </svg>
  );
}

function ArrowUpIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

function ArrowDownIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}

function RefreshIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function TrashIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PlusIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
      {icon}
      <p className="mt-3 text-sm">{message}</p>
    </div>
  );
}

/* ─── Lead Queue Types ────────────────────────────────────────────────── */

interface QueueLead {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  icp_score: number | null;
  source: string | null;
  source_detail: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  industry: string | null;
  location_city: string | null;
  location_state: string | null;
  location_zip: string | null;
  company_size_min: number | null;
  company_size_max: number | null;
  estimated_revenue: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  tags: string[] | null;
  contact_attempts: number;
  last_contacted_at: string | null;
  next_followup_at: string | null;
}

interface Closer {
  id: string;
  first_name: string;
  last_name: string;
}

type CallOutcome = 'no_answer' | 'voicemail' | 'connected' | 'gatekeeper' | 'callback_booked' | 'dnc';

const OUTCOME_OPTIONS: { value: CallOutcome; label: string; color: string }[] = [
  { value: 'no_answer', label: 'No Answer', color: 'bg-gray-100 text-gray-700 dark:bg-[#111] dark:text-gray-300' },
  { value: 'voicemail', label: 'Voicemail', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { value: 'connected', label: 'Connected', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'gatekeeper', label: 'Gatekeeper', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'callback_booked', label: 'Callback Booked', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'dnc', label: 'DNC', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
];

const ICP_BADGE: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-[#111] dark:text-gray-400',
};

function QueueDetail({ label, value, link, linkLabel }: { label: string; value?: string | null; link?: boolean; linkLabel?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      {value ? (
        link ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-blue-600 hover:underline dark:text-blue-400" style={{ maxWidth: '60%' }}>{linkLabel || value}</a>
        ) : (
          <span className="font-medium text-gray-700 dark:text-gray-300 text-right" style={{ maxWidth: '60%' }}>{value}</span>
        )
      ) : (
        <span className="text-gray-300 dark:text-gray-600">—</span>
      )}
    </div>
  );
}

function icpTier(score: number | null): 'high' | 'medium' | 'low' {
  if (score == null) return 'low';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

interface ScriptTemplate {
  id: string;
  name: string;
  script: string;
}

const SHARED_BODY = `
═══ PHASE 2: FIND THE PROBLEM ═══
Tonality: Slow down. Curious, empathetic. Like a doctor.

THE CORRECTION TECHNIQUE:
"I don't know if this applies to you guys — correct me if I'm wrong — but a lot of [INDUSTRY] businesses we talk to who are trying to grow revenue are also dealing with inconsistent leads, a website that isn't converting, and no real marketing system in place. Is that the same situation for you?"

"Most business owners I talk to already have someone handling all this for them — is that the case for you guys?"

FOLLOW-UP QUESTIONS:
• "Walk me through how you're getting new clients right now."
• "If your lead flow stopped tomorrow — what's your backup?"
• "How long have you been running it this way?"
• "What's the cost of that to you every month?"

═══ PHASE 3: BUILD THE GAP ═══
Tonality: Measured, slightly serious. Concerned like a trusted advisor.

"So you've been relying on referrals for [X] years… at that pace, where does the business realistically end up in 12 months?"
"You mentioned you want to hit [X] by year end — what does that actually look like on your current path?"
"What's it costing you every month that this isn't solved?"

⚠️ After a gap question — PAUSE. Don't fill the silence. Let them sit in it.

═══ PHASE 4: FLIP THE DEFENSE ═══
Tonality: Relaxed, unbothered, almost indifferent.

"Honestly, I don't even know if we can help you yet — that's what I'm trying to figure out."
"You're probably going to tell me you're not looking to make any changes right now."

═══ PHASE 5: THE CLOSE ═══
Tonality: Confident, assumptive.

TRANSITION: "Before I let you go — can I give you a quick recommendation?"

FULL CLOSE:
"I talk to a lot of [INDUSTRY] owners dealing with exactly what you described. They always ask us about [X] and [Y]. Let's say that's where you are right now — is there any downside to spending 20 minutes going over this together? We do a free audit and analysis right on the call. We could do [day] or [day] — which one works better for you?"

═══ OBJECTION HANDLERS ═══

"Send me an email":
"Absolutely — and I will. But honestly, an email isn't going to give you the full picture. These 20 minutes are free, zero obligation — and most owners who do the audit find at least one thing they didn't know was costing them money. Does [day] or [day] work?"

"We already have someone":
"That's actually really common. The call isn't about replacing anyone, it's just a free audit. Worst case you walk away with a second opinion. Best case you find a gap. Does [day] or [day] work?"

"Not interested":
"Totally fair — I'm not here to push anything. Quick question though — what does your current lead gen look like?"

"No budget":
"I hear that — and I'm not here to sell you anything today. The audit is free. But what usually comes up is that the cost of not having a system is actually bigger than the cost of fixing it. Is that something worth 20 minutes?"

"Call me back next month":
"I can do that — but what changes next month? What if we just lock in 20 minutes now and you can cancel if anything comes up?"

"How did you get my number?":
"We research businesses in [INDUSTRY] that we think we can actually help. Your name came up. If after 60 more seconds it doesn't make sense, I'll let you go. Fair?"`;

const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'competitor-drop',
    name: 'Competitor Drop',
    script: `═══ NWS MEDIA — COLD CALL SCRIPT ═══
Template: Competitor Drop

═══ PHASE 1: THE OPENER ═══
Tonality: Calm, casual, peer-to-peer. Downward inflection.

"Hey [LEAD NAME], it's [YOUR NAME] from NWS Media. We just wrapped up a project with [competitor name] and helped them grow revenue by [X%]. You want me to keep going?"

AVOID: "How are you today?" / listing services / explaining NWS Media
${SHARED_BODY}`,
  },
  {
    id: 'good-news-bad-news',
    name: 'Good News / Bad News',
    script: `═══ NWS MEDIA — COLD CALL SCRIPT ═══
Template: Good News / Bad News

═══ PHASE 1: THE OPENER ═══
Tonality: Calm, casual, slightly playful. Downward inflection.

"Hey [LEAD NAME], it's [YOUR NAME] from NWS Media — do you want the good news or the bad news first?"

(Good news: We found a way to help businesses like yours increase revenue 200-300%.)
(Bad news: Most of your competitors already know about it.)

AVOID: "How are you today?" / listing services / explaining NWS Media
${SHARED_BODY}`,
  },
  {
    id: 'revenue-hook',
    name: 'Revenue Hook',
    script: `═══ NWS MEDIA — COLD CALL SCRIPT ═══
Template: Revenue Hook

═══ PHASE 1: THE OPENER ═══
Tonality: Calm, confident, matter-of-fact. Downward inflection.

"Hey [LEAD NAME], it's [YOUR NAME] from NWS Media. We work with [INDUSTRY] businesses to grow revenue 200 to 300%. Can I take 60 seconds to show you how?"

AVOID: "How are you today?" / listing services / explaining NWS Media
${SHARED_BODY}`,
  },
  {
    id: 'decision-maker',
    name: 'Decision Maker',
    script: `═══ NWS MEDIA — COLD CALL SCRIPT ═══
Template: Decision Maker

═══ PHASE 1: THE OPENER ═══
Tonality: Calm, curious, sounds internal. Downward inflection.

"Hey [LEAD NAME], quick question — who's handling the growth side of things over there?"

(If it's them: "Perfect — that's exactly who I need to talk to.")
(If someone else: "Got it — could you point me to them? I have something they'll want to see.")

AVOID: "How are you today?" / listing services / explaining NWS Media
${SHARED_BODY}`,
  },
  {
    id: '30-second-ask',
    name: '30-Second Ask',
    script: `═══ NWS MEDIA — COLD CALL SCRIPT ═══
Template: 30-Second Ask

═══ PHASE 1: THE OPENER ═══
Tonality: Casual, respectful, peer-to-peer. Downward inflection.

"Hey [LEAD NAME], do you have 30 seconds? I'm not going to waste your time."

(Then pivot to value): "I'm reaching out because we've been helping [INDUSTRY] businesses generate 2-3x more leads with a system most owners don't know exists. I just wanted to see if it's worth a quick conversation."

AVOID: "How are you today?" / listing services / explaining NWS Media
${SHARED_BODY}`,
  },
];


/* ─── Main Component ─────────────────────────────────────────────────── */

export function DialerPage() {
  const { user } = useAuth();
  const isVA = user?.role === 'va';
  const [activeTab, setActiveTab] = useState<Tab>(isVA ? 'queue' : 'dialer');

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'queue', label: 'Call Queue', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    { key: 'dialer', label: 'Dialer', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
    { key: 'history', label: 'Call History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-[#1a1a1a] dark:bg-black">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-[#1a1a1a] dark:text-white">
            <PhoneIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dialer</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Make and receive calls</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-neutral-50 text-neutral-800 dark:bg-[#111] dark:text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-[#111] dark:hover:text-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'queue' && <CallQueueTab />}
        {activeTab === 'dialer' && <DialerTab />}
        {activeTab === 'history' && <CallHistoryTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 0: CALL QUEUE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CallQueueTab() {
  const [leads, setLeads] = useState<QueueLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<CallOutcome | ''>('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPushPanel, setShowPushPanel] = useState(false);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [selectedCloser, setSelectedCloser] = useState('');
  const [painPoint, setPainPoint] = useState('');
  const [handoffNotes, setHandoffNotes] = useState('');
  const [pushSaving, setPushSaving] = useState(false);
  const [phoneAssignments, setPhoneAssignments] = useState<PhoneAssignment[]>([]);
  const [fromNumber, setFromNumber] = useState('');
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [sessionCalls, setSessionCalls] = useState(0);
  const [totalCalls, setTotalCalls] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => localStorage.getItem('va_script_template') || SCRIPT_TEMPLATES[0].id);
  const [customScripts, setCustomScripts] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('va_custom_scripts') || '{}'); } catch { return {}; }
  });
  const [editingScript, setEditingScript] = useState(false);

  const activeTemplate = SCRIPT_TEMPLATES.find(t => t.id === selectedTemplateId) || SCRIPT_TEMPLATES[0];
  const script = customScripts[selectedTemplateId] ?? activeTemplate.script;
  function setScript(val: string) {
    setCustomScripts(prev => {
      const next = { ...prev, [selectedTemplateId]: val };
      localStorage.setItem('va_custom_scripts', JSON.stringify(next));
      return next;
    });
  }
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadQueue();
    loadPhoneAssignments();
    loadTotalCalls();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (activeCall && activeCall.status !== 'completed') {
      timerRef.current = setInterval(() => {
        setCallTimer(Math.floor((Date.now() - activeCall.startTime) / 1000));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [activeCall]);

  async function loadQueue() {
    try {
      const res = await api.get<{ data: QueueLead[] }>('/leads?limit=200&sort=icp_score&order=desc');
      const eligible = res.data.filter(
        (l) => l.phone && ['new', 'contacted', 'nurture'].includes(l.stage)
      );
      setLeads(eligible);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }

  async function loadPhoneAssignments() {
    try {
      const res = await api.get<{ data: PhoneAssignment[] }>('/dialer/phone-assignments');
      setPhoneAssignments(res.data);
      const active = res.data.find((p) => p.is_active);
      if (active) setFromNumber(active.phone_number);
      else if (res.data.length > 0) setFromNumber(res.data[0].phone_number);
    } catch {
      /* silently fail */
    }
  }

  async function loadClosers() {
    try {
      const res = await api.get<{ closers: Closer[] }>('/users/closers');
      setClosers(res.closers);
    } catch {
      /* silently fail */
    }
  }

  async function loadTotalCalls() {
    try {
      const res = await api.get<CallHistoryResponse>('/dialer/voice/call-history?limit=1&page=1');
      setTotalCalls(res.total);
    } catch {
      /* silently fail */
    }
  }

  function resetForm() {
    setNotes('');
    setOutcome('');
    setFollowUp('');
    setShowPushPanel(false);
    setSelectedCloser('');
    setPainPoint('');
    setHandoffNotes('');
  }

  function advance() {
    resetForm();
    setCurrentIdx((i) => i + 1);
  }

  function handleSkip() {
    advance();
  }

  async function handleCallLead() {
    const lead = leads[currentIdx];
    if (!lead?.phone || !fromNumber || isCalling) return;
    setIsCalling(true);
    try {
      const assignment = phoneAssignments.find((p) => p.phone_number === fromNumber);
      if (!assignment) return;
      const res = await api.post<MakeCallResponse>('/dialer/voice/real-call', {
        to: lead.phone,
        from: fromNumber,
        credentials: { accountSid: assignment.account_sid },
      });
      setActiveCall({
        callSid: res.callSid,
        to: lead.phone,
        from: fromNumber,
        status: 'ringing',
        startTime: Date.now(),
        isMuted: false,
        isOnHold: false,
      });
      setCallTimer(0);
      setTimeout(() => {
        setActiveCall((prev) => (prev ? { ...prev, status: 'in-progress' } : null));
      }, 3000);
    } catch {
      /* call failed */
    } finally {
      setIsCalling(false);
    }
  }

  async function handleEndCall() {
    if (!activeCall) return;
    try {
      const assignment = phoneAssignments.find((p) => p.phone_number === activeCall.from);
      await api.put(`/dialer/voice/call/${activeCall.callSid}`, {
        status: 'completed',
        credentials: assignment ? { accountSid: assignment.account_sid } : undefined,
      });
    } catch {
      /* silently fail */
    }
    setActiveCall(null);
    setCallTimer(0);
  }

  async function handleSaveAndNext() {
    const lead = leads[currentIdx];
    if (!lead || !outcome) return;
    setSaving(true);
    try {
      await api.post('/activities', {
        lead_id: lead.id,
        activity_type: 'call',
        outcome,
        notes,
        call_duration_seconds: callTimer > 0 ? callTimer : undefined,
      });
      if (followUp) {
        await api.put(`/leads/${lead.id}`, { next_followup_at: followUp });
      }
      setSessionCalls((c) => c + 1);
      setTotalCalls((c) => (c ?? 0) + 1);
      advance();
    } catch {
      /* silently fail */
    } finally {
      setSaving(false);
    }
  }

  function openPushPanel() {
    setHandoffNotes(notes);
    setShowPushPanel(true);
    if (closers.length === 0) loadClosers();
  }

  async function handlePushToCloser() {
    const lead = leads[currentIdx];
    if (!lead || !selectedCloser) return;
    setPushSaving(true);
    try {
      await api.post(`/leads/${lead.id}/qualify`, {
        assigned_closer_id: selectedCloser,
        pain_point: painPoint || undefined,
        handoff_notes: handoffNotes || undefined,
      });
      advance();
    } catch {
      /* silently fail */
    } finally {
      setPushSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="w-8 h-8 text-neutral-700" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<PhoneIcon className="w-12 h-12" />}
          message="No leads in your queue. Leads assigned to you with a phone number will appear here."
        />
      </Card>
    );
  }

  if (currentIdx >= leads.length) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">All caught up!</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">You&apos;ve gone through all leads in your queue.</p>
          <Button className="mt-6" onClick={() => { setCurrentIdx(0); resetForm(); loadQueue(); }}>
            <RefreshIcon className="w-4 h-4 mr-2" />
            Restart Queue
          </Button>
        </div>
      </Card>
    );
  }

  const lead = leads[currentIdx];
  const tier = icpTier(lead.icp_score);

  return (
    <div className="flex gap-6">
      {/* Left Column: Lead Card */}
      <div className="w-2/5 space-y-4">
        <Card className="!p-0">
          <div className="p-6">
            {/* Queue position */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {currentIdx + 1} of {leads.length}
              </span>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ICP_BADGE[tier]}`}>
                  ICP: {lead.icp_score ?? '—'}
                </span>
                <Badge variant={lead.stage === 'new' ? 'blue' : lead.stage === 'contacted' ? 'yellow' : 'purple'}>
                  {lead.stage}
                </Badge>
              </div>
            </div>

            {/* Lead info */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {lead.first_name} {lead.last_name}
            </h2>
            {lead.company_name && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{lead.company_name}</p>
            )}

            {/* Contact info */}
            <div className="mt-4 space-y-2">
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <PhoneIcon className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{formatPhoneDisplay(lead.phone)}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{lead.email}</span>
                </div>
              )}
            </div>

            {/* Full lead details */}
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Lead Details</p>
              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                <QueueDetail label="Source" value={lead.source ? `${lead.source}${lead.source_detail ? ` — ${lead.source_detail}` : ''}` : null} />
                <QueueDetail label="UTM" value={[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ') || null} />
                <QueueDetail label="Industry" value={lead.industry} />
                <QueueDetail label="Location" value={[lead.location_city, lead.location_state, lead.location_zip].filter(Boolean).join(', ') || null} />
                <QueueDetail label="Company Size" value={
                  lead.company_size_min != null || lead.company_size_max != null
                    ? `${lead.company_size_min ?? '?'}–${lead.company_size_max ?? '?'} employees`
                    : null
                } />
                <QueueDetail label="Est. Revenue" value={lead.estimated_revenue ? `$${Number(lead.estimated_revenue).toLocaleString()}` : null} />
                <QueueDetail label="Website" value={lead.website_url} link />
                <QueueDetail label="LinkedIn" value={lead.linkedin_url} link linkLabel="View Profile" />
                <QueueDetail label="Tags" value={lead.tags?.length ? lead.tags.join(', ') : null} />
                <QueueDetail label="Contact Attempts" value={String(lead.contact_attempts ?? 0)} />
                <QueueDetail label="Last Contacted" value={lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : null} />
                <QueueDetail label="Next Follow-up" value={lead.next_followup_at ? new Date(lead.next_followup_at).toLocaleString() : null} />
              </div>
            </div>

            {/* Active call indicator */}
            {activeCall && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      {activeCall.status === 'ringing' ? 'Ringing...' : 'Connected'}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold text-green-700 dark:text-green-300">
                    {formatDuration(callTimer)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setActiveCall((prev) => prev ? { ...prev, isMuted: !prev.isMuted } : null)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeCall.isMuted
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-300'
                    }`}
                  >
                    {activeCall.isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    End Call
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-5 space-y-2">
              {!activeCall ? (
                <button
                  onClick={handleCallLead}
                  disabled={!lead.phone || !fromNumber || isCalling}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCalling ? <Spinner className="w-5 h-5" /> : <PhoneIcon className="w-5 h-5" />}
                  <span className="font-semibold">{isCalling ? 'Calling...' : 'Call Lead'}</span>
                </button>
              ) : null}

              <button
                onClick={handleSkip}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-2.5 text-gray-700 transition-colors hover:bg-gray-50 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-300 dark:hover:bg-[#111]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium">Skip</span>
              </button>
            </div>

            {/* From number selector */}
            {phoneAssignments.length > 0 && (
              <div className="mt-4">
                <Select
                  label="Call from"
                  options={phoneAssignments.map((p) => ({
                    value: p.phone_number,
                    label: p.friendly_name
                      ? `${p.friendly_name} - ${formatPhoneDisplay(p.phone_number)}`
                      : formatPhoneDisplay(p.phone_number),
                  }))}
                  value={fromNumber}
                  onChange={(e) => setFromNumber(e.target.value)}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Queue progress */}
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-[#1a1a1a] dark:bg-black">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Queue progress</span>
            <span>{Math.round(((currentIdx) / leads.length) * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-[#111]">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all duration-300"
              style={{ width: `${((currentIdx) / leads.length) * 100}%` }}
            />
          </div>

          {/* Call stats */}
          <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 dark:border-[#1a1a1a]">
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{sessionCalls}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">This Session</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-[#1a1a1a]" />
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalCalls ?? '—'}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Overall</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Notes + Disposition */}
      <div className="w-3/5 space-y-4">
        <Card className="!p-0">
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Call Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this call..."
              rows={4}
              className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100 dark:placeholder:text-gray-500"
            />

            {/* Outcome selector */}
            <div className="mt-4">
              <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Outcome</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTCOME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOutcome(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      outcome === opt.value
                        ? `${opt.color} ring-2 ring-neutral-500 ring-offset-1 dark:ring-offset-gray-900`
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-[#0a0a0a] dark:text-gray-400 dark:hover:bg-[#111]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Follow-up date */}
            <div className="mt-4">
              <Input
                label="Next Follow-up (optional)"
                type="datetime-local"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>

            {/* Save & Next */}
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={handleSaveAndNext} disabled={!outcome || saving}>
                {saving ? <Spinner className="w-4 h-4 mr-2" /> : null}
                Save &amp; Next
              </Button>
              <Button variant="secondary" onClick={openPushPanel}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                Push to Closer
              </Button>
            </div>
          </div>
        </Card>

        {/* Push to Closer Panel */}
        {showPushPanel && (
          <Card className="!p-0 border-2 border-purple-200 dark:border-purple-800">
            <div className="border-b border-purple-200 bg-purple-50 px-6 py-3 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100">Push to Closer</h3>
                <button
                  onClick={() => setShowPushPanel(false)}
                  className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-300"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <Select
                label="Assign to Closer"
                options={[
                  { value: '', label: 'Select a closer...' },
                  ...closers.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })),
                ]}
                value={selectedCloser}
                onChange={(e) => setSelectedCloser(e.target.value)}
              />
              <Input
                label="Pain Point"
                placeholder="What problem does the client need solved?"
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Handoff Notes
                </label>
                <textarea
                  value={handoffNotes}
                  onChange={(e) => setHandoffNotes(e.target.value)}
                  placeholder="Any relevant context for the closer..."
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handlePushToCloser} disabled={!selectedCloser || pushSaving}>
                  {pushSaving ? <Spinner className="w-4 h-4 mr-2" /> : null}
                  Confirm Handoff
                </Button>
                <Button variant="ghost" onClick={() => setShowPushPanel(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Call Script */}
        <Card className="!p-0">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Call Script</h3>
            </div>
            <div className="flex items-center gap-2">
              {editingScript && customScripts[selectedTemplateId] && (
                <button
                  onClick={() => {
                    setCustomScripts(prev => {
                      const next = { ...prev };
                      delete next[selectedTemplateId];
                      localStorage.setItem('va_custom_scripts', JSON.stringify(next));
                      return next;
                    });
                  }}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Reset to Default
                </button>
              )}
              <button
                onClick={() => setEditingScript(!editingScript)}
                className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-[#111] dark:hover:text-gray-200"
              >
                {editingScript ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Template selector */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-6 py-2.5 dark:border-[#111] scrollbar-hide">
            {SCRIPT_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplateId(t.id);
                  localStorage.setItem('va_script_template', t.id);
                  setEditingScript(false);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTemplateId === t.id
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-400 dark:hover:bg-[#1a1a1a]'
                }`}
              >
                {t.name}
                {customScripts[t.id] && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" title="Customized" />
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {editingScript ? (
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={20}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed shadow-sm transition-colors placeholder:text-gray-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {script
                    .replace(/\[LEAD NAME\]/g, `${lead.first_name} ${lead.last_name}`)
                    .replace(/\[COMPANY\]/g, lead.company_name || '[COMPANY]')
                    .replace(/\[INDUSTRY\]/g, lead.industry || '[INDUSTRY]')}
                </pre>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 1: DIALER
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function DialerTab() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [phoneAssignments, setPhoneAssignments] = useState<PhoneAssignment[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallHistory[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadPhoneAssignments();
    loadRecentCalls();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (activeCall && activeCall.status !== 'completed') {
      timerRef.current = setInterval(() => {
        setCallTimer(Math.floor((Date.now() - activeCall.startTime) / 1000));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [activeCall]);

  async function loadPhoneAssignments() {
    try {
      const res = await api.get<{ data: PhoneAssignment[] }>('/dialer/phone-assignments');
      setPhoneAssignments(res.data);
      const active = res.data.find((p) => p.is_active);
      if (active) setFromNumber(active.phone_number);
      else if (res.data.length > 0) setFromNumber(res.data[0].phone_number);
    } catch {
      /* silently fail */
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function loadRecentCalls() {
    try {
      const res = await api.get<CallHistoryResponse>('/dialer/voice/call-history?limit=10&page=1');
      setRecentCalls(res.data);
    } catch {
      /* silently fail */
    } finally {
      setLoadingRecent(false);
    }
  }

  function handleDigit(digit: string) {
    if (activeCall) return;
    setPhoneNumber((prev) => prev + digit);
  }

  function handleBackspace() {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }

  async function handleCall() {
    if (!phoneNumber.trim() || !fromNumber || isCalling) return;
    setIsCalling(true);
    try {
      const assignment = phoneAssignments.find((p) => p.phone_number === fromNumber);
      if (!assignment) return;
      const res = await api.post<MakeCallResponse>('/dialer/voice/real-call', {
        to: phoneNumber,
        from: fromNumber,
        credentials: { accountSid: assignment.account_sid },
      });
      setActiveCall({
        callSid: res.callSid,
        to: phoneNumber,
        from: fromNumber,
        status: 'ringing',
        startTime: Date.now(),
        isMuted: false,
        isOnHold: false,
      });
      setCallTimer(0);
      setTimeout(() => {
        setActiveCall((prev) => (prev ? { ...prev, status: 'in-progress' } : null));
      }, 3000);
    } catch {
      /* call failed */
    } finally {
      setIsCalling(false);
    }
  }

  async function handleEndCall() {
    if (!activeCall) return;
    try {
      const assignment = phoneAssignments.find((p) => p.phone_number === activeCall.from);
      await api.put(`/dialer/voice/call/${activeCall.callSid}`, {
        status: 'completed',
        credentials: assignment ? { accountSid: assignment.account_sid } : undefined,
      });
    } catch {
      /* silently fail */
    }
    setActiveCall(null);
    setCallTimer(0);
    setPhoneNumber('');
    loadRecentCalls();
  }

  function toggleMute() {
    setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null));
  }

  function toggleHold() {
    setActiveCall((prev) => (prev ? { ...prev, isOnHold: !prev.isOnHold } : null));
  }

  function loadNumberIntoPad(number: string) {
    if (activeCall) return;
    setPhoneNumber(number);
  }

  const fromOptions = phoneAssignments.map((p) => ({
    value: p.phone_number,
    label: p.friendly_name ? `${p.friendly_name} - ${formatPhoneDisplay(p.phone_number)}` : formatPhoneDisplay(p.phone_number),
  }));

  return (
    <div className="flex gap-6">
      {/* Left Panel: Dial Pad */}
      <div className="w-2/5 space-y-4">
        <Card className="!p-0">
          <div className="p-6">
            {activeCall ? (
              <ActiveCallPanel
                call={activeCall}
                timer={callTimer}
                onEnd={handleEndCall}
                onToggleMute={toggleMute}
                onToggleHold={toggleHold}
              />
            ) : (
              <>
                {/* Number display */}
                <div className="mb-4">
                  <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
                    <input
                      type="text"
                      value={phoneNumber ? formatPhoneDisplay(phoneNumber) : ''}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+*#]/g, ''))}
                      placeholder="Enter phone number"
                      className="w-full bg-transparent text-center text-2xl font-semibold tracking-wide text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    {phoneNumber && (
                      <button
                        onClick={handleBackspace}
                        className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <BackspaceIcon className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {NUMPAD_KEYS.map(({ digit, letters }) => (
                    <button
                      key={digit}
                      onClick={() => handleDigit(digit)}
                      className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-3.5 transition-all hover:bg-gray-50 active:scale-95 dark:border-[#1a1a1a] dark:bg-[#0a0a0a] dark:hover:bg-[#111]"
                    >
                      <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">{digit}</span>
                      <span className="mt-0.5 text-[10px] font-medium tracking-widest text-gray-400 dark:text-gray-500">
                        {letters || '\u00A0'}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Call + Clear row */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleCall}
                    disabled={!phoneNumber.trim() || !fromNumber || isCalling}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCalling ? (
                      <Spinner className="w-5 h-5" />
                    ) : (
                      <PhoneIcon className="w-5 h-5" />
                    )}
                    <span className="font-semibold">{isCalling ? 'Calling...' : 'Call'}</span>
                  </button>
                </div>

                {/* From number */}
                <div className="mt-4">
                  {loadingAssignments ? (
                    <div className="flex items-center justify-center py-2">
                      <Spinner className="w-4 h-4 text-gray-400" />
                    </div>
                  ) : fromOptions.length > 0 ? (
                    <Select
                      label="Call from"
                      options={fromOptions}
                      value={fromNumber}
                      onChange={(e) => setFromNumber(e.target.value)}
                    />
                  ) : (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                      No phone numbers assigned. Add one in Settings.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Right Panel: Recent Calls */}
      <div className="w-3/5">
        <Card
          title="Recent Calls"
          action={
            <button
              onClick={() => {
                const tabBtn = document.querySelector('[data-tab="history"]') as HTMLButtonElement;
                tabBtn?.click();
              }}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-800 dark:text-white dark:hover:text-brand-300"
            >
              View All
            </button>
          }
          className="h-full"
        >
          {loadingRecent ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-6 h-6 text-neutral-700" />
            </div>
          ) : recentCalls.length === 0 ? (
            <EmptyState
              icon={<PhoneIcon className="w-10 h-10" />}
              message="No recent calls"
            />
          ) : (
            <div className="space-y-1">
              {recentCalls.map((call) => (
                <RecentCallRow
                  key={call.id}
                  call={call}
                  onClickNumber={loadNumberIntoPad}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ─── Active Call Panel ──────────────────────────────────────────────── */

function ActiveCallPanel({
  call,
  timer,
  onEnd,
  onToggleMute,
  onToggleHold,
}: {
  call: ActiveCall;
  timer: number;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleHold: () => void;
}) {
  const statusColors: Record<string, string> = {
    ringing: 'text-yellow-500',
    'in-progress': 'text-green-500',
    completed: 'text-gray-500',
    failed: 'text-red-500',
  };

  return (
    <div className="flex flex-col items-center py-4">
      {/* Pulsing ring animation */}
      <div className="relative mb-4">
        <div className={`h-20 w-20 rounded-full flex items-center justify-center ${
          call.status === 'ringing'
            ? 'bg-yellow-100 dark:bg-yellow-900/30'
            : 'bg-green-100 dark:bg-green-900/30'
        }`}>
          <PhoneIcon className={`w-8 h-8 ${statusColors[call.status] || 'text-green-500'}`} />
        </div>
        {call.status === 'ringing' && (
          <div className="absolute inset-0 animate-ping rounded-full bg-yellow-400/30" />
        )}
      </div>

      {/* Calling number */}
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {formatPhoneDisplay(call.to)}
      </p>

      {/* Status */}
      <p className={`mt-1 text-sm font-medium capitalize ${statusColors[call.status] || 'text-gray-500'}`}>
        {call.status === 'in-progress' ? 'Connected' : call.status}
      </p>

      {/* Timer */}
      <p className="mt-2 text-3xl font-mono font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {formatDuration(timer)}
      </p>

      {/* From line */}
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        From: {formatPhoneDisplay(call.from)}
      </p>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={onToggleMute}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            call.isMuted
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title={call.isMuted ? 'Unmute' : 'Mute'}
        >
          {call.isMuted ? <MicOffIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
        </button>

        <button
          onClick={onEnd}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
          title="End Call"
        >
          <PhoneOffIcon className="w-6 h-6" />
        </button>

        <button
          onClick={onToggleHold}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            call.isOnHold
              ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#111] dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title={call.isOnHold ? 'Resume' : 'Hold'}
        >
          {call.isOnHold ? <PlayIcon className="w-5 h-5" /> : <PauseIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Labels */}
      <div className="mt-2 flex items-center gap-8 text-xs text-gray-400 dark:text-gray-500">
        <span>{call.isMuted ? 'Unmute' : 'Mute'}</span>
        <span>End</span>
        <span>{call.isOnHold ? 'Resume' : 'Hold'}</span>
      </div>
    </div>
  );
}

/* ─── Recent Call Row ────────────────────────────────────────────────── */

function RecentCallRow({ call, onClickNumber }: { call: CallHistory; onClickNumber: (n: string) => void }) {
  const isOutbound = call.direction?.toLowerCase().includes('outbound');
  const isMissed = call.status === 'no-answer' || call.status === 'missed' || call.status === 'canceled';
  const displayNumber = isOutbound ? call.to_number : call.from_number;

  let iconColor = 'text-blue-500';
  if (isOutbound) iconColor = 'text-green-500';
  if (isMissed) iconColor = 'text-red-500';

  return (
    <button
      onClick={() => onClickNumber(displayNumber)}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#111]"
    >
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
        isMissed
          ? 'bg-red-100 dark:bg-red-900/20'
          : isOutbound
            ? 'bg-green-100 dark:bg-green-900/20'
            : 'bg-blue-100 dark:bg-blue-900/20'
      }`}>
        {isOutbound ? (
          <ArrowUpIcon className={`w-3.5 h-3.5 ${iconColor}`} />
        ) : (
          <ArrowDownIcon className={`w-3.5 h-3.5 ${iconColor}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {formatPhoneDisplay(displayNumber)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isOutbound ? 'Outbound' : 'Inbound'}
          {call.duration != null && call.duration > 0 && ` · ${formatDuration(call.duration)}`}
        </p>
      </div>
      <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
        {smartTime(call.created_at)}
      </span>
    </button>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 2: CALL HISTORY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function CallHistoryTab() {
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [playingCallSid, setPlayingCallSid] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('page', String(page));
      if (search) params.set('search', search);
      if (directionFilter) params.set('direction', directionFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await api.get<CallHistoryResponse>(`/dialer/voice/call-history?${params.toString()}`);
      setCalls(res.data);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [page, search, directionFilter, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
    }, 400);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await api.post('/dialer/voice/sync-call-history?limit=50');
      fetchCalls();
    } catch {
      /* silently fail */
    } finally {
      setSyncing(false);
    }
  }

  async function handlePlayRecording(callSid: string) {
    if (playingCallSid === callSid) {
      setPlayingCallSid(null);
      setRecordingUrl(null);
      return;
    }
    setLoadingRecording(true);
    setPlayingCallSid(callSid);
    try {
      const res = await api.get<{ recordingUrl: string; recordingSid: string }>(`/dialer/voice/recording/${callSid}`);
      setRecordingUrl(res.recordingUrl);
    } catch {
      setPlayingCallSid(null);
      setRecordingUrl(null);
    } finally {
      setLoadingRecording(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="!p-0">
        <div className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by phone number..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm shadow-sm transition-colors focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-gray-100 dark:placeholder-gray-500"
              />
            </div>

            {/* Direction */}
            <div className="w-36">
              <Select
                label="Direction"
                options={[
                  { value: '', label: 'All' },
                  { value: 'inbound', label: 'Inbound' },
                  { value: 'outbound', label: 'Outbound' },
                ]}
                value={directionFilter}
                onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
              />
            </div>

            {/* Status */}
            <div className="w-36">
              <Select
                label="Status"
                options={[
                  { value: '', label: 'All' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'no-answer', label: 'Missed' },
                  { value: 'failed', label: 'Failed' },
                ]}
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              />
            </div>

            {/* Date range */}
            <div className="w-40">
              <Input
                label="From date"
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="w-40">
              <Input
                label="To date"
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              />
            </div>

            {/* Sync button */}
            <Button variant="secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshIcon className="w-4 h-4 mr-2" />}
              Sync from Twilio
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-neutral-700" />
          </div>
        ) : calls.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<PhoneIcon className="w-10 h-10" />}
              message="No calls found matching your filters"
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Direction</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">From</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Recording</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {calls.map((call) => {
                    const isOutbound = call.direction?.toLowerCase().includes('outbound');
                    return (
                      <tr key={call.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-[#111]/50">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isOutbound ? (
                              <ArrowUpIcon className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDownIcon className="w-4 h-4 text-blue-500" />
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {isOutbound ? 'Outbound' : 'Inbound'}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatPhoneDisplay(call.from_number)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatPhoneDisplay(call.to_number)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={STATUS_BADGE[call.status] || 'gray'}>
                            {call.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {call.duration != null && call.duration > 0 ? formatDuration(call.duration) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {smartTime(call.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {(call.recording_url || call.recording_sid) ? (
                            <button
                              onClick={() => handlePlayRecording(call.call_sid)}
                              className="text-neutral-700 hover:text-neutral-800 dark:text-white dark:hover:text-brand-300"
                              title="Play recording"
                            >
                              {loadingRecording && playingCallSid === call.call_sid ? (
                                <Spinner className="w-4 h-4" />
                              ) : playingCallSid === call.call_sid ? (
                                <PauseIcon className="w-5 h-5" />
                              ) : (
                                <PlayIcon className="w-5 h-5" />
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Inline audio player */}
            {playingCallSid && recordingUrl && (
              <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Recording:</span>
                  <audio controls autoPlay src={recordingUrl} className="h-8 flex-1">
                    Your browser does not support audio playback.
                  </audio>
                  <button
                    onClick={() => { setPlayingCallSid(null); setRecordingUrl(null); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-[#1a1a1a]">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} calls
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TAB 3: SETTINGS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function SettingsTab() {
  return (
    <div className="space-y-6">
      <PhoneNumbersSection />
      <CredentialsInfoSection />
      <DialerSettingsSection />
    </div>
  );
}

/* ─── Phone Numbers Section ──────────────────────────────────────────── */

function PhoneNumbersSection() {
  const [phones, setPhones] = useState<PhoneAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ phoneNumber: '', accountSid: '', friendlyName: '', provider: '', numberType: '' });
  const [saving, setSaving] = useState(false);
  const [editingForward, setEditingForward] = useState<string | null>(null);
  const [forwardValue, setForwardValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadPhones(); }, []);

  async function loadPhones() {
    try {
      const res = await api.get<{ data: PhoneAssignment[] }>('/dialer/phone-assignments');
      setPhones(res.data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!addForm.phoneNumber || !addForm.accountSid) return;
    setSaving(true);
    try {
      await api.post('/dialer/phone-assignments', {
        phoneNumber: addForm.phoneNumber,
        accountSid: addForm.accountSid,
        friendlyName: addForm.friendlyName || undefined,
        provider: addForm.provider || undefined,
        numberType: addForm.numberType || undefined,
      });
      setShowAddModal(false);
      setAddForm({ phoneNumber: '', accountSid: '', friendlyName: '', provider: '', numberType: '' });
      loadPhones();
    } catch {
      /* silently fail */
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateForward(id: string) {
    try {
      await api.put(`/dialer/phone-assignments/${id}`, { forwardNumber: forwardValue || null });
      setEditingForward(null);
      loadPhones();
    } catch {
      /* silently fail */
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/dialer/phone-assignments/${id}`);
      loadPhones();
    } catch {
      /* silently fail */
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Card
        title="Phone Numbers"
        action={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Add Phone Number
          </Button>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="w-6 h-6 text-neutral-700" />
          </div>
        ) : phones.length === 0 ? (
          <EmptyState
            icon={<PhoneIcon className="w-10 h-10" />}
            message="No phone numbers assigned yet"
          />
        ) : (
          <div className="space-y-3">
            {phones.map((phone) => (
              <div
                key={phone.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]"
              >
                {/* Number & Friendly name */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatPhoneDisplay(phone.phone_number)}
                    </p>
                    {phone.friendly_name && (
                      <Badge variant="purple">{phone.friendly_name}</Badge>
                    )}
                    <Badge variant={phone.is_active ? 'green' : 'gray'}>
                      {phone.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Provider: {phone.provider || 'twilio'}</span>
                    {phone.number_type && <span>Type: {phone.number_type}</span>}
                  </div>
                </div>

                {/* Forward number */}
                <div className="flex items-center gap-2">
                  {editingForward === phone.id ? (
                    <>
                      <input
                        type="text"
                        value={forwardValue}
                        onChange={(e) => setForwardValue(e.target.value)}
                        placeholder="Forward number"
                        className="w-40 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-[#262626] dark:bg-[#111] dark:text-gray-100"
                      />
                      <Button size="sm" onClick={() => handleUpdateForward(phone.id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingForward(null)}>Cancel</Button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingForward(phone.id);
                        setForwardValue(phone.forward_number || '');
                      }}
                      className="text-xs text-neutral-700 hover:text-neutral-800 dark:text-white dark:hover:text-brand-300"
                    >
                      {phone.forward_number ? `Fwd: ${formatPhoneDisplay(phone.forward_number)}` : 'Set forward'}
                    </button>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(phone.id)}
                  disabled={deletingId === phone.id}
                  className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                  title="Delete phone number"
                >
                  {deletingId === phone.id ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <TrashIcon />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Phone Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Phone Number">
        <div className="space-y-4">
          <Input
            label="Phone Number"
            placeholder="+1XXXXXXXXXX"
            value={addForm.phoneNumber}
            onChange={(e) => setAddForm((f) => ({ ...f, phoneNumber: e.target.value }))}
          />
          <Input
            label="Account SID"
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={addForm.accountSid}
            onChange={(e) => setAddForm((f) => ({ ...f, accountSid: e.target.value }))}
          />
          <Input
            label="Friendly Name (optional)"
            placeholder="e.g., Main Line"
            value={addForm.friendlyName}
            onChange={(e) => setAddForm((f) => ({ ...f, friendlyName: e.target.value }))}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="Provider (optional)"
                placeholder="twilio"
                value={addForm.provider}
                onChange={(e) => setAddForm((f) => ({ ...f, provider: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Number Type"
                options={[
                  { value: '', label: 'Select type' },
                  { value: 'local', label: 'Local' },
                  { value: 'toll-free', label: 'Toll-Free' },
                  { value: 'mobile', label: 'Mobile' },
                ]}
                value={addForm.numberType}
                onChange={(e) => setAddForm((f) => ({ ...f, numberType: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!addForm.phoneNumber || !addForm.accountSid || saving}>
              {saving ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Add Number
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ─── Credentials Info Section ───────────────────────────────────────── */

function CredentialsInfoSection() {
  return (
    <Card title="Twilio Credentials">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Twilio credentials are configured per-user in the admin panel.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Your Account SID and Auth Token are securely stored and used when placing calls.
            Contact your administrator to update credentials.
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ─── Dialer Settings Section ────────────────────────────────────────── */

function DialerSettingsSection() {
  const [settings, setSettings] = useState<DialerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<{ value: string; label: string }[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    loadSettings();
    loadAudioDevices();
  }, []);

  async function loadSettings() {
    try {
      const res = await api.get<DialerSettings>('/dialer/settings');
      setSettings(res);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }

  async function loadAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ value: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}` }));
      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({ value: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}` }));
      setAudioInputDevices([{ value: '', label: 'System Default' }, ...inputs]);
      setAudioOutputDevices([{ value: '', label: 'System Default' }, ...outputs]);
    } catch {
      setAudioInputDevices([{ value: '', label: 'System Default' }]);
      setAudioOutputDevices([{ value: '', label: 'System Default' }]);
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/dialer/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      /* silently fail */
    } finally {
      setSaving(false);
    }
  }

  function update(patch: Partial<DialerSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (loading) {
    return (
      <Card title="Dialer Settings">
        <div className="flex items-center justify-center py-8">
          <Spinner className="w-6 h-6 text-neutral-700" />
        </div>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card title="Dialer Settings">
        <EmptyState
          icon={
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          }
          message="Could not load dialer settings"
        />
      </Card>
    );
  }

  return (
    <Card title="Dialer Settings">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
        {/* Max retry attempts */}
        <Input
          label="Max Retry Attempts"
          type="number"
          min={0}
          max={20}
          value={settings.max_attempts}
          onChange={(e) => update({ max_attempts: parseInt(e.target.value) || 0 })}
        />

        {/* Retry interval */}
        <Input
          label="Retry Interval (seconds)"
          type="number"
          min={0}
          value={settings.retry_interval}
          onChange={(e) => update({ retry_interval: parseInt(e.target.value) || 0 })}
        />

        {/* Call order */}
        <Select
          label="Call Order"
          options={[
            { value: 'sequential', label: 'Sequential' },
            { value: 'random', label: 'Random' },
          ]}
          value={settings.call_order}
          onChange={(e) => update({ call_order: e.target.value })}
        />

        {/* Between call delay */}
        <Input
          label="Between Call Delay (seconds)"
          type="number"
          min={0}
          value={settings.between_call_delay}
          onChange={(e) => update({ between_call_delay: parseInt(e.target.value) || 0 })}
        />

        {/* Auto requeue */}
        <ToggleField
          label="Auto Requeue"
          description="Automatically requeue failed calls"
          checked={settings.auto_requeue}
          onChange={(val) => update({ auto_requeue: val })}
        />

        {/* Local presence */}
        <ToggleField
          label="Local Presence"
          description="Use local area code when calling"
          checked={settings.local_presence}
          onChange={(val) => update({ local_presence: val })}
        />

        {/* Audio input device */}
        <Select
          label="Audio Input Device"
          options={audioInputDevices}
          value={settings.audio_input_device_id || ''}
          onChange={(e) => update({ audio_input_device_id: e.target.value || null })}
        />

        {/* Audio output device */}
        <Select
          label="Audio Output Device"
          options={audioOutputDevices}
          value={settings.audio_output_device_id || ''}
          onChange={(e) => update({ audio_output_device_id: e.target.value || null })}
        />
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center gap-3 border-t border-gray-200 pt-5 dark:border-[#1a1a1a]">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Spinner className="w-4 h-4 mr-2" /> : null}
          Save Settings
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Settings saved
          </span>
        )}
      </div>
    </Card>
  );
}

/* ─── Toggle Field ───────────────────────────────────────────────────── */

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 dark:focus:ring-offset-black ${
          checked ? 'bg-neutral-900' : 'bg-gray-200 dark:bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
