import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Shield, AlertTriangle, TrendingUp, RefreshCw, Download, Zap, Radio, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

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

// Equirectangular projection mapping to SVG viewBox 0 0 1000 500
function ll2xy(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [Math.max(12, Math.min(988, x)), Math.max(12, Math.min(488, y))];
}

function fmtDt(dt: string) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

export const ThreatMapView: React.FC = () => {
  const [geoData, setGeoData] = useState<GeoEntry[]>([]);
  const [threats, setThreats] = useState<ThreatScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [hoveredIP, setHoveredIP] = useState<string | null>(null);
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [section, setSection] = useState<'map' | 'scores'>('map');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [gData, tData] = await Promise.all([
        api.getGeoMap(),
        api.getThreatScores(),
      ]);
      setGeoData(gData || []);
      setThreats(tData || []);
    } catch (e: any) {
      console.error('Intel fetch failed:', e);
      setErrorMsg(e?.message || 'Failed to fetch threat intelligence data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSimulateGlobal = async () => {
    setSimulating(true);
    setErrorMsg(null);
    try {
      await api.simulateGlobalThreats();
      setToastMsg('Simulated 5 international threat actors across US, Europe, Asia & Africa');
      await fetchData();
      setTimeout(() => setToastMsg(null), 4500);
    } catch (e: any) {
      console.error('Simulation error:', e);
      setErrorMsg(e?.message || 'Threat simulation request failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleDownloadPDF = async (ip: string) => {
    try {
      await api.downloadIncidentReport(ip);
    } catch (e: any) {
      console.error('PDF download failed:', e);
      setErrorMsg(`Failed to download incident report for ${ip}: ${e?.message}`);
    }
  };

  const validGeo = geoData.filter(g => g.lat !== 0 || g.lon !== 0);
  const hoveredEntry = geoData.find(g => g.ip === hoveredIP) || geoData.find(g => g.ip === selectedIP);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Globe size={28} color="#10b981" />
          <div>
            <div style={{ fontSize: '1.35rem', fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
              THREAT INTELLIGENCE &amp; ATTACK ORIGIN MAP
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Real-time Geolocation · Threat Scoring · MITRE ATT&amp;CK · Telegram Alert Sync
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleSimulateGlobal}
            disabled={simulating}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.08) 100%)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '6px', color: '#f87171', padding: '8px 16px',
              cursor: simulating ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
              fontFamily: "'Chakra Petch',sans-serif", fontWeight: 600, letterSpacing: '0.04em',
            }}
          >
            <Zap size={14} />
            {simulating ? 'INJECTING THREATS...' : 'INJECT DEMO THREATS'}
          </button>

          <button onClick={fetchData} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '6px', color: '#10b981', padding: '8px 16px',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.04em',
          }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'REFRESHING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
          borderRadius: '8px', padding: '12px 18px', color: '#f87171',
          marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div style={{
          background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981',
          borderRadius: '8px', padding: '12px 18px', color: '#10b981',
          marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <Radio size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {card('TOTAL TRACKED IPS', geoData.length, '#10b981', <Globe size={18}/>)}
        {card('CRITICAL THREATS', threats.filter(t => t.level === 'critical').length, '#ef4444', <AlertTriangle size={18}/>)}
        {card('HIGH THREATS', threats.filter(t => t.level === 'high').length, '#f97316', <Shield size={18}/>)}
        {card('ACTIVE COUNTRIES', new Set(geoData.map(g => g.country_code).filter(c => c && c !== 'XX')).size, '#3b82f6', <TrendingUp size={18}/>)}
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
            {s === 'map' ? '🌍  GEOGRAPHIC ATTACK MAP' : '📊  THREAT SCORING MATRIX'}
          </button>
        ))}
      </div>

      {/* ── Attack Map ── */}
      {section === 'map' && (
        <div style={{ background: 'rgba(4,6,15,0.95)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.05em' }}>
              GLOBAL THREAT ORIGIN RADAR &bull; {validGeo.length} ACTIVE THREAT SOURCE{validGeo.length !== 1 ? 'S' : ''} DETECTED
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              LIVE TELEMETRY ACTIVE
            </div>
          </div>

          <div style={{ position: 'relative', background: '#020712', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.15)' }}>
            <svg viewBox="0 0 1000 500" style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* Deep ocean background */}
              <rect width="1000" height="500" fill="#030914" />

              {/* Coordinate Grid lines */}
              {[-60,-30,0,30,60].map(lat => {
                const y = ((90-lat)/180)*500;
                return (
                  <g key={`lat${lat}`}>
                    <line x1="0" y1={y} x2="1000" y2={y} stroke="rgba(16,185,129,0.08)" strokeDasharray="3 3" strokeWidth="0.6"/>
                    <text x="8" y={y - 3} fill="rgba(16,185,129,0.3)" fontSize="8" fontFamily="monospace">{lat}&deg;</text>
                  </g>
                );
              })}
              {[-120,-60,0,60,120].map(lon => {
                const x = ((lon+180)/360)*1000;
                return (
                  <g key={`lon${lon}`}>
                    <line x1={x} y1="0" x2={x} y2="500" stroke="rgba(16,185,129,0.08)" strokeDasharray="3 3" strokeWidth="0.6"/>
                    <text x={x + 3} y="495" fill="rgba(16,185,129,0.3)" fontSize="8" fontFamily="monospace">{lon}&deg;</text>
                  </g>
                );
              })}

              {/* Equator & Prime Meridian highlight */}
              <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(16,185,129,0.18)" strokeWidth="0.8"/>
              <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(16,185,129,0.18)" strokeWidth="0.8"/>

              {/* Refined World Continents (Equirectangular) */}
              <g fill="#0b1b2d" stroke="rgba(16,185,129,0.22)" strokeWidth="0.8">
                {/* North America */}
                <path d="M 120,40 L 210,35 L 260,65 L 290,110 L 270,140 L 250,145 L 240,175 L 210,185 L 195,210 L 165,225 L 150,250 L 140,265 L 125,245 L 115,220 L 105,190 L 95,160 L 85,125 L 90,90 L 105,60 Z" />
                {/* Central America & Caribbean */}
                <path d="M 150,250 L 175,260 L 190,280 L 180,295 L 165,285 L 140,265 Z" />
                {/* South America */}
                <path d="M 190,285 L 225,275 L 255,295 L 265,330 L 255,365 L 240,405 L 220,440 L 205,455 L 195,435 L 180,395 L 170,360 L 165,325 L 175,295 Z" />
                {/* Greenland */}
                <path d="M 295,30 L 350,25 L 365,55 L 330,80 L 300,75 Z" />
                {/* Europe */}
                <path d="M 435,70 L 480,60 L 515,68 L 525,95 L 510,120 L 485,130 L 460,135 L 440,125 L 430,105 L 425,85 Z" />
                {/* British Isles */}
                <path d="M 415,75 L 430,70 L 435,90 L 420,95 Z" />
                {/* Africa */}
                <path d="M 435,145 L 480,140 L 520,155 L 550,180 L 560,225 L 545,285 L 525,335 L 500,375 L 475,370 L 445,335 L 430,290 L 415,240 L 418,190 L 425,165 Z" />
                {/* Madagascar */}
                <path d="M 565,315 L 575,310 L 580,345 L 570,355 Z" />
                {/* Asia / Eurasia */}
                <path d="M 525,60 L 610,50 L 700,55 L 780,65 L 850,75 L 890,100 L 860,130 L 830,145 L 800,160 L 760,165 L 725,185 L 690,210 L 650,230 L 620,220 L 590,195 L 565,165 L 540,135 L 525,95 Z" />
                {/* India */}
                <path d="M 645,190 L 675,195 L 685,235 L 665,270 L 650,245 Z" />
                {/* Japan */}
                <path d="M 865,120 L 880,115 L 885,145 L 870,160 Z" />
                {/* Southeast Asia / Indonesia */}
                <path d="M 720,235 L 755,230 L 780,260 L 760,285 L 725,270 Z" />
                <path d="M 770,290 L 820,285 L 835,305 L 790,310 Z" />
                {/* Australia */}
                <path d="M 740,310 L 810,300 L 850,315 L 865,345 L 855,385 L 830,410 L 790,415 L 760,395 L 740,360 L 730,330 Z" />
                {/* New Zealand */}
                <path d="M 890,395 L 905,390 L 910,425 L 895,430 Z" />
              </g>

              {/* Attack Origin Markers */}
              {validGeo.map(g => {
                const [x, y] = ll2xy(g.lat, g.lon);
                const col = SEV_COLOR[g.max_severity] || '#22c55e';
                const baseR = Math.min(5 + Math.log2(g.event_count + 1) * 2.5, 18);
                const isHov = hoveredIP === g.ip || selectedIP === g.ip;
                const r = isHov ? baseR + 4 : baseR;

                return (
                  <g key={g.ip} style={{ cursor: 'pointer' }}
                     onClick={() => setSelectedIP(selectedIP === g.ip ? null : g.ip)}
                     onMouseEnter={() => setHoveredIP(g.ip)}
                     onMouseLeave={() => setHoveredIP(null)}>
                    {/* Concentric radar wave rings */}
                    <circle cx={x} cy={y} r={r + 14} fill="none" stroke={col} strokeWidth="0.6" opacity={isHov ? 0.7 : 0.2}>
                      <animate attributeName="r" values={`${r+4};${r+20};${r+4}`} dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0.05;0.5" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={x} cy={y} r={r + 6} fill="none" stroke={col} strokeWidth="0.9" opacity={isHov ? 0.8 : 0.3} />

                    {/* Target crosshair for hovered/selected dot */}
                    {isHov && (
                      <g stroke={col} strokeWidth="0.8" opacity="0.9">
                        <line x1={x - r - 8} y1={y} x2={x - r - 2} y2={y} />
                        <line x1={x + r + 2} y1={y} x2={x + r + 8} y2={y} />
                        <line x1={x} y1={y - r - 8} x2={x} y2={y - r - 2} />
                        <line x1={x} y1={y + r + 2} x2={x} y2={y + r + 8} />
                      </g>
                    )}

                    {/* Main pulsing attack core */}
                    <circle
                      cx={x} cy={y} r={r}
                      fill={col}
                      opacity={0.9}
                      style={{ filter: `drop-shadow(0 0 ${isHov ? 12 : 6}px ${col})`, transition: 'all 0.2s' }}
                    />

                    {/* Inner high-energy centroid */}
                    <circle cx={x} cy={y} r={Math.max(2, r * 0.35)} fill="#ffffff" opacity="0.95" />

                    {/* Country callout pill */}
                    <text
                      x={x} y={y - r - 6}
                      fill="#e2e8f0"
                      fontSize="9.5"
                      fontFamily="'Chakra Petch',sans-serif"
                      fontWeight="700"
                      textAnchor="middle"
                      style={{ textShadow: '0 1px 4px #000, 0 0 6px #000', pointerEvents: 'none' }}
                    >
                      {g.country_code ? `${g.country_code} • ${g.event_count}` : g.ip}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tactical Inspector HUD Tooltip */}
            {hoveredEntry && (
              <div style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(6,10,22,0.96)',
                border: `1px solid ${SEV_COLOR[hoveredEntry.max_severity]}`,
                boxShadow: `0 0 20px rgba(0,0,0,0.8), 0 0 10px ${SEV_COLOR[hoveredEntry.max_severity]}33`,
                borderRadius: '8px', padding: '14px 18px', minWidth: '240px', pointerEvents: 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: '#ffffff', fontWeight: 700 }}>
                    {hoveredEntry.ip}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
                    color: SEV_COLOR[hoveredEntry.max_severity],
                    background: `${SEV_COLOR[hoveredEntry.max_severity]}22`,
                    padding: '2px 6px', borderRadius: '4px',
                  }}>
                    {hoveredEntry.max_severity.toUpperCase()}
                  </span>
                </div>

                <div style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '4px 0' }}>
                  📍 {hoveredEntry.city ? `${hoveredEntry.city}, ` : ''}{hoveredEntry.country} ({hoveredEntry.country_code})
                </div>
                {hoveredEntry.isp && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    🏢 {hoveredEntry.isp}
                  </div>
                )}

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>VOLUME</div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{hoveredEntry.event_count} events</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>PRIMARY VECTOR</div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>{hoveredEntry.top_event_type.replace(/_/g,' ')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
              {Object.entries(SEV_COLOR).map(([sev, col]) => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}` }}/>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sev}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              Dot radius scales dynamically with attack intensity
            </div>
          </div>
        </div>
      )}

      {/* ── Threat Scores Matrix Table ── */}
      {section === 'scores' && (
        <div style={{ background: 'rgba(13,18,30,0.85)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Chakra Petch',sans-serif", fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              ATTACKER RISK SCORING MATRIX &bull; LAST 7 DAYS
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{threats.length} Tracked Hostiles</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                  {['Hostile IP','Origin','Score','Risk Level','Events','Observed Vectors','First Seen','Last Activity','Forensics PDF'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: '0.68rem',
                      color: 'var(--text-dim)', letterSpacing: '0.06em', fontWeight: 600,
                      whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {threats.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No hostile telemetry detected yet. Click "INJECT DEMO THREATS" above or interact with the decoy.
                  </td></tr>
                ) : threats.map((t, i) => {
                  const col = SEV_COLOR[t.level] || '#22c55e';
                  return (
                    <tr key={t.ip} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {t.ip}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {t.country || 'Host Local'} {t.country_code ? `(${t.country_code})` : ''}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: `${Math.min(t.score * 1.5, 90)}px`, height: '6px', borderRadius: '3px', background: col, boxShadow: `0 0 6px ${col}66` }}/>
                          <span style={{ color: col, fontWeight: 700 }}>{t.score}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          color: col, fontWeight: 700, fontSize: '0.7rem',
                          background: `${col}18`, border: `1px solid ${col}44`,
                          padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.05em'
                        }}>
                          {t.level.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#e2e8f0', fontWeight: 600 }}>{t.event_count}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.74rem', maxWidth: '200px' }}>
                        {t.event_types.slice(0,3).map(e => e.replace(/_/g,' ')).join(', ')}
                        {t.event_types.length > 3 ? ` +${t.event_types.length-3}` : ''}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtDt(t.first_seen)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{fmtDt(t.last_seen)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => handleDownloadPDF(t.ip)} title={`Download forensic report for ${t.ip}`} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                          borderRadius: '4px', color: '#60a5fa', padding: '6px 10px',
                          cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          <Download size={12}/> REPORT
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
