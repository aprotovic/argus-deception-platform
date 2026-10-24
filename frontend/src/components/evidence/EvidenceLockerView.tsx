import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { CapturedFile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  Download,
  Copy,
  Check,
  FileCode,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export const EvidenceLockerView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [evidenceList, setEvidenceList] = useState<CapturedFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await api.getEvidence();
      setEvidenceList(res.items);
    } catch (err) {
      console.error('Failed to load evidence locker:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownload = async (file: CapturedFile) => {
    if (!isAdmin) {
      alert('Access Restricted: Quarantined payload downloads require Administrator role.');
      return;
    }

    if (!confirm(`CAUTION: You are about to download a quarantined artifact (${file.original_filename_sanitized}). This payload was captured from an untrusted source. Do not execute this file on unisolated workstations. Proceed?`)) {
      return;
    }

    setDownloadingId(file.id);
    try {
      await api.downloadEvidence(file.id, file.original_filename_sanitized);
    } catch (err: any) {
      alert(err.message || 'Evidence download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={22} color="#10b981" />
            <h1 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              SECURE EVIDENCE LOCKER
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Cryptographically quarantined payloads captured by decoy upload interfaces.
          </p>
        </div>

        <button onClick={fetchEvidence} className="btn-secondary" style={{ padding: '8px 12px' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>REFRESH INVENTORY</span>
        </button>
      </div>

      {/* Security Caution Callout */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '6px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <AlertTriangle size={20} color="#f87171" />
        <div style={{ fontSize: '0.78rem', color: '#fca5a5', lineHeight: 1.4 }}>
          <strong>ISOLATION PROTOCOL ACTIVE:</strong> Uploaded payloads are renamed with UUIDs and stored with read-only permissions in a non-executable quarantine volume. Standard parsers, runtimes, and shell interpreters are disabled. Every artifact download is immutably recorded in the administrative audit log.
        </div>
      </div>

      {/* Evidence Table */}
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
                <th style={{ padding: '12px 16px' }}>ORIGINAL ARTIFACT</th>
                <th style={{ padding: '12px 16px' }}>SHA-256 CHECKSUM</th>
                <th style={{ padding: '12px 16px' }}>SIZE</th>
                <th style={{ padding: '12px 16px' }}>DETECTED MIME</th>
                <th style={{ padding: '12px 16px' }}>SOURCE IP</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>CUSTODY ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading && evidenceList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Scanning evidence quarantine vault...
                  </td>
                </tr>
              ) : evidenceList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
                    <ShieldAlert size={32} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    No quarantined artifacts currently present in vault.
                  </td>
                </tr>
              ) : (
                evidenceList.map((file) => (
                  <tr
                    key={file.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Filename */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileCode size={16} color="#10b981" />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#ffffff' }}>
                          {file.original_filename_sanitized}
                        </span>
                      </div>
                    </td>

                    {/* SHA-256 Hash */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.72rem',
                          color: '#fb7185',
                          background: 'rgba(0, 0, 0, 0.4)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                        }}>
                          {file.sha256_hash.substring(0, 16)}...
                        </span>
                        <button
                          onClick={() => handleCopyHash(file.sha256_hash)}
                          title="Copy Full SHA-256"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                        >
                          {copiedHash === file.sha256_hash ? (
                            <Check size={14} color="#34d399" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* File Size */}
                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                      {(file.file_size_bytes / 1024).toFixed(1)} KB
                    </td>

                    {/* Detected MIME */}
                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981' }}>
                      {file.detected_mime_type}
                    </td>

                    {/* Source IP */}
                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-main)' }}>
                      {file.source_ip}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: file.quarantine_status === 'quarantined' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: file.quarantine_status === 'quarantined' ? '#f87171' : '#fbbf24',
                        border: `1px solid ${file.quarantine_status === 'quarantined' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      }}>
                        {file.quarantine_status}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.id || !isAdmin}
                        className="btn-secondary"
                        style={{
                          fontSize: '0.72rem',
                          padding: '4px 10px',
                          opacity: isAdmin ? 1 : 0.4,
                          cursor: isAdmin ? 'pointer' : 'not-allowed',
                        }}
                        title={isAdmin ? 'Download quarantined payload' : 'Requires Administrator role'}
                      >
                        <Download size={12} />
                        <span>{downloadingId === file.id ? 'DOWNLOADING...' : 'DOWNLOAD'}</span>
                      </button>
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
