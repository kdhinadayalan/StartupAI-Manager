import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { Dashboard } from './pages/dashboard/Dashboard';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { KanbanPage } from './pages/tasks/KanbanPage';
import { TeamPage } from './pages/team/TeamPage';
import { AIChatPage } from './pages/ai/AIChatPage';
import { FinancePage } from './pages/finance/FinancePage';
import { MarketingPage } from './pages/marketing/MarketingPage';
import { ResearchPage } from './pages/research/ResearchPage';
import { RisksPage } from './pages/risks/RisksPage';
import { AIMonitoringPage } from './pages/monitoring/AIMonitoringPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { Card } from './components/common/Card';
import { Badge } from './components/common/Badge';

const queryClient = new QueryClient();

// Placeholder view for modules coming in Phase 6
const PhasePlaceholder: React.FC<{ title: string; phase: string; description: string }> = ({
  title,
  phase,
  description,
}) => (
  <div className="max-w-4xl mx-auto py-12">
    <Card>
      <div className="text-center py-10">
        <Badge variant="primary">{phase}</Badge>
        <h2 className="text-xl font-bold text-white mt-3">{title}</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">{description}</p>
        <div className="mt-6 flex justify-center">
          <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
            Database models & security architecture ready
          </span>
        </div>
      </div>
    </Card>
  </div>
);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected App Routes */}
              <Route path="/" element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="tasks" element={<KanbanPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="ai-manager" element={<AIChatPage />} />
                <Route path="ai-monitoring" element={<AIMonitoringPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="marketing" element={<MarketingPage />} />
                <Route path="research" element={<ResearchPage />} />
                <Route path="risks" element={<RisksPage />} />

                <Route
                  path="reports"
                  element={
                    <PhasePlaceholder
                      title="Startup Health & Executive Reports"
                      phase="Phase 5 Analytics & Monitoring"
                      description="Synthesis of daily, weekly, and monthly performance snapshots."
                    />
                  }
                />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
