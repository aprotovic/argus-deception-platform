import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationDrawer } from '../notifications/NotificationDrawer';
import {
  Shield,
  Radio,
  ExternalLink,
  LogOut,
  User as UserIcon,
  Clock,
  Bell,
  Volume2,
  VolumeX,
  X,
  Activity,
} from 'lucide-react';

interface NavbarProps {
  isMobileNavOpen?: boolean;
  onToggleMobileNav?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isMobileNavOpen = false,
  onToggleMobileNav,
}) => {
  const { user, logout } = useAuth();
  const { isConnected, liveEventCount } = useWebSocket();
  const { soundEnabled, toggleSound, unreadCount } = useNotifications();
  const [utcTime, setUtcTime] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="nav-header"
      style={{
        background: 'rgba(4, 6, 5, 0.98)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        minHeight: 'var(--navbar-height)',
        maxHeight: 'var(--navbar-height)',
        boxSizing: 'border-box',
      }}
    >
      {/* Brand & System Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <button
            onClick={onToggleMobileNav}
            aria-label={isMobileNavOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
            className="mobile-nav-toggle"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
              border: '1px solid var(--border-accent)',
              boxShadow: isMobileNavOpen ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none',
              outline: 'none',
            }}
          >
            {isMobileNavOpen ? (
              <X size={20} color="#10b981" />
            ) : (
              <Shield size={20} color="#10b981" />
            )}
          </button>
          <div>
            <div style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.05rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              ARGUS
              <span className="nav-version-badge" style={{
                fontSize: '0.65rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 500,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                v1.0-DEFENSE
              </span>
            </div>
            <div className="nav-brand-subtitle" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', letterSpacing: '0.02em' }}>
              Cyber Deception & Telemetry Monitor
            </div>
          </div>
        </div>

        {/* Live Stream Status Indicator */}
        <div className="nav-live-pill" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          marginLeft: '4px',
        }}>
          <span className={`radar-dot ${!isConnected ? 'offline' : ''}`} />
          <Activity size={13} color={isConnected ? '#34d399' : '#f87171'} />
          <span className="nav-live-text" style={{ color: isConnected ? '#34d399' : '#f87171', fontWeight: 600 }}>
            {isConnected ? 'LIVE FEED ACTIVE' : 'RECONNECTING'}
          </span>
          {liveEventCount > 0 && (
            <span className="nav-live-count" style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontSize: '0.68rem',
              padding: '1px 6px',
              borderRadius: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
            }}>
              +{liveEventCount} new
            </span>
          )}
        </div>
      </div>

      {/* Center Clock */}
      <div className="nav-clock" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '6px 12px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 255, 255, 0.04)',
      }}>
        <Clock size={14} color="#64748b" />
        <span>{utcTime || 'SYNCHRONIZING UTC...'}</span>
      </div>

      {/* Operator & Quick Action Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Sound Chime Toggle */}
        <button
          onClick={toggleSound}
          title={soundEnabled ? 'Alert Audio: ON (Click to Mute)' : 'Alert Audio: MUTED (Click to Enable)'}
          className="nav-audio-btn"
          style={{
            background: soundEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${soundEnabled ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-subtle)'}`,
            borderRadius: '4px',
            padding: '6px 9px',
            color: soundEnabled ? '#34d399' : 'var(--text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontFamily: "'Chakra Petch', sans-serif",
            transition: 'all 0.15s',
          }}
        >
          {soundEnabled ? <Volume2 size={15} color="#34d399" /> : <VolumeX size={15} color="#64748b" />}
          <span className="nav-audio-text">{soundEnabled ? 'AUDIO' : 'MUTED'}</span>
        </button>

        {/* Real-Time Notification Bell & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            id="notification-bell-btn"
            onClick={() => setDrawerOpen(!drawerOpen)}
            title="Real-Time Threat Notifications"
            style={{
              background: unreadCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${unreadCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}`,
              borderRadius: '4px',
              padding: '6px 10px',
              color: unreadCount > 0 ? '#f87171' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              transition: 'all 0.15s',
            }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '0 3px',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </div>

        {/* Link to Decoy Portal */}
        <a
          href="/decoy"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-decoy-link"
          title="Decoy Trap Portal"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            padding: '6px 12px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: 600,
            letterSpacing: '0.04em',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
        >
          <Radio size={14} />
          <span className="nav-decoy-text">DECOY PORTAL</span>
          <ExternalLink size={12} className="nav-decoy-arrow" />
        </a>

        {/* User Badge */}
        <div
          className="nav-user-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: user?.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${user?.role === 'admin' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)'}`,
          }}
        >
          <UserIcon size={14} color={user?.role === 'admin' ? '#f87171' : '#10b981'} />
          <span className="nav-username" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {user?.username}
          </span>
          <span style={{
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: user?.role === 'admin' ? '#f87171' : '#10b981',
            letterSpacing: '0.04em',
          }}>
            {user?.role}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign Out"
          style={{
            background: 'none',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '6px 8px',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-dim)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};

