import React from 'react';
import { BarChart3, Activity, Lock, FileText, Globe, X, Eye, User as UserIcon } from 'lucide-react';

export type NavTab = 'overview' | 'stream' | 'evidence' | 'audit' | 'intel' | 'profile';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen = false,
  onClose,
  isCollapsed = false,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'overview', label: 'SOC Overview', icon: <BarChart3 size={18} /> },
    { id: 'stream', label: 'Live Stream', icon: <Activity size={18} /> },
    { id: 'evidence', label: 'Evidence Locker', icon: <Lock size={18} /> },
    { id: 'audit', label: 'Audit Trail', icon: <FileText size={18} /> },
    { id: 'intel', label: 'Threat Intel', icon: <Globe size={18} /> },
    { id: 'profile', label: 'Profile & Team', icon: <UserIcon size={18} /> },
  ];

  return (
    <aside
      className={`sidebar-aside ${isOpen ? 'mobile-open' : ''} ${isCollapsed ? 'desktop-collapsed' : ''}`}
      style={{
        width: isCollapsed ? '0px' : '240px',
        minWidth: isCollapsed ? '0px' : '240px',
        maxWidth: isCollapsed ? '0px' : '240px',
        flexShrink: 0,
        background: 'rgba(4, 6, 5, 0.98)',
        borderRight: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: isCollapsed ? '0px' : '20px 12px',
        gap: '6px',
        height: '100%',
        maxHeight: '100%',
        overflowY: isCollapsed ? 'hidden' : 'auto',
        overflowX: 'hidden',
        opacity: isCollapsed ? 0 : 1,
        pointerEvents: isCollapsed ? 'none' : 'auto',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s ease, opacity 0.2s ease',
        visibility: isCollapsed ? 'hidden' : 'visible',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 10px 12px',
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          fontSize: '0.68rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          fontFamily: "'Chakra Petch', sans-serif",
        }}>
          OPERATIONAL NAVIGATION
        </div>
        <button
          onClick={onClose}
          className="sidebar-close-btn"
          aria-label="Close navigation"
          title="Close Navigation"
        >
          <X size={14} />
        </button>
      </div>

      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onTabChange(item.id);
              if (onClose) onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '6px',
              border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
              background: isActive
                ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0.04) 100%)'
                : 'transparent',
              color: isActive ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 500,
              letterSpacing: '0.03em',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
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
              <span style={{ color: isActive ? '#10b981' : 'var(--text-dim)' }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
            {isActive && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
              }} />
            )}
          </button>
        );
      })}

      {/* ARGUS Mythology & Branding Card */}
      <div style={{ marginTop: 'auto', padding: '16px 2px 2px 2px', borderTop: '1px solid var(--border-subtle)', whiteSpace: 'normal' }}>
        <div style={{
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.09) 0%, rgba(6, 18, 12, 0.75) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Subtle tactical corner glow */}
          <div style={{
            position: 'absolute',
            top: -16,
            right: -16,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Header with Cyber Eye Logo and Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.16)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.25)',
            }}>
              <Eye size={16} color="#10b981" />
            </div>
            <div>
              <div style={{
                fontSize: '0.78rem',
                color: '#ffffff',
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.05em',
                lineHeight: 1.2,
              }}>
                ARGUS PANOPTES
              </div>
              <div style={{
                fontSize: '0.62rem',
                color: '#10b981',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}>
                Ἄργος Πανόπτης
              </div>
            </div>
          </div>

          {/* Meaning / Origin Explanation */}
          <div style={{
            fontSize: '0.67rem',
            color: 'var(--text-dim)',
            lineHeight: 1.48,
            marginBottom: '10px',
            fontFamily: "'Chakra Petch', sans-serif",
          }}>
            Named after the mythological all-seeing guardian with 100 watchful eyes who never slept. In this platform, every decoy trap acts as an unblinking eye detecting hostile incursions with zero blind spots.
          </div>

          {/* Surveillance Grid Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px dashed rgba(16, 185, 129, 0.22)',
            fontSize: '0.60rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#6ee7b7',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                display: 'inline-block',
              }} />
              ALL-SEEING SENSORS
            </span>
            <span style={{ color: 'var(--text-dim)', letterSpacing: '0.04em' }}>ACTIVE</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
