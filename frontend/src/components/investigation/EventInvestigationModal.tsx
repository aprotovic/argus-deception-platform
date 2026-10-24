import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { SecurityEventDetail } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Shield,
  ShieldAlert,
  Clock,
  Terminal,
  FileCode,
  Download,
  Copy,
  Check,
  Globe,
} from 'lucide-react';

interface EventInvestigationModalProps {
  eventId: string;
  onClose: () => void;
  onSelectEvent: (id: string) => void;
}

export const EventInvestigationModal: React.FC<EventInvestigationModalProps> = ({
  eventId,
  onClose,
  onSelectEvent,
}) => {
  const { isAdmin } = useAuth();
  const [detail, setDetail] = useState<SecurityEventDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.getEventDetail(eventId)
      .then((data) => {
        if (isMounted) setDetail(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const handleCopyJson = () => {
    if (detail) {
      navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadEvidence = async () => {
    if (!detail?.captured_file) return;
    setDownloading(true);
    try {
      await api.downloadEvidence(
        detail.captured_file.id,
        detail.captured_file.original_filename_sanitized
      );
    } catch (err: any) {
      alert(err.message || 'Evidence download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px',
    }}>
      <div style={{
        background: '#0e1422',
        border: '1px solid var(--border-accent)',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 180, 216, 0.1)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#00b4d8" />
            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.04em',
              }}>
                SECURITY EVENT INVESTIGATION
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                UUID: {eventId}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleCopyJson}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              <span>{copied ? 'COPIED JSON' : 'COPY JSON'}</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading event metadata and correlated telemetry...
            </div>
          ) : !detail ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>
              Failed to load event details.
            </div>
          ) : (
            <>
              {/* Event Attributes Badges Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '12px 16px',
              }}>
                <span className={`badge-${detail.severity}`} style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}>
                  {detail.severity} SEVERITY
                </span>

                <span style={{
                  background: 'rgba(0, 180, 216, 0.12)',
                  color: '#38bdf8',
                  border: '1px solid rgba(0, 180, 216, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  {detail.event_type.replace('_', ' ')}
                </span>

                <span style={{
                  background: detail.is_test_event ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: detail.is_test_event ? '#fbbf24' : '#34d399',
                  border: `1px solid ${detail.is_test_event ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {detail.is_test_event ? 'CONTROLLED TEST TRAFFIC' : 'GENUINE OBSERVED INTERACTION'}
                </span>

                <div style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  <Clock size={14} />
                  <span>{new Date(detail.timestamp).toUTCString()}</span>
                </div>
              </div>

              {/* Source & Network Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                    SOURCE CONNECTION
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={18} color="#00b4d8" />
                    {detail.source_ip}
                    {detail.source_port && <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>:{detail.source_port}</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', wordBreak: 'break-all' }}>
                    User Agent: {detail.user_agent || 'Not provided'}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                    REQUEST ANATOMY
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}>
                      {detail.http_method}
                    </span>
                    <span style={{ color: '#ffffff' }}>{detail.request_path}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Correlation ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8' }}>{detail.correlation_id || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Decoy Credential Trap Details */}
              {detail.login_attempt && (
                <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Terminal size={18} color="#f59e0b" />
                    <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                      TRAPPED DECOY CREDENTIAL SUBMISSION
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>SUBMITTED USERNAME</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                        {detail.login_attempt.submitted_username}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>SUBMITTED PASSWORD LENGTH</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                        {detail.login_attempt.password_length} characters
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>KEYED PASSWORD FINGERPRINT (HMAC-SHA256)</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.75rem',
                        color: '#fbbf24',
                        background: 'rgba(0, 0, 0, 0.4)',
                        padding: '8px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        wordBreak: 'break-all',
                      }}>
                        {detail.login_attempt.password_hmac_fingerprint}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        * Plaintext password is NEVER stored. Keyed HMAC enables correlation across distributed attacks without credential exposure.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quarantined Artifact Details */}
              {detail.captured_file && (
                <div className="glass-panel" style={{ padding: '20px', borderLeft: '4px solid #ef4444' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileCode size={18} color="#ef4444" />
                      <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                        QUARANTINED PAYLOAD EVIDENCE
                      </span>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={handleDownloadEvidence}
                        disabled={downloading}
                        className="btn-primary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        <Download size={14} />
                        <span>{downloading ? 'FETCHING...' : 'DOWNLOAD ARTIFACT'}</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>SANITIZED FILENAME</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                        {detail.captured_file.original_filename_sanitized}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>FILE SIZE</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', marginTop: '2px' }}>
                        {(detail.captured_file.file_size_bytes / 1024).toFixed(1)} KB ({detail.captured_file.file_size_bytes} bytes)
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>DETECTED MIME TYPE</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', marginTop: '2px' }}>
                        {detail.captured_file.detected_mime_type}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>CRYPTOGRAPHIC SHA-256 CHECKSUM</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.75rem',
                        color: '#f87171',
                        background: 'rgba(0, 0, 0, 0.4)',
                        padding: '8px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        wordBreak: 'break-all',
                      }}>
                        {detail.captured_file.sha256_hash}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Deception Forensic Payload Analysis */}
              {detail.metadata_payload && (
                detail.metadata_payload.command_injection_payload ||
                detail.metadata_payload.honeytoken_filename ||
                detail.metadata_payload.injected_sql ||
                detail.metadata_payload.interactive_command
              ) && (
                <div className="glass-panel" style={{
                  padding: '20px',
                  borderLeft: `4px solid ${
                    detail.metadata_payload.command_injection_payload ? '#ef4444' :
                    detail.metadata_payload.honeytoken_filename ? '#c084fc' :
                    detail.metadata_payload.injected_sql ? '#fb923c' : '#2dd4bf'
                  }`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <ShieldAlert size={18} color={
                      detail.metadata_payload.command_injection_payload ? '#ef4444' :
                      detail.metadata_payload.honeytoken_filename ? '#c084fc' :
                      detail.metadata_payload.injected_sql ? '#fb923c' : '#2dd4bf'
                    } />
                    <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                      {detail.metadata_payload.command_injection_payload ? 'DETECTED COMMAND INJECTION EXPLOIT' :
                       detail.metadata_payload.honeytoken_filename ? 'HONEYTOKEN CANARY ACCESS FORENSICS' :
                       detail.metadata_payload.injected_sql ? 'DETECTED SQL INJECTION QUERY ATTEMPT' :
                       'INTERACTIVE TERMINAL HONEYPOT EXECUTION'}
                    </span>
                  </div>

                  {detail.metadata_payload.command_injection_payload && (
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', textTransform: 'uppercase' }}>EXTRACTED INJECTION PAYLOAD</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#f87171',
                        background: 'rgba(0, 0, 0, 0.45)',
                        padding: '10px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        fontSize: '0.85rem',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}>
                        {detail.metadata_payload.command_injection_payload}
                      </div>
                      {detail.metadata_payload.detected_technique && (
                        <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '6px' }}>
                          Technique: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{detail.metadata_payload.detected_technique}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {detail.metadata_payload.honeytoken_filename && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>TRIPPED CANARY FILE</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#c084fc', fontWeight: 600, marginTop: '2px' }}>
                          {detail.metadata_payload.honeytoken_filename}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>CANARY TOKEN ID</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#fbbf24', fontSize: '0.78rem', marginTop: '2px' }}>
                          {detail.metadata_payload.canary_id || 'NX-CANARY-ACTIVE'}
                        </div>
                      </div>
                    </div>
                  )}

                  {detail.metadata_payload.injected_sql && (
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>INTERCEPTED SQL INJECTION</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#fb923c',
                        background: 'rgba(0, 0, 0, 0.45)',
                        padding: '10px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        fontSize: '0.82rem',
                        border: '1px solid rgba(251, 146, 60, 0.3)',
                      }}>
                        {detail.metadata_payload.injected_sql}
                      </div>
                    </div>
                  )}

                  {detail.metadata_payload.interactive_command && (
                    <div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>SANDBOX COMMAND EXECUTED</div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#2dd4bf',
                        background: 'rgba(0, 0, 0, 0.45)',
                        padding: '8px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        fontSize: '0.82rem',
                      }}>
                        $ {detail.metadata_payload.interactive_command}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sanitized Request Headers */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>
                  SANITIZED REQUEST HEADERS (COOKIES & TOKENS STRIPPED)
                </div>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '4px',
                  padding: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}>
                  {Object.entries(detail.headers_sanitized).map(([k, v]) => (
                    <div key={k} style={{ marginBottom: '4px' }}>
                      <span style={{ color: '#00b4d8' }}>{k}:</span> <span style={{ color: '#94a3b8' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correlated Events from Same Source IP */}
              <div className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '10px' }}>
                  CORRELATED ACTIVITY FROM SOURCE IP ({detail.correlated_events.length} OTHER INTERACTIONS)
                </div>

                {detail.correlated_events.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    No other interactions observed from this source address.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detail.correlated_events.map((corr) => (
                      <div
                        key={corr.id}
                        onClick={() => onSelectEvent(corr.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          fontSize: '0.78rem',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`badge-${corr.severity}`} style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700 }}>
                            {corr.severity}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ffffff' }}>
                            {corr.http_method} {corr.request_path}
                          </span>
                        </div>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                          {new Date(corr.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
