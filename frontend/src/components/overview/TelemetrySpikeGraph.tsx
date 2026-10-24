import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { SecurityEvent, HourlyActivity } from '../../types';

interface TelemetrySpikeGraphProps {
  events?: SecurityEvent[];
  recentActivity?: HourlyActivity[];
  height?: number;
}

interface ImpulsePoint {
  timeMs: number;
  label: string;
  weight: number;
  count: number;
  severities: Record<string, number>;
  types: Record<string, number>;
}

export const TelemetrySpikeGraph: React.FC<TelemetrySpikeGraphProps> = ({
  events = [],
  recentActivity = [],
  height = 190,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [hoverData, setHoverData] = useState<{
    x: number;
    y: number;
    timeLabel: string;
    count: number;
    severities: Record<string, number>;
  } | null>(null);

  // Track responsive container width
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth || 800);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute impulse data points from real events or recentActivity fallback
  const { impulses, timeMin, timeMax, peakCount } = useMemo(() => {
    const nowMs = Date.now();
    let minTime = nowMs - 36 * 3600 * 1000; // default 36 hours window
    let maxTime = nowMs;
    const impulseList: ImpulsePoint[] = [];

    if (events && events.length > 0) {
      // Find event time bounds
      const eventTimes = events.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t));
      if (eventTimes.length > 0) {
        const earliest = Math.min(...eventTimes);
        minTime = Math.min(earliest - 3600 * 1000, nowMs - 36 * 3600 * 1000);
        maxTime = Math.max(...eventTimes, nowMs);
      }

      // Group close events into impulses (within 60-second clusters)
      const sorted = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let currentCluster: ImpulsePoint | null = null;
      const clusterThresholdMs = Math.max((maxTime - minTime) / 120, 30 * 1000); // adaptive cluster resolution

      for (const ev of sorted) {
        const evTime = new Date(ev.timestamp).getTime();
        if (isNaN(evTime)) continue;

        const sev = ev.severity?.toLowerCase() || 'medium';
        const sevWeight = sev === 'critical' ? 4 : sev === 'high' ? 2.8 : sev === 'medium' ? 1.8 : 1;

        if (currentCluster && Math.abs(evTime - currentCluster.timeMs) <= clusterThresholdMs) {
          currentCluster.count += 1;
          currentCluster.weight += sevWeight;
          currentCluster.severities[sev] = (currentCluster.severities[sev] || 0) + 1;
          currentCluster.types[ev.event_type] = (currentCluster.types[ev.event_type] || 0) + 1;
        } else {
          if (currentCluster) {
            impulseList.push(currentCluster);
          }
          currentCluster = {
            timeMs: evTime,
            label: new Date(evTime).toUTCString().replace('GMT', 'UTC').slice(0, 22),
            weight: sevWeight,
            count: 1,
            severities: { [sev]: 1 },
            types: { [ev.event_type]: 1 },
          };
        }
      }
      if (currentCluster) {
        impulseList.push(currentCluster);
      }
    } else if (recentActivity && recentActivity.length > 0) {
      // Fallback to recentActivity intervals
      const bucketCount = recentActivity.length;
      minTime = nowMs - bucketCount * 3600 * 1000;
      maxTime = nowMs;

      recentActivity.forEach((item, index) => {
        if (item.count > 0) {
          const tMs = minTime + (index / (bucketCount - 1 || 1)) * (maxTime - minTime);
          impulseList.push({
            timeMs: tMs,
            label: item.hour,
            weight: item.count * 2,
            count: item.count,
            severities: {},
            types: {},
          });
        }
      });
    }

    const maxCount = impulseList.reduce((max, imp) => Math.max(max, imp.count), 0);

    return {
      impulses: impulseList,
      timeMin: minTime,
      timeMax: maxTime,
      peakCount: maxCount || 1,
    };
  }, [events, recentActivity]);

  // Geometry calculations
  const padX = 18;
  const padBottom = 22;
  const padTop = 18;
  const baselineY = height - padBottom;
  const usableHeight = baselineY - padTop;
  const usableWidth = Math.max(containerWidth - padX * 2, 100);

  // Generate continuous SVG spike curve matching the user's reference image
  const { strokePath, fillPath, samplePoints } = useMemo(() => {
    if (containerWidth <= 0) return { strokePath: '', fillPath: '', samplePoints: [] };

    // Map each impulse to an X pixel coordinate and peak height
    const maxWeight = Math.max(...impulses.map((i) => i.weight), 1);
    const mappedImpulses = impulses.map((imp) => {
      const ratio = (imp.timeMs - timeMin) / (timeMax - timeMin || 1);
      const px = padX + ratio * usableWidth;
      // Scale height: minimum 18px for low events, up to usableHeight for peak bursts
      const normalizedH = Math.max((imp.weight / maxWeight) * usableHeight, 18);
      return {
        px,
        h: Math.min(normalizedH, usableHeight),
        imp,
      };
    });

    // Gaussian impulse width (sigma): 3.5px creates needle-sharp spikes with smooth bell bases
    const sigma = 3.6;
    const step = 2; // sample every 2px for high-definition smooth curve
    const points: { x: number; y: number; impulse?: ImpulsePoint }[] = [];

    for (let x = 0; x <= containerWidth; x += step) {
      let totalH = 0;
      let dominantImpulse: ImpulsePoint | undefined;
      let minDistance = Infinity;

      for (const m of mappedImpulses) {
        const dx = x - m.px;
        const dist = Math.abs(dx);
        if (dist < 28) {
          const kernel = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          totalH += m.h * kernel;
          if (dist < minDistance && kernel > 0.15) {
            minDistance = dist;
            dominantImpulse = m.imp;
          }
        }
      }

      // Lock to exact flat baseline between spikes
      if (totalH < 0.3) {
        totalH = 0;
        dominantImpulse = undefined;
      }

      const y = baselineY - Math.min(totalH, usableHeight);
      points.push({ x, y, impulse: dominantImpulse });
    }

    if (points.length === 0) return { strokePath: '', fillPath: '', samplePoints: [] };

    // Build SVG path
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    // Closed path for subtle gradient fill
    const fillD = `${d} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

    return { strokePath: d, fillPath: fillD, samplePoints: points };
  }, [containerWidth, impulses, timeMin, timeMax, usableWidth, usableHeight, baselineY]);

  // Handle crosshair hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find closest sample point
    if (samplePoints.length === 0) return;
    const closest = samplePoints.reduce((prev, curr) =>
      Math.abs(curr.x - mouseX) < Math.abs(prev.x - mouseX) ? curr : prev
    );

    // Compute time at mouseX
    const ratio = Math.max(0, Math.min((mouseX - padX) / (usableWidth || 1), 1));
    const timeAtX = new Date(timeMin + ratio * (timeMax - timeMin));
    const timeLabel = timeAtX.toUTCString().replace('GMT', 'UTC').slice(0, 22);

    const isSpike = closest.y < baselineY - 2;
    setHoverData({
      x: closest.x,
      y: closest.y,
      timeLabel: closest.impulse?.label || timeLabel,
      count: closest.impulse?.count || (isSpike ? 1 : 0),
      severities: closest.impulse?.severities || {},
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  // Generate 5-6 readable time axis labels
  const timeLabels = useMemo(() => {
    const labels: { label: string; xPct: number }[] = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      const t = new Date(timeMin + ratio * (timeMax - timeMin));
      const hoursAgo = Math.round((timeMax - t.getTime()) / (3600 * 1000));
      const label =
        i === count
          ? 'NOW'
          : hoursAgo > 0
          ? `-${hoursAgo}h`
          : t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      labels.push({ label, xPct: ratio * 100 });
    }
    return labels;
  }, [timeMin, timeMax]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        background: 'transparent',
        border: 'none',
        overflow: 'hidden',
        boxShadow: 'none',
      }}
    >
      {/* Top right live status & peak indicator */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <div
          style={{
            background: 'rgba(10, 14, 23, 0.8)',
            border: '1px solid rgba(255, 20, 117, 0.3)',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '0.65rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span style={{ color: '#10b981', fontWeight: 600 }}>MAX PEAK:</span>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>{peakCount} BURST</span>
        </div>
      </div>

      <svg
        width="100%"
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
      >
        <defs>
          {/* Subtle green gradient fill beneath peaks */}
          <linearGradient id="neonGreenSpikeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="65%" stopColor="#10b981" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>

          {/* Neon glow filter */}
          <filter id="neonSpikeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10b981" floodOpacity="0.85" />
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#10b981" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Shaded area under the peaks */}
        {fillPath && <path d={fillPath} fill="url(#neonGreenSpikeGrad)" />}

        {/* Flat baseline line at the bottom */}
        <line
          x1={0}
          y1={baselineY}
          x2={containerWidth}
          y2={baselineY}
          stroke="#10b981"
          strokeWidth="1.5"
          strokeOpacity="0.85"
        />

        {/* Main continuous neon green telemetry spike waveform */}
        {strokePath && (
          <path
            d={strokePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#neonSpikeGlow)"
          />
        )}

        {/* Interactive Hover crosshair and indicator */}
        {hoverData && (
          <g pointerEvents="none">
            {/* Vertical crosshair guide */}
            <line
              x1={hoverData.x}
              y1={padTop}
              x2={hoverData.x}
              y2={baselineY}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            {/* Glowing target point on the curve */}
            <circle
              cx={hoverData.x}
              cy={hoverData.y}
              r="4.5"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2"
              filter="url(#neonSpikeGlow)"
            />
          </g>
        )}
      </svg>

      {/* Interactive Tooltip Card */}
      {hoverData && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(hoverData.x, 110), containerWidth - 110)}px`,
            top: `${Math.max(hoverData.y - 68, 12)}px`,
            transform: 'translateX(-50%)',
            background: 'rgba(8, 12, 10, 0.95)',
            border: '1px solid #10b981',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.8), 0 0 12px rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            padding: '6px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-dim)',
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: '2px',
            }}
          >
            {hoverData.timeLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.82rem',
                fontWeight: 700,
                color: hoverData.count > 0 ? '#10b981' : 'var(--text-muted)',
              }}
            >
              {hoverData.count > 0 ? `${hoverData.count} TELEMETRY BURST` : 'BASELINE (0 EVENTS)'}
            </span>
          </div>
          {Object.keys(hoverData.severities).length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
              {Object.entries(hoverData.severities).map(([sev, cnt]) => (
                <span
                  key={sev}
                  style={{
                    fontSize: '0.62rem',
                    textTransform: 'uppercase',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: sev === 'critical' ? '#f87171' : sev === 'high' ? '#fb923c' : '#34d399',
                  }}
                >
                  {sev}: {cnt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Temporal axis tick markers along bottom */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 16px 4px 16px',
          background: 'transparent',
          borderTop: 'none',
        }}
      >
        {timeLabels.map((t, idx) => (
          <span
            key={idx}
            style={{
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: idx === timeLabels.length - 1 ? '#10b981' : 'var(--text-dim)',
              fontWeight: idx === timeLabels.length - 1 ? 700 : 500,
            }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
};
