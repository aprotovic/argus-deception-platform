import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Shield, AlertTriangle, TrendingUp, RefreshCw, Download } from 'lucide-react';

interface GeoEntry {
  ip: string;
  country: string;
  country_code: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
  event_count: number;
  top_event_type: string;
  max_severity: string;
}

interface ThreatScore {
  ip: string;
  score: number;
  level: string;
  event_count: number;
  event_types: string[];
  first_seen: string;
  last_seen: string;
  country: string;
  country_code: string;
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

// Equirectangular projection — SVG viewBox 0 0 1000 500
function ll2xy(lat: number, lon: number): [number, number] {
  return [((lon + 180) / 360) * 1000, ((90 - lat) / 180) * 500];
}

function fmtDt(dt: string) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

const CONTINENTS = [
  // North America
  'M130,80 L220,75 L240,90 L230,110 L210,135 L200,162 L185,182 L168,202 L152,212 L138,242 L128,262 L118,242 L108,212 L98,192 L93,162 L98,132 L108,102 Z',
  // South America
  'M178,272 L208,262 L223,282 L228,312 L223,342 L213,372 L198,397 L183,412 L168,397 L158,372 L153,342 L156,312 L163,287 Z',
  // Europe
  'M438,68 L488,63 L508,73 L518,83 L508,98 L493,108 L473,113 L458,118 L443,113 L433,98 L430,83 Z',
  // Africa
  'M448,138 L488,133 L508,143 L523,163 L528,198 L523,238 L513,268 L498,293 L478,308 L458,303 L443,283 L433,258 L428,228 L430,198 L436,168 L440,148 Z',
  // Asia (simplified)
  'M508,58 L618,48 L698,53 L758,63 L798,73 L818,88 L808,108 L788,123 L758,133 L718,138 L678,143 L638,148 L598,143 L568,133 L543,118 L523,103 L510,88 Z',
  // Australia
  'M718,288 L778,278 L818,288 L838,308 L833,333 L813,348 L783,353 L753,343 L728,323 L713,303 Z',
];

export const ThreatMapView: React.FC = () => {
  const [geoData, setGeoData] = useState<GeoEntry[]>([]);
  const [threats, setThreats] = useState<ThreatScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIP, setHoveredIP] = useState<string | null>(null);
  const [section, setSection] = useState<'map' | 'scores'>('map');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, tRes] = await Promise.all([
        fetch('/api/v1/intel/geo-map', { credentials: 'include' }),
        fetch('/api/v1/intel/threat-scores', { credentials: 'include' }),
      ]);
      if (gRes.ok) setGeoData(await gRes.json());
      if (tRes.ok) setThreats(await tRes.json());
    } catch (e) {
      console.error('Intel fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadPDF = async (ip: string) => {
    try {
      const res = await fetch(`/api/v1/export/incident-report/${encodeURIComponent(ip)}`, { credentials: 'include' });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `argus_incident_${ip.replace(/\./g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('PDF download failed:', e); }
  };

  const validGeo = geoData.filter(g => g.lat !== 0 || g.lon !== 0);
  const hoveredEntry = geoData.find(g => g.ip === hoveredIP);

  const card = (label: string, value: number | string, color: string, icon: React.ReactNode) => (
    <div style={{
      background: 'rgba(13,18,30,0.85)',
      border: `1px solid ${color}44`,
      borderRadius: '8px', padding: '16px',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color, fontFamily: "'Chakra Petch',sans-serif" }}>{value}</div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.06em', marginTop: '2px' }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Globe size={28} color="#10b981" />
          <div>
            <div style={{ fontSize: '1.35rem', fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
              THREAT INTELLIGENCE
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              GeoIP Attack Map · Attacker Threat Scoring · MITRE ATT&CK · PDF Reports
            </div>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '6px', color: '#10b981', padding: '8px 16px',
          cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
          fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.04em',
        }}>
          <RefreshCw size={14} />
          {loading ? 'LOADING...' : 'REFRESH'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {card('TRACKED IPs', geoData.length, '#10b981', <Globe size={18}/>)}
        {card('CRITICAL THREATS', threats.filter(t => t.level === 'critical').length, '#ef4444', <AlertTriangle size={18}/>)}
        {card('HIGH THREATS', threats.filter(t => t.level === 'high').length, '#f97316', <Shield size={18}/>)}
        {card('COUNTRIES', new Set(geoData.map(g => g.country_code).filter(c => c && c !== 'XX')).size, '#3b82f6', <TrendingUp size={18}/>)}
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['map','scores'] as const).map(s => (
          <button key={s} onClick={() => setSection(s)} style={{
            padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
            fontFamily: "'Chakra Petch',sans-serif", fontSize: '0.8rem', fontWeight: 600,
            border: section === s ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--border-subtle)',
            background: section === s ? 'rgba(16,185,129,0.12)' : 'transparent',
            color: section === s ? '#10b981' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            {s === 'map' ? '🌍  ATTACK MAP' : '📊  THREAT SCORES'}
          </button>
        ))}
      </div>

      {/* ── Attack Map ── */}
      {section === 'map' && (
        <div style={{ background: 'rgba(4,6,15,0.95)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '12px', fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.05em' }}>
            GLOBAL THREAT ORIGIN MAP — {validGeo.length} active source{validGeo.length !== 1 ? 's' : ''} · hover dots for details
          </div>

          <div style={{ position: 'relative', background: '#020814', borderRadius: '8px', overflow: 'hidden' }}>
            <svg viewBox="0 0 1000 500" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <rect width="1000" height="500" fill="#020814" />
              {/* Grid */}
              {[-60,-30,0,30,60].map(lat => {
                const y = ((90-lat)/180)*500;
                return <line key={`lat${lat}`} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(16,185,129,0.05)" strokeWidth="0.5"/>;
              })}
              {[-120,-60,0,60,120].map(lon => {
                const x = ((lon+180)/360)*1000;
                return <line key={`lon${lon}`} x1={x} y1="0" x2={x} y2="500" stroke="rgba(16,185,129,0.05)" strokeWidth="0.5"/>;
              })}
              {/* Continents */}
              {CONTINENTS.map((d, i) => (
                <path key={i} d={d} fill="#0d2137" stroke="rgba(16,185,129,0.15)" strokeWidth="0.5"/>
              ))}
              {/* Attack dots */}
              {validGeo.map(g => {
                const [x, y] = ll2xy(g.lat, g.lon);
                const col = SEV_COLOR[g.max_severity] || '#22c55e';
                const r = Math.min(3 + Math.log2(g.event_count + 1) * 2, 14);
                const hov = hoveredIP === g.ip;
                return (
                  <g key={g.ip}>
                    <circle cx={x} cy={y} r={r+8} fill="none" stroke={col} strokeWidth="0.5" opacity={hov ? 0.5 : 0.15}/>
                    <circle cx={x} cy={y} r={r+4} fill="none" stroke={col} strokeWidth="0.5" opacity={hov ? 0.3 : 0.08}/>
                    <circle
                      cx={x} cy={y} r={hov ? r+2 : r}
                      fill={col} opacity={0.85}
                      style={{ cursor: 'pointer', filter: hov ? `drop-shadow(0 0 6px ${col})` : 'none', transition: 'all 0.15s' }}
                      onMouseEnter={() => setHoveredIP(g.ip)}
                      onMouseLeave={() => setHoveredIP(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip */}
            {hoveredEntry && (
              <div style={{
                position: 'absolute', top: 12, right: 12, pointerEvents: 'none',
                background: 'rgba(4,6,15,0.97)', border: `1px solid ${SEV_COLOR[hoveredEntry.max_severity]}`,
                borderRadius: '8px', padding: '12px 16px', minWidth: '210px',
              }}>
                <div style={{ fontFamily: "'Chakra Petch',sans-serif", fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 700 }}>{hoveredEntry.ip}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  📍 {hoveredEntry.city ? `${hoveredEntry.city}, ` : ''}{hoveredEntry.country || 'Unknown'}
                </div>
                {hoveredEntry.isp && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>🏢 {hoveredEntry.isp}</div>}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: SEV_COLOR[hoveredEntry.max_severity], fontWeight: 700 }}>
                    {hoveredEntry.max_severity.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{hoveredEntry.event_count} events</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{hoveredEntry.top_event_type.replace(/_/g,' ')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(SEV_COLOR).map(([sev, col]) => (
              <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col }}/>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{sev}</span>
              </div>
            ))}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>• Dot size ∝ event count</span>
          </div>
        </div>
      )}

      {/* ── Threat Scores Table ── */}
      {section === 'scores' && (
        <div style={{ background: 'rgba(13,18,30,0.85)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Chakra Petch',sans-serif", fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              ATTACKER THREAT SCORES — Last 7 Days
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{threats.length} tracked actor{threats.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                  {['IP Address','Country','Score','Level','Events','Event Types','First Seen','Last Seen','PDF'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: '0.67rem',
                      color: 'var(--text-dim)', letterSpacing: '0.06em', fontWeight: 600,
                      whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {threats.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    No threat data yet — trigger some decoy interactions to populate this table
                  </td></tr>
                ) : threats.map((t, i) => {
                  const col = SEV_COLOR[t.level] || '#22c55e';
                  return (
                    <tr key={t.ip} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.ip}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t.country || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: `${Math.min(t.score * 2, 80)}px`, height: '5px', borderRadius: '3px', background: col }}/>
                          <span style={{ color: col, fontWeight: 700 }}>{t.score}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ color: col, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.05em' }}>{t.level.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{t.event_count}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.74rem', maxWidth: '180px' }}>
                        {t.event_types.slice(0,3).map(e => e.replace(/_/g,' ')).join(', ')}
                        {t.event_types.length > 3 ? ` +${t.event_types.length-3}` : ''}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtDt(t.first_seen)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtDt(t.last_seen)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => downloadPDF(t.ip)} title={`Download PDF report for ${t.ip}`} style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                          borderRadius: '4px', color: '#60a5fa', padding: '5px 9px',
                          cursor: 'pointer', fontSize: '0.72rem', whiteSpace: 'nowrap',
                        }}>
                          <Download size={11}/> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
