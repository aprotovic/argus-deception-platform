import React from 'react';
import { BarChart3, Activity, Lock, FileText } from 'lucide-react';

export type NavTab = 'overview' | 'stream' | 'evidence' | 'audit';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'SOC Overview', icon: <BarChart3 size={18} /> },
    { id: 'stream', label: 'Live Stream', icon: <Activity size={18} /> },
    { id: 'evidence', label: 'Evidence Locker', icon: <Lock size={18} /> },
    { id: 'audit', label: 'Audit Trail', icon: <FileText size={18} /> },
  ];

  return (
    <aside style={{
      width: '240px',
      background: 'rgba(10, 14, 23, 0.85)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      gap: '6px',
      minHeight: 'calc(100vh - 65px)',
    }}>
      <div style={{
        fontSize: '0.68rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-dim)',
        fontFamily: "'Chakra Petch', sans-serif",
        padding: '0 12px 10px 12px',
      }}>
        OPERATIONAL NAVIGATION
      </div>

      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '6px',
              border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
              background: isActive
                ? 'linear-gradient(90deg, rgba(0, 180, 216, 0.15) 0%, rgba(0, 180, 216, 0.04) 100%)'
                : 'transparent',
              color: isActive ? '#38bdf8' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 500,
              letterSpacing: '0.03em',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: isActive ? '#38bdf8' : 'var(--text-dim)' }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
            {isActive && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#38bdf8',
                boxShadow: '0 0 8px #38bdf8',
              }} />
            )}
          </button>
        );
      })}

      <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{
          background: 'rgba(0, 180, 216, 0.05)',
          border: '1px solid rgba(0, 180, 216, 0.2)',
          borderRadius: '6px',
          padding: '12px',
        }}>
          <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, marginBottom: '4px' }}>
            DECOY ACTIVE
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
            Persona: Nexis Defense Systems
            <br />
            Status: Port 8080 Trapping
          </div>
        </div>
      </div>
    </aside>
  );
};
