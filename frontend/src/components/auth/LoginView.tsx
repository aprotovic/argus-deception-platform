import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, KeyRound, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Hidden shortcut (Ctrl + Shift + A) to toggle operator presets for demonstrations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowPresets((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setPresetUser = (u: string) => {
    setUsername(u);
    setPassword('');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Background radial accent */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(8, 12, 10, 0.95)',
        border: '1px solid var(--border-accent)',
        borderRadius: '10px',
        padding: '36px 32px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(16, 185, 129, 0.15)',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Header Icon & Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            onClick={() => setShowPresets((prev) => !prev)}
            title="Defense Network Gateway"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))',
              border: '1px solid var(--border-accent)',
              marginBottom: '16px',
              cursor: 'pointer',
            }}
          >
            <Shield size={28} color="#10b981" />
          </div>

          <h1 style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '1.6rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#ffffff',
            textTransform: 'uppercase',
          }}>
            ARGUS DEFENSE NETWORK
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Tactical Security Operations Command Center
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '4px',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: '6px',
            }}>
              Operator Identity
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-tactical"
              style={{ width: '100%' }}
              placeholder="Operator Call-Sign / ID"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: '6px',
            }}>
              Security Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-tactical"
              style={{ width: '100%' }}
              placeholder="••••••••••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              justifyContent: 'center',
              padding: '12px',
              fontSize: '0.9rem',
              marginTop: '6px',
            }}
          >
            <KeyRound size={16} />
            <span>{loading ? 'AUTHENTICATING...' : 'ACCESS COMMAND CONSOLE'}</span>
          </button>
        </form>

        {/* Operator Quick-Connect Presets */}
        {showPresets && (
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              marginBottom: '10px',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}>
              QUICK-CONNECT CREDENTIALS (CLICK TO AUTOFILL):
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setPresetUser('argus_admin')}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#f87171',
                  fontSize: '0.75rem',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>ADMINISTRATOR</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'monospace' }}>
                  argus_admin
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPresetUser('analyst')}
                style={{
                  flex: 1,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: '#10b981',
                  fontSize: '0.75rem',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>SOC ANALYST</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'monospace' }}>
                  analyst
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.04em' }}>
        RESTRICTED ACCESS &bull; DISA STIG COMPLIANT &bull; AUTHORIZED DEFENSE OPERATORS ONLY
      </div>
    </div>
  );
};
