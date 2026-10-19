import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { OverviewMetrics } from '../../types';
import { useWebSocket } from '../../context/WebSocketContext';
import {
  Users,
  KeyRound,
  FileArchive,
  Activity,
  AlertTriangle,
  Flame,
  Radio,
  Play,
  Download,
  RefreshCw,
} from 'lucide-react';

export const OverviewView: React.FC<{ onNavigateToStream: () => void }> = ({ onNavigateToStream }) => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const { lastEvent } = useWebSocket();

  const fetchMetrics = async () => {
    try {
      const data = await api.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Update metrics when new WebSocket event arrives
  useEffect(() => {
    if (lastEvent) {
      fetchMetrics();
    }
  }, [lastEvent]);

  const handleSimulateTraffic = async () => {
    setSimulating(true);
    setSimMessage('Simulating controlled reconnaissance and login attempts...');
    try {
      // Simulate safe controlled probe
      await fetch('/api/v1/decoy/probe/.env?test=1');
      await fetch('/api/v1/decoy/probe/wp-login.php?test=1');
      
      // Simulate safe controlled login attempt
      const formData = new FormData();
      formData.append('username', 'root');
      formData.append('password', 'SimulatedTestCredential2026!');
      await fetch('/api/v1/decoy/auth/login?test=1', {
        method: 'POST',
        body: formData,
        headers: { 'X-Argus-Test-Token': 'test_suite' },
      });

      setSimMessage('Simulation delivered: 3 controlled test events ingested into database.');
      await fetchMetrics();
      setTimeout(() => setSimMessage(null), 4000);
    } catch {
      setSimMessage('Simulation error: Could not transmit test interaction.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <RefreshCw size={24} className="animate-spin" color="#00b4d8" />
        <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>Retrieving operational telemetry...</span>
      </div>
    );
  }

  const kpis = [
    {
      title: 'TOTAL OBSERVED EVENTS',
      value: metrics?.total_events ?? 0,
      sub: `${metrics?.events_last_24h ?? 0} in last 24 hours`,
      icon: <Activity size={22} color="#00b4d8" />,
      color: '#00b4d8',
    },
    {
      title: 'UNIQUE ATTACKER IPS',
      value: metrics?.unique_ips ?? 0,
      sub: 'Observed source addresses',
      icon: <Users size={22} color="#38bdf8" />,
      color: '#38bdf8',
    },
    {
      title: 'TRAPPED LOGIN ATTEMPTS',
      value: metrics?.failed_logins ?? 0,
      sub: 'Decoy credential submissions',
      icon: <KeyRound size={22} color="#f59e0b" />,
      color: '#f59e0b',
    },
    {
      title: 'QUARANTINED PAYLOADS',
      value: metrics?.quarantined_files ?? 0,
      sub: `${metrics?.rejected_uploads ?? 0} uploads rejected`,
      icon: <FileArchive size={22} color="#f43f5e" />,
      color: '#f43f5e',
    },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Control Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '1.6rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#ffffff',
            textTransform: 'uppercase',
          }}>
            SECURITY OPERATIONS OVERVIEW
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Live attack telemetry and honeypot interaction metrics captured by ARGUS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleSimulateTraffic}
            disabled={simulating}
            className="btn-secondary"
            title="Inject controlled test traffic marked with is_test_event=True"
          >
            <Play size={14} color="#34d399" />
            <span>{simulating ? 'GENERATING TEST TRAFFIC...' : 'RUN CONTROLLED TEST'}</span>
          </button>

          <a
            href={api.getExportUrl('json')}
            download="argus_forensic_export.json"
            className="btn-primary"
          >
            <Download size={14} />
            <span>EXPORT REPORT (JSON)</span>
          </a>
        </div>
      </div>

      {simMessage && (
        <div style={{
          background: 'rgba(0, 180, 216, 0.1)',
          border: '1px solid rgba(0, 180, 216, 0.4)',
          borderRadius: '4px',
          padding: '10px 16px',
          fontSize: '0.82rem',
          color: '#38bdf8',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Radio size={16} />
          <span>{simMessage}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '4px',
              height: '100%',
              backgroundColor: kpi.color,
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
              }}>
                {kpi.title}
              </span>
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '6px',
                padding: '6px',
              }}>
                {kpi.icon}
              </div>
            </div>
            <div style={{
              fontSize: '2.1rem',
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#ffffff',
              lineHeight: 1.1,
            }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Severity Breakdown */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Flame size={18} color="#f43f5e" />
            <h2 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              THREAT SEVERITY DISTRIBUTION
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'CRITICAL', count: metrics?.events_by_severity.critical ?? 0, color: 'var(--severity-critical)' },
              { label: 'HIGH', count: metrics?.events_by_severity.high ?? 0, color: 'var(--severity-high)' },
              { label: 'MEDIUM', count: metrics?.events_by_severity.medium ?? 0, color: 'var(--severity-medium)' },
              { label: 'LOW', count: metrics?.events_by_severity.low ?? 0, color: 'var(--severity-low)' },
            ].map((sev) => {
              const total = metrics?.total_events || 1;
              const pct = Math.round((sev.count / total) * 100);
              return (
                <div key={sev.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: sev.color }}>{sev.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                      {sev.count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: sev.color,
                      borderRadius: '3px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Type Breakdown */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={18} color="#00b4d8" />
            <h2 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              INTERACTION CLASSIFICATION
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { type: 'login_attempt', label: 'Decoy Login Attempt', count: (metrics?.events_by_type as any)?.login_attempt ?? 0, color: '#f59e0b' },
              { type: 'command_injection', label: 'Command Injection Traps', count: (metrics?.events_by_type as any)?.command_injection ?? 0, color: '#f43f5e' },
              { type: 'honeytoken_accessed', label: 'Honeytoken Canary Alerts', count: (metrics?.events_by_type as any)?.honeytoken_accessed ?? 0, color: '#c084fc' },
              { type: 'file_upload', label: 'Quarantined Upload', count: (metrics?.events_by_type as any)?.file_upload ?? 0, color: '#ef4444' },
              { type: 'recon_probe', label: 'Reconnaissance Probe', count: (metrics?.events_by_type as any)?.recon_probe ?? 0, color: '#38bdf8' },
              { type: 'unauthorized_access', label: 'Unauthorized Enclave Access', count: (metrics?.events_by_type as any)?.unauthorized_access ?? 0, color: '#8b5cf6' },
            ].map((item) => (
              <div
                key={item.type}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{item.label}</span>
                </div>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: '#ffffff',
                }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Trend Ingestion Activity */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#10b981" />
            <h2 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              RECENT OBSERVATIONAL ACTIVITY
            </h2>
          </div>
          <button
            onClick={onNavigateToStream}
            style={{
              background: 'none',
              border: 'none',
              color: '#00b4d8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            VIEW LIVE TELEMETRY STREAM &rarr;
          </button>
        </div>

        {/* Activity Bars */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '12px',
          height: '140px',
          paddingTop: '20px',
        }}>
          {(metrics?.recent_activity || []).map((pt, i) => {
            const maxVal = Math.max(...(metrics?.recent_activity.map((p) => p.count) || [1]), 1);
            const heightPct = Math.max(Math.round((pt.count / maxVal) * 100), 10);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8' }}>
                  {pt.count}
                </span>
                <div style={{
                  width: '100%',
                  maxWidth: '48px',
                  height: `${heightPct}%`,
                  background: 'linear-gradient(180deg, #00b4d8 0%, rgba(0, 180, 216, 0.2) 100%)',
                  borderRadius: '4px 4px 0 0',
                  borderTop: '2px solid #38bdf8',
                  transition: 'height 0.4s ease',
                }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {pt.hour}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
