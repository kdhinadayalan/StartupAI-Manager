import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
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
import { ReportsPage } from './pages/reports/ReportsPage';

const queryClient = new QueryClient();

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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

                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
