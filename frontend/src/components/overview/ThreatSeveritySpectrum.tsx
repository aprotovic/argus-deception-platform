import React, { useState, useMemo } from 'react';
import type { Severity, OverviewMetrics } from '../../types';
import {
  Flame,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Activity,
  Filter,
} from 'lucide-react';

interface ThreatSeveritySpectrumProps {
  metrics: OverviewMetrics | null;
  onFilterSeverity?: (severity: Severity | null) => void;
}

export const ThreatSeveritySpectrum: React.FC<ThreatSeveritySpectrumProps> = ({
  metrics,
  onFilterSeverity,
}) => {
  const [hoveredSeverity, setHoveredSeverity] = useState<Severity | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | null>(null);
  const [hoveredWavelength, setHoveredWavelength] = useState<{
    pct: number;
    nm: number;
    label: string;
    color: string;
  } | null>(null);

  const criticalCount = metrics?.events_by_severity?.critical ?? 0;
  const highCount = metrics?.events_by_severity?.high ?? 0;
  const mediumCount = metrics?.events_by_severity?.medium ?? 0;
  const lowCount = metrics?.events_by_severity?.low ?? 0;
  const totalEvents = metrics?.total_events || 0;
  const safeTotal = totalEvents || 1;

  // Threat Index (0-100)
  const threatIndex = useMemo(() => {
    return Math.min(
      100,
      Math.round(
        ((criticalCount * 4 + highCount * 3 + mediumCount * 1.5 + lowCount * 0.5) /
          Math.max(1, totalEvents)) *
          25
      )
    );
  }, [criticalCount, highCount, mediumCount, lowCount, totalEvents]);

  // DEFCON Level calculation
  const defconInfo = useMemo(() => {
    if (criticalCount > 0) {
      return {
        level: 1,
        code: 'DEFCON 1',
        status: 'CRITICAL',
        color: '#ef4444',
        glow: 'rgba(239, 68, 68, 0.2)',
      };
    }
    if (highCount > 0) {
      return {
        level: 2,
        code: 'DEFCON 2',
        status: 'ELEVATED',
        color: '#f97316',
        glow: 'rgba(249, 115, 22, 0.2)',
      };
    }
    if (mediumCount > 0) {
      return {
        level: 3,
        code: 'DEFCON 3',
        status: 'ADVISORY',
        color: '#f59e0b',
        glow: 'rgba(245, 158, 11, 0.2)',
      };
    }
    return {
      level: 4,
      code: 'DEFCON 4',
      status: 'NOMINAL',
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.2)',
    };
  }, [criticalCount, highCount, mediumCount]);

  const severitiesList: Array<{
    key: Severity;
    code: string;
    label: string;
    count: number;
    color: string;
    glow: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'critical',
      code: 'CRIT-01',
      label: 'Critical',
      count: criticalCount,
      color: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.2)',
      icon: <Flame size={15} color="#ef4444" />,
    },
    {
      key: 'high',
      code: 'HIGH-02',
      label: 'High',
      count: highCount,
      color: '#f97316',
      glow: 'rgba(249, 115, 22, 0.2)',
      icon: <AlertTriangle size={15} color="#f97316" />,
    },
    {
      key: 'medium',
      code: 'MED-03',
      label: 'Medium',
      count: mediumCount,
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.2)',
      icon: <Zap size={15} color="#f59e0b" />,
    },
    {
      key: 'low',
      code: 'LOW-04',
      label: 'Low',
      count: lowCount,
      color: '#10b981',
      glow: 'rgba(16, 185, 129, 0.2)',
      icon: <CheckCircle2 size={15} color="#10b981" />,
    },
  ];

  // Arc math for polar radar donut (r=52, C ~326.72)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  let runningOffset = 0;
  const severityArcs = severitiesList.map((sev) => {
    const fraction = totalEvents > 0 ? sev.count / totalEvents : 0;
    const arcLength = fraction * circumference;
    const offset = -runningOffset;
    runningOffset += arcLength;
    return {
      ...sev,
      fraction,
      arcLength,
      offset,
    };
  });

  // Discrete equalizer spectral bars across the 4 bands (36 bars total)
  const totalBars = 36;
  const spectrumBars = useMemo(() => {
    return Array.from({ length: totalBars }).map((_, idx) => {
      const ratio = idx / (totalBars - 1);
      let bandKey: Severity = 'low';
      let bandColor = '#10b981';
      let weightRatio = lowCount / safeTotal;

      if (ratio > 0.72) {
        bandKey = 'critical';
        bandColor = '#ef4444';
        weightRatio = criticalCount / safeTotal;
      } else if (ratio > 0.46) {
        bandKey = 'high';
        bandColor = '#f97316';
        weightRatio = highCount / safeTotal;
      } else if (ratio > 0.22) {
        bandKey = 'medium';
        bandColor = '#f59e0b';
        weightRatio = mediumCount / safeTotal;
      }

      // Height derived from relative severity concentration with animated organic variance
      const baseHeight = 18;
      const variableHeight = totalEvents > 0 ? weightRatio * 64 : 12;
      // Slight sinusoidal wave shape across frequencies
      const wave = Math.sin(ratio * Math.PI * 3 + idx * 0.4) * 8;
      const height = Math.min(Math.max(baseHeight + variableHeight + wave, 12), 76);

      return {
        idx,
        ratio,
        bandKey,
        bandColor,
        height,
      };
    });
  }, [totalBars, criticalCount, highCount, mediumCount, lowCount, totalEvents, safeTotal]);

  const handleCardClick = (key: Severity) => {
    const next = selectedSeverity === key ? null : key;
    setSelectedSeverity(next);
    if (onFilterSeverity) onFilterSeverity(next);
  };

  const activeFocus = hoveredSeverity || selectedSeverity;

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(8, 14, 10, 0.95) 0%, rgba(3, 6, 4, 0.98) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.22)',
        borderRadius: '10px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
        overflow: 'hidden',
      }}
    >
      {/* Background Subtle Tech Grid Scanline */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(16, 185, 129, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.02) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '6px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Flame size={18} color="#ef4444" />
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <h2
                style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                SEVERITY SPECTRUM
              </h2>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                color: '#64748b',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'block',
                marginTop: '2px',
              }}
            >
              Threat distribution by severity level
            </span>
          </div>
        </div>

        {/* DEFCON Rating Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedSeverity && (
            <button
              onClick={() => {
                setSelectedSeverity(null);
                if (onFilterSeverity) onFilterSeverity(null);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-dim)',
                fontSize: '0.68rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Filter size={10} />
              RESET FILTER
            </button>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              background: `rgba(${defconInfo.level === 1 ? '239, 68, 68' : '16, 185, 129'}, 0.08)`,
              border: `1px solid ${defconInfo.color}60`,
              boxShadow: `0 0 6px ${defconInfo.glow}`,
              fontSize: '0.72rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: defconInfo.color,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            <span
              className="radar-dot"
              style={{
                width: '7px',
                height: '7px',
                background: defconInfo.color,
              }}
            />
            <span>{defconInfo.code}: {defconInfo.status}</span>
          </div>
        </div>
      </div>

      {/* CONTINUOUS CHROMATIC SPECTRUM VISUALIZER */}
      <div
        style={{
          background: 'rgba(4, 7, 5, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '22px',
          position: 'relative',
          boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={12} color="#10b981" />
            <span>FREQUENCY SPECTRUM</span>
          </div>
          {hoveredWavelength && (
            <div
              style={{
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: hoveredWavelength.color,
                fontWeight: 600,
              }}
            >
              {hoveredWavelength.nm}nm • {hoveredWavelength.label}
            </div>
          )}
        </div>

        {/* Dynamic Equalizer Spectrum Bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '3px',
            height: '78px',
            paddingBottom: '4px',
            position: 'relative',
          }}
          onMouseLeave={() => setHoveredWavelength(null)}
        >
          {spectrumBars.map((bar) => {
            const isHovered =
              activeFocus === bar.bandKey || (hoveredWavelength && Math.abs(hoveredWavelength.pct - bar.ratio * 100) < 3.5);
            const isDimmed = activeFocus && activeFocus !== bar.bandKey;

            return (
              <div
                key={bar.idx}
                onMouseEnter={() => {
                  setHoveredWavelength({
                    pct: bar.ratio * 100,
                    nm: Math.round(400 + bar.ratio * 450),
                    label: bar.bandKey.toUpperCase(),
                    color: bar.bandColor,
                  });
                }}
                onClick={() => handleCardClick(bar.bandKey)}
                style={{
                  flex: 1,
                  height: `${bar.height}%`,
                  background: isHovered
                    ? bar.bandColor
                    : `linear-gradient(180deg, ${bar.bandColor}b3 0%, rgba(4, 7, 5, 0.4) 100%)`,
                  borderRadius: '1px',
                  boxShadow: isHovered
                    ? `0 0 6px ${bar.bandColor}`
                    : 'none',
                  opacity: isDimmed ? 0.25 : 1,
                  transform: isHovered ? 'scaleY(1.08)' : 'scaleY(1)',
                  transformOrigin: 'bottom',
                  transition: 'height 0.3s ease, opacity 0.2s ease, transform 0.2s ease, background 0.2s ease',
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </div>

        {/* Continuous Gradient Track Beneath Bars */}
        <div
          style={{
            height: '4px',
            borderRadius: '2px',
            background: 'linear-gradient(90deg, #059669 0%, #10b981 22%, #d97706 46%, #ea580c 72%, #dc2626 100%)',
            marginTop: '4px',
            position: 'relative',
          }}
        />

        {/* Spectral Band Labels along bottom */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px',
            fontSize: '0.62rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-dim)',
          }}
        >
          <span style={{ color: '#10b981', fontWeight: 600 }}>LOW</span>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>MEDIUM</span>
          <span style={{ color: '#f97316', fontWeight: 600 }}>HIGH</span>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>CRITICAL</span>
        </div>
      </div>

      {/* LOWER SECTION: RADAR DONUT + TACTICAL CARDS */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Polar Threat Radar Gauge */}
        <div
          style={{
            position: 'relative',
            width: '150px',
            height: '150px',
            flexShrink: 0,
            margin: '0 auto',
          }}
        >
          {/* Radar Sweep Cone Animation */}
          <div
            style={{
              position: 'absolute',
              inset: '6px',
              borderRadius: '50%',
              background:
                'conic-gradient(from 0deg, rgba(16, 185, 129, 0.08) 0deg, rgba(16, 185, 129, 0.02) 40deg, transparent 60deg)',
              animation: 'radarSweep 4.5s linear infinite',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          <svg
            viewBox="0 0 150 150"
            style={{ width: '150px', height: '150px', transform: 'rotate(-90deg)' }}
          >
            <defs>
              <filter id="spectrumArcGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.75" />
              </filter>
            </defs>

            {/* Background Tech Ring */}
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="11"
            />
            {/* Outer Reticle Ticks */}
            <circle
              cx="75"
              cy="75"
              r={radius + 10}
              fill="none"
              stroke="rgba(16, 185, 129, 0.15)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <circle
              cx="75"
              cy="75"
              r={radius - 12}
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />

            {/* Severity Colored Arcs */}
            {totalEvents === 0 ? (
              <circle
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke="#10b981"
                strokeWidth="11"
                strokeDasharray="6 8"
                opacity="0.3"
              />
            ) : (
              severityArcs.map((sev) => {
                if (sev.count === 0) return null;
                const isHovered = activeFocus === sev.key;
                const isDimmed = activeFocus && activeFocus !== sev.key;
                return (
                  <circle
                    key={sev.key}
                    cx="75"
                    cy="75"
                    r={radius}
                    fill="none"
                    stroke={sev.color}
                    strokeWidth={isHovered ? 14 : 11}
                    strokeDasharray={`${Math.max(0, sev.arcLength - 3)} ${circumference}`}
                    strokeDashoffset={sev.offset}
                    opacity={isDimmed ? 0.25 : 1}
                    style={{
                      transition: 'all 0.25s ease',
                      cursor: 'pointer',
                      filter: isHovered ? `drop-shadow(0 0 10px ${sev.color})` : 'none',
                    }}
                    onMouseEnter={() => setHoveredSeverity(sev.key)}
                    onMouseLeave={() => setHoveredSeverity(null)}
                    onClick={() => handleCardClick(sev.key)}
                  />
                );
              })
            )}
          </svg>

          {/* Central Holographic Readout */}
          <div
            style={{
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
              zIndex: 3,
            }}
          >
            <span
              style={{
                fontSize: '1.5rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                color: activeFocus
                  ? severitiesList.find((s) => s.key === activeFocus)?.color || '#e2e8f0'
                  : '#e2e8f0',
                lineHeight: 1,
                transition: 'color 0.2s',
              }}
            >
              {activeFocus
                ? metrics?.events_by_severity[activeFocus] ?? 0
                : totalEvents}
            </span>
            <span
              style={{
                fontSize: '0.62rem',
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 600,
                color: '#64748b',
                letterSpacing: '0.08em',
                marginTop: '3px',
                textTransform: 'uppercase',
              }}
            >
              {activeFocus ? activeFocus : 'THREATS'}
            </span>
            <span
              style={{
                fontSize: '0.62rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: defconInfo.color,
                fontWeight: 600,
                marginTop: '1px',
              }}
            >
              SCORE: {threatIndex}
            </span>
          </div>
        </div>

        {/* Tactical Segmented LED Frequency Arrays */}
        <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {severitiesList.map((sev) => {
            const pct = Math.round((sev.count / safeTotal) * 100);
            const isHovered = activeFocus === sev.key;
            const isDimmed = activeFocus && activeFocus !== sev.key;
            const totalBlocks = 16;
            const filledBlocks = totalEvents > 0 ? Math.round((sev.count / totalEvents) * totalBlocks) : 0;

            return (
              <div
                key={sev.key}
                onMouseEnter={() => setHoveredSeverity(sev.key)}
                onMouseLeave={() => setHoveredSeverity(null)}
                onClick={() => handleCardClick(sev.key)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '6px',
                  background: isHovered
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'rgba(255, 255, 255, 0.015)',
                  border: `1px solid ${isHovered ? sev.color : 'rgba(255, 255, 255, 0.06)'}`,
                  boxShadow: isHovered ? `0 0 8px ${sev.glow}` : 'none',
                  opacity: isDimmed ? 0.35 : 1,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {sev.icon}
                    <span
                      style={{
                        fontFamily: "'Chakra Petch', sans-serif",
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: sev.color,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {sev.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#f1f5f9',
                    }}
                  >
                    {sev.count}{' '}
                    <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 400 }}>
                      ({pct}%)
                    </span>
                  </div>
                </div>

                {/* 16 Discrete LED Segmented Phosphor Blocks */}
                <div style={{ display: 'flex', gap: '3px' }}>
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
                          transition: 'all 0.25s ease',
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
  );
};
