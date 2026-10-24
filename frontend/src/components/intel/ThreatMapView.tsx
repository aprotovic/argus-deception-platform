import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, Shield, AlertTriangle, TrendingUp, RefreshCw, Download, Zap, Radio, AlertCircle, Maximize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

function fmtDt(dt: string) {
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

export const ThreatMapView: React.FC = () => {
  const [geoData, setGeoData] = useState<GeoEntry[]>([]);
  const [threats, setThreats] = useState<ThreatScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [section, setSection] = useState<'map' | 'scores'>('map');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize Real Leaflet Map with CartoDB Dark Matter tiles
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20, 10],
        zoom: 2.2,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false,
      });

      // Esri World Dark Gray Canvas — Geopolitical SOC Base Map
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        minZoom: 2,
        maxZoom: 10,
        attribution: 'Esri, DeLorme, NAVTEQ',
      }).addTo(map);

      // Borders and country labels overlay
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        minZoom: 2,
        maxZoom: 10,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync threat markers whenever geoData changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    // Disperse overlapping points (e.g. laptop & phone on same local network) so each has its own distinct dot & tag
    const coordCounts: Record<string, number> = {};
    const validGeo = (geoData || [])
      .filter(g => g.lat !== 0 || g.lon !== 0)
      .map(g => {
        const key = `${g.lat.toFixed(2)},${g.lon.toFixed(2)}`;
        const idx = coordCounts[key] || 0;
        coordCounts[key] = idx + 1;
        if (idx > 0) {
          const angle = (idx * 2 * Math.PI) / 4;
          return {
            ...g,
            lat: g.lat + Math.sin(angle) * 0.04,
            lon: g.lon + Math.cos(angle) * 0.04,
          };
        }
        return g;
      });

    validGeo.forEach((g) => {
      const col = SEV_COLOR[g.max_severity] || '#22c55e';
      const r = Math.min(8 + Math.log2(g.event_count + 1) * 3, 24);

      // Custom pulsing HTML radar marker
      const customIcon = L.divIcon({
        className: 'argus-radar-marker',
        html: `
          <div style="position:relative; width:${r*2}px; height:${r*2}px; cursor:pointer;">
            <div style="position:absolute; inset:-8px; border-radius:50%; border:1px solid ${col}; opacity:0.4; animation:argus-ping 2s infinite ease-out;"></div>
            <div style="position:absolute; inset:0; border-radius:50%; background:${col}; opacity:0.85; box-shadow:0 0 14px ${col}; border:1.5px solid #ffffff;"></div>
            <div style="position:absolute; inset:35%; border-radius:50%; background:#ffffff;"></div>
          </div>
        `,
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
      });

      const marker = L.marker([g.lat, g.lon], { icon: customIcon });

      // Permanent City & IP callout tag visible at all zoom levels
      const cityName = g.city || g.country || 'Target Area';
      marker.bindTooltip(
        `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${col}; box-shadow:0 0 6px ${col};"></span>
          <span style="color:#ffffff; font-weight:700;">${cityName}</span>
          <span style="color:#94a3b8; font-family:monospace; font-size:0.68rem;">(${g.ip})</span>
        </div>
        `,
        {
          permanent: true,
          direction: 'top',
          offset: [0, -r - 4],
          className: 'argus-permanent-tag',
        }
      );

      const popupHtml = `
        <div style="font-family:'Chakra Petch',sans-serif; background:#070d19; color:#e2e8f0; padding:12px 14px; border-radius:8px; border:1px solid ${col}; min-width:220px; box-shadow:0 0 16px rgba(0,0,0,0.8);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.95rem; font-family:monospace; color:#ffffff; font-weight:700;">${g.ip}</span>
            <span style="font-size:0.65rem; background:${col}25; color:${col}; padding:2px 6px; border-radius:4px; font-weight:700;">${g.max_severity.toUpperCase()}</span>
          </div>
          <div style="font-size:0.75rem; color:#94a3b8; margin:3px 0;">📍 ${g.city ? g.city + ', ' : ''}${g.country} (${g.country_code})</div>
          <div style="font-size:0.7rem; color:#64748b;">🏢 ${g.isp || 'Host'}</div>
          <div style="margin-top:10px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.72rem; display:flex; justify-content:space-between;">
            <span>Volume: <b style="color:#fff;">${g.event_count} events</b></span>
            <span>Vector: <b style="color:#fff;">${g.top_event_type.replace(/_/g,' ')}</b></span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'argus-dark-popup',
        closeButton: false,
      });

      marker.on('click', () => {
        setSelectedIP(g.ip);
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // Invalidate size in case tab just became visible
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
  }, [geoData]);

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

  const focusThreatOnMap = (t: ThreatScore) => {
    const geo = geoData.find(g => g.ip === t.ip);
    if (geo && geo.lat !== 0 && geo.lon !== 0 && mapInstanceRef.current) {
      setSection('map');
      setSelectedIP(t.ip);
      mapInstanceRef.current.flyTo([geo.lat, geo.lon], 5, { duration: 1.2 });
    }
  };

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
      <style>{`
        @keyframes argus-ping {
          0% { transform: scale(0.9); opacity: 0.8; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-container {
          background: #020712 !important;
          font-family: 'Chakra Petch', sans-serif !important;
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-tip {
          background: #070d19 !important;
        }
        .leaflet-control-zoom a {
          background: rgba(13, 18, 30, 0.9) !important;
          color: #10b981 !important;
          border-color: rgba(16, 185, 129, 0.3) !important;
        }
        .argus-permanent-tag {
          background: rgba(4, 8, 18, 0.95) !important;
          border: 1px solid rgba(16, 185, 129, 0.45) !important;
          color: #e2e8f0 !important;
          font-family: 'Chakra Petch', sans-serif !important;
          font-size: 0.72rem !important;
          padding: 3px 8px !important;
          border-radius: 4px !important;
          box-shadow: 0 0 12px rgba(0,0,0,0.85) !important;
          white-space: nowrap !important;
        }
        .argus-permanent-tag::before {
          border-top-color: rgba(16, 185, 129, 0.45) !important;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Globe size={28} color="#10b981" />
          <div>
            <div style={{ fontSize: '1.35rem', fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
              REAL-TIME GEOGRAPHIC THREAT INTELLIGENCE
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              CartoDB Satellite Dark Mesh &bull; Attacker Profiling &bull; MITRE ATT&amp;CK Framework &bull; Telegram Alerts
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
            {s === 'map' ? '🌍  INTERACTIVE GLOBAL MAP' : '📊  THREAT SCORING MATRIX'}
          </button>
        ))}
      </div>

      {/* ── Real Interactive Leaflet Attack Map ── */}
      <div style={{ display: section === 'map' ? 'block' : 'none' }}>
        <div style={{ background: 'rgba(4,6,15,0.95)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.05em' }}>
              GLOBAL THREAT ORIGIN RADAR &bull; {geoData.length} ACTIVE THREAT ORIGIN{geoData.length !== 1 ? 'S' : ''} MAPPED
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedIP(null);
                  mapInstanceRef.current?.flyTo([20, 10], 2.2, { duration: 1.2 });
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '4px',
                  color: '#10b981',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                🌐 RESET WORLD VIEW
              </button>
              <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                ACTIVE TILES
              </div>
            </div>
          </div>

          <div
            ref={mapContainerRef}
            style={{
              height: '540px',
              width: '100%',
              borderRadius: '8px',
              border: '1px solid rgba(16,185,129,0.2)',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)',
            }}
          />

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
            <div style={{ fontSize: '0.72rem', color: selectedIP ? '#10b981' : 'var(--text-dim)', fontStyle: 'italic' }}>
              {selectedIP ? `Target Inspected: ${selectedIP}` : 'Click any marker to inspect attacker forensics or zoom in'}
            </div>
          </div>

          {/* Quick Hostile Locator Pills */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Identified Threat Origin Nodes ({geoData.length}):
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
              {geoData.map((g) => {
                const col = SEV_COLOR[g.max_severity] || '#22c55e';
                const isSelected = selectedIP === g.ip;
                return (
                  <button
                    key={g.ip}
                    type="button"
                    onClick={() => {
                      setSelectedIP(g.ip);
                      mapInstanceRef.current?.flyTo([g.lat, g.lon], 5, { duration: 1.2 });
                    }}
                    style={{
                      background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'rgba(13, 18, 30, 0.85)',
                      border: `1px solid ${isSelected ? col : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}` }} />
                    <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#ffffff', fontWeight: 600 }}>{g.ip}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>📍 {g.city || g.country}</span>
                    <span style={{ fontSize: '0.65rem', background: `${col}22`, color: col, padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      {g.event_count} ev
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Threat Scores Matrix Table ── */}
      <div style={{ display: section === 'scores' ? 'block' : 'none' }}>
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
                  {['Hostile IP','Origin','Score','Risk Level','Events','Observed Vectors','First Seen','Last Activity','Locate','Forensics PDF'].map(h => (
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
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)' }}>
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
                        <button onClick={() => focusThreatOnMap(t)} title="Locate and zoom on map" style={{
                          display: 'flex', alignItems: 'center', gap: '5px',
                          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '4px', color: '#10b981', padding: '6px 10px',
                          cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                        }}>
                          <Maximize2 size={12}/> MAP
                        </button>
                      </td>
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
      </div>
    </div>
  );
};
