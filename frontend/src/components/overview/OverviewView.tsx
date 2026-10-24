import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { OverviewMetrics, SecurityEvent, Severity } from '../../types';
import { useWebSocket } from '../../context/WebSocketContext';
import { TelemetrySpikeGraph } from './TelemetrySpikeGraph';
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
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Crosshair,
  Radar,
  Binary,
  Lock,
  FileCode,
} from 'lucide-react';

export const OverviewView: React.FC<{ onNavigateToStream: () => void }> = ({ onNavigateToStream }) => {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [hoveredSeverity, setHoveredSeverity] = useState<Severity | null>(null);
  const { lastEvent } = useWebSocket();

  const fetchMetrics = async () => {
    try {
      const [metricsData, eventsRes] = await Promise.all([
        api.getMetrics(),
        api.getEvents({ limit: 100 }),
      ]);
      setMetrics(metricsData);
      setEvents(eventsRes.items);
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
        <RefreshCw size={24} className="animate-spin" color="#10b981" />
        <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>Retrieving operational telemetry...</span>
      </div>
    );
  }

  // Calculate Threat Severity metrics for the Circular Gauge
  const criticalCount = metrics?.events_by_severity.critical ?? 0;
  const highCount = metrics?.events_by_severity.high ?? 0;
  const mediumCount = metrics?.events_by_severity.medium ?? 0;
  const lowCount = metrics?.events_by_severity.low ?? 0;
  const totalEvents = metrics?.total_events || 0;
  const safeTotal = totalEvents || 1;

  // Arc math for the circular gauge (circumference of r=50 is ~314.16)
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  
  const severitiesList: Array<{
    key: Severity;
    label: string;
    count: number;
    color: string;
    glow: string;
    action: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'critical',
      label: 'CRITICAL',
      count: criticalCount,
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.45)',
      action: 'ISOLATION ENFORCED',
      icon: <Flame size={14} color="#ef4444" />,
    },
    {
      key: 'high',
      label: 'HIGH',
      count: highCount,
      color: '#f97316',
      glow: 'rgba(249, 115, 22, 0.45)',
      action: 'AUTOMATED BLOCK',
      icon: <AlertTriangle size={14} color="#f97316" />,
    },
    {
      key: 'medium',
      label: 'MEDIUM',
      count: mediumCount,
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.45)',
      action: 'DECOY ENGAGED',
      icon: <ShieldAlert size={14} color="#f59e0b" />,
    },
    {
      key: 'low',
      label: 'LOW',
      count: lowCount,
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.45)',
      action: 'PASSIVE AUDIT',
      icon: <ShieldCheck size={14} color="#10b981" />,
    },
  ];

  // Calculate cumulative arc offsets
  let cumulativeLength = 0;
  const severityArcs = severitiesList.map((sev) => {
    const fraction = totalEvents > 0 ? sev.count / totalEvents : 0;
    const arcLength = fraction * circumference;
    const offset = -cumulativeLength;
    cumulativeLength += arcLength;
    return {
      ...sev,
      fraction,
      arcLength,
      offset,
    };
  });

  // Calculate Threat Index (0-100)
  const threatIndex = Math.min(100, Math.round(
    ((criticalCount * 4 + highCount * 3 + mediumCount * 1.5 + lowCount * 0.5) / Math.max(1, totalEvents)) * 25
  ));

  // Deception vectors
  const deceptionVectors = [
    {
      id: 'VEC-01',
      type: 'login_attempt',
      label: 'Decoy Authentication Portals',
      sub: 'Synthetic SSH / Admin login forms trapping credential sprays',
      count: (metrics?.events_by_type as any)?.login_attempt ?? 0,
      color: '#f59e0b',
      icon: <KeyRound size={16} color="#f59e0b" />,
    },
    {
      id: 'VEC-02',
      type: 'recon_probe',
      label: 'Reconnaissance Scanners',
      sub: 'Exposed fictitious .env, wp-login, swagger & git endpoints',
      count: (metrics?.events_by_type as any)?.recon_probe ?? 0,
      color: '#10b981',
      icon: <Radar size={16} color="#10b981" />,
    },
    {
      id: 'VEC-03',
      type: 'file_upload',
      label: 'Quarantined File Uploads',
      sub: 'In-memory sandbox trapping web-shells & executable binaries',
      count: (metrics?.events_by_type as any)?.file_upload ?? 0,
      color: '#ef4444',
      icon: <FileCode size={16} color="#ef4444" />,
    },
    {
      id: 'VEC-04',
      type: 'command_injection',
      label: 'Command Injection Traps',
      sub: 'Emulated virtual shell intercepting system command payloads',
      count: (metrics?.events_by_type as any)?.command_injection ?? 0,
      color: '#f43f5e',
      icon: <Terminal size={16} color="#f43f5e" />,
    },
    {
      id: 'VEC-05',
      type: 'honeytoken_accessed',
      label: 'Honeytoken Canary Traps',
      sub: 'Synthetic high-privilege AWS keys, tokens & connection strings',
      count: (metrics?.events_by_type as any)?.honeytoken_accessed ?? 0,
      color: '#c084fc',
      icon: <Binary size={16} color="#c084fc" />,
    },
    {
      id: 'VEC-06',
      type: 'unauthorized_access',
      label: 'Unauthorized Enclave Probes',
      sub: 'Zero-trust perimeter violations & forbidden route attempts',
      count: (metrics?.events_by_type as any)?.unauthorized_access ?? 0,
      color: '#8b5cf6',
      icon: <Lock size={16} color="#8b5cf6" />,
    },
  ];

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner & Control Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.25)',
          }}>
            <Shield size={20} color="#10b981" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.65rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: '#ffffff',
                textTransform: 'uppercase',
                margin: 0,
                textShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
              }}>
                SECURITY OPERATIONS OVERVIEW
              </h1>
              <span style={{
                fontSize: '0.68rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span className="radar-dot" style={{ width: '6px', height: '6px' }} />
                DEFENSE MATRIX ACTIVE
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span>Live attack telemetry & honeypot interaction metrics captured by ARGUS.</span>
              <span style={{ color: '#334155' }}>•</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.74rem', color: '#64748b' }}>
                NODE: <span style={{ color: '#10b981' }}>ARGUS-EAST-01</span>
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleSimulateTraffic}
            disabled={simulating}
            className="btn-secondary"
            title="Inject controlled test traffic marked with is_test_event=True"
            style={{
              borderColor: 'rgba(16, 185, 129, 0.3)',
              background: 'rgba(16, 185, 129, 0.05)',
            }}
          >
            <Play size={14} color="#10b981" />
            <span>{simulating ? 'GENERATING TEST TRAFFIC...' : 'RUN CONTROLLED TEST'}</span>
          </button>

          <a
            href={api.getExportUrl('json')}
            download="argus_forensic_export.json"
            className="btn-primary"
            style={{
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Download size={14} />
            <span>EXPORT REPORT (JSON)</span>
          </a>
        </div>
      </div>

      {simMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '6px',
          padding: '10px 16px',
          fontSize: '0.82rem',
          color: '#10b981',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 0 14px rgba(16, 185, 129, 0.15)',
        }}>
          <Radio size={16} />
          <span>{simMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TACTICAL TELEMETRY COMMAND DECK (Integrated HUD Console) */}
      {/* ========================================================= */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(8, 14, 10, 0.95) 0%, rgba(3, 6, 4, 0.98) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.22)',
        borderRadius: '10px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(16, 185, 129, 0.25)',
      }}>
        {/* Top Diagnostic Stream Ticker */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          background: 'rgba(0, 0, 0, 0.65)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
          fontSize: '0.72rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
              <span className="radar-dot" style={{ width: '6px', height: '6px' }} />
              TELEMETRY STREAM // LIVE
            </span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>INGESTION: <strong style={{ color: '#f1f5f9' }}>ONLINE</strong></span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>CONTAINMENT: <strong style={{ color: '#10b981' }}>ENFORCED</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>DECOYS: <strong style={{ color: '#10b981' }}>6 ARMED</strong></span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>STATUS: <strong style={{ color: threatIndex > 60 ? '#f43f5e' : '#10b981' }}>
              {threatIndex > 60 ? 'ELEVATED RISK' : 'SECURE'}
            </strong></span>
          </div>
        </div>

        {/* 4 Connected Telemetry Hub Cells */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}>
          {/* Cell 1: Total Events */}
          <div style={{
            padding: '22px 20px',
            position: 'relative',
            borderRight: '1px solid rgba(16, 185, 129, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
          }}>
            {/* Corner Bracket */}
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(16, 185, 129, 0.4)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                TOTAL OBSERVED EVENTS
              </span>
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Activity size={18} color="#10b981" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#ffffff',
                lineHeight: 1,
                textShadow: '0 0 20px rgba(16, 185, 129, 0.45)',
              }}>
                {metrics?.total_events ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontWeight: 600,
              }}>
                +{metrics?.events_last_24h ?? 0} 24h
              </span>
            </div>

            {/* Ambient Mini Pulse Sparkline */}
            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,22 L 15,18 L 30,22 L 45,14 L 60,18 L 75,9 L 90,14 L 105,6 L 120,3 L 120,28 L 0,28 Z" fill="url(#metricGrad1)" />
                <path d="M 0,22 L 15,18 L 30,22 L 45,14 L 60,18 L 75,9 L 90,14 L 105,6 L 120,3" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
                <circle cx="120" cy="3" r="3" fill="#10b981" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>TELEMETRY INGESTION</span>
                <span style={{ color: '#10b981' }}>100% CAPTURED</span>
              </div>
            </div>
          </div>

          {/* Cell 2: Unique IPs */}
          <div style={{
            padding: '22px 20px',
            position: 'relative',
            borderRight: '1px solid rgba(16, 185, 129, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(52, 211, 153, 0.08) 0%, transparent 60%)',
          }}>
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(52, 211, 153, 0.4)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                UNIQUE ATTACKER IPS
              </span>
              <div style={{
                background: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Users size={18} color="#34d399" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#ffffff',
                lineHeight: 1,
                textShadow: '0 0 20px rgba(52, 211, 153, 0.45)',
              }}>
                {metrics?.unique_ips ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                fontWeight: 600,
              }}>
                ISOLATED
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,24 L 20,24 L 35,14 L 55,24 L 75,24 L 90,8 L 105,24 L 120,24 L 120,28 L 0,28 Z" fill="url(#metricGrad2)" />
                <path d="M 0,24 L 20,24 L 35,14 L 55,24 L 75,24 L 90,8 L 105,24 L 120,24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                <circle cx="90" cy="8" r="3" fill="#34d399" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>SOURCES PROFILED</span>
                <span style={{ color: '#34d399' }}>GEO ENRICHED</span>
              </div>
            </div>
          </div>

          {/* Cell 3: Trapped Logins */}
          <div style={{
            padding: '22px 20px',
            position: 'relative',
            borderRight: '1px solid rgba(16, 185, 129, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.08) 0%, transparent 60%)',
          }}>
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(245, 158, 11, 0.4)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                TRAPPED LOGIN ATTEMPTS
              </span>
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <KeyRound size={18} color="#f59e0b" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#ffffff',
                lineHeight: 1,
                textShadow: '0 0 20px rgba(245, 158, 11, 0.45)',
              }}>
                {metrics?.failed_logins ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontWeight: 600,
              }}>
                DECOY AUTH
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,24 L 20,24 L 35,16 L 50,16 L 65,20 L 80,12 L 95,12 L 110,6 L 120,6 L 120,28 L 0,28 Z" fill="url(#metricGrad3)" />
                <path d="M 0,24 L 20,24 L 35,16 L 50,16 L 65,20 L 80,12 L 95,12 L 110,6 L 120,6" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                <circle cx="120" cy="6" r="3" fill="#f59e0b" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>CANARY PASSWORDS</span>
                <span style={{ color: '#f59e0b' }}>HMAC HASHED</span>
              </div>
            </div>
          </div>

          {/* Cell 4: Quarantined Payloads */}
          <div style={{
            padding: '22px 20px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(244, 63, 94, 0.08) 0%, transparent 60%)',
          }}>
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(244, 63, 94, 0.4)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                QUARANTINED PAYLOADS
              </span>
              <div style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileArchive size={18} color="#f43f5e" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#ffffff',
                lineHeight: 1,
                textShadow: '0 0 20px rgba(244, 63, 94, 0.45)',
              }}>
                {metrics?.quarantined_files ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                fontWeight: 600,
              }}>
                {metrics?.rejected_uploads ?? 0} REJECTED
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad4" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,24 L 25,24 L 40,10 L 55,24 L 75,24 L 90,6 L 105,24 L 120,24 L 120,28 L 0,28 Z" fill="url(#metricGrad4)" />
                <path d="M 0,24 L 25,24 L 40,10 L 55,24 L 75,24 L 90,6 L 105,24 L 120,24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                <circle cx="90" cy="6" r="3" fill="#f43f5e" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>SANDBOX CONTAINMENT</span>
                <span style={{ color: '#f43f5e' }}>0 ESCAPES</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. MASTER THREAT & DECEPTION MATRIX (Polar Radar + Honeytrap Grid) */}
      {/* ========================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '22px' }}>
        
        {/* LEFT: THREAT SEVERITY SPECTRUM (Interactive Radar Donut & Segmented LED Bars) */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(8, 14, 10, 0.95) 0%, rgba(3, 6, 4, 0.98) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.22)',
          borderRadius: '10px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Flame size={18} color="#ef4444" />
              </div>
              <div>
                <h2 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}>
                  THREAT SEVERITY SPECTRUM
                </h2>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                  TELEMETRY ENGINE // SEVERITY PROFILE
                </span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: criticalCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              border: `1px solid ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              fontSize: '0.7rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: criticalCount > 0 ? '#f87171' : '#10b981',
              fontWeight: 600,
            }}>
              <span className="radar-dot" style={{
                width: '6px',
                height: '6px',
                background: criticalCount > 0 ? '#ef4444' : '#10b981'
              }} />
              {criticalCount > 0 ? 'CRITICAL RISK' : 'CONTAINED'}
            </div>
          </div>

          {/* Visual Breakdown: Circular Arc Radar + Segmented Level Meters */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Circular Polar Threat Arc Gauge */}
            <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0, margin: '0 auto' }}>
              <svg viewBox="0 0 140 140" style={{ width: '140px', height: '140px', transform: 'rotate(-90deg)' }}>
                {/* Background Tech Ring */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.04)"
                  strokeWidth="10"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius + 8}
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.1)"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />

                {/* Severity Colored Arcs */}
                {totalEvents === 0 ? (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="10"
                    strokeDasharray="6 8"
                    opacity="0.3"
                  />
                ) : (
                  severityArcs.map((sev) => {
                    if (sev.count === 0) return null;
                    const isHovered = hoveredSeverity === sev.key;
                    return (
                      <circle
                        key={sev.key}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke={sev.color}
                        strokeWidth={isHovered ? 13 : 10}
                        strokeDasharray={`${Math.max(0, sev.arcLength - 3)} ${circumference}`}
                        strokeDashoffset={sev.offset}
                        style={{
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          filter: isHovered ? `drop-shadow(0 0 8px ${sev.color})` : 'none',
                        }}
                        onMouseEnter={() => setHoveredSeverity(sev.key)}
                        onMouseLeave={() => setHoveredSeverity(null)}
                      />
                    );
                  })
                )}
              </svg>

              {/* Center HUD Readout */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{
                  fontSize: '1.45rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1,
                  textShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                }}>
                  {hoveredSeverity
                    ? metrics?.events_by_severity[hoveredSeverity] ?? 0
                    : totalEvents}
                </span>
                <span style={{
                  fontSize: '0.62rem',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontWeight: 600,
                  color: '#64748b',
                  letterSpacing: '0.08em',
                  marginTop: '2px',
                  textTransform: 'uppercase',
                }}>
                  {hoveredSeverity ? hoveredSeverity : 'THREATS'}
                </span>
                <span style={{
                  fontSize: '0.6rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#10b981',
                  marginTop: '1px',
                }}>
                  SCORE: {threatIndex}
                </span>
              </div>
            </div>

            {/* Segmented LED Level Meters */}
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {severitiesList.map((sev) => {
                const pct = Math.round((sev.count / safeTotal) * 100);
                const isHovered = hoveredSeverity === sev.key;
                const totalBlocks = 14;
                const filledBlocks = totalEvents > 0 ? Math.round((sev.count / totalEvents) * totalBlocks) : 0;

                return (
                  <div
                    key={sev.key}
                    onMouseEnter={() => setHoveredSeverity(sev.key)}
                    onMouseLeave={() => setHoveredSeverity(null)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: isHovered ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                      border: `1px solid ${isHovered ? sev.color : 'rgba(255, 255, 255, 0.05)'}`,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {sev.icon}
                        <span style={{
                          fontFamily: "'Chakra Petch', sans-serif",
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: sev.color,
                          letterSpacing: '0.04em',
                        }}>
                          {sev.label}
                        </span>
                        <span style={{
                          fontSize: '0.62rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#475569',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}>
                          {sev.action}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>
                        {sev.count} <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 400 }}>({pct}%)</span>
                      </div>
                    </div>

                    {/* 14 Discrete LED Segmented Blocks */}
                    <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                      {Array.from({ length: totalBlocks }).map((_, blockIdx) => {
                        const isFilled = blockIdx < filledBlocks;
                        return (
                          <div
                            key={blockIdx}
                            style={{
                              flex: 1,
                              height: '6px',
                              borderRadius: '1px',
                              background: isFilled ? sev.color : 'rgba(255, 255, 255, 0.05)',
                              boxShadow: isFilled ? `0 0 6px ${sev.glow}` : 'none',
                              transition: 'all 0.3s ease',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: DECEPTION VECTOR INVENTORY (Honeytrap Vector Hub) */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(8, 14, 10, 0.95) 0%, rgba(3, 6, 4, 0.98) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.22)',
          borderRadius: '10px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Crosshair size={18} color="#10b981" />
              </div>
              <div>
                <h2 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}>
                  INTERACTION CLASSIFICATION & VECTORS
                </h2>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                  DECEPTION LAYER // ACTIVE HONEY-GRID
                </span>
              </div>
            </div>

            <span style={{
              fontSize: '0.7rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#10b981',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontWeight: 600,
            }}>
              6 VECTORS ARMED
            </span>
          </div>

          {/* Vector Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {deceptionVectors.map((item) => {
              const vectorPct = Math.round((item.count / safeTotal) * 100);
              const isActive = item.count > 0;

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.12)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.45)';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.12)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  {/* Subtle Background Intensity Gradient Bar */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${vectorPct}%`,
                    background: `linear-gradient(90deg, ${item.color}15 0%, ${item.color}05 100%)`,
                    pointerEvents: 'none',
                    transition: 'width 0.4s ease',
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                        color: item.color,
                        background: `${item.color}18`,
                        border: `1px solid ${item.color}40`,
                        borderRadius: '3px',
                        padding: '1px 5px',
                      }}>
                        {item.id}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.icon}
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>
                          {item.label}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                        color: isActive ? '#34d399' : '#64748b',
                        fontWeight: 600,
                      }}>
                        {isActive ? `TRAPPED (${item.count})` : 'ARMED'}
                      </span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: '#ffffff',
                        minWidth: '24px',
                        textAlign: 'right',
                      }}>
                        {item.count}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {item.sub}
                    </span>
                    <span style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>
                      {vectorPct}% of total
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* 3. CONTINUOUS OBSERVATIONAL IMPULSE WAVEFORM CHART        */}
      {/* ========================================================= */}

      {/* Observational Telemetry Impulse Waveform Chart */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(255, 20, 117, 0.12)',
              border: '1px solid rgba(255, 20, 117, 0.35)',
              borderRadius: '6px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Activity size={18} color="#ff1475" />
            </div>
            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}>
                RECENT OBSERVATIONAL ACTIVITY
                <span style={{
                  fontSize: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  color: '#10b981',
                }}>
                  TELEMETRY IMPULSE STREAM
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Real-time attack telemetry and honeypot interaction spikes over temporal window
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={onNavigateToStream}
              style={{
                background: 'none',
                border: 'none',
                color: '#10b981',
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
        </div>

        {/* Continuous Neon Pink Telemetry Spike Waveform */}
        <TelemetrySpikeGraph
          events={events}
          recentActivity={metrics?.recent_activity}
          height={210}
        />
      </div>
    </div>
  );
};
