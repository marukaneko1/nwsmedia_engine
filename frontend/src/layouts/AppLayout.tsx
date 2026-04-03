import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NotificationBell } from '../components/NotificationBell';
import { GlobalSearch } from '../components/GlobalSearch';
import type { UserRole } from '@nws/shared';

type NavItem = { label: string; path: string; icon: string };
type NavSection = { section: string; items: NavItem[] };
type NavEntry = NavItem | NavSection;

function isSection(entry: NavEntry): entry is NavSection {
  return 'section' in entry;
}

const icons = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  leads: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  commissions: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  meetings: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  timesheet: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  schedule: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  training: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  deals: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  projects: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z',
  analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  clients: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  queue: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  proposals: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  onboarding: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  contracts: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  audit: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  courses: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z',
  email: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  documents: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  dialer: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  activity: 'M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z',
  simulator: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  engine: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
  scraper: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  megaphone: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
  scrapedLeads: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
};

const navItems: Record<UserRole, NavEntry[]> = {
  va: [
    { label: 'Dashboard', path: '/va', icon: icons.dashboard },
    { section: 'Work', items: [
      { label: 'My Leads', path: '/va/leads', icon: icons.leads },
      { label: 'Commissions', path: '/va/commissions', icon: icons.commissions },
    ]},
    { section: 'Communicate', items: [
      { label: 'Chat', path: '/va/chat', icon: icons.chat },
      { label: 'Email', path: '/va/email', icon: icons.email },
      { label: 'Calendar', path: '/va/calendar', icon: icons.calendar },
      { label: 'Dialer', path: '/va/dialer', icon: icons.dialer },
    ]},
    { section: 'My Stuff', items: [
      { label: 'Timesheet', path: '/va/timesheet', icon: icons.timesheet },
      { label: 'Training', path: '/va/training', icon: icons.training },
      { label: 'Call Simulator', path: '/va/simulator', icon: icons.simulator },
    ]},
  ],
  closer: [
    { label: 'Dashboard', path: '/closer', icon: icons.dashboard },
    { section: 'Sales', items: [
      { label: 'Pipeline', path: '/closer/deals', icon: icons.deals },
      { label: 'Qualified Leads', path: '/closer/queue', icon: icons.queue },
      { label: 'Commissions', path: '/closer/commissions', icon: icons.commissions },
      { label: 'Proposals', path: '/closer/proposals', icon: icons.proposals },
    ]},
    { section: 'Communicate', items: [
      { label: 'Chat', path: '/closer/chat', icon: icons.chat },
      { label: 'Email', path: '/closer/email', icon: icons.email },
      { label: 'Calendar', path: '/closer/calendar', icon: icons.calendar },
      { label: 'Dialer', path: '/closer/dialer', icon: icons.dialer },
    ]},
    { section: 'My Stuff', items: [
      { label: 'Timesheet', path: '/closer/timesheet', icon: icons.timesheet },
      { label: 'Training', path: '/closer/training', icon: icons.training },
      { label: 'Call Simulator', path: '/closer/simulator', icon: icons.simulator },
    ]},
  ],
  ops: [
    { label: 'Dashboard', path: '/ops', icon: icons.dashboard },
    { section: 'Operations', items: [
      { label: 'Projects', path: '/ops/projects', icon: icons.projects },
      { label: 'Clients', path: '/ops/clients', icon: icons.clients },
    ]},
    { section: 'Communicate', items: [
      { label: 'Chat', path: '/ops/chat', icon: icons.chat },
      { label: 'Email', path: '/ops/email', icon: icons.email },
      { label: 'Calendar', path: '/ops/calendar', icon: icons.calendar },
      { label: 'Dialer', path: '/ops/dialer', icon: icons.dialer },
    ]},
    { section: 'My Stuff', items: [
      { label: 'Timesheet', path: '/ops/timesheet', icon: icons.timesheet },
      { label: 'Training', path: '/ops/training', icon: icons.training },
    ]},
  ],
  admin: [
    { label: 'Dashboard', path: '/admin', icon: icons.dashboard },
    { section: 'Sales & Pipeline', items: [
      { label: 'Leads', path: '/admin/leads', icon: icons.leads },
      { label: 'Deals', path: '/admin/deals', icon: icons.deals },
      { label: 'Commissions', path: '/admin/commissions', icon: icons.commissions },
      { label: 'Analytics', path: '/admin/analytics', icon: icons.analytics },
    ]},
    { section: 'Lead Engine', items: [
      { label: 'Overview', path: '/admin/lead-engine', icon: icons.engine },
      { label: 'Scraper', path: '/admin/lead-engine/scraper', icon: icons.scraper },
      { label: 'Craigslist', path: '/admin/lead-engine/craigslist', icon: icons.megaphone },
      { label: 'Yelp', path: '/admin/lead-engine/yelp', icon: icons.scraper },
      { label: 'Filings', path: '/admin/lead-engine/filings', icon: icons.contracts },
      { label: 'Scraped Leads', path: '/admin/lead-engine/leads', icon: icons.scrapedLeads },
    ]},
    { section: 'Operations', items: [
      { label: 'Users', path: '/admin/users', icon: icons.users },
      { label: 'Projects', path: '/admin/projects', icon: icons.projects },
      { label: 'Schedule', path: '/admin/schedule', icon: icons.schedule },
    ]},
    { section: 'Communicate', items: [
      { label: 'Chat', path: '/admin/chat', icon: icons.chat },
      { label: 'Email', path: '/admin/email', icon: icons.email },
      { label: 'Calendar', path: '/admin/calendar', icon: icons.calendar },
      { label: 'Dialer', path: '/admin/dialer', icon: icons.dialer },
    ]},
    { section: 'Setup', items: [
      { label: 'Onboarding', path: '/admin/onboarding', icon: icons.onboarding },
      { label: 'Contracts', path: '/admin/contracts', icon: icons.contracts },
      { label: 'Documents', path: '/admin/documents', icon: icons.documents },
      { label: 'Training', path: '/admin/training', icon: icons.training },
      { label: 'Courses', path: '/admin/courses', icon: icons.courses },
      { label: 'Call Simulator', path: '/admin/simulator', icon: icons.simulator },
    ]},
    { section: 'System', items: [
      { label: 'User Activities', path: '/admin/user-activities', icon: icons.activity },
      { label: 'Audit Log', path: '/admin/audit-log', icon: icons.audit },
    ]},
  ],
  client: [],
};

