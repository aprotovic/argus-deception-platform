import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import type { SecurityEvent } from '../../types';
import { useWebSocket } from '../../context/WebSocketContext';
import { EventInvestigationModal } from '../investigation/EventInvestigationModal';
import {
  Activity,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Copy,
  Check,
  Plus,
  ArrowUpDown,
  ArrowUpRight,
  Syringe,
  Shield,
  Zap,
  Terminal,
  Hash,
  Diamond,
  Calendar,
  Globe,
  Hexagon,
  CircleDot,
  Circle,
  X,
} from 'lucide-react';

type SortField = 'id' | 'severity' | 'createdAt' | 'source_ip' | 'event_type' | 'request_target' | 'origin';

export const LiveStreamView: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [pages, setPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [trafficFilter, setTrafficFilter] = useState<string>(''); // '', 'genuine', 'test'
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Row selection & interaction
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newestEventId, setNewestEventId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Column sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { lastEvent } = useWebSocket();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const isTestParam = trafficFilter === 'test' ? true : trafficFilter === 'genuine' ? false : undefined;
      const res = await api.getEvents({
        page,
        limit,
        severity: severityFilter || undefined,
        event_type: typeFilter || undefined,
        is_test_event: isTestParam,
        search: searchTerm || undefined,
      });
      setEvents(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, severityFilter, typeFilter, trafficFilter, searchTerm]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // When search changes, reset to page 1 after small debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Handle incoming WebSocket event in real-time
  useEffect(() => {
    if (lastEvent) {
      setNewestEventId(lastEvent.id);
      if (page === 1) {
        fetchEvents();
      }
    }
  }, [lastEvent, page, fetchEvents]);

  const handleCopy = (text: string, label: string = 'Copied to clipboard') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setFeedbackToast(label);
      setTimeout(() => setCopiedId(null), 1600);
      setTimeout(() => setFeedbackToast(null), 2400);
    }
  };

  const handleAddSampleData = async () => {
    setSampleLoading(true);
    try {
      const samples = [
        {
          path: '/api/v1/decoy/auth/login?test=1',
          method: 'POST',
          body: { username: "admin' OR 1=1--", password: 'InjectedPayload!' },
        },
        {
          path: '/wp-login.php?test=1',
          method: 'GET',
          body: null,
        },
        {
          path: '/.env?test=1',
          method: 'GET',
          body: null,
        },
        {
          path: '/api/v1/decoy/upload/diagnostics?test=1',
          method: 'POST',
          body: { filename: 'recon_dump.sh', content: 'cat /etc/passwd' },
        },
        {
          path: '/api/v1/decoy/honeytoken/download?test=1',
          method: 'GET',
          body: null,
        },
        {
          path: '/api/v1/decoy/terminal/exec?test=1',
          method: 'POST',
          body: { command: 'sudo uname -a && cat /var/log/auth.log' },
        },
        {
          path: '/api/v1/decoy/auth/login?test=1',
          method: 'POST',
          body: { username: 'contractor_eval_' + Math.floor(Math.random() * 900 + 100), password: 'TestCredential99!' },
        },
      ];
      const pick = samples[Math.floor(Math.random() * samples.length)];
      const reqInit: RequestInit = {
        method: pick.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (pick.body && pick.method !== 'GET') {
        reqInit.body = JSON.stringify(pick.body);
      }
      await fetch(pick.path, reqInit);

      setFeedbackToast('Sample telemetry interaction injected into live stream.');
      setTimeout(() => setFeedbackToast(null), 3000);

      setTimeout(() => {
        fetchEvents();
        setSampleLoading(false);
      }, 400);
    } catch (e) {
      console.error('Failed to inject sample data:', e);
      setSampleLoading(false);
    }
  };

  const formatCreatedAt = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = String(hours).padStart(2, '0');
      return `${month}/${day}/${year}, ${strHours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const severityRanks: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const sortedEvents = useMemo(() => {
    if (!sortField) return events;
    return [...events].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') {
        cmp = a.id.localeCompare(b.id);
      } else if (sortField === 'severity') {
        cmp = (severityRanks[a.severity] || 0) - (severityRanks[b.severity] || 0);
      } else if (sortField === 'createdAt') {
        const dateA = new Date(a.created_at || a.timestamp).getTime();
        const dateB = new Date(b.created_at || b.timestamp).getTime();
        cmp = dateA - dateB;
      } else if (sortField === 'source_ip') {
        cmp = a.source_ip.localeCompare(b.source_ip);
      } else if (sortField === 'event_type') {
        cmp = a.event_type.localeCompare(b.event_type);
      } else if (sortField === 'request_target') {
        cmp = a.request_path.localeCompare(b.request_path);
      } else if (sortField === 'origin') {
        cmp = (a.is_test_event ? 1 : 0) - (b.is_test_event ? 1 : 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [events, sortField, sortDirection]);

  // Selection handlers
  const allSelected = sortedEvents.length > 0 && sortedEvents.every((ev) => selectedIds.has(ev.id));
  const someSelected = sortedEvents.some((ev) => selectedIds.has(ev.id));

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      sortedEvents.forEach((ev) => next.add(ev.id));
      setSelectedIds(next);
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Renderers for cell contents matching screenshot
  const renderSeverityBadge = (severity: string) => {
    const sev = severity?.toLowerCase() || 'medium';
    if (sev === 'critical') {
      return (
        <span style={{
          display: 'inline-block',
          background: 'rgba(239, 68, 68, 0.14)',
          border: '1px solid #dc2626',
          color: '#f87171',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          CRITICAL
        </span>
      );
    }
    if (sev === 'high') {
      return (
        <span style={{
          display: 'inline-block',
          background: 'rgba(249, 115, 22, 0.14)',
          border: '1px solid #ea580c',
          color: '#fb923c',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          HIGH
        </span>
      );
    }
    if (sev === 'medium') {
      return (
        <span style={{
          display: 'inline-block',
          background: 'rgba(234, 179, 8, 0.14)',
          border: '1px solid #ca8a04',
          color: '#facc15',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          MEDIUM
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-block',
        background: 'rgba(6, 182, 212, 0.14)',
        border: '1px solid #0891b2',
        color: '#22d3ee',
        padding: '3px 10px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        LOW
      </span>
    );
  };

  const renderEventType = (ev: SecurityEvent) => {
    const type = ev.event_type?.toLowerCase() || '';

    if (type === 'sql_injection') {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(249, 115, 22, 0.14)',
          border: '1px solid #ea580c',
          borderRadius: '6px',
          padding: '3px 9px',
          color: '#fb923c',
          fontSize: '0.74rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          <Syringe size={12} color="#fb923c" />
          <span>SQL Injection</span>
        </div>
      );
    }

    if (type === 'honeytoken_accessed' || type === 'honeytoken') {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(168, 85, 247, 0.14)',
          border: '1px solid #9333ea',
          borderRadius: '6px',
          padding: '3px 9px',
          color: '#c084fc',
          fontSize: '0.74rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          <Shield size={12} color="#c084fc" />
          <span>Honeytoken</span>
        </div>
      );
    }

    if (type === 'command_injection') {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(234, 179, 8, 0.14)',
          border: '1px solid #ca8a04',
          borderRadius: '6px',
          padding: '3px 9px',
          color: '#facc15',
          fontSize: '0.74rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          <Zap size={12} color="#facc15" />
          <span>Command Injection</span>
        </div>
      );
    }

    if (type === 'terminal_execution') {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(34, 197, 94, 0.14)',
          border: '1px solid #16a34a',
          borderRadius: '6px',
          padding: '3px 9px',
          color: '#4ade80',
          fontSize: '0.74rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          <Terminal size={12} color="#4ade80" />
          <span>Terminal Execution</span>
        </div>
      );
    }

    // Default probes and uploads rendered in bright sky blue / cyan text
    let label = 'Security Event';
    if (type === 'login_attempt') label = 'Login Attempt';
    else if (type === 'recon_probe') label = 'Recon Probe';
    else if (type === 'file_upload') label = 'File Upload';
    else if (type === 'unauthorized_access') label = 'Unauthorized Access';
    else if (type === 'malformed_request') label = 'Malformed Request';
    else label = type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return (
      <span style={{
        color: '#10b981',
        fontSize: '0.8rem',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    );
  };

  const renderRequestTarget = (ev: SecurityEvent) => {
    const rawPath = ev.request_path || '/';
    const method = (
      ev.http_method ||
      (ev.event_type === 'login_attempt' || ev.event_type === 'file_upload' ? 'POST' : 'GET')
    ).toUpperCase();
    const displayPath = rawPath.length > 25 ? `${rawPath.slice(0, 23)}..` : rawPath;

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          whiteSpace: 'nowrap',
        }}
        title={rawPath}
      >
        <span style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '4px',
          padding: '2px 6px',
          color: '#8b949e',
          fontSize: '0.68rem',
          fontWeight: 600,
        }}>
          {method}
        </span>
        <span style={{ color: '#cbd5e1' }}>
          {displayPath}
        </span>
      </div>
    );
  };

  const renderOriginBadge = (isTest: boolean) => {
    if (isTest) {
      return (
        <span style={{
          display: 'inline-block',
          background: 'rgba(217, 119, 6, 0.14)',
          border: '1px solid #b45309',
          borderRadius: '4px',
          padding: '3px 8px',
          color: '#fbbf24',
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          TEST EVENT
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-block',
        background: 'rgba(16, 185, 129, 0.14)',
        border: '1px solid #059669',
        borderRadius: '4px',
        padding: '3px 8px',
        color: '#34d399',
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        GENUINE
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Feedback Notification */}
      {feedbackToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '10px 16px',
          color: '#e6edf3',
          fontSize: '0.82rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <Check size={16} color="#2dd4bf" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Title & Forensic Export Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="#10b981" />
            <h1 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              LIVE ATTACK TELEMETRY STREAM
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Real-time feed of unauthorized interactions, probes, credential attacks, and file uploads.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={api.getExportUrl('csv', {
              severity: severityFilter || undefined,
              event_type: typeFilter || undefined,
              is_test_event: trafficFilter === 'test' ? true : trafficFilter === 'genuine' ? false : undefined,
            })}
            download="argus_events.csv"
            className="btn-secondary"
            style={{ fontSize: '0.78rem' }}
          >
            <Download size={14} />
            <span>EXPORT CSV</span>
          </a>

          <a
            href={api.getExportUrl('json', {
              severity: severityFilter || undefined,
              event_type: typeFilter || undefined,
              is_test_event: trafficFilter === 'test' ? true : trafficFilter === 'genuine' ? false : undefined,
            })}
            download="argus_events.json"
            className="btn-primary"
            style={{ fontSize: '0.78rem' }}
          >
            <Download size={14} />
            <span>EXPORT JSON</span>
          </a>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-panel" style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 14, 23, 0.9)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          padding: '6px 12px',
          flex: '1 1 240px',
        }}>
          <Search size={16} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Filter by IP, endpoint, or User-Agent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.82rem',
              width: '100%',
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPage(1);
          }}
          className="input-tactical"
          style={{ minWidth: '140px' }}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Event Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="input-tactical"
          style={{ minWidth: '160px' }}
        >
          <option value="">All Event Types</option>
          <option value="login_attempt">Login Attempt</option>
          <option value="file_upload">File Upload</option>
          <option value="command_injection">⚡ Command Injection</option>
          <option value="honeytoken_accessed">🛡️ Honeytoken Access</option>
          <option value="sql_injection">💉 SQL Injection</option>
          <option value="terminal_execution">💻 Terminal Execution</option>
          <option value="recon_probe">Recon Probe</option>
          <option value="unauthorized_access">Unauthorized Access</option>
        </select>

        {/* Traffic Filter: Genuine vs Test */}
        <select
          value={trafficFilter}
          onChange={(e) => {
            setTrafficFilter(e.target.value);
            setPage(1);
          }}
          className="input-tactical"
          style={{ minWidth: '180px' }}
        >
          <option value="">All Traffic Origins</option>
          <option value="genuine">Genuine Observed Only</option>
          <option value="test">Controlled Test Cases Only</option>
        </select>

        <button
          onClick={fetchEvents}
          className="btn-secondary"
          style={{ padding: '8px 12px' }}
          title="Refresh stream"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Selected Items Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          color: '#e6edf3',
          fontSize: '0.82rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: '#10b981',
              color: '#000000',
              borderRadius: '12px',
              padding: '2px 8px',
              fontWeight: 700,
              fontSize: '0.72rem',
            }}>
              {selectedIds.size}
            </span>
            <span>event{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const idsText = Array.from(selectedIds).join('\n');
                handleCopy(idsText, `Copied ${selectedIds.size} UUIDs to clipboard`);
              }}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              <Copy size={13} />
              <span>Copy IDs</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const selectedList = events.filter((e) => selectedIds.has(e.id));
                const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedList, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute('href', dataStr);
                downloadAnchor.setAttribute('download', `argus_selected_events_${Date.now()}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              <Download size={13} />
              <span>Export Selected</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <X size={14} />
              <span>Deselect all</span>
            </button>
          </div>
        </div>
      )}

      {/* Table Container - Exact Structure Matching User's Image */}
      <div style={{
        background: '#040705',
        border: '1px solid #142419',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
      }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                background: '#080d09',
                borderBottom: '1px solid #142419',
                color: '#8b949e',
                fontSize: '0.74rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                userSelect: 'none',
              }}>
                {/* 1. Checkbox Select All */}
                <th style={{ padding: '12px 14px', width: '42px', textAlign: 'center' }}>
                  <div
                    onClick={handleToggleSelectAll}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '3px',
                      border: allSelected || someSelected ? '1px solid #ffffff' : '1px solid #3b4252',
                      background: allSelected || someSelected ? '#1a2234' : '#0c1017',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      margin: '0 auto',
                    }}
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  >
                    {allSelected && (
                      <div style={{ width: '8px', height: '8px', background: '#ffffff', borderRadius: '1.5px' }} />
                    )}
                    {someSelected && !allSelected && (
                      <div style={{ width: '8px', height: '2px', background: '#ffffff', borderRadius: '1px' }} />
                    )}
                  </div>
                </th>

                {/* 2. Row Sequence # */}
                <th style={{
                  padding: '12px 10px',
                  width: '46px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#64748b',
                }}>
                  #
                </th>

                {/* 3. # $id */}
                <th
                  onClick={() => handleSort('id')}
                  style={{
                    padding: '12px 14px',
                    width: '210px',
                    cursor: 'pointer',
                    color: sortField === 'id' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by $id"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Hash size={12} color="#64748b" />
                      <span>$id</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'id' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 4. severity */}
                <th
                  onClick={() => handleSort('severity')}
                  style={{
                    padding: '12px 14px',
                    width: '125px',
                    cursor: 'pointer',
                    color: sortField === 'severity' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by severity"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Diamond size={12} color="#64748b" />
                      <span>severity</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'severity' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 5. $createdAt */}
                <th
                  onClick={() => handleSort('createdAt')}
                  style={{
                    padding: '12px 14px',
                    width: '175px',
                    cursor: 'pointer',
                    color: sortField === 'createdAt' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by $createdAt"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={12} color="#64748b" />
                      <span>$createdAt</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'createdAt' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 6. source_ip */}
                <th
                  onClick={() => handleSort('source_ip')}
                  style={{
                    padding: '12px 14px',
                    width: '145px',
                    cursor: 'pointer',
                    color: sortField === 'source_ip' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by source_ip"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Globe size={12} color="#64748b" />
                      <span>source_ip</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'source_ip' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 7. event_type */}
                <th
                  onClick={() => handleSort('event_type')}
                  style={{
                    padding: '12px 14px',
                    width: '185px',
                    cursor: 'pointer',
                    color: sortField === 'event_type' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by event_type"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Hexagon size={12} color="#64748b" />
                      <span>event_type</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'event_type' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 8. request_target */}
                <th
                  onClick={() => handleSort('request_target')}
                  style={{
                    padding: '12px 14px',
                    minWidth: '230px',
                    cursor: 'pointer',
                    color: sortField === 'request_target' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by request_target"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CircleDot size={12} color="#64748b" />
                      <span>request_target</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'request_target' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 9. origin */}
                <th
                  onClick={() => handleSort('origin')}
                  style={{
                    padding: '12px 14px',
                    width: '130px',
                    cursor: 'pointer',
                    color: sortField === 'origin' ? '#ffffff' : '#8b949e',
                  }}
                  title="Sort by origin"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Circle size={12} color="#64748b" />
                      <span>origin</span>
                    </div>
                    <ArrowUpDown size={12} color={sortField === 'origin' ? '#10b981' : '#475569'} />
                  </div>
                </th>

                {/* 10. # actions */}
                <th style={{
                  padding: '12px 16px',
                  width: '110px',
                  textAlign: 'right',
                  color: '#8b949e',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                    <Hash size={12} color="#64748b" />
                    <span>actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#8b949e', fontSize: '0.85rem' }}>
                    Loading telemetry stream...
                  </td>
                </tr>
              ) : sortedEvents.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#8b949e', fontSize: '0.85rem' }}>
                    <Shield size={32} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    No security events observed matching current filter criteria.
                  </td>
                </tr>
              ) : (
                sortedEvents.map((ev, index) => {
                  const isNew = ev.id === newestEventId;
                  const isSelected = selectedIds.has(ev.id);
                  const rowIndex = total > 0 ? (total - ((page - 1) * limit + index)) : (index + 1);
                  const displayId = ev.id.length > 21 ? `${ev.id.slice(0, 21)}..` : ev.id;

                  return (
                    <tr
                      key={ev.id}
                      className={isNew ? 'row-new-event' : ''}
                      style={{
                        borderBottom: '1px solid #151a24',
                        background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => setSelectedEventId(ev.id)}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* 1. Selection Checkbox */}
                      <td
                        style={{ padding: '12px 14px', textAlign: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRow(ev.id);
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '3px',
                            border: isSelected ? '1px solid #ffffff' : '1px solid #3b4252',
                            background: isSelected ? '#1a2234' : '#0c1017',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            margin: '0 auto',
                          }}
                        >
                          {isSelected && (
                            <div style={{ width: '8px', height: '8px', background: '#ffffff', borderRadius: '1.5px' }} />
                          )}
                        </div>
                      </td>

                      {/* 2. Row Sequence # */}
                      <td style={{
                        padding: '12px 10px',
                        color: '#64748b',
                        fontSize: '0.82rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                      }}>
                        {rowIndex}
                      </td>

                      {/* 3. # $id */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#121721',
                          border: '1px solid #252f40',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.76rem',
                          color: '#cbd5e1',
                        }}>
                          <span>{displayId}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(ev.id, 'Event UUID copied to clipboard');
                            }}
                            title="Copy full UUID"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedId === ev.id ? '#2dd4bf' : '#64748b',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                              transition: 'color 0.15s ease',
                            }}
                          >
                            {copiedId === ev.id ? <Check size={12} color="#2dd4bf" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* 4. severity */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {renderSeverityBadge(ev.severity)}
                      </td>

                      {/* 5. $createdAt */}
                      <td style={{
                        padding: '12px 14px',
                        color: '#c9d1d9',
                        fontSize: '0.78rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                      }}>
                        {formatCreatedAt(ev.created_at || ev.timestamp)}
                      </td>

                      {/* 6. source_ip */}
                      <td style={{
                        padding: '12px 14px',
                        color: '#f1f5f9',
                        fontSize: '0.82rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>
                        {ev.source_ip}
                      </td>

                      {/* 7. event_type */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {renderEventType(ev)}
                      </td>

                      {/* 8. request_target */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {renderRequestTarget(ev)}
                      </td>

                      {/* 9. origin */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {renderOriginBadge(ev.is_test_event)}
                      </td>

                      {/* 10. # actions */}
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventId(ev.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#10b981',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#10b981')}
                          title="Inspect telemetry & forensic details"
                        >
                          <span>INSPECT</span>
                          <ArrowUpRight size={13} color="#10b981" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Minimalist Pagination Bar */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #1a2233',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#0c1017',
          color: '#8b949e',
          fontSize: '0.8rem',
        }}>
          {/* Left: of {total} Show [25 v] per page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>of {total}</span>
            <span style={{ marginLeft: '4px' }}>Show</span>
            <select
              value={limit}
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                setLimit(newLimit);
                setPage(1);
              }}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#e6edf3',
                padding: '4px 8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>per page</span>
          </div>

          {/* Right: << < Page 1 of 30 > >> + Sample data */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* First page << */}
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              title="First Page"
              style={{
                background: 'transparent',
                border: 'none',
                color: page <= 1 ? '#3b4252' : '#8b949e',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
            >
              <ChevronsLeft size={16} />
            </button>

            {/* Prev page < */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              title="Previous Page"
              style={{
                background: 'transparent',
                border: 'none',
                color: page <= 1 ? '#3b4252' : '#8b949e',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page indicator: Page 1 of 30 */}
            <span style={{ margin: '0 4px', fontSize: '0.8rem', color: '#8b949e' }}>
              Page <strong style={{ color: '#e6edf3', fontWeight: 600 }}>{page}</strong> of {pages || 1}
            </span>

            {/* Next page > */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, pages))}
              disabled={page >= pages}
              title="Next Page"
              style={{
                background: 'transparent',
                border: 'none',
                color: page >= pages ? '#3b4252' : '#8b949e',
                cursor: page >= pages ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
            >
              <ChevronRight size={16} />
            </button>

            {/* Last page >> */}
            <button
              type="button"
              onClick={() => setPage(pages)}
              disabled={page >= pages}
              title="Last Page"
              style={{
                background: 'transparent',
                border: 'none',
                color: page >= pages ? '#3b4252' : '#8b949e',
                cursor: page >= pages ? 'not-allowed' : 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
            >
              <ChevronsRight size={16} />
            </button>

            {/* + Sample data button */}
            <button
              type="button"
              onClick={handleAddSampleData}
              disabled={sampleLoading}
              style={{
                marginLeft: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#e6edf3',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: sampleLoading ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = '#8b949e';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = '#30363d';
              }}
            >
              <Plus size={14} color="#10b981" />
              <span>{sampleLoading ? 'Injecting...' : 'Sample data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forensic Inspection Modal */}
      {selectedEventId && (
        <EventInvestigationModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onSelectEvent={(id) => setSelectedEventId(id)}
        />
      )}
    </div>
  );
};
