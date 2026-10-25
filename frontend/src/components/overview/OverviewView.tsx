import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { OverviewMetrics, SecurityEvent } from '../../types';
import { useWebSocket } from '../../context/WebSocketContext';
import { TelemetrySpikeGraph } from './TelemetrySpikeGraph';
import { ThreatSeveritySpectrum } from './ThreatSeveritySpectrum';
import { CyberLoader } from '../common/CyberLoader';
import {
  Users,
  KeyRound,
  FileArchive,
  Activity,
  Radio,
  Play,
  Download,
  Shield,
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
      formData.append('password', '[SIMULATED]');
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
      <CyberLoader
        mode="inline"
        message="DECRYPTING LIVE SOC TELEMETRY..."
        subMessage="SYNCHRONIZING ATTACK EVENT DISTRIBUTION & METRICS"
      />
    );
  }

  // Calculate Threat Index (0-100)
  const criticalCount = metrics?.events_by_severity.critical ?? 0;
  const highCount = metrics?.events_by_severity.high ?? 0;
  const mediumCount = metrics?.events_by_severity.medium ?? 0;
  const lowCount = metrics?.events_by_severity.low ?? 0;
  const totalEvents = metrics?.total_events || 0;
  const safeTotal = totalEvents || 1;

  const threatIndex = Math.min(100, Math.round(
    ((criticalCount * 4 + highCount * 3 + mediumCount * 1.5 + lowCount * 0.5) / Math.max(1, totalEvents)) * 25
  ));

  // Deception vectors
  const deceptionVectors = [
    {
      id: 'VEC-01',
      type: 'login_attempt',
      label: 'Auth Portals',
      count: (metrics?.events_by_type as any)?.login_attempt ?? 0,
      color: '#f59e0b',
      icon: <KeyRound size={16} color="#f59e0b" />,
    },
    {
      id: 'VEC-02',
      type: 'recon_probe',
      label: 'Recon Probes',
      count: (metrics?.events_by_type as any)?.recon_probe ?? 0,
      color: '#10b981',
      icon: <Radar size={16} color="#10b981" />,
    },
    {
      id: 'VEC-03',
      type: 'file_upload',
      label: 'File Uploads',
      count: (metrics?.events_by_type as any)?.file_upload ?? 0,
      color: '#ef4444',
      icon: <FileCode size={16} color="#ef4444" />,
    },
    {
      id: 'VEC-04',
      type: 'command_injection',
      label: 'Command Traps',
      count: (metrics?.events_by_type as any)?.command_injection ?? 0,
      color: '#f43f5e',
      icon: <Terminal size={16} color="#f43f5e" />,
    },
    {
      id: 'VEC-05',
      type: 'honeytoken_accessed',
      label: 'Honeytokens',
      count: (metrics?.events_by_type as any)?.honeytoken_accessed ?? 0,
      color: '#c084fc',
      icon: <Binary size={16} color="#c084fc" />,
    },
    {
      id: 'VEC-06',
      type: 'unauthorized_access',
      label: 'Unauthorized Probes',
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
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.02) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
                color: '#e2e8f0',
                textTransform: 'uppercase',
                margin: 0,
              }}>
                SECURITY OVERVIEW
              </h1>
              <span style={{
                fontSize: '0.68rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span className="radar-dot" style={{ width: '6px', height: '6px' }} />
                ACTIVE
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
              Live telemetry and honeypot metrics.
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
              borderColor: 'rgba(16, 185, 129, 0.2)',
              background: 'rgba(16, 185, 129, 0.04)',
            }}
          >
            <Play size={14} color="#10b981" />
            <span>{simulating ? 'SIMULATING...' : 'RUN TEST'}</span>
          </button>

          <a
            href={api.getExportUrl('json')}
            download="argus_forensic_export.json"
            className="btn-primary"
          >
            <Download size={14} />
            <span>EXPORT JSON</span>
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
        border: '1px solid rgba(16, 185, 129, 0.14)',
        borderRadius: '10px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      }}>
        {/* Top Diagnostic Stream Ticker */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          background: 'rgba(0, 0, 0, 0.65)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.12)',
          fontSize: '0.72rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
              <span className="radar-dot" style={{ width: '6px', height: '6px' }} />
              STREAM: LIVE
            </span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>INGESTION: <strong style={{ color: '#cbd5e1' }}>ACTIVE</strong></span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>CONTAINMENT: <strong style={{ color: '#10b981' }}>ENFORCED</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span><strong style={{ color: '#10b981' }}>6 DECOYS</strong></span>
            <span style={{ color: '#1e293b' }}>|</span>
            <span>STATUS: <strong style={{ color: threatIndex > 60 ? '#f43f5e' : '#10b981' }}>
              {threatIndex > 60 ? 'ELEVATED' : 'SECURE'}
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
            borderRight: '1px solid rgba(16, 185, 129, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)',
          }}>
            {/* Corner Bracket */}
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(16, 185, 129, 0.25)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                TOTAL EVENTS
              </span>
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
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
                color: '#e2e8f0',
                lineHeight: 1,
              }}>
                {metrics?.total_events ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)',
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
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,22 L 15,18 L 30,22 L 45,14 L 60,18 L 75,9 L 90,14 L 105,6 L 120,3 L 120,28 L 0,28 Z" fill="url(#metricGrad1)" />
                <path d="M 0,22 L 15,18 L 30,22 L 45,14 L 60,18 L 75,9 L 90,14 L 105,6 L 120,3" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="120" cy="3" r="2.5" fill="#10b981" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>INGESTION</span>
                <span style={{ color: '#10b981' }}>100%</span>
              </div>
            </div>
          </div>

          {/* Cell 2: Unique IPs */}
          <div style={{
            padding: '22px 20px',
            position: 'relative',
            borderRight: '1px solid rgba(16, 185, 129, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)',
          }}>
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(16, 185, 129, 0.25)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                ATTACKER IPS
              </span>
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Users size={18} color="#10b981" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#e2e8f0',
                lineHeight: 1,
              }}>
                {metrics?.unique_ips ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontWeight: 600,
              }}>
                ISOLATED
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,24 L 20,24 L 35,14 L 55,24 L 75,24 L 90,8 L 105,24 L 120,24 L 120,28 L 0,28 Z" fill="url(#metricGrad2)" />
                <path d="M 0,24 L 20,24 L 35,14 L 55,24 L 75,24 L 90,8 L 105,24 L 120,24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="90" cy="8" r="2.5" fill="#10b981" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>PROFILED</span>
                <span style={{ color: '#10b981' }}>ENRICHED</span>
              </div>
            </div>
          </div>

          {/* Cell 3: Trapped Logins */}
          <div style={{
            padding: '22px 20px',
            position: 'relative',
            borderRight: '1px solid rgba(16, 185, 129, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'radial-gradient(circle at 10% 10%, rgba(245, 158, 11, 0.04) 0%, transparent 60%)',
          }}>
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(245, 158, 11, 0.25)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                LOGIN ATTEMPTS
              </span>
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
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
                color: '#e2e8f0',
                lineHeight: 1,
              }}>
                {metrics?.failed_logins ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                fontWeight: 600,
              }}>
                DECOY AUTH
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,24 L 20,24 L 35,16 L 50,16 L 65,20 L 80,12 L 95,12 L 110,6 L 120,6 L 120,28 L 0,28 Z" fill="url(#metricGrad3)" />
                <path d="M 0,24 L 20,24 L 35,16 L 50,16 L 65,20 L 80,12 L 95,12 L 110,6 L 120,6" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="120" cy="6" r="2.5" fill="#f59e0b" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>PASSWORDS</span>
                <span style={{ color: '#f59e0b' }}>HASHED</span>
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
            background: 'radial-gradient(circle at 10% 10%, rgba(244, 63, 94, 0.04) 0%, transparent 60%)',
          }}>
            <span style={{ position: 'absolute', top: '6px', left: '8px', fontSize: '10px', color: 'rgba(244, 63, 94, 0.25)', fontFamily: 'monospace' }}>┌</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.08em',
              }}>
                QUARANTINED FILES
              </span>
              <div style={{
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.2)',
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
                color: '#e2e8f0',
                lineHeight: 1,
              }}>
                {metrics?.quarantined_files ?? 0}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(244, 63, 94, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(244, 63, 94, 0.2)',
                fontWeight: 600,
              }}>
                {metrics?.rejected_uploads ?? 0} REJECTED
              </span>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
              <svg viewBox="0 0 120 28" style={{ width: '100%', height: '28px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="metricGrad4" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0,24 L 25,24 L 40,10 L 55,24 L 75,24 L 90,6 L 105,24 L 120,24 L 120,28 L 0,28 Z" fill="url(#metricGrad4)" />
                <path d="M 0,24 L 25,24 L 40,10 L 55,24 L 75,24 L 90,6 L 105,24 L 120,24" fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="90" cy="6" r="2.5" fill="#f43f5e" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>CONTAINMENT</span>
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

        {/* LEFT: ADVANCED CYBER THREAT SEVERITY SPECTRUM */}
        <ThreatSeveritySpectrum metrics={metrics} />

        {/* RIGHT: DECEPTION VECTOR INVENTORY (Honeytrap Vector Hub) */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(8, 14, 10, 0.95) 0%, rgba(3, 6, 4, 0.98) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.22)',
          borderRadius: '10px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
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
                  color: '#e2e8f0',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}>
                  INTERACTION VECTORS
                </h2>
              </div>
            </div>

            <span style={{
              fontSize: '0.7rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#10b981',
              padding: '2px 8px',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontWeight: 600,
            }}>
              6 VECTORS
            </span>
          </div>

          {/* Vector Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {deceptionVectors.map((item) => {
              const vectorPct = Math.round((item.count / safeTotal) * 100);
              const isActive = item.count > 0;

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.1)';
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                    <span style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", color: '#64748b' }}>
                      {vectorPct}%
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: '1px 6px',
                      borderRadius: '3px',
                      background: isActive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                      color: isActive ? '#10b981' : '#64748b',
                      fontWeight: 600,
                    }}>
                      {isActive ? 'TRAPPED' : 'ARMED'}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      color: '#ffffff',
                      minWidth: '20px',
                      textAlign: 'right',
                    }}>
                      {item.count}
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
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Activity size={18} color="#10b981" />
            </div>
            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: '#e2e8f0',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}>
                RECENT ACTIVITY
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Telemetry spikes over 36 hours
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
              LIVE STREAM &rarr;
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
