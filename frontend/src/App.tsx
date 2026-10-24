import React, { useState, useEffect } from 'react';
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
import { ThreatMapView } from './components/intel/ThreatMapView';
import { CyberLoader } from './components/common/CyberLoader';

const DashboardLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const { investigationEventId, setInvestigationEventId } = useNotifications();

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <Navbar
        isMobileNavOpen={isMobileNavOpen}
        onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
      />
      <NotificationToasts />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setIsMobileNavOpen(false);
          }}
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
        />
        {/* Mobile Backdrop Overlay */}
        {isMobileNavOpen && (
          <div
            className="mobile-nav-backdrop"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation backdrop"
          />
        )}
        <main style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', background: 'var(--bg-primary)' }}>
          <div key={activeTab} className="cyber-tab-pane">
            {activeTab === 'overview' && (
              <OverviewView onNavigateToStream={() => setActiveTab('stream')} />
            )}
            {activeTab === 'stream' && <LiveStreamView />}
            {activeTab === 'evidence' && <EvidenceLockerView />}
            {activeTab === 'audit' && <AuditLogView />}
            {activeTab === 'intel' && <ThreatMapView />}
          </div>
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
      <CyberLoader
        mode="fullscreen"
        message="INITIALIZING ARGUS ENCLAVE..."
        subMessage="CALIBRATING ZERO-TRUST DECEPTION SENSORS"
      />
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
