import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { Severity } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function getBadgeColor(severity: Severity) {
  switch (severity) {
    case 'critical':
      return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
    case 'high':
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
    default:
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
  }
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    clearAll,
    setInvestigationEventId,
  } = useNotifications();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: '0px',
        marginTop: '8px',
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(6, 8, 6, 0.98)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.9), 0 0 24px rgba(16, 185, 129, 0.15)',
        backdropFilter: 'blur(20px)',
        zIndex: 100,
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} color="#10b981" />
          <span
            style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            REAL-TIME THREAT ALERTS
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '9999px',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {unreadCount} NEW
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '2px',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Action Bar */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '8px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
          }}
        >
          <button
            onClick={markAllAsRead}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <CheckCheck size={13} />
            <span>Mark all read</span>
          </button>

          <button
            onClick={clearAll}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            <Trash2 size={13} />
            <span>Clear all</span>
          </button>
        </div>
      )}

      {/* Notification List */}
      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
            <ShieldAlert size={28} color="#64748b" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>No active threat alerts.</div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
              Deception telemetry listening on live WebSocket feed.
            </div>
          </div>
        ) : (
          notifications.map((n) => {
            const b = getBadgeColor(n.severity);
            const timeStr = new Date(n.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  background: n.read ? 'transparent' : 'rgba(16, 185, 129, 0.04)',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid #10b981',
                  transition: 'background 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: b.bg,
                        color: b.text,
                        border: `1px solid ${b.border}`,
                      }}
                    >
                      {n.severity}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {timeStr}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>
                    {n.source_ip}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 500, lineHeight: 1.35 }}>
                  {n.summary}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(n.id);
                      setInvestigationEventId(n.eventId);
                      onClose();
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#10b981',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.color = '#10b981';
                    }}
                  >
                    <span>Inspect Forensics</span>
                    <ExternalLink size={10} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
