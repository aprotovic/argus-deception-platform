import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { NotificationToasts } from './components/notifications/NotificationToasts';
import { EventInvestigationModal } from './components/investigation/EventInvestigationModal';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { OverviewView } from './components/overview/OverviewView';
import { LiveStreamView } from './components/stream/LiveStreamView';
import { EvidenceLockerView } from './components/evidence/EvidenceLockerView';
import { AuditLogView } from './components/audit/AuditLogView';
import { LoginView } from './components/auth/LoginView';
import { RefreshCw } from 'lucide-react';

const DashboardLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const { investigationEventId, setInvestigationEventId } = useNotifications();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Navbar />
      <NotificationToasts />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          {activeTab === 'overview' && (
            <OverviewView onNavigateToStream={() => setActiveTab('stream')} />
          )}
          {activeTab === 'stream' && <LiveStreamView />}
          {activeTab === 'evidence' && <EvidenceLockerView />}
          {activeTab === 'audit' && <AuditLogView />}
        </main>
      </div>

      {investigationEventId && (
        <EventInvestigationModal
          eventId={investigationEventId}
          onClose={() => setInvestigationEventId(null)}
          onSelectEvent={(id) => setInvestigationEventId(id)}
        />
      )}
    </div>
  );
};

const DashboardContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: '#00b4d8',
        fontFamily: "'Chakra Petch', sans-serif",
      }}>
        <RefreshCw size={24} className="animate-spin" />
        <span style={{ marginLeft: '12px' }}>INITIALIZING ARGUS ENCLAVE...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <WebSocketProvider>
      <NotificationProvider>
        <DashboardLayout />
      </NotificationProvider>
    </WebSocketProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
