import React, { useEffect, useState } from 'react';
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
  RefreshCw,
  ExternalLink,
  Shield,
} from 'lucide-react';

export const LiveStreamView: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pages, setPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [trafficFilter, setTrafficFilter] = useState<string>(''); // '', 'genuine', 'test'
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newestEventId, setNewestEventId] = useState<string | null>(null);

  const { lastEvent } = useWebSocket();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const isTestParam = trafficFilter === 'test' ? true : trafficFilter === 'genuine' ? false : undefined;
      const res = await api.getEvents({
        page,
        limit: 20,
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
  };

  useEffect(() => {
    fetchEvents();
  }, [page, severityFilter, typeFilter, trafficFilter]);

  // When search changes, reset to page 1 after small debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchEvents();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Handle incoming WebSocket event in real-time
  useEffect(() => {
    if (lastEvent) {
      setNewestEventId(lastEvent.id);
      // If currently on page 1 and filters match, prepend or refresh
      if (page === 1) {
        fetchEvents();
      }
    }
  }, [lastEvent]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title & Forensic Export Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="#00b4d8" />
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
          <option value="honeytoken_accessed">🍯 Honeytoken Access</option>
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

      {/* Events Stream Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-dim)',
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                <th style={{ padding: '12px 16px' }}>SEVERITY</th>
                <th style={{ padding: '12px 16px' }}>TIMESTAMP (UTC)</th>
                <th style={{ padding: '12px 16px' }}>SOURCE IP</th>
                <th style={{ padding: '12px 16px' }}>CLASSIFICATION</th>
                <th style={{ padding: '12px 16px' }}>REQUEST TARGET</th>
                <th style={{ padding: '12px 16px' }}>TRAFFIC ORIGIN</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading security event stream...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
                    <Shield size={32} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    No security events observed matching current filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const isNew = ev.id === newestEventId;
                  return (
                    <tr
                      key={ev.id}
                      className={isNew ? 'row-new-event' : ''}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => setSelectedEventId(ev.id)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Severity */}
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge-${ev.severity}`} style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {ev.severity}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      {/* Source IP */}
                      <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#ffffff' }}>
                        {ev.source_ip}
                      </td>

                      {/* Event Type */}
                      <td style={{ padding: '12px 16px' }}>
                        {ev.event_type === 'command_injection' ? (
                          <span style={{ color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            ⚡ Cmd Injection
                          </span>
                        ) : ev.event_type === 'honeytoken_accessed' ? (
                          <span style={{ color: '#c084fc', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(192, 132, 252, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
                            🍯 Honeytoken
                          </span>
                        ) : ev.event_type === 'sql_injection' ? (
                          <span style={{ color: '#fb923c', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(251, 146, 60, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(251, 146, 60, 0.3)' }}>
                            💉 SQL Injection
                          </span>
                        ) : ev.event_type === 'terminal_execution' ? (
                          <span style={{ color: '#2dd4bf', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(45, 212, 191, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                            💻 Terminal Exec
                          </span>
                        ) : (
                          <span style={{
                            color: '#38bdf8',
                            fontWeight: 500,
                            textTransform: 'capitalize',
                          }}>
                            {ev.event_type.replace('_', ' ')}
                          </span>
                        )}
                      </td>

                      {/* Target Path */}
                      <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-main)' }}>
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          marginRight: '6px',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                        }}>
                          {ev.http_method}
                        </span>
                        <span>{ev.request_path}</span>
                      </td>

                      {/* Traffic Origin */}
                      <td style={{ padding: '12px 16px' }}>
                        {ev.is_test_event ? (
                          <span style={{
                            fontSize: '0.7rem',
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>
                            TEST EVENT
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.7rem',
                            color: '#34d399',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>
                            GENUINE
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventId(ev.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#00b4d8',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          <span>INSPECT</span>
                          <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}>
          <div>
            Showing {events.length} of {total} total observed interactions
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            >
              <ChevronLeft size={14} />
              <span>PREV</span>
            </button>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, pages))}
              disabled={page >= pages}
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            >
              <span>NEXT</span>
              <ChevronRight size={14} />
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
