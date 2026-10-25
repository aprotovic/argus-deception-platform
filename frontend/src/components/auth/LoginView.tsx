import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Eye,
  EyeOff,
  KeyRound,
  Radio,
  Lock,
  Activity,
  Globe,
  Database,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('argus_admin');
  const [password, setPassword] = useState<string>('ArgusAdmin2026!ChangeMe');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'analyst'>('admin');
  const loginFormRef = useRef<HTMLDivElement>(null);

  // Auto-switch credentials when selecting role tab
  const handleSelectRole = (role: 'admin' | 'analyst') => {
    setSelectedRole(role);
    setError(null);
    if (role === 'admin') {
      setUsername('argus_admin');
      setPassword('ArgusAdmin2026!ChangeMe');
    } else {
      setUsername('analyst');
      setPassword('Analyst2026!SecOps');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials or authorization.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToLogin = () => {
    loginFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020503',
      color: '#f1f5f9',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* ── Subtle Cyber Grid & Ambient Glow Background ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 15%, rgba(16, 185, 129, 0.08) 0%, transparent 45%),
          radial-gradient(circle at 80% 85%, rgba(5, 150, 105, 0.06) 0%, transparent 50%),
          linear-gradient(rgba(16, 185, 129, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16, 185, 129, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Top Tactical Navigation Bar ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(4, 7, 5, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Brand & Emblem */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(16, 185, 129, 0.3)',
          }}>
            <Eye size={20} color="#10b981" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              ARGUS PANOPTES
              <span style={{
                fontSize: '0.62rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                v2.4
              </span>
            </div>
            <div style={{
              fontSize: '0.68rem',
              color: 'var(--text-dim)',
              letterSpacing: '0.04em',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Ἄργος Πανόπτης &bull; AUTONOMOUS DECEPTION & INCIDENT PLATFORM
            </div>
          </div>
        </div>

        {/* Live System Posture Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '5px 10px',
            borderRadius: '4px',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }} />
            <span>SENSORS: 100% ARMED</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#6ee7b7',
            background: 'rgba(5, 150, 105, 0.08)',
            border: '1px solid rgba(5, 150, 105, 0.25)',
            padding: '5px 10px',
            borderRadius: '4px',
          }}>
            <Radio size={12} color="#10b981" />
            <span>DECOYS: PORTS 8081 / 3306</span>
          </div>

          {/* Decoy Surface Link */}
          <a
            href="/decoy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '6px 12px',
              borderRadius: '4px',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.22)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)')}
          >
            <span>DECOY SURFACE</span>
            <ExternalLink size={12} />
          </a>

          {/* Quick Scroll To Login */}
          <button
            onClick={scrollToLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#020503',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <KeyRound size={13} />
            <span>AUTHENTICATE</span>
          </button>
        </div>
      </header>

      {/* ── Main Hero Section (Split View: Mission & Auth Console) ── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '48px 24px 32px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '40px',
        alignItems: 'center',
      }}>
        {/* Left Column: Mission & Defense Narrative */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            fontSize: '0.72rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#10b981',
            letterSpacing: '0.06em',
            marginBottom: '20px',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981',
            }} />
            // CLASSIFIED SOC OPERATIONS // ZERO-DAY DECEPTION ENCLAVE
          </div>

          <h1 style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: 'clamp(2rem, 3.8vw, 2.9rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '0.04em',
            color: '#ffffff',
            marginBottom: '18px',
            textTransform: 'uppercase',
          }}>
            ALL-SEEING THREAT <span style={{ color: '#10b981', textShadow: '0 0 25px rgba(16, 185, 129, 0.45)' }}>DECEPTION</span> &amp; INCIDENT COMMAND
          </h1>

          <p style={{
            fontSize: '0.92rem',
            lineHeight: 1.65,
            color: 'var(--text-muted)',
            marginBottom: '28px',
            maxWidth: '560px',
          }}>
            Named after the mythological guardian with <strong>100 watchful eyes</strong> who never slept. ARGUS Panoptes blankets your entire enterprise perimeter with active deception honeypots, trapping hostile incursions with <strong>zero blind spots</strong> and zero false positives.
          </p>

          {/* 3 Mission Metrics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '32px',
          }}>
            <div style={{
              background: 'rgba(10, 16, 12, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '14px',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase' }}>
                False Positive Rate
              </div>
              <div style={{ fontSize: '1.4rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                0.00%
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Decoys hold zero benign traffic
              </div>
            </div>

            <div style={{
              background: 'rgba(10, 16, 12, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '14px',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase' }}>
                Active Honey-Grid
              </div>
              <div style={{ fontSize: '1.4rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                2 SENSORS
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                HTTP Web + MySQL Decoys
              </div>
            </div>

            <div style={{
              background: 'rgba(10, 16, 12, 0.85)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              padding: '14px',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase' }}>
                Quarantine Custody
              </div>
              <div style={{ fontSize: '1.4rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                SHA-256
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Air-gapped tamper-proof
              </div>
            </div>
          </div>

          {/* Operator Role Selector Tabs */}
          <div>
            <div style={{
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              fontFamily: "'Chakra Petch', sans-serif",
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}>
              Select Operator Clearance Portal:
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: selectedRole === 'admin' ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                  background: selectedRole === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: selectedRole === 'admin' ? '#fbbf24' : 'var(--text-muted)',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Shield size={14} color={selectedRole === 'admin' ? '#fbbf24' : '#888'} />
                <span>ADMINISTRATOR GATEWAY</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('analyst')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 16px',
                  borderRadius: '6px',
                  border: selectedRole === 'analyst' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                  background: selectedRole === 'analyst' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: selectedRole === 'analyst' ? '#34d399' : 'var(--text-muted)',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Activity size={14} color={selectedRole === 'analyst' ? '#34d399' : '#888'} />
                <span>SOC ANALYST GATEWAY</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: The Operator Command Authentication Console */}
        <div ref={loginFormRef} style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            background: 'rgba(6, 11, 8, 0.94)',
            border: selectedRole === 'admin' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '12px',
            padding: '36px 30px',
            backdropFilter: 'blur(20px)',
            boxShadow: selectedRole === 'admin'
              ? '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 158, 11, 0.15)'
              : '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.2)',
            position: 'relative',
          }}>
            {/* Header Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
            }}>
              <div>
                <div style={{
                  fontSize: '0.68rem',
                  fontFamily: "'Chakra Petch', sans-serif",
                  color: 'var(--text-dim)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  SECURITY CLEARANCE LEVEL
                </div>
                <div style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  fontFamily: "'Chakra Petch', sans-serif",
                  color: selectedRole === 'admin' ? '#fbbf24' : '#10b981',
                  letterSpacing: '0.04em',
                  marginTop: '2px',
                }}>
                  {selectedRole === 'admin' ? 'ADMINISTRATOR (ROOT SOC)' : 'SOC THREAT ANALYST'}
                </div>
              </div>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: selectedRole === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: selectedRole === 'admin' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selectedRole === 'admin' ? (
                  <Shield size={18} color="#fbbf24" />
                ) : (
                  <Activity size={18} color="#10b981" />
                )}
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
              }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  fontFamily: "'Chakra Petch', sans-serif",
                }}>
                  Operator Identity
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Call-Sign / ID"
                  required
                  autoComplete="username"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'rgba(3, 7, 5, 0.85)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)')}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                  fontFamily: "'Chakra Petch', sans-serif",
                }}>
                  Security Passcode
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    required
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 14px',
                      background: 'rgba(3, 7, 5, 0.85)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 1-Click Autofill Buttons */}
              <div>
                <div style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-dim)',
                  marginBottom: '6px',
                  fontFamily: "'Chakra Petch', sans-serif",
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  1-Click Demo Credentials:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectRole('admin')}
                    style={{
                      padding: '6px 8px',
                      background: selectedRole === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: selectedRole === 'admin' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      color: selectedRole === 'admin' ? '#fbbf24' : 'var(--text-dim)',
                      fontSize: '0.7rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    👑 argus_admin
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectRole('analyst')}
                    style={{
                      padding: '6px 8px',
                      background: selectedRole === 'analyst' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: selectedRole === 'analyst' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      color: selectedRole === 'analyst' ? '#34d399' : 'var(--text-dim)',
                      fontSize: '0.7rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    🛡️ analyst
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  background: selectedRole === 'admin'
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#020503',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: selectedRole === 'admin'
                    ? '0 0 20px rgba(245, 158, 11, 0.4)'
                    : '0 0 20px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.15s ease',
                  marginTop: '4px',
                }}
              >
                <KeyRound size={16} />
                <span>{loading ? 'AUTHENTICATING ENCLAVE...' : 'ACCESS COMMAND CONSOLE'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.64rem',
              color: 'var(--text-dim)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span>DISA STIG COMPLIANT</span>
              <span>AES-256 GCM SECURED</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Deception Architecture Surface Grid ── */}
      <section style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1280px',
        margin: '24px auto',
        padding: '32px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '0.72rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#10b981',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            // MULTI-PROTOCOL DECEPTION SURFACE //
          </div>
          <h2 style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '1.8rem',
            color: '#ffffff',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            THE 4 EYES OF ARGUS DECEPTION
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: '620px', margin: '8px auto 0 auto' }}>
            High-interaction deception traps deployed at multiple protocol layers to detect adversary reconnaissance and payload deployment in real time.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: '20px',
        }}>
          {/* Card 1: Web Decoy */}
          <div style={{
            background: 'rgba(8, 14, 10, 0.85)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Globe size={20} color="#10b981" />
            </div>
            <div style={{
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#10b981',
              marginBottom: '4px',
            }}>
              PORT 8081 &bull; HTTP / REST
            </div>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.1rem',
              color: '#ffffff',
              marginBottom: '8px',
            }}>
              Web Contractor Portal Decoy
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Realistic mock enterprise contractor portal. Traps SQL injection, unauthorized directory traverses, credential stuffing, and payload uploads.
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '18px',
              paddingTop: '12px',
              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ color: '#10b981' }}>🟢 ARMED &amp; TRAPPING</span>
              <a
                href="/decoy"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#6ee7b7', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Inspect <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Card 2: MySQL Decoy */}
          <div style={{
            background: 'rgba(8, 14, 10, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Database size={20} color="#38bdf8" />
            </div>
            <div style={{
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#38bdf8',
              marginBottom: '4px',
            }}>
              PORT 3306 &bull; WIRE PROTOCOL
            </div>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.1rem',
              color: '#ffffff',
              marginBottom: '8px',
            }}>
              MySQL Protocol Honeypot
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Handcrafted MySQL 8.0 server socket. Intercepts brute-force authentication, simulates believable database tables, and extracts adversary queries.
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '18px',
              paddingTop: '12px',
              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ color: '#38bdf8' }}>🟢 WIRE HOOK ACTIVE</span>
              <span style={{ color: 'var(--text-dim)' }}>FAKE SCHEMAS</span>
            </div>
          </div>

          {/* Card 3: Evidence Locker */}
          <div style={{
            background: 'rgba(8, 14, 10, 0.85)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Lock size={20} color="#f59e0b" />
            </div>
            <div style={{
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#f59e0b',
              marginBottom: '4px',
            }}>
              AIR-GAPPED &bull; FORENSIC CUSTODY
            </div>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.1rem',
              color: '#ffffff',
              marginBottom: '8px',
            }}>
              Quarantine Evidence Vault
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Malicious payloads uploaded by intruders are trapped, quarantined into isolated storage, cryptographically hashed with SHA-256, and chain-of-custody locked.
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '18px',
              paddingTop: '12px',
              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ color: '#f59e0b' }}>🔒 AIR-GAPPED VAULT</span>
              <span style={{ color: 'var(--text-dim)' }}>TAMPER-EVIDENT</span>
            </div>
          </div>

          {/* Card 4: Incident Bot */}
          <div style={{
            background: 'rgba(8, 14, 10, 0.85)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '10px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <Radio size={20} color="#a855f7" />
            </div>
            <div style={{
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#a855f7',
              marginBottom: '4px',
            }}>
              INCIDENT COMMAND &bull; TELEGRAM
            </div>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.1rem',
              color: '#ffffff',
              marginBottom: '8px',
            }}>
              Autonomous Lockdown Bot
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Super Admin root controls, instant incursion push notifications, 1-tap user approval/revocation, and immediate remote emergency lockdown.
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '18px',
              paddingTop: '12px',
              borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span style={{ color: '#a855f7' }}>⚡ REALTIME BROADCAST</span>
              <span style={{ color: 'var(--text-dim)' }}>ID: 6288136999</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: The 4-Stage Autonomous Defense Cycle ── */}
      <section style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1280px',
        margin: '24px auto 48px auto',
        padding: '32px 24px',
        borderTop: '1px solid rgba(16, 185, 129, 0.15)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '0.72rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#10b981',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            // ZERO-LATENCY INCIDENT CONTAINMENT //
          </div>
          <h2 style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '1.8rem',
            color: '#ffffff',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            THE 4-STAGE AUTONOMOUS DEFENSE CYCLE
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}>
          {[
            {
              step: '01',
              title: 'LURE & ENTRAP',
              desc: 'Hostile actor scans perimeter and engages high-interaction HTTP/MySQL decoys.',
              badge: 'DECEPTION LAYER',
            },
            {
              step: '02',
              title: 'SILENT TELEMETRY',
              desc: 'Deep packet inspection records payloads, SQL queries, and tool signatures with zero disruption.',
              badge: 'PANOPTES SENSORS',
            },
            {
              step: '03',
              title: 'FORENSIC LOCKDOWN',
              desc: 'Uploaded artifacts are locked into air-gapped quarantine storage with SHA-256 validation.',
              badge: 'EVIDENCE CUSTODY',
            },
            {
              step: '04',
              title: 'INCIDENT DISPATCH',
              desc: 'Super Administrator receives Telegram alert and can revoke or trigger emergency lockdown in 1 tap.',
              badge: 'ROOT COMMAND',
            },
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'rgba(6, 11, 8, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '20px',
              position: 'relative',
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '1.6rem',
                fontWeight: 700,
                color: 'rgba(16, 185, 129, 0.3)',
                marginBottom: '8px',
              }}>
                {item.step}
              </div>
              <div style={{
                fontSize: '0.62rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#10b981',
                letterSpacing: '0.06em',
                marginBottom: '4px',
              }}>
                {item.badge}
              </div>
              <h4 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.98rem',
                color: '#ffffff',
                marginBottom: '8px',
                letterSpacing: '0.04em',
              }}>
                {item.title}
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        background: 'rgba(2, 5, 3, 0.98)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px',
        textAlign: 'center',
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        letterSpacing: '0.04em',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div style={{ marginBottom: '6px' }}>
          ARGUS PANOPTES &bull; CYBER DECEPTION &amp; INCIDENT COMMAND PLATFORM &bull; LEVEL 5 OPERATIONAL ENCLAVE
        </div>
        <div>
          DISA STIG COMPLIANT &bull; ZERO-TRUST ARCHITECTURE &bull; ALL RIGHTS RESERVED &copy; 2026
        </div>
      </footer>
    </div>
  );
};