function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  if (!user) return null;

  const items = navItems[user.role] || [];

  return (
    <div className="flex h-screen flex-col">
      {/* Shared top bar */}
      <div className="flex h-14 shrink-0 border-b border-gray-200 dark:border-[#1a1a1a]">
        <div className="flex w-64 shrink-0 items-center gap-2 border-r border-gray-200 bg-white px-6 dark:border-[#1a1a1a] dark:bg-black">
          <img src="/logo.jpeg" alt="NWS Media" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">NWS CRM</span>
        </div>
        <div className="flex flex-1 items-center bg-white/80 px-6 backdrop-blur dark:bg-black/80">
          <GlobalSearch />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-[#1a1a1a] dark:bg-black">
        <nav className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {items.map((entry, idx) => {
            if (isSection(entry)) {
              return (
                <div key={entry.section} className={idx > 0 ? 'pt-4' : ''}>
                  <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {entry.section}
                  </p>
                  {entry.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === `/${user.role}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-neutral-100 text-neutral-900 dark:bg-[#1a1a1a] dark:text-white'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#111] dark:hover:text-gray-200'
                        }`
                      }
                    >
                      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              );
            }
            const item = entry as NavItem;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === `/${user.role}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900 dark:bg-[#1a1a1a] dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#111] dark:hover:text-gray-200'
                  }`
                }
              >
                <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/${user.role}/profile`)} className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700 font-semibold text-sm dark:bg-[#1a1a1a] dark:text-neutral-300 hover:ring-2 hover:ring-neutral-400 transition-all" title="My Profile">
              {user.first_name[0]}{user.last_name[0]}
            </button>
            <button onClick={() => navigate(`/${user.role}/profile`)} className="flex-1 min-w-0 text-left" title="My Profile">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-neutral-600 dark:hover:text-white">{user.first_name} {user.last_name}</p>
              <p className="truncate text-xs text-gray-500 capitalize dark:text-gray-400">{user.role}</p>
            </button>
            <NotificationBell />
            <button
              onClick={toggle}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Logout"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black">
        <Outlet />
      </main>
      </div>
    </div>
  );
}
