import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import {
  AlertTriangle,
  Flame,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react';
import type { EventType, Severity } from '../../types';

function getSeverityBadge(severity: Severity) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'rgba(239, 68, 68, 0.18)',
        border: 'rgba(239, 68, 68, 0.5)',
        text: '#f87171',
        glow: '0 0 16px rgba(239, 68, 68, 0.35)',
        icon: <Flame size={15} color="#ef4444" />,
        label: 'CRITICAL THREAT',
      };
    case 'high':
      return {
        bg: 'rgba(245, 158, 11, 0.18)',
        border: 'rgba(245, 158, 11, 0.5)',
        text: '#fbbf24',
        glow: '0 0 12px rgba(245, 158, 11, 0.25)',
        icon: <AlertTriangle size={15} color="#f59e0b" />,
        label: 'HIGH PRIORITY',
      };
    default:
      return {
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.4)',
        text: '#10b981',
        glow: '0 0 10px rgba(16, 185, 129, 0.2)',
        icon: <ShieldAlert size={15} color="#10b981" />,
        label: 'TELEMETRY EVENT',
      };
  }
}

function getEventTypeIcon(type: EventType) {
  switch (type) {
    case 'command_injection':
      return '⚡';
    case 'honeytoken_accessed':
      return '🍯';
    case 'sql_injection':
      return '💉';
    case 'terminal_execution':
      return '💻';
    case 'file_upload':
      return '📦';
    default:
      return '🛡️';
  }
}

export const NotificationToasts: React.FC = () => {
  const { toasts, dismissToast, setInvestigationEventId } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const badge = getSeverityBadge(toast.severity);
        const emoji = getEventTypeIcon(toast.event_type);

        return (
          <div
            key={toast.id}
            style={{
              background: 'rgba(10, 14, 23, 0.96)',
              border: `1px solid ${badge.border}`,
              borderRadius: '8px',
              padding: '14px 16px',
              boxShadow: `0 12px 32px rgba(0, 0, 0, 0.85), ${badge.glow}`,
              backdropFilter: 'blur(16px)',
              pointerEvents: 'auto',
              position: 'relative',
              overflow: 'hidden',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Countdown animation bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: badge.text,
                animation: 'toastCountdown 6.5s linear forwards',
              }}
            />

            {/* Header: Badge & Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.9rem' }}>{emoji}</span>
                <span
                  style={{
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: badge.text,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>

            {/* Event Summary */}
            <div
              style={{
                fontSize: '0.82rem',
                color: '#ffffff',
                fontWeight: 600,
                lineHeight: 1.35,
                marginBottom: '8px',
              }}
            >
              {toast.summary}
            </div>

            {/* Meta Row: Source IP & Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <div>
                IP: <span style={{ color: '#10b981', fontWeight: 600 }}>{toast.source_ip}</span>
              </div>

              <button
                onClick={() => {
                  setInvestigationEventId(toast.eventId);
                  dismissToast(toast.id);
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.color = '#10b981';
                }}
              >
                <span>Inspect Event</span>
                <ExternalLink size={11} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
