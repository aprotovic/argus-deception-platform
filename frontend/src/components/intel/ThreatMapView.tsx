import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  Shield,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Download,
  Zap,
  Radio,
  AlertCircle,
  Maximize2,
  Minimize2,
  Filter,
  Crosshair,
  Copy,
  Check,
  X,
} from 'lucide-react';
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

// Target ARGUS Defense Honeypot Station coordinates (HQ Enclave)
const ENCLAVE_COORDS: [number, number] = [9.0245, 38.7485];

// MITRE ATT&CK Mapping Encyclopedia for Analysts
const MITRE_LOOKUP: Record<string, { id: string; name: string; tactic: string; desc: string }> = {
  sql_injection: {
    id: 'T1190',
    name: 'Exploit Public-Facing Application',
    tactic: 'Initial Access',
    desc: 'Adversary submitted malicious SQL injection payload to bypass application authentication boundary.',
  },
  login_attempt: {
    id: 'T1110',
    name: 'Brute Force / Password Spraying',
    tactic: 'Credential Access',
    desc: 'Automated adversary botnet cycling credential pairs against simulated contractor authentication portal.',
  },
  file_upload: {
    id: 'T1105',
    name: 'Ingress Tool Transfer',
    tactic: 'Command & Control',
    desc: 'Adversary attempted uploading weaponized web shell or backdoor payload into diagnostic endpoint.',
  },
  honeytoken_access: {
    id: 'T1083',
    name: 'File and Directory Discovery',
    tactic: 'Discovery',
    desc: 'Adversary tripped tripwire honeytoken breadcrumb embedded in leaked source code.',
  },
  contractor_credential_use: {
    id: 'T1078',
    name: 'Valid Accounts: Local Accounts',
    tactic: 'Defense Evasion',
    desc: 'Adversary utilized exposed contractor canary credentials trapped in decoy comments.',
  },
  terminal_exec: {
    id: 'T1059',
    name: 'Command and Scripting Interpreter',
    tactic: 'Execution',
    desc: 'Simulated tactical shell command execution captured in decoy sandbox environment.',
  },
  recon_probe: {
    id: 'T1595',
    name: 'Active Scanning: Vulnerability Scanning',
    tactic: 'Reconnaissance',
    desc: 'Automated reconnaissance crawler probing for sensitive paths (.env, wp-login, config dumps).',
  },
  db_query: {
    id: 'T1213',
    name: 'Data from Information Repositories',
    tactic: 'Collection',
    desc: 'Adversary issued raw SQL commands against simulated MySQL protocol decoy instance on port 3306.',
  },
};

