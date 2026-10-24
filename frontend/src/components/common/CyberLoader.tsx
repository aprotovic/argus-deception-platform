import React, { useEffect, useState } from 'react';
import { Shield, Radio, Terminal } from 'lucide-react';

interface CyberLoaderProps {
  mode?: 'fullscreen' | 'inline';
  message?: string;
  subMessage?: string;
}

const BOOT_LOGS = [
  'INITIALIZING ARGUS DEFENSE PROTOCOLS....',
  'ESTABLISHING ZERO-TRUST ENCLAVE TUNNEL....',
  'CALIBRATING CANARY HONEYTOKENS....',
  'SYNCHRONIZING DECEPTION SENSORS....',
  'QUANTUM TELEMETRY STREAM ONLINE',
];

export const CyberLoader: React.FC<CyberLoaderProps> = ({
  mode = 'inline',
  message = 'INITIALIZING ARGUS ENCLAVE...',
  subMessage = 'ESTABLISHING ZERO-TRUST TELEMETRY LINK',
}) => {
  const [logIndex, setLogIndex] = useState(0);
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    const logInterval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % BOOT_LOGS.length);
    }, 1800);

    const progressInterval = setInterval(() => {
      setProgress((prev) => (prev >= 98 ? 18 : prev + Math.floor(Math.random() * 14 + 6)));
    }, 450);

    return () => {
      clearInterval(logInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const isFullscreen = mode === 'fullscreen';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isFullscreen ? '100vh' : '320px',
        width: '100%',
        background: isFullscreen ? 'var(--bg-primary)' : 'transparent',
        padding: '32px 16px',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Background Cyber Ambient Grid & Radial Glow */}
      <div
        style={{
          position: 'absolute',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.02) 45%, transparent 70%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Holographic Concentric Scanner */}
      <div
        style={{
          position: 'relative',
          width: isFullscreen ? '150px' : '120px',
          height: isFullscreen ? '150px' : '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        {/* Outer Tech Ring - Clockwise */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px dashed rgba(16, 185, 129, 0.4)',
            animation: 'radarSweep 12s linear infinite',
          }}
        />

        {/* Second Ring - Counter-Clockwise with Segmented Gaps */}
        <div
          style={{
            position: 'absolute',
            inset: '8px',
            borderRadius: '50%',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderTopColor: '#10b981',
            borderBottomColor: '#10b981',
            animation: 'radarSweep 6s linear infinite reverse',
          }}
        />

        {/* Third High-Speed Inner Ring */}
        <div
          style={{
            position: 'absolute',
            inset: '18px',
            borderRadius: '50%',
            border: '2px solid transparent',
            borderLeftColor: 'rgba(52, 211, 153, 0.7)',
            borderRightColor: 'rgba(52, 211, 153, 0.7)',
            animation: 'radarSweep 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />

        {/* Radar Sweep Cone Beam */}
        <div
          style={{
            position: 'absolute',
            inset: '10px',
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, rgba(16, 185, 129, 0.28) 0deg, rgba(16, 185, 129, 0.05) 50deg, transparent 75deg)',
            animation: 'radarSweep 2.4s linear infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Central Glowing Shield Icon */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 78, 59, 0.4) 100%)',
            border: '1px solid #10b981',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.5), inset 0 0 10px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulseRingGlow 2s ease-in-out infinite',
          }}
        >
          <Shield size={24} color="#10b981" />
        </div>
      </div>

      {/* Main Tactical Title */}
      <div
        style={{
          fontFamily: "'Chakra Petch', sans-serif",
          fontSize: isFullscreen ? '1.15rem' : '0.98rem',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.08em',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <Radio size={15} color="#10b981" className="animate-pulse" />
        <span>{message}</span>
      </div>

      {/* Rotating Cyber Telemetry Feed Log */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.72rem',
          color: '#10b981',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '4px 12px',
          borderRadius: '4px',
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '16px',
          maxWidth: '90%',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Terminal size={12} color="#10b981" />
        <span style={{ color: '#34d399' }}>&gt;</span>
        <span>{BOOT_LOGS[logIndex] || subMessage}</span>
      </div>

      {/* Segmented Cyber Progress Bar */}
      <div
        style={{
          width: isFullscreen ? '260px' : '200px',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(progress, 100)}%`,
            background: 'linear-gradient(90deg, #059669 0%, #10b981 70%, #34d399 100%)',
            boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)',
            transition: 'width 0.35s ease',
          }}
        />
      </div>

      {/* Percent HUD readout */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem',
          color: '#64748b',
          marginTop: '6px',
          letterSpacing: '0.06em',
        }}
      >
        TELEMETRY SYNC: <span style={{ color: '#10b981', fontWeight: 600 }}>{Math.min(progress, 99)}%</span>
      </div>
    </div>
  );
};
