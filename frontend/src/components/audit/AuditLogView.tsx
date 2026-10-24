import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { AuditLog } from '../../types';
import { FileText, RefreshCw, Shield } from 'lucide-react';
import { CyberLoader } from '../common/CyberLoader';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        action: actionFilter || undefined,
        limit: 50,
      });
      setLogs(res.items);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="#10b981" />
            <h1 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              ADMINISTRATIVE AUDIT LOG
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Immutable forensic record of operator logins, evidence downloads, and data exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input-tactical"
            style={{ minWidth: '180px' }}
          >
            <option value="">All Actions</option>
            <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
            <option value="AUTH_LOGIN_FAILED">AUTH_LOGIN_FAILED</option>
            <option value="EVIDENCE_DOWNLOAD">EVIDENCE_DOWNLOAD</option>
            <option value="EVENT_EXPORT">EVENT_EXPORT</option>
          </select>

          <button onClick={fetchLogs} className="btn-secondary" style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
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
                <th style={{ padding: '12px 16px' }}>TIMESTAMP (UTC)</th>
                <th style={{ padding: '12px 16px' }}>ACTION</th>
                <th style={{ padding: '12px 16px' }}>OPERATOR IP</th>
                <th style={{ padding: '12px 16px' }}>TARGET ENTITY</th>
                <th style={{ padding: '12px 16px' }}>AUDIT DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 12px' }}>
                    <CyberLoader
                      mode="inline"
                      message="AUDITING OPERATOR ACCESS LOGS..."
                      subMessage="DECRYPTING COMPLIANCE INTEGRITY TRAIL"
                    />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
                    <Shield size={32} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toUTCString()}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: log.action.includes('FAIL')
                          ? 'rgba(239, 68, 68, 0.15)'
                          : log.action.includes('DOWNLOAD')
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                        color: log.action.includes('FAIL')
                          ? '#f87171'
                          : log.action.includes('DOWNLOAD')
                            ? '#fbbf24'
                            : '#10b981',
                        border: `1px solid ${log.action.includes('FAIL')
                            ? 'rgba(239, 68, 68, 0.3)'
                            : log.action.includes('DOWNLOAD')
                              ? 'rgba(245, 158, 11, 0.3)'
                              : 'rgba(16, 185, 129, 0.3)'
                          }`,
                      }}>
                        {log.action}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff' }}>
                      {log.ip_address}
                    </td>

                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)' }}>
                      {log.target_type} ({log.target_id.substring(0, 12)}...)
                    </td>

                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