// Interpolate curved Bezier trajectory arc between two geographic coordinates
function getArcPoints(start: [number, number], end: [number, number], numPoints = 28): [number, number][] {
  const [lat1, lon1] = start;
  const [lat2, lon2] = end;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const dist = Math.sqrt(dLat * dLat + dLon * dLon);

  if (dist < 0.2) return [];

  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;

  // Arc bend height perpendicular to trajectory
  const bend = Math.min(dist * 0.22, 24);
  const normalLat = -dLon / dist;
  const normalLon = dLat / dist;

  const ctrlLat = midLat + normalLat * bend;
  const ctrlLon = midLon + normalLon * bend;

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * ctrlLon + t * t * lon2;
    points.push([lat, lon]);
  }
  return points;
}

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
  const [copiedIOC, setCopiedIOC] = useState(false);

  // SOC Analyst Controls & Filters
  const [sevFilter, setSevFilter] = useState<'all' | 'critical' | 'high'>('all');
  const [vectorFilter, setVectorFilter] = useState<string>('all');
  const [showArcs, setShowArcs] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCrosshairs, setShowCrosshairs] = useState(true);
  const [focusedTarget, setFocusedTarget] = useState<{
    lat: number;
    lon: number;
    name: string;
    ip?: string;
    severity?: string;
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const arcsLayerRef = useRef<L.LayerGroup | null>(null);
  const crosshairOverlayRef = useRef<HTMLDivElement>(null);
  const filteredGeoRef = useRef<GeoEntry[]>([]);
  const updateCrosshairRef = useRef<() => void>(() => {});

  const updateCrosshair = useCallback(() => {
    const overlay = crosshairOverlayRef.current;
    const map = mapInstanceRef.current;
    if (!overlay || !map || !focusedTarget || !showCrosshairs) {
      if (overlay) overlay.style.display = 'none';
      return;
    }
    try {
      const pt = map.latLngToContainerPoint([focusedTarget.lat, focusedTarget.lon]);
      overlay.style.display = 'block';

      const hLine = overlay.querySelector<HTMLDivElement>('.crosshair-hline');
      if (hLine) hLine.style.top = `${pt.y}px`;

      const vLine = overlay.querySelector<HTMLDivElement>('.crosshair-vline');
      if (vLine) vLine.style.left = `${pt.x}px`;

      const box = overlay.querySelector<HTMLDivElement>('.crosshair-box');
      if (box) {
        box.style.left = `${pt.x}px`;
        box.style.top = `${pt.y}px`;
      }
    } catch {
      if (overlay) overlay.style.display = 'none';
    }
  }, [focusedTarget, showCrosshairs]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    updateCrosshair();
    map.on('move', updateCrosshair);
    map.on('zoom', updateCrosshair);
    map.on('resize', updateCrosshair);
    return () => {
      map.off('move', updateCrosshair);
      map.off('zoom', updateCrosshair);
      map.off('resize', updateCrosshair);
    };
  }, [updateCrosshair]);

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

  // Initialize Real Leaflet Map with Esri World Dark Gray Canvas
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [22, 18],
        zoom: 2.2,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        attributionControl: false,
      });

      // Esri World Dark Gray Canvas Base
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { minZoom: 2, maxZoom: 10, attribution: 'Esri, DeLorme, NAVTEQ' }
      ).addTo(map);

      // Borders and geopolitical reference labels overlay
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { minZoom: 2, maxZoom: 10 }
      ).addTo(map);

      // Dedicated layers for attack trajectory arcs and markers
      arcsLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);

      // Clicking on or near any hostile marker on the map selects it
      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickPt = e.containerPoint;
        let closest: GeoEntry | null = null;
        let minDist = 40; // 40px radius around click
        for (const g of filteredGeoRef.current) {
          try {
            const pt = map.latLngToContainerPoint([g.lat, g.lon]);
            const dist = Math.hypot(pt.x - clickPt.x, pt.y - clickPt.y);
            if (dist < minDist) {
              minDist = dist;
              closest = g;
            }
          } catch {}
        }
        if (closest !== null) {
          const target: GeoEntry = closest;
          setSelectedIP(target.ip);
          setFocusedTarget({
            lat: target.lat,
            lon: target.lon,
            name: target.city || target.country || 'Hostile Zone',
            ip: target.ip,
            severity: target.max_severity,
          });
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Filtered dataset based on analyst controls
  const filteredGeo = geoData.filter((g) => {
    if (sevFilter === 'critical' && g.max_severity !== 'critical') return false;
    if (sevFilter === 'high' && g.max_severity !== 'critical' && g.max_severity !== 'high') return false;
    if (vectorFilter !== 'all' && g.top_event_type !== vectorFilter) return false;
    return true;
  });

  filteredGeoRef.current = filteredGeo;
  updateCrosshairRef.current = updateCrosshair;

  // Auto-resize map when dossier panel opens or closes
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
      updateCrosshair();
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedIP, updateCrosshair]);

  // Render Markers, Trajectory Arcs, and Target Enclave Node
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !arcsLayerRef.current) return;
    markersLayerRef.current.clearLayers();
    arcsLayerRef.current.clearLayers();

    // 1. Draw Target ARGUS Defense Sensor Station
    const targetIcon = L.divIcon({
      className: 'argus-target-node',
      html: `
        <div style="position:relative; width:34px; height:34px; cursor:pointer;">
          <div style="position:absolute; inset:-8px; border-radius:50%; border:1.5px solid #10b981; animation:enclave-ping 2.5s infinite; opacity:0.6;"></div>
          <div style="position:absolute; inset:0; border-radius:50%; background:rgba(16,185,129,0.25); border:2px solid #10b981; box-shadow:0 0 20px #10b981; display:flex; align-items:center; justify-content:center;">
            <span style="font-size:14px;">🛡️</span>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const targetMarker = L.marker(ENCLAVE_COORDS, { icon: targetIcon, zIndexOffset: 1000 });
    targetMarker.bindTooltip(
      `<div style="font-weight:700; color:#10b981; font-family:'Chakra Petch',sans-serif; padding:2px 4px;">
        🛡️ ARGUS DEFENSE ENCLAVE (ADDIS ABABA)
        <div style="font-size:0.68rem; color:#6ee7b7; font-family:monospace; margin-top:2px;">
          📍 LAT: 9.0245° N &bull; LON: 38.7485° E
        </div>
      </div>`,
      { permanent: false, direction: 'bottom', offset: [0, 16], className: 'argus-enclave-tag' }
    );

    targetMarker.on('mouseover', () => {
      setFocusedTarget({
        lat: ENCLAVE_COORDS[0],
        lon: ENCLAVE_COORDS[1],
        name: 'Addis Ababa',
        severity: 'low',
      });
    });

    targetMarker.on('click', () => {
      setFocusedTarget({
        lat: ENCLAVE_COORDS[0],
        lon: ENCLAVE_COORDS[1],
        name: 'Addis Ababa',
        severity: 'low',
      });
    });

    markersLayerRef.current.addLayer(targetMarker);

    // 2. Disperse overlapping local/subnet points into an orbital constellation
    const coordCounts: Record<string, number> = {};
    const validGeo = filteredGeo
      .filter((g) => g.lat !== 0 || g.lon !== 0)
      .map((g) => {
        // Group points sharing approximate coordinates (~15-20km zone)
        const key = `${Math.round(g.lat * 4) / 4},${Math.round(g.lon * 4) / 4}`;
        const idx = coordCounts[key] || 0;
        coordCounts[key] = idx + 1;
        if (idx > 0) {
          const angle = (idx * 2 * Math.PI) / 5 + (idx * 0.45);
          const radius = 0.20 + (idx * 0.12);
          return {
            ...g,
            lat: g.lat + Math.sin(angle) * radius,
            lon: g.lon + Math.cos(angle) * radius,
          };
        }
        return g;
      });

    // Default crosshairs to first visible hostile threat vector (e.g. Dire Dawa)
    if (validGeo.length > 0) {
      setFocusedTarget((prev) => {
        if (!prev) {
          const first = validGeo[0];
          return {
            lat: first.lat,
            lon: first.lon,
            name: first.city || first.country || 'Target Vector',
            ip: first.ip,
            severity: first.max_severity,
          };
        }
        return prev;
      });
    }

    // 3. Render Hostile Markers & Attack Beams
    validGeo.forEach((g) => {
      const col = SEV_COLOR[g.max_severity] || '#22c55e';
      const r = Math.min(8 + Math.log2(g.event_count + 1) * 3, 24);

      // Curved Trajectory Arc from Attacker Origin -> ARGUS Enclave
      if (showArcs) {
        const arcPoints = getArcPoints([g.lat, g.lon], ENCLAVE_COORDS);
        if (arcPoints.length > 0) {
          // Glow background arc
          const glowArc = L.polyline(arcPoints, {
            color: col,
            weight: 3.5,
            opacity: 0.18,
          });
          arcsLayerRef.current?.addLayer(glowArc);

          // Flowing particle beam line
          const beamArc = L.polyline(arcPoints, {
            color: col,
            weight: 1.8,
            opacity: 0.85,
            dashArray: '8, 14',
            className: 'argus-attack-beam',
          });
          arcsLayerRef.current?.addLayer(beamArc);
        }
      }

      // Tactical Hostile Marker
      const customIcon = L.divIcon({
        className: 'argus-radar-marker',
        html: `
          <div style="position:relative; width:${r * 2}px; height:${r * 2}px; cursor:pointer;" title="${g.city || g.country} - Lat: ${g.lat.toFixed(4)}, Lon: ${g.lon.toFixed(4)}">
            <div style="position:absolute; inset:-8px; border-radius:50%; border:1px solid ${col}; opacity:0.4; animation:argus-ping 2s infinite ease-out;"></div>
            <div style="position:absolute; inset:0; border-radius:50%; background:${col}; opacity:0.85; box-shadow:0 0 14px ${col}; border:1.5px solid #ffffff;"></div>
            <div style="position:absolute; inset:35%; border-radius:50%; background:#ffffff;"></div>
          </div>
        `,
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
      });

      const marker = L.marker([g.lat, g.lon], { icon: customIcon });

      const cityName = g.city || g.country || 'Hostile Zone';
      const tooltipContent = `
        <div style="font-family:'Chakra Petch',sans-serif; min-width:145px; padding:2px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; gap:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${col}; box-shadow:0 0 8px ${col};"></span>
              <span style="color:#ffffff; font-weight:700; font-size:0.8rem;">${cityName}</span>
            </div>
            <span style="color:${col}; font-size:0.65rem; font-weight:700; text-transform:uppercase;">${g.max_severity}</span>
          </div>
          <div style="color:#94a3b8; font-family:monospace; font-size:0.72rem; margin-bottom:4px;">IP: ${g.ip}</div>
          <div style="font-size:0.68rem; color:#38bdf8; font-family:monospace; margin-bottom:4px; background:rgba(56,189,248,0.1); padding:2px 5px; border-radius:3px; border:1px solid rgba(56,189,248,0.2);">
            📍 LAT: ${g.lat.toFixed(4)} &bull; LON: ${g.lon.toFixed(4)}
          </div>
          <div style="font-size:0.68rem; color:#64748b; display:flex; justify-content:space-between; gap:10px;">
            <span>Hits: <strong style="color:#e2e8f0;">${g.event_count}</strong></span>
            <span>Vector: <strong style="color:#38bdf8;">${g.top_event_type}</strong></span>
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        permanent: showLabels,
        direction: 'top',
        offset: [0, -r - 4],
        className: 'argus-radar-tooltip',
      });

      marker.on('mouseover', () => {
        setFocusedTarget({
          lat: g.lat,
          lon: g.lon,
          name: cityName,
          ip: g.ip,
          severity: g.max_severity,
        });
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedIP(g.ip);
        setFocusedTarget({
          lat: g.lat,
          lon: g.lon,
          name: cityName,
          ip: g.ip,
          severity: g.max_severity,
        });
      });

      markersLayerRef.current?.addLayer(marker);
    });

    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
      updateCrosshairRef.current?.();
    }, 150);
  }, [filteredGeo, showArcs, showLabels]);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIOC(true);
    setTimeout(() => setCopiedIOC(false), 2000);
  };

  const focusThreatOnMap = (t: ThreatScore) => {
    const geo = geoData.find((g) => g.ip === t.ip);
    if (geo && geo.lat !== 0 && geo.lon !== 0 && mapInstanceRef.current) {
      setSection('map');
      setSelectedIP(t.ip);
      mapInstanceRef.current.flyTo([geo.lat, geo.lon], 5, { duration: 1.2 });
    }
  };

  // Currently inspected threat details for the Analyst Dossier side-panel
  const inspectedGeo = geoData.find((g) => g.ip === selectedIP) || filteredGeo.find((g) => g.ip === selectedIP);
  const inspectedThreat = threats.find((t) => t.ip === selectedIP);
  const inspectedMitre = inspectedGeo ? MITRE_LOOKUP[inspectedGeo.top_event_type] || MITRE_LOOKUP['recon_probe'] : null;

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      <style>{`
        @keyframes argus-ping {
          0% { transform: scale(0.9); opacity: 0.8; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes enclave-ping {
          0% { transform: scale(0.85); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.2; }
          100% { transform: scale(0.85); opacity: 0.9; }
        }
        @keyframes arc-flow {
          0% { stroke-dashoffset: 44; }
          100% { stroke-dashoffset: 0; }
        }
        .argus-attack-beam {
          animation: arc-flow 1.4s linear infinite;
        }
        .leaflet-container {
          background: #020712 !important;
          font-family: 'Chakra Petch', sans-serif !important;
        }
        .leaflet-control-zoom a {
          background: rgba(13, 18, 30, 0.9) !important;
          color: #10b981 !important;
          border-color: rgba(16, 185, 129, 0.3) !important;
        }
        .argus-radar-tooltip {
          background: rgba(4, 9, 20, 0.94) !important;
          border: 1px solid rgba(16, 185, 129, 0.45) !important;
          color: #e2e8f0 !important;
          font-family: 'Chakra Petch', sans-serif !important;
          padding: 6px 10px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.85) !important;
          backdrop-filter: blur(8px) !important;
        }
        .argus-radar-tooltip::before {
          border-top-color: rgba(16, 185, 129, 0.45) !important;
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
        .argus-enclave-tag {
          background: rgba(6, 18, 12, 0.95) !important;
          border: 1px solid #10b981 !important;
          padding: 4px 10px !important;
          border-radius: 4px !important;
          box-shadow: 0 0 16px rgba(16,185,129,0.3) !important;
        }
      `}</style>

      {/* ── Top Analyst Console Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crosshair size={24} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontFamily: "'Chakra Petch',sans-serif", fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.04em' }}>
              GLOBAL THREAT INTELLIGENCE &bull; RADAR CONSOLE
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>CTI Telemetry Stream</span> &bull;
              <span>MITRE ATT&amp;CK Mapping</span> &bull;
              <span>Automated Decoy Splunk/Telegram Ingress</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleSimulateGlobal}
            disabled={simulating}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.06) 100%)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '6px', color: '#f87171', padding: '8px 16px',
              cursor: simulating ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
              fontFamily: "'Chakra Petch',sans-serif", fontWeight: 600, letterSpacing: '0.04em',
            }}
          >
            <Zap size={14} />
            {simulating ? 'INJECTING THREATS...' : 'INJECT DEMO THREATS'}
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '6px', color: '#10b981', padding: '8px 16px',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
              fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.04em',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'SYNCING...' : 'SYNC RADAR'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
          borderRadius: '8px', padding: '12px 18px', color: '#f87171',
          marginBottom: '18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div style={{
          background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981',
          borderRadius: '8px', padding: '12px 18px', color: '#10b981',
          marginBottom: '18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <Radio size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── CTI Metrics Ribbon ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'TRACKED HOSTILE IPS', val: geoData.length, color: '#10b981', icon: <Globe size={18} /> },
          { label: 'CRITICAL INTRUSIONS', val: threats.filter(t => t.level === 'critical').length, color: '#ef4444', icon: <AlertTriangle size={18} /> },
          { label: 'HIGH RISK ADVERSARIES', val: threats.filter(t => t.level === 'high').length, color: '#f97316', icon: <Shield size={18} /> },
          { label: 'ACTIVE GEOLOCATIONS', val: new Set(geoData.map(g => g.country_code).filter(c => c && c !== 'XX')).size, color: '#38bdf8', icon: <TrendingUp size={18} /> },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: 'rgba(13,18,30,0.85)',
            border: `1px solid ${stat.color}35`,
            borderRadius: '8px', padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ color: stat.color }}>{stat.icon}</span>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: stat.color, fontFamily: "'Chakra Petch',sans-serif" }}>{stat.val}</div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Navigation & Operational HUD Toolbar ── */}
      <div style={{
        background: 'rgba(9, 14, 24, 0.9)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '10px 16px',
        marginBottom: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* View switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['map', 'scores'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                padding: '7px 18px', borderRadius: '5px', cursor: 'pointer',
                fontFamily: "'Chakra Petch',sans-serif", fontSize: '0.8rem', fontWeight: 600,
                border: section === s ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                background: section === s ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: section === s ? '#10b981' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              {s === 'map' ? '🌍  DEFENSE RADAR MAP' : '📊  THREAT SCORING MATRIX'}
            </button>
          ))}
        </div>

        {/* Analyst Filters & Layer Toggles (Visible in Map Mode) */}
        {section === 'map' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Severity Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
              <Filter size={13} />
              <select
                value={sevFilter}
                onChange={(e) => setSevFilter(e.target.value as any)}
                style={{
                  background: '#070d19', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0', borderRadius: '4px', padding: '4px 8px',
                  fontFamily: "'Chakra Petch', sans-serif", fontSize: '0.74rem',
                }}
              >
                <option value="all">Severity: All</option>
                <option value="high">High + Critical</option>
                <option value="critical">Critical Only</option>
              </select>
            </div>

            {/* Attack Vector Filter */}
            <select
              value={vectorFilter}
              onChange={(e) => setVectorFilter(e.target.value)}
              style={{
                background: '#070d19', border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2e8f0', borderRadius: '4px', padding: '4px 8px',
                fontFamily: "'Chakra Petch', sans-serif", fontSize: '0.74rem',
              }}
            >
              <option value="all">Vector: All Vectors</option>
              <option value="sql_injection">SQL Injection</option>
              <option value="login_attempt">Credential Attacks</option>
              <option value="file_upload">File Uploads</option>
              <option value="honeytoken_access">Honeytokens</option>
              <option value="recon_probe">Recon Probes</option>
            </select>

            {/* Arcs Toggle */}
            <button
              onClick={() => setShowArcs(!showArcs)}
              style={{
                background: showArcs ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                border: `1px solid ${showArcs ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: showArcs ? '#10b981' : 'var(--text-dim)',
                padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem',
                cursor: 'pointer', fontFamily: "'Chakra Petch', sans-serif",
              }}
            >
              ⚡ Trajectory Arcs: {showArcs ? 'ON' : 'OFF'}
            </button>

            {/* Labels Toggle */}
            <button
              onClick={() => setShowLabels(!showLabels)}
              title="Toggle between interactive hover HUD and pinned labels"
              style={{
                background: showLabels ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                border: `1px solid ${showLabels ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: showLabels ? '#10b981' : 'var(--text-dim)',
                padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem',
                cursor: 'pointer', fontFamily: "'Chakra Petch', sans-serif",
              }}
            >
              🏷️ Labels: {showLabels ? 'PINNED' : 'HOVER HUD'}
            </button>

            {/* Crosshair Reticle Toggle */}
            <button
              onClick={() => setShowCrosshairs(!showCrosshairs)}
              title="Toggle Tactical Coordinate Crosshairs (Latitude & Longitude Grid)"
              style={{
                background: showCrosshairs ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: `1px solid ${showCrosshairs ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                color: showCrosshairs ? '#10b981' : 'var(--text-dim)',
                padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem',
                cursor: 'pointer', fontFamily: "'Chakra Petch', sans-serif", fontWeight: 600,
              }}
            >
              🎯 Reticle: {showCrosshairs ? 'ACTIVE' : 'OFF'}
            </button>

            {/* Reset World View */}
            <button
              onClick={() => {
                setSelectedIP(null);
                mapInstanceRef.current?.flyTo([22, 18], 2.2, { duration: 1.2 });
              }}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem',
                cursor: 'pointer', fontFamily: "'Chakra Petch', sans-serif", fontWeight: 600,
              }}
            >
              🌐 Reset World
            </button>

            {/* Fullscreen Expand */}
            <button
              onClick={() => {
                setIsFullscreen(!isFullscreen);
                setTimeout(() => {
                  mapInstanceRef.current?.invalidateSize();
                  updateCrosshair();
                }, 200);
              }}
              title="Toggle Fullscreen Tactical Mode"
              style={{
                background: isFullscreen ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#e2e8f0', padding: '4px 8px', borderRadius: '4px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        )}
      </div>

      {/* ── Main Map Interface & Threat Dossier Split ── */}
      <div style={{ display: section === 'map' ? 'block' : 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: selectedIP ? '1fr 360px' : '1fr', gap: '18px', transition: 'all 0.3s' }}>

          {/* Map Container */}
          <div style={{
            background: 'rgba(4,6,15,0.96)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '16px',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch',sans-serif", letterSpacing: '0.05em' }}>
                GLOBAL HONEYPOT CONVERGENCE RADAR &bull; {filteredGeo.length} HOSTILE THREAT VECTORS VISIBLE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {focusedTarget && (
                  <div
                    onClick={() => {
                      if (focusedTarget.ip) {
                        setSelectedIP(focusedTarget.ip);
                      }
                    }}
                    title={focusedTarget.ip ? `Click to view ${focusedTarget.name} dossier` : undefined}
                    style={{
                      fontSize: '0.7rem',
                      color: focusedTarget.severity ? (SEV_COLOR[focusedTarget.severity] || '#ef4444') : '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontFamily: "'Chakra Petch',sans-serif",
                      cursor: focusedTarget.ip ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: focusedTarget.severity ? (SEV_COLOR[focusedTarget.severity] || '#ef4444') : '#10b981', boxShadow: '0 0 8px #10b981' }} />
                    <span>TARGET: <b>{focusedTarget.name.toUpperCase()}</b></span>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#34d399',
                      background: 'rgba(0,0,0,0.5)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}>
                      LAT: {focusedTarget.lat.toFixed(4)}° N &bull; LON: {focusedTarget.lon.toFixed(4)}° E
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFocusedTarget({
                      lat: ENCLAVE_COORDS[0],
                      lon: ENCLAVE_COORDS[1],
                      name: 'Addis Ababa',
                      severity: 'low',
                    });
                    mapInstanceRef.current?.flyTo(ENCLAVE_COORDS, 6, { duration: 0.8 });
                  }}
                  title="Center map on ARGUS Enclave Station"
                  style={{
                    fontSize: '0.7rem',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontFamily: "'Chakra Petch',sans-serif",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                  CONVERGENCE TARGET: ARGUS ENCLAVE (ADDIS ABABA)
                </button>
              </div>
            </div>

            {/* Relative Map Frame with Crosshair Targeting HUD */}
            <div style={{
              position: 'relative',
              width: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(16,185,129,0.22)',
            }}>
              <div
                ref={mapContainerRef}
                style={{
                  height: isFullscreen ? '740px' : '560px',
                  width: '100%',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.85)',
                  transition: 'height 0.3s ease',
                }}
              />

              {/* Tactical Crosshair Targeting Overlay (Latitude & Longitude Radar Reticle) */}
              {showCrosshairs && focusedTarget && (
                <div
                  ref={crosshairOverlayRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 650,
                    overflow: 'hidden',
                  }}
                >
                  {/* Full-width Horizontal Latitude Line */}
                  <div
                    className="crosshair-hline"
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: '100%',
                      height: '2px',
                      background: '#10b981',
                      boxShadow: '0 0 10px #10b981',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      className="crosshair-lat-badge"
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '-20px',
                        background: 'rgba(4, 12, 10, 0.94)',
                        border: '1px solid #10b981',
                        borderRadius: '3px',
                        padding: '1px 6px',
                        fontSize: '0.64rem',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: '#34d399',
                        letterSpacing: '0.04em',
                        boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      LAT: {focusedTarget.lat.toFixed(4)}° N
                    </div>
                  </div>

                  {/* Full-height Vertical Longitude Line */}
                  <div
                    className="crosshair-vline"
                    style={{
                      position: 'absolute',
                      top: 0,
                      height: '100%',
                      width: '2px',
                      background: '#10b981',
                      boxShadow: '0 0 10px #10b981',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      className="crosshair-lon-badge"
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'rgba(4, 12, 10, 0.94)',
                        border: '1px solid #10b981',
                        borderRadius: '3px',
                        padding: '1px 6px',
                        fontSize: '0.64rem',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: '#34d399',
                        letterSpacing: '0.04em',
                        boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      LON: {focusedTarget.lon.toFixed(4)}° E
                    </div>
                  </div>

                  {/* Tactical Square Reticle Box */}
                  <div
                    className="crosshair-box"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (focusedTarget?.ip) {
                        setSelectedIP(focusedTarget.ip);
                      }
                    }}
                    title={focusedTarget?.ip ? `Click to inspect ${focusedTarget.name} (${focusedTarget.ip}) dossier` : 'Target Reticle'}
                    style={{
                      position: 'absolute',
                      width: '68px',
                      height: '68px',
                      transform: 'translate(-50%, -50%)',
                      border: '2px solid #00ff9d',
                      boxShadow: '0 0 18px rgba(0, 255, 157, 0.45), inset 0 0 12px rgba(16, 185, 129, 0.2)',
                      pointerEvents: 'auto',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '4px',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div
                      className="crosshair-name-label"
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        fontFamily: "'Chakra Petch', sans-serif",
                        color: '#ffffff',
                        textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 4px #10b981',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                        background: 'rgba(4, 10, 18, 0.85)',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        pointerEvents: 'none',
                      }}
                    >
                      {focusedTarget.name}
                    </div>

                    {/* Corner Reticle Accents */}
                    <div style={{ position: 'absolute', top: -3, left: -3, width: 8, height: 8, borderTop: '3px solid #00ff9d', borderLeft: '3px solid #00ff9d' }} />
                    <div style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderTop: '3px solid #00ff9d', borderRight: '3px solid #00ff9d' }} />
                    <div style={{ position: 'absolute', bottom: -3, left: -3, width: 8, height: 8, borderBottom: '3px solid #00ff9d', borderLeft: '3px solid #00ff9d' }} />
                    <div style={{ position: 'absolute', bottom: -3, right: -3, width: 8, height: 8, borderBottom: '3px solid #00ff9d', borderRight: '3px solid #00ff9d' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Hostile Selector Strip */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-dim)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Target Acquisition Feeds (Hover/Click Hostile to Aim Reticle):
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                {filteredGeo.map((g) => {
                  const col = SEV_COLOR[g.max_severity] || '#22c55e';
                  const isSelected = selectedIP === g.ip || focusedTarget?.ip === g.ip;
                  return (
                    <button
                      key={g.ip}
                      type="button"
                      onMouseEnter={() => {
                        setFocusedTarget({
                          lat: g.lat,
                          lon: g.lon,
                          name: g.city || g.country || 'Hostile Zone',
                          ip: g.ip,
                          severity: g.max_severity,
                        });
                      }}
                      onClick={() => {
                        setSelectedIP(g.ip);
                        setFocusedTarget({
                          lat: g.lat,
                          lon: g.lon,
                          name: g.city || g.country || 'Hostile Zone',
                          ip: g.ip,
                          severity: g.max_severity,
                        });
                        mapInstanceRef.current?.flyTo([g.lat, g.lon], 5, { duration: 1.2 });
                      }}
                      style={{
                        background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(13, 18, 30, 0.85)',
                        border: `1px solid ${isSelected ? col : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px', padding: '6px 11px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
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

          {/* ── Threat Actor Dossier Side Panel (When a Hostile is Selected) ── */}
          {selectedIP && inspectedGeo && (
            <div style={{
              background: 'rgba(8, 12, 22, 0.98)',
              border: `1px solid ${SEV_COLOR[inspectedGeo.max_severity]}55`,
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: `0 0 30px rgba(0,0,0,0.9), 0 0 15px ${SEV_COLOR[inspectedGeo.max_severity]}22`,
              animation: 'fadeIn 0.2s ease',
            }}>
              {/* Dossier Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    ADVERSARY PROFILE DOSSIER
                  </div>
                  <div style={{ fontSize: '1.2rem', fontFamily: 'monospace', color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>
                    {inspectedGeo.ip}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIP(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Severity & Threat Score Banner */}
              <div style={{
                background: `${SEV_COLOR[inspectedGeo.max_severity]}15`,
                border: `1px solid ${SEV_COLOR[inspectedGeo.max_severity]}40`,
                borderRadius: '6px', padding: '10px 14px', marginBottom: '16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)' }}>RISK CLASSIFICATION</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: SEV_COLOR[inspectedGeo.max_severity] }}>
                    {inspectedGeo.max_severity.toUpperCase()} THREAT
                  </div>
                </div>
                {inspectedThreat && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)' }}>THREAT SCORE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: SEV_COLOR[inspectedGeo.max_severity], fontFamily: "'Chakra Petch',sans-serif" }}>
                      {inspectedThreat.score}
                    </div>
                  </div>
                )}
              </div>

              {/* Geopolitical Intelligence */}
              <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em' }}>
                  GEOPOLITICAL INTELLIGENCE
                </div>
                <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginBottom: '4px' }}>
                  📍 <b>Location:</b> {inspectedGeo.city ? `${inspectedGeo.city}, ` : ''}{inspectedGeo.country} ({inspectedGeo.country_code})
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '4px' }}>
                  🏢 <b>ASN / ISP:</b> {inspectedGeo.isp || 'Host Private Gateway'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  🌐 <b>Coordinates:</b> {inspectedGeo.lat.toFixed(4)}, {inspectedGeo.lon.toFixed(4)}
                </div>
              </div>

              {/* MITRE ATT&CK Classification */}
              {inspectedMitre && (
                <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em' }}>
                    MITRE ATT&amp;CK FRAMEWORK ALIGNMENT
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                      {inspectedMitre.id}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 600 }}>{inspectedMitre.name}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
                    <b>Tactic:</b> {inspectedMitre.tactic}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4 }}>
                    {inspectedMitre.desc}
                  </div>
                </div>
              )}

              {/* Forensic Timeline */}
              <div style={{ marginBottom: '16px', fontSize: '0.74rem', color: '#94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Observed Interactions:</span>
                  <b style={{ color: '#ffffff' }}>{inspectedGeo.event_count} incidents</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Primary Exploit Target:</span>
                  <b style={{ color: '#ffffff' }}>{inspectedGeo.top_event_type.replace(/_/g, ' ')}</b>
                </div>
                {inspectedThreat && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Last Ingress:</span>
                    <b style={{ color: '#ffffff' }}>{fmtDt(inspectedThreat.last_seen)}</b>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => handleDownloadPDF(inspectedGeo.ip)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.08) 100%)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    color: '#60a5fa', borderRadius: '6px', padding: '9px',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontFamily: "'Chakra Petch',sans-serif",
                  }}
                >
                  <Download size={14} /> EXPORT INCIDENT REPORT (PDF)
                </button>

                <button
                  onClick={() => copyToClipboard(inspectedGeo.ip)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0', borderRadius: '6px', padding: '8px',
                    fontSize: '0.74rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontFamily: "'Chakra Petch',sans-serif",
                  }}
                >
                  {copiedIOC ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedIOC ? 'IOC COPIED TO CLIPBOARD' : 'COPY HOSTILE IP (IOC)'}
                </button>
              </div>
            </div>
          )}
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
                  {['Hostile IP','Origin','Score','Risk Level','Events','Observed Vectors','First Seen','Last Activity','Locate','Forensics PDF'].map((h) => (
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
                        {t.event_types.slice(0, 3).map(e => e.replace(/_/g, ' ')).join(', ')}
                        {t.event_types.length > 3 ? ` +${t.event_types.length - 3}` : ''}
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
                          <Crosshair size={12}/> INSPECT
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
