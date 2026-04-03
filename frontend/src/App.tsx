import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';

// VA pages
import { VADashboard } from './pages/va/Dashboard';
import { VALeads } from './pages/va/Leads';
import { VACommissions } from './pages/va/Commissions';

// Closer pages
import { CloserDashboard } from './pages/closer/Dashboard';
import { CloserDeals } from './pages/closer/Deals';
import { CloserQueue } from './pages/closer/Queue';
import { CloserCommissions } from './pages/closer/Commissions';
import { CloserProposals } from './pages/closer/Proposals';

// Ops pages
import { OpsDashboard } from './pages/ops/Dashboard';
import { OpsProjects } from './pages/ops/Projects';
import { OpsProjectDetail } from './pages/ops/ProjectDetail';
import { OpsClients } from './pages/ops/Clients';

// Shared pages
import { DealDetail } from './pages/shared/DealDetail';

// Admin pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminUsers } from './pages/admin/Users';
import { AdminLeads } from './pages/admin/Leads';
import { AdminDeals } from './pages/admin/Deals';
import { AdminCommissions } from './pages/admin/Commissions';
import { AdminAnalytics } from './pages/admin/Analytics';

// Portal pages
import { PortalLogin } from './pages/portal/Login';
import { PortalAuthCallback } from './pages/portal/AuthCallback';
import { PortalDashboard } from './pages/portal/Dashboard';
import { PortalReferral } from './pages/portal/Referral';

// Onboarding pages (public, token-auth)
import { OnboardingForm } from './pages/onboarding/OnboardingForm';
import { ProjectTracker } from './pages/onboarding/ProjectTracker';
import { ClientIntakeForm } from './pages/onboarding/ClientIntakeForm';

// Employee invite registration (public, token-auth)
import { InviteRegister } from './pages/invite/InviteRegister';

// Admin onboarding hub
import { AdminOnboarding } from './pages/admin/Onboarding';
import { AdminContracts } from './pages/admin/Contracts';

// Lead engine pages
import { EngineOverview } from './pages/admin/lead-engine/EngineOverview';
import { ScraperPanel } from './pages/admin/lead-engine/ScraperPanel';
import { CraigslistPanel } from './pages/admin/lead-engine/CraigslistPanel';
import { ScrapedLeads } from './pages/admin/lead-engine/ScrapedLeads';
import { ScrapedLeadDetail } from './pages/admin/lead-engine/ScrapedLeadDetail';

// Shared pages: Chat, Meetings, Timesheet
import { ChatPage } from './pages/shared/ChatPage';
import { MeetingsPage } from './pages/shared/MeetingsPage';
import { TimesheetPage } from './pages/shared/TimesheetPage';

// Admin schedule
import { AdminSchedule } from './pages/admin/Schedule';

// Training
import { AdminTraining } from './pages/admin/Training';
import { AdminCourseManager } from './pages/admin/CourseManager';
import { AdminAuditLog } from './pages/admin/AuditLog';
import { AdminUserActivities } from './pages/admin/UserActivities';
import { TrainingPage } from './pages/shared/TrainingPage';
import { ProfilePage } from './pages/shared/ProfilePage';
import { VACourseWrapper } from './pages/shared/VACourseWrapper';
import { DynamicCourseWrapper } from './pages/shared/DynamicCourseWrapper';
import { CalendarPage } from './pages/shared/CalendarPage';
import { EmailPage } from './pages/shared/EmailPage';
import { DocumentsPage } from './pages/shared/DocumentsPage';
import { DialerPage } from './pages/shared/DialerPage';
import { CallSimulator } from './pages/shared/CallSimulator';
import { SigningPage } from './pages/signing/SigningPage';

function RoleRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  const roleHomeMap: Record<string, string> = {
    va: '/va',
    closer: '/closer',
    ops: '/ops',
    admin: '/admin',
  };

  return <Navigate to={roleHomeMap[user.role] || '/login'} />;
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* VA routes */}
          <Route element={<ProtectedRoute roles={['va', 'admin']}><AppLayout /></ProtectedRoute>}>
            <Route path="/va" element={<VADashboard />} />
            <Route path="/va/leads" element={<VALeads />} />
            <Route path="/va/commissions" element={<VACommissions />} />
            <Route path="/va/chat" element={<ChatPage />} />
            <Route path="/va/email" element={<EmailPage />} />
            <Route path="/va/calendar" element={<CalendarPage />} />
            <Route path="/va/dialer" element={<DialerPage />} />
            <Route path="/va/meetings" element={<MeetingsPage />} />
            <Route path="/va/timesheet" element={<TimesheetPage />} />
            <Route path="/va/training" element={<TrainingPage />} />
            <Route path="/va/training/course" element={<VACourseWrapper />} />
            <Route path="/va/training/course/:slug" element={<DynamicCourseWrapper />} />
            <Route path="/va/simulator" element={<CallSimulator />} />
            <Route path="/va/profile" element={<ProfilePage />} />
          </Route>

          {/* Closer routes */}
          <Route element={<ProtectedRoute roles={['closer', 'admin']}><AppLayout /></ProtectedRoute>}>
            <Route path="/closer" element={<CloserDashboard />} />
            <Route path="/closer/deals" element={<CloserDeals />} />
            <Route path="/closer/deals/:id" element={<DealDetail />} />
            <Route path="/closer/queue" element={<CloserQueue />} />
            <Route path="/closer/commissions" element={<CloserCommissions />} />
            <Route path="/closer/proposals" element={<CloserProposals />} />
            <Route path="/closer/chat" element={<ChatPage />} />
            <Route path="/closer/email" element={<EmailPage />} />
            <Route path="/closer/calendar" element={<CalendarPage />} />
            <Route path="/closer/dialer" element={<DialerPage />} />
            <Route path="/closer/meetings" element={<MeetingsPage />} />
            <Route path="/closer/timesheet" element={<TimesheetPage />} />
            <Route path="/closer/training" element={<TrainingPage />} />
            <Route path="/closer/training/course" element={<VACourseWrapper />} />
            <Route path="/closer/training/course/:slug" element={<DynamicCourseWrapper />} />
            <Route path="/closer/simulator" element={<CallSimulator />} />
            <Route path="/closer/profile" element={<ProfilePage />} />
          </Route>

          {/* Ops routes */}
          <Route element={<ProtectedRoute roles={['ops', 'admin']}><AppLayout /></ProtectedRoute>}>
            <Route path="/ops" element={<OpsDashboard />} />
            <Route path="/ops/projects" element={<OpsProjects />} />
            <Route path="/ops/projects/:id" element={<OpsProjectDetail />} />
            <Route path="/ops/clients" element={<OpsClients />} />
            <Route path="/ops/chat" element={<ChatPage />} />
            <Route path="/ops/email" element={<EmailPage />} />
            <Route path="/ops/calendar" element={<CalendarPage />} />
            <Route path="/ops/dialer" element={<DialerPage />} />
            <Route path="/ops/meetings" element={<MeetingsPage />} />
            <Route path="/ops/timesheet" element={<TimesheetPage />} />
            <Route path="/ops/training" element={<TrainingPage />} />
            <Route path="/ops/training/course" element={<VACourseWrapper />} />
            <Route path="/ops/training/course/:slug" element={<DynamicCourseWrapper />} />
            <Route path="/ops/simulator" element={<CallSimulator />} />
            <Route path="/ops/profile" element={<ProfilePage />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute roles={['admin']}><AppLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/deals" element={<AdminDeals />} />
            <Route path="/admin/deals/:id" element={<DealDetail />} />
            <Route path="/admin/pipeline" element={<Navigate to="/admin/deals" replace />} />
            <Route path="/admin/commissions" element={<AdminCommissions />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/projects" element={<OpsProjects />} />
            <Route path="/admin/projects/:id" element={<OpsProjectDetail />} />
            <Route path="/admin/chat" element={<ChatPage />} />
            <Route path="/admin/email" element={<EmailPage />} />
            <Route path="/admin/calendar" element={<CalendarPage />} />
            <Route path="/admin/dialer" element={<DialerPage />} />
            <Route path="/admin/meetings" element={<MeetingsPage />} />
            <Route path="/admin/timesheet" element={<TimesheetPage />} />
            <Route path="/admin/schedule" element={<AdminSchedule />} />
            <Route path="/admin/onboarding" element={<AdminOnboarding />} />
            <Route path="/admin/contracts" element={<AdminContracts />} />
            <Route path="/admin/documents" element={<DocumentsPage />} />
            <Route path="/admin/training" element={<AdminTraining />} />
            <Route path="/admin/training/course" element={<VACourseWrapper />} />
            <Route path="/admin/training/course/:slug" element={<DynamicCourseWrapper />} />
            <Route path="/admin/courses" element={<AdminCourseManager />} />
            <Route path="/admin/courses/preview/:slug" element={<DynamicCourseWrapper />} />
            <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            <Route path="/admin/user-activities" element={<AdminUserActivities />} />
            <Route path="/admin/simulator" element={<CallSimulator />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            <Route path="/admin/lead-engine" element={<EngineOverview />} />
            <Route path="/admin/lead-engine/scraper" element={<ScraperPanel />} />
            <Route path="/admin/lead-engine/craigslist" element={<CraigslistPanel />} />
            <Route path="/admin/lead-engine/leads" element={<ScrapedLeads />} />
            <Route path="/admin/lead-engine/leads/:id" element={<ScrapedLeadDetail />} />
          </Route>

          {/* Portal routes (separate auth) */}
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal/auth/:token" element={<PortalAuthCallback />} />
          <Route path="/portal/dashboard" element={<PortalDashboard />} />
          <Route path="/portal/referral" element={<PortalReferral />} />

          {/* Client onboarding (public, token-based) */}
          <Route path="/onboarding/:token" element={<OnboardingForm />} />
          <Route path="/onboarding/:token/tracker" element={<ProjectTracker />} />

          {/* Client intake form (public, shareable link) */}
          <Route path="/intake/:token" element={<ClientIntakeForm />} />

          {/* Employee invite registration (public, token-based) */}
          <Route path="/invite/:token" element={<InviteRegister />} />

          {/* Public document signing (token-based) */}
          <Route path="/sign/:token" element={<SigningPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
