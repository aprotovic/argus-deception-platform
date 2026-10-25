import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Eye,
  EyeOff,
  KeyRound,
  X,
  ExternalLink,
  Activity,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('argus_admin');
  const [password, setPassword] = useState<string>('ArgusAdmin2026!ChangeMe');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'analyst'>('admin');

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLoginModal) {
        setShowLoginModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLoginModal]);

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
      setError(err.message || 'Authentication rejected. Verify authorization credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#040706',
      color: '#f1f5f9',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* ── Subtle Ambient Backdrop Grid ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(16, 185, 129, 0.05) 0%, transparent 40%),
          radial-gradient(circle at 85% 80%, rgba(5, 150, 105, 0.04) 0%, transparent 45%),
          linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Minimalist Luxury Header ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(4, 7, 6, 0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
      }}>
        {/* Brand Emblem & Identification */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={18} color="#10b981" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              ARGUS PANOPTES
              <span style={{
                fontSize: '0.62rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                color: '#10b981',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}>
                DEFENSE ENCLAVE
              </span>
            </div>
            <div style={{
              fontSize: '0.65rem',
              color: 'var(--text-dim)',
              letterSpacing: '0.04em',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              RESTRICTED CLASSIFICATION &bull; ZERO-TRUST DECEPTION GRID
            </div>
          </div>
        </div>

        {/* Right Header Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Subtle Live Decoy Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.7rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-muted)',
            padding: '6px 12px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 6px #10b981',
            }} />
            <span>DECEPTION ACTIVE</span>
          </div>

          <a
            href="/decoy"
            target="_blank"
            rel="noopener noreferrer"
            title="External Decoy Surface Traps"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: '#94a3b8',
              padding: '6px 12px',
              borderRadius: '4px',
              textDecoration: 'none',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            }}
          >
            <span>DECOY SURFACE</span>
            <ExternalLink size={12} />
          </a>

          {/* Luxury Login Trigger Button */}
          <button
            onClick={() => setShowLoginModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              fontFamily: "'Chakra Petch', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#040706',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '5px',
              cursor: 'pointer',
              boxShadow: '0 2px 14px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
              e.currentTarget.style.boxShadow = '0 2px 14px rgba(16, 185, 129, 0.3)';
            }}
          >
            <KeyRound size={13} />
            <span>OPERATOR ACCESS</span>
          </button>
        </div>
      </header>

      {/* ── Main Hero Section: Minimal Luxury Split ── */}
      <main style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '64px 32px 48px 32px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '56px',
          alignItems: 'center',
          marginBottom: '80px',
        }}>
          {/* Left Column: Restrained Luxury Editorial */}
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.68rem',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#10b981',
              marginBottom: '20px',
            }}>
              <span>// CLASSIFIED DEFENSE BRIEFING</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>&bull;</span>
              <span style={{ color: 'var(--text-dim)' }}>STIG COMPLIANT</span>
            </div>

            <h1 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '0.02em',
              color: '#ffffff',
              marginBottom: '22px',
              textTransform: 'uppercase',
            }}>
              Autonomous Threat Deception &amp; Sovereign Defense
            </h1>

            <p style={{
              fontSize: '0.94rem',
              lineHeight: 1.7,
              color: '#94a3b8',
              marginBottom: '32px',
              maxWidth: '520px',
            }}>
              Designed for critical enterprise perimeters. ARGUS Panoptes operates sovereign deception grids that invisibly entrap hostile actors, quarantine zero-day payloads, and deliver decisive incident intelligence without exposing core production assets.
            </p>

            {/* Clean CTA & Security Clearance Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#040706',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>ENTER COMMAND CONSOLE</span>
                <ArrowRight size={15} />
              </button>

              <div style={{
                fontSize: '0.72rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-dim)',
                lineHeight: 1.4,
              }}>
                <div>SECURE ENCLAVE</div>
                <div style={{ color: '#64748b' }}>REQUIRES VERIFIED OPERATOR KEY</div>
              </div>
            </div>
          </div>

          {/* Right Column: Real SOC Operations Photography Showcase */}
          <div style={{ position: 'relative' }}>
            <div style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.1)',
              background: '#070b09',
              position: 'relative',
            }}>
              {/* Real High-Resolution SOC Operations Room Image */}
              <img
                src="/images/soc_command.jpg"
                alt="Security Operations Center Command Center"
                style={{
                  width: '100%',
                  height: '420px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'contrast(1.08) brightness(0.85)',
                }}
              />

              {/* Refined Dark Vignette Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(4, 7, 6, 0.2) 0%, rgba(4, 7, 6, 0.85) 100%)',
                pointerEvents: 'none',
              }} />

              {/* Floating Real-Time Operational Telemetry Card */}
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                background: 'rgba(8, 14, 11, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Activity size={16} color="#10b981" />
                  </div>
                  <div>
                    <div style={{
                      fontSize: '0.78rem',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '0.04em',
                    }}>
                      PANOPTES SURVEILLANCE GRID
                    </div>
                    <div style={{
                      fontSize: '0.65rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#6ee7b7',
                    }}>
                      CONTINUOUS HONEY-GRID INGESTION
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.68rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  textAlign: 'right',
                  color: 'var(--text-muted)',
                }}>
                  <div style={{ color: '#10b981', fontWeight: 600 }}>0 FALSE POSITIVES</div>
                  <div>ZERO-TRUST BOUNDARY</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Three Discreet Pillars (Luxury & Confidentiality) ── */}
        <section style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '56px',
          marginBottom: '64px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
          }}>
            {/* Pillar 1: High Interaction Deception */}
            <div style={{
              background: 'rgba(8, 12, 10, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.35)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <img
                src="/images/cyber_grid.jpg"
                alt="Cyber defense infrastructure"
                style={{
                  width: '100%',
                  height: '160px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.75) contrast(1.1)',
                }}
              />
              <div style={{ padding: '22px' }}>
                <div style={{
                  fontSize: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#10b981',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}>
                  01 // ACTIVE SURFACE
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '0.03em',
                }}>
                  Multi-Protocol Deception
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  High-interaction HTTP and wire-level MySQL honeypots intercept adversarial discovery and credential extraction before real infrastructure is touched.
                </p>
              </div>
            </div>

            {/* Pillar 2: Forensic Custody */}
            <div style={{
              background: 'rgba(8, 12, 10, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <img
                src="/images/soc_analyst.jpg"
                alt="Security analyst operations"
                style={{
                  width: '100%',
                  height: '160px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.75) contrast(1.1)',
                }}
              />
              <div style={{ padding: '22px' }}>
                <div style={{
                  fontSize: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#fbbf24',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}>
                  02 // FORENSIC CUSTODY
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '0.03em',
                }}>
                  Air-Gapped Quarantine
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  Hostile payloads and malware artifacts are isolated into cryptographic vaults with SHA-256 fingerprinting and strict chain-of-custody tracking.
                </p>
              </div>
            </div>

            {/* Pillar 3: Incident Command */}
            <div style={{
              background: 'rgba(8, 12, 10, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <img
                src="/images/defense_terminal.jpg"
                alt="Defense terminal command"
                style={{
                  width: '100%',
                  height: '160px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.75) contrast(1.1)',
                }}
              />
              <div style={{ padding: '22px' }}>
                <div style={{
                  fontSize: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#38bdf8',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}>
                  03 // INCIDENT COMMAND
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '0.03em',
                }}>
                  Autonomous Telegram Containment
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  Real-time intrusion broadcast, Super Admin root authority, interactive analyst approvals, and one-tap emergency global platform lockdown.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Discreet Security Footer ── */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        background: 'rgba(2, 5, 3, 0.98)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '24px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.68rem',
        color: 'var(--text-dim)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div>
          ARGUS PANOPTES &bull; SOVEREIGN CYBER DEFENSE ENCLAVE &bull; STIG / SOC 2 ALIGNED
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>ZERO-TRUST BOUNDARY</span>
          <span>DISA STIG COMPLIANT</span>
          <span style={{ color: '#10b981' }}>SYSTEM STATUS: NOMINAL</span>
        </div>
      </footer>

      {/* ── Separate Dedicated Login Modal / Overlay ── */}
      {showLoginModal && (
        <div
          onClick={() => setShowLoginModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(16px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Modal Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#070c09',
              border: selectedRole === 'admin' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              padding: '32px 28px',
              boxShadow: selectedRole === 'admin'
                ? '0 24px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(245, 158, 11, 0.15)'
                : '0 24px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(16, 185, 129, 0.18)',
              position: 'relative',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowLoginModal(false)}
              aria-label="Close authentication modal"
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: 'var(--text-dim)',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-dim)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <X size={15} />
            </button>

            {/* Header */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{
                fontSize: '0.65rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: selectedRole === 'admin' ? '#fbbf24' : '#10b981',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                // SECURE OPERATOR CLEARANCE //
              </div>
              <h2 style={{
                margin: 0,
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {selectedRole === 'admin' ? 'Administrator Enclave' : 'SOC Analyst Gateway'}
              </h2>
            </div>

            {/* Role Switcher */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '20px',
              padding: '4px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <button
                type="button"
                onClick={() => handleSelectRole('admin')}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: selectedRole === 'admin' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid transparent',
                  background: selectedRole === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  color: selectedRole === 'admin' ? '#fbbf24' : 'var(--text-dim)',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                ADMINISTRATOR
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('analyst')}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: selectedRole === 'analyst' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                  background: selectedRole === 'analyst' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: selectedRole === 'analyst' ? '#34d399' : 'var(--text-dim)',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                SOC ANALYST
              </button>
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
                marginBottom: '18px',
              }}>
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.7rem',
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
                    padding: '10px 14px',
                    background: 'rgba(3, 7, 5, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = selectedRole === 'admin' ? '#f59e0b' : '#10b981')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.7rem',
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
                      padding: '10px 38px 10px 14px',
                      background: 'rgba(3, 7, 5, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = selectedRole === 'admin' ? '#f59e0b' : '#10b981')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Quick Fill Preset Pills */}
              <div>
                <div style={{
                  fontSize: '0.65rem',
                  color: 'var(--text-dim)',
                  marginBottom: '6px',
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: 'uppercase',
                }}>
                  Autofill Operator Profile:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectRole('admin')}
                    style={{
                      padding: '5px 8px',
                      background: selectedRole === 'admin' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: selectedRole === 'admin' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px',
                      color: selectedRole === 'admin' ? '#fbbf24' : 'var(--text-dim)',
                      fontSize: '0.68rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                    }}
                  >
                    argus_admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectRole('analyst')}
                    style={{
                      padding: '5px 8px',
                      background: selectedRole === 'analyst' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: selectedRole === 'analyst' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '4px',
                      color: selectedRole === 'analyst' ? '#34d399' : 'var(--text-dim)',
                      fontSize: '0.68rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      cursor: 'pointer',
                    }}
                  >
                    analyst
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: selectedRole === 'admin'
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#040706',
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: selectedRole === 'admin'
                    ? '0 0 16px rgba(245, 158, 11, 0.35)'
                    : '0 0 16px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                  marginTop: '4px',
                }}
              >
                <KeyRound size={15} />
                <span>{loading ? 'AUTHENTICATING ENCLAVE...' : 'AUTHENTICATE & ENTER'}</span>
              </button>
            </form>

            <div style={{
              marginTop: '18px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.62rem',
              color: 'var(--text-dim)',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <span>DISA STIG COMPLIANT</span>
              <span>AES-256 ENCRYPTION</span>
            </div>
          </div>
        </div>
      )}

      {/* Animation helper */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
