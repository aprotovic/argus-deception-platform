import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, type NavTab } from './components/layout/Sidebar';
import { OverviewView } from './components/overview/OverviewView';
import { LiveStreamView } from './components/stream/LiveStreamView';
import { EvidenceLockerView } from './components/evidence/EvidenceLockerView';
import { AuditLogView } from './components/audit/AuditLogView';
import { LoginView } from './components/auth/LoginView';
import { RefreshCw } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
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
      </div>
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
