import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Shield,
  Eye,
  EyeOff,
  KeyRound,
  X,
  AlertTriangle,
  CheckCircle,
  Mail,
  RotateCcw,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [modalView, setModalView] = useState<'login' | 'forgot' | 'reset'>('login');

  // Login form state
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Recovery form state
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  // Status feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  const resetModalState = () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(false);
    setModalView('login');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication rejected. Verify authorization credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await api.forgotPassword(recoveryEmail.trim());
      setSuccessMsg(res.detail || 'Recovery code generated.');
      if (res.dev_code) {
        setRecoveryCode(res.dev_code);
      }
      setModalView('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch recovery code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError('Please enter the 6-digit recovery code.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await api.resetPassword({
        email: recoveryEmail.trim(),
        token: recoveryCode.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMsg(res.detail || 'Passcode successfully reset. You may now sign in.');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryCode('');
      setModalView('login');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Verify code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#030708',
      color: '#f1f5f9',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* ── Giant Static Transparent Photographic Background (Does not move on scroll) ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(180deg, rgba(3, 7, 12, 0.38) 0%, rgba(3, 7, 12, 0.62) 65%, rgba(2, 5, 8, 0.88) 100%),
          url('/images/giant_soc_bg.jpg')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        pointerEvents: 'none',
        zIndex: 0,
        filter: 'contrast(1.08) brightness(0.95)',
      }} />

      {/* ── Minimalist Luxury Transparent Header ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(3, 7, 10, 0.45)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
      }}>
        {/* Brand Emblem & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={17} color="#10b981" />
          </div>
          <div style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '1.05rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#ffffff',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
          }}>
            ARGUS PANOPTES
          </div>
        </div>

        {/* Right Header: Single Clean Luxury Operator Login Button */}
        <div>
          <button
            onClick={() => {
              resetModalState();
              setShowLoginModal(true);
            }}
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
              padding: '9px 22px',
              borderRadius: '5px',
              cursor: 'pointer',
              boxShadow: '0 2px 16px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.12)';
              e.currentTarget.style.boxShadow = '0 4px 22px rgba(16, 185, 129, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
              e.currentTarget.style.boxShadow = '0 2px 16px rgba(16, 185, 129, 0.4)';
            }}
          >
            <KeyRound size={13} />
            <span>OPERATOR ACCESS</span>
          </button>
        </div>
      </header>

      {/* ── Main Hero Section (Centered Luxury Layout Matching Reference Image) ── */}
      <section style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          {/* Top Hairline Rule */}
          <div style={{
            width: '100%',
            maxWidth: '480px',
            height: '1px',
            background: 'rgba(255, 255, 255, 0.35)',
            margin: '0 auto 28px auto',
          }} />

          {/* Big Center Display Title */}
          <h1 style={{
            fontFamily: "'Chakra Petch', 'Inter', sans-serif",
            fontStyle: 'italic',
            fontSize: 'clamp(3.4rem, 7.5vw, 5.8rem)',
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '0.03em',
            color: '#ffffff',
            textTransform: 'uppercase',
            margin: '0 0 16px 0',
            textShadow: '0 4px 28px rgba(0, 0, 0, 0.9), 0 2px 10px rgba(0, 0, 0, 0.95)',
          }}>
            ARGUS<br />PANOPTES
          </h1>

          {/* Centered Italic Subtitle */}
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontStyle: 'italic',
            fontSize: 'clamp(1rem, 2vw, 1.3rem)',
            fontWeight: 400,
            color: '#e2e8f0',
            margin: '0 0 26px 0',
            letterSpacing: '0.02em',
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.9)',
          }}>
            Autonomous cyber deception &amp; sovereign threat neutralization
          </p>

          {/* Bottom Hairline Rule */}
          <div style={{
            width: '100%',
            maxWidth: '480px',
            height: '1px',
            background: 'rgba(255, 255, 255, 0.35)',
            margin: '0 auto 24px auto',
          }} />

          {/* Centered Navigation Menu */}
          <nav style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '0.85rem',
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#ffffff',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.85)',
            marginBottom: '36px',
          }}>
            <a
              href="#overview"
              style={{ color: '#ffffff', textDecoration: 'none', transition: 'color 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#ffffff')}
            >
              HOME
            </a>
            <span style={{ opacity: 0.4 }}>|</span>
            <a
              href="#capabilities"
              style={{ color: '#ffffff', textDecoration: 'none', transition: 'color 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#ffffff')}
            >
              MISSION
            </a>
            <span style={{ opacity: 0.4 }}>|</span>
            <a
              href="#capabilities"
              style={{ color: '#ffffff', textDecoration: 'none', transition: 'color 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#ffffff')}
            >
              CAPABILITIES
            </a>
            <span style={{ opacity: 0.4 }}>|</span>
            <a
              href="#capabilities"
              style={{ color: '#ffffff', textDecoration: 'none', transition: 'color 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#ffffff')}
            >
              COMPLIANCE
            </a>
            <span style={{ opacity: 0.4 }}>|</span>
            <button
              onClick={() => {
                resetModalState();
                setShowLoginModal(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#34d399',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                letterSpacing: 'inherit',
                cursor: 'pointer',
                padding: 0,
                textTransform: 'uppercase',
                textShadow: '0 0 12px rgba(16, 185, 129, 0.5)',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#10b981')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#34d399')}
            >
              OPERATOR ACCESS
            </button>
          </nav>

          {/* Downward Caret Arrow */}
          <a
            href="#capabilities"
            aria-label="Scroll to capabilities"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.color = '#10b981';
              e.currentTarget.style.transform = 'translateY(3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            ▼
          </a>
        </div>
      </section>

      {/* ── Capabilities Section (Scrolls smoothly over the static background) ── */}
      <section id="capabilities" style={{
        position: 'relative',
        zIndex: 10,
        background: 'rgba(4, 8, 11, 0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '72px 32px 80px 32px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '28px',
          }}>
            {/* Capability 1 */}
            <div style={{
              background: 'rgba(8, 14, 18, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <img
                src="/images/cyber_grid.jpg"
                alt="Active surface deception grid"
                style={{
                  width: '100%',
                  height: '180px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.8) contrast(1.1)',
                }}
              />
              <div style={{ padding: '24px' }}>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Active Surface Deception
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  High-interaction honey-grids intercept reconnaissance and credential attacks before production boundaries can be engaged.
                </p>
              </div>
            </div>

            {/* Capability 2 */}
            <div style={{
              background: 'rgba(8, 14, 18, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <img
                src="/images/soc_analyst.jpg"
                alt="Air-gapped forensic custody operations"
                style={{
                  width: '100%',
                  height: '180px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.8) contrast(1.1)',
                }}
              />
              <div style={{ padding: '24px' }}>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Air-Gapped Forensic Custody
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  Hostile artifacts are trapped into isolated quarantine vaults with cryptographic SHA-256 chain-of-custody tracking.
                </p>
              </div>
            </div>

            {/* Capability 3 */}
            <div style={{
              background: 'rgba(8, 14, 18, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)')}
            >
              <img
                src="/images/defense_terminal.jpg"
                alt="Incident command and telemetric synthesis"
                style={{
                  width: '100%',
                  height: '180px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.8) contrast(1.1)',
                }}
              />
              <div style={{ padding: '24px' }}>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Incident Containment
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                  Immediate telemetric synthesis, root authority control, and single-tap emergency lockdown response.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Minimalist Clean Footer ── */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        background: 'rgba(2, 5, 3, 0.98)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.72rem',
        color: 'var(--text-dim)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div>ARGUS PANOPTES &bull; SOVEREIGN CYBER DEFENSE ENCLAVE</div>
        <div>AUTHORIZED ACCESS ONLY &copy; 2026</div>
      </footer>

      {/* ── Separate Dedicated Login & Recovery Modal ── */}
      {showLoginModal && (
        <div
          onClick={() => setShowLoginModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
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
              maxWidth: '430px',
              background: '#070c09',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '12px',
              padding: '36px 32px',
              boxShadow: '0 24px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(16, 185, 129, 0.15)',
              position: 'relative',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowLoginModal(false)}
              aria-label="Close authentication modal"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                color: 'var(--text-dim)',
                width: '32px',
                height: '32px',
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

            {/* Modal View 1: Unified Sign In */}
            {modalView === 'login' && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: '0.65rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#10b981',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}>
                    // SECURE OPERATOR CLEARANCE //
                  </div>
                  <h2 style={{
                    margin: 0,
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    Operator Sign In
                  </h2>
                </div>

                {successMsg && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '18px',
                  }}>
                    <CheckCircle size={15} />
                    <span>{successMsg}</span>
                  </div>
                )}

                {error && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '18px',
                    lineHeight: 1.45,
                  }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                      fontFamily: "'Chakra Petch', sans-serif",
                    }}>
                      Username / Call-Sign
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter operator username"
                      required
                      autoFocus
                      autoComplete="username"
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        background: 'rgba(3, 7, 5, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-muted)',
                        fontFamily: "'Chakra Petch', sans-serif",
                      }}>
                        Password / Passcode
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setSuccessMsg(null);
                          setModalView('forgot');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#10b981',
                          fontSize: '0.7rem',
                          fontFamily: "'Chakra Petch', sans-serif",
                          letterSpacing: '0.04em',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'opacity 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        Forgot passcode?
                      </button>
                    </div>

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
                          background: 'rgba(3, 7, 5, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.88rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.15s ease',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
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

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '13px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#040706',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
                      transition: 'all 0.15s ease',
                      marginTop: '6px',
                    }}
                  >
                    <KeyRound size={15} />
                    <span>{loading ? 'AUTHENTICATING ENCLAVE...' : 'AUTHENTICATE & ENTER'}</span>
                  </button>
                </form>
              </div>
            )}

            {/* Modal View 2: Forgot Password Request */}
            {modalView === 'forgot' && (
              <div>
                <div style={{ marginBottom: '22px' }}>
                  <div style={{
                    fontSize: '0.65rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#10b981',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}>
                    // PASSCODE RECOVERY //
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
                    Recover Operator Passcode
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                    Enter your registered email address to receive a secure 6-digit recovery code.
                  </p>
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

                <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                      fontFamily: "'Chakra Petch', sans-serif",
                    }}>
                      Registered Email Address
                    </label>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="operator@argus-defense.local"
                      required
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        background: 'rgba(3, 7, 5, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#040706',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
                      transition: 'all 0.15s ease',
                      marginTop: '6px',
                    }}
                  >
                    <Mail size={15} />
                    <span>{loading ? 'DISPATCHING CODE...' : 'DISPATCH RECOVERY CODE'}</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setModalView('login');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '0.75rem',
                        fontFamily: "'Chakra Petch', sans-serif",
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                      &larr; Back to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Modal View 3: Reset Password with Code */}
            {modalView === 'reset' && (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    fontSize: '0.65rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#10b981',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}>
                    // VERIFY &amp; RESET //
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
                    Set New Passcode
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
                    Enter the code dispatched to <strong style={{ color: '#fff' }}>{recoveryEmail}</strong>.
                  </p>
                </div>

                {successMsg && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                  }}>
                    <CheckCircle size={14} />
                    <span>{successMsg}</span>
                  </div>
                )}

                {error && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                  }}>
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                      6-Digit Recovery Code
                    </label>
                    <input
                      type="text"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="e.g. 549210"
                      required
                      autoFocus
                      maxLength={12}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(3, 7, 5, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#10b981',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.95rem',
                        letterSpacing: '0.15em',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
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
                      New Passcode (Min 8 characters)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••••••"
                        required
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
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
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
                        {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
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
                      Confirm New Passcode
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      required
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
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#040706',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)',
                      transition: 'all 0.15s ease',
                      marginTop: '4px',
                    }}
                  >
                    <RotateCcw size={15} />
                    <span>{loading ? 'RESETTING PASSCODE...' : 'RESET PASSCODE & SIGN IN'}</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccessMsg(null);
                        setModalView('login');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '0.75rem',
                        fontFamily: "'Chakra Petch', sans-serif",
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                      &larr; Back to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}
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
