import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Shield,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  X,
  AlertTriangle,
  CheckCircle,
  Mail,
  RotateCcw,
  Search,
  Database,
  Link2Off,
  Crosshair,
  Check,
  Lock,
  Activity,
  Send,
  ChevronRight,
  Cpu,
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
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(120);
  const [operatorCallSign, setOperatorCallSign] = useState<string>('');
  const [operatorEmail, setOperatorEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);

  // Status feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Interactive briefing form state
  const [briefingEmail, setBriefingEmail] = useState<string>('');
  const [briefingName, setBriefingName] = useState<string>('');
  const [briefingOrg, setBriefingOrg] = useState<string>('');
  const [briefingRole, setBriefingRole] = useState<string>('');
  const [briefingNodes, setBriefingNodes] = useState<string>('50 - 500 Nodes');
  const [briefingSubmitted, setBriefingSubmitted] = useState<boolean>(false);

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState<string>('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState<boolean>(false);

  // Decreasing 30-second countdown timer for passcode recovery code
  useEffect(() => {
    if (modalView !== 'reset') return;
    setCountdown(120);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [modalView, devCodeHint]);

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
    setDevCodeHint(null);
    setModalView('login');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await login(username, password);
      setShowLoginModal(false);
    } catch (err: any) {
      setError(err.message || 'Authentication rejected. Verify authorization credentials.');
      setShowLoginModal(true);
      setPassword(''); // Clear invalid passcode so operator can immediately re-enter
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
    setDevCodeHint(null);
    setLoading(true);

    try {
      const res = await api.forgotPassword(recoveryEmail.trim());
      setSuccessMsg(res.detail || 'Verification code dispatched to your verified security channel.');
      setRecoveryCode(''); // Ready for manual entry or instant autofill
      if (res.username) setOperatorCallSign(res.username);
      if (res.email) setOperatorEmail(res.email);
      const code = res.code || res.dev_code;
      if (code) {
        setDevCodeHint(code);
      }
      setModalView('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError('Please enter the 6-digit verification code.');
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
      setSuccessMsg(res.detail || 'Passcode successfully reset! You may now sign in.');
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryCode('');
      setDevCodeHint(null);
      setModalView('login');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Verify code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBriefingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefingEmail.trim()) return;
    setBriefingSubmitted(true);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterSubmitted(true);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#04080e',
      color: '#f1f5f9',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* ── Fixed Static Transparent Photographic Background ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(180deg, rgba(4, 9, 15, 0.45) 0%, rgba(4, 9, 15, 0.7) 60%, rgba(4, 8, 14, 0.95) 100%),
          url('/images/giant_soc_bg.jpg')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        pointerEvents: 'none',
        zIndex: 0,
        filter: 'contrast(1.05) brightness(0.9)',
      }} />

      {/* ── Top Navbar (Acalvio-style Clean Enterprise Header) ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(5, 11, 19, 0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
      }}>
        {/* Brand Emblem & Clean Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '7px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 182, 212, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(16, 185, 129, 0.25)',
          }}>
            <Shield size={19} color="#10b981" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.12rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: '#ffffff',
              lineHeight: 1.1,
            }}>
              ARGUS PANOPTES
            </div>
            <div style={{
              fontSize: '0.62rem',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#38bdf8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              Autonomous Threat Deception Platform
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          fontSize: '0.82rem',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          color: '#94a3b8',
        }}>
          <a href="#hero" style={{ color: '#ffffff', textDecoration: 'none', transition: 'color 0.15s ease' }}>Platform</a>
          <a href="#four-pillars" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.15s ease' }}>Four Pillars</a>
          <a href="#deep-dive" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.15s ease' }}>Capabilities</a>
          <a href="#operational-ai" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.15s ease' }}>Operational AI</a>
          <a href="#preemptive-defense" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.15s ease' }}>Preemptive Defense</a>
          <a href="#schedule-briefing" style={{ color: '#cbd5e1', textDecoration: 'none', transition: 'color 0.15s ease' }}>Briefing</a>
        </nav>

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
              fontSize: '0.78rem',
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
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(16, 185, 129, 0.6)';
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

      {/* ── Main Content Container ── */}
      <main style={{ position: 'relative', zIndex: 10 }}>

        {/* ── 1. Hero Section (Acalvio-style Left Copy + Right Cyber Exposure Showcase) ── */}
        <section id="hero" style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '64px 32px 60px 32px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
            gap: '48px',
            alignItems: 'center',
          }}>
            {/* Left Column: Headline, Badge, Copy & Dual CTAs */}
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: '0.74rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '20px',
              }}>
                <Shield size={13} />
                <span>SHADOWPLEX-CLASS ADVANCED THREAT DEFENSE</span>
              </div>

              <h1 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: 'clamp(2.4rem, 4.4vw, 3.6rem)',
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '0.02em',
                color: '#ffffff',
                marginBottom: '20px',
                textTransform: 'uppercase',
              }}>
                Autonomous Threat Deception &amp; Sovereign Active Defense
              </h1>

              <p style={{
                fontSize: '1rem',
                lineHeight: 1.7,
                color: '#cbd5e1',
                marginBottom: '32px',
                maxWidth: '540px',
              }}>
                Combines breakthrough autonomous deception grids with zero-false-positive telemetry. Entrap adversaries early across IT, cloud, and database surfaces before production assets can be engaged.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    resetModalState();
                    setShowLoginModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '13px 28px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#040706',
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <KeyRound size={15} />
                  <span>OPERATOR ACCESS</span>
                </button>

                <a
                  href="#schedule-briefing"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    color: '#ffffff',
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#38bdf8';
                    e.currentTarget.style.color = '#38bdf8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                >
                  <span>SCHEDULE A BRIEFING</span>
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>

            {/* Right Column: Visual Threat Exposure Box with Live Decoy Metrics */}
            <div style={{ position: 'relative' }}>
              <div style={{
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.15)',
                background: '#071018',
                position: 'relative',
              }}>
                <img
                  src="/images/soc_command.jpg"
                  alt="ARGUS Panoptes Command Console"
                  style={{
                    width: '100%',
                    height: '380px',
                    objectFit: 'cover',
                    display: 'block',
                    filter: 'contrast(1.1) brightness(0.85)',
                  }}
                />

                {/* Glassmorphic Overlay Badge on the Image */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(6, 13, 22, 0.3) 0%, rgba(6, 13, 22, 0.85) 100%)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      fontSize: '0.72rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#10b981',
                    }}>
                      <Activity size={13} />
                      <span>DECEPTION MESH: ARMED</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      <Lock size={12} color="#38bdf8" />
                      <span>DISA STIG ENCLAVE</span>
                    </div>
                  </div>

                  {/* 3 Metric Pills */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    background: 'rgba(6, 14, 24, 0.8)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, color: '#10b981' }}>
                        0%
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        False Positives
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div style={{ fontSize: '1.2rem', fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, color: '#38bdf8' }}>
                        100%
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Quarantine Custody
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, color: '#f59e0b' }}>
                        &lt;45ms
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        Telegram Alert
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Strategic Navy Ribbon (Acalvio Screenshot 1 Callout Banner) ── */}
        <section style={{
          background: 'linear-gradient(180deg, #0a1626 0%, #071220 100%)',
          borderTop: '1px solid rgba(56, 189, 248, 0.2)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            <h2 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '14px',
              letterSpacing: '0.02em',
            }}>
              Advanced attackers rely on stealth. An Advanced Threat Defense exposes their tactics early.
            </h2>
            <p style={{
              fontSize: '0.92rem',
              lineHeight: 1.7,
              color: '#94a3b8',
              marginBottom: '24px',
            }}>
              Dense decoys, shadow breadcrumbs, and automated honeypots surface unauthorized attacker behavior during reconnaissance, lateral movement, and privilege escalation—before they can escalate into breaches.
            </p>
            <a
              href="#deep-dive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '5px',
                background: '#dc2626',
                color: '#ffffff',
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                boxShadow: '0 2px 14px rgba(220, 38, 38, 0.4)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
            >
              <span>Explore the Solution Guide</span>
              <ChevronRight size={14} />
            </a>
          </div>
        </section>

        {/* ── 3. Four Pillars of ARGUS Advanced Threat Defense (Screenshot 1 2x2 Grid) ── */}
        <section id="four-pillars" style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '80px 32px 72px 32px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <h2 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: 'clamp(1.8rem, 3.2vw, 2.5rem)',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Four Pillars of ARGUS Advanced Threat Defense
            </h2>
            <p style={{ fontSize: '0.92rem', color: '#94a3b8', maxWidth: '640px', margin: '0 auto' }}>
              Built specifically to detect and neutralize adversarial tactics before production compromise occurs.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '28px',
          }}>
            {/* Pillar 1 */}
            <div style={{
              background: 'rgba(8, 17, 28, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '10px',
              padding: '32px 28px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#38bdf8',
              }}>
                <Search size={22} />
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '10px',
                letterSpacing: '0.03em',
              }}>
                Detect Early APT and AI Reconnaissance
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                Surface network scanning, automated tool enumeration, and credential harvesting attempts targeting your perimeter before actual production infrastructure is mapped.
              </p>
            </div>

            {/* Pillar 2 */}
            <div style={{
              background: 'rgba(8, 17, 28, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '10px',
              padding: '32px 28px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#10b981',
              }}>
                <Database size={22} />
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '10px',
                letterSpacing: '0.03em',
              }}>
                Detect Lateral Movement and Privilege Abuse
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                Expose credential misuse, pass-the-hash attacks, and lateral hops across IT and Cloud environments by baiting hostile actors into synthetic MySQL and HTTP honey-grids.
              </p>
            </div>

            {/* Pillar 3 */}
            <div style={{
              background: 'rgba(8, 17, 28, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '10px',
              padding: '32px 28px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#ef4444',
              }}>
                <Link2Off size={22} />
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '10px',
                letterSpacing: '0.03em',
              }}>
                Disrupt AI-Driven Attack Chains
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                Deploy dynamic canary credentials and poison hostile AI scanners with synthetic honeytokens, breaking automated multi-stage penetration cycles before privilege escalation.
              </p>
            </div>

            {/* Pillar 4 */}
            <div style={{
              background: 'rgba(8, 17, 28, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '10px',
              padding: '32px 28px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#f59e0b',
              }}>
                <Crosshair size={22} />
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '10px',
                letterSpacing: '0.03em',
              }}>
                Map Early Threat Activity to MITRE ATT&amp;CK
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                Correlate incoming malicious interactions against MITRE matrices (T1595, T1078, T1021) in sub-second timeframes, delivering decisive threat intel and root Telegram lockdown containment.
              </p>
            </div>
          </div>
        </section>

        {/* ── 4. Callout Ribbon: Explore Threat Defense in Action (Screenshot 1) ── */}
        <section style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
          borderTop: '1px solid rgba(56, 189, 248, 0.3)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
          padding: '40px 32px',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.45rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Explore Advanced Threat Defense In Action
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '20px' }}>
              Find out how ARGUS autonomous deception detects APTs, AI-driven attacks, and advanced threat actors early across IT, cloud, and DB environments before damage occurs.
            </p>
            <button
              onClick={() => {
                resetModalState();
                setShowLoginModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '5px',
                background: '#ffffff',
                color: '#0a1626',
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 14px rgba(255, 255, 255, 0.3)',
              }}
            >
              <span>See Live Telemetry In Action</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </section>

        {/* ── 5. Alternating Zig-Zag Deep-Dive Walkthrough (Screenshot 2) ── */}
        <section id="deep-dive" style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '88px 32px 72px 32px',
        }}>
          {/* Deep-Dive Row 1: Detect Early Reconnaissance */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '56px',
            alignItems: 'center',
            marginBottom: '80px',
          }}>
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              boxShadow: '0 18px 45px rgba(0, 0, 0, 0.8)',
            }}>
              <img
                src="/images/cyber_grid.jpg"
                alt="Early Reconnaissance Interception"
                style={{
                  width: '100%',
                  height: '320px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'contrast(1.08) brightness(0.9)',
                }}
              />
            </div>
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                // PILLAR 01: PERIMETER SURFACE TRAPS //
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.65rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '16px',
                textTransform: 'uppercase',
              }}>
                Detect Early APT and AI Reconnaissance
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: '20px' }}>
                Hostile reconnaissance scanners map IP ranges and test exposed endpoints. ARGUS deploys lightweight high-interaction HTTP honeypots that entrap scanners before legitimate services are exposed.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Uncover port discovery, HTTP banner probing, and vulnerability scans across perimeter zones.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Intercept automated toolchains (Nikto, SQLMap, Nuclei, DirBuster) deterministically.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Capture source IP geolocation, headers, and payloads with zero production downtime.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Deep-Dive Row 2: Detect Lateral Movement & Privilege Abuse */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '56px',
            alignItems: 'center',
            marginBottom: '80px',
          }}>
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#10b981',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                // PILLAR 02: DATABASE &amp; CREDENTIAL TRAPS //
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.65rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '16px',
                textTransform: 'uppercase',
              }}>
                Detect Lateral Movement and Privilege Abuse
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: '20px' }}>
                Once inside a network, adversaries traverse subnet boundaries using stolen credentials. ARGUS injects synthetic MySQL honeypots on port 3306 and seeded canary credentials.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Expose credential reuse and privilege escalation attempts before databases are touched.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Trap SQL injection, schema enumeration, and rogue data dumps in simulated sandboxes.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Force adversaries to waste operational hours attacking synthetic dummy targets.</span>
                </li>
              </ul>
            </div>
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              boxShadow: '0 18px 45px rgba(0, 0, 0, 0.8)',
            }}>
              <img
                src="/images/defense_terminal.jpg"
                alt="Lateral Movement Detection"
                style={{
                  width: '100%',
                  height: '320px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'contrast(1.08) brightness(0.9)',
                }}
              />
            </div>
          </div>

          {/* Deep-Dive Row 3: Disrupt AI-Driven Attack Chains */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '56px',
            alignItems: 'center',
            marginBottom: '80px',
          }}>
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              boxShadow: '0 18px 45px rgba(0, 0, 0, 0.8)',
            }}>
              <img
                src="/images/giant_cyber_ops.jpg"
                alt="Disrupt AI-Driven Attack Chains"
                style={{
                  width: '100%',
                  height: '320px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'contrast(1.08) brightness(0.9)',
                }}
              />
            </div>
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#ef4444',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                // PILLAR 03: AUTONOMOUS INTERCEPTION //
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.65rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '16px',
                textTransform: 'uppercase',
              }}>
                Disrupt AI-Driven Attack Chains
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: '20px' }}>
                Next-generation automated exploits rapidly chain reconnaissance to payload execution. ARGUS breaks automated multi-stage pipelines with deceptive response poisoning and canary triggers.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Deploy adaptive deception assets that dynamically mimic internal active directory hosts.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Force automated attack scripts to engage fake targets, wasting computational resources.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Inject canary artifacts into quarantined isolation vaults with SHA-256 custody logs.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Deep-Dive Row 4: Map Early Threat Activity to MITRE ATT&CK */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '56px',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '0.75rem',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#f59e0b',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                // PILLAR 04: MITRE ATT&amp;CK CORRELATION //
              </div>
              <h3 style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.65rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '16px',
                textTransform: 'uppercase',
              }}>
                Map Early Threat Activity to MITRE ATT&amp;CK
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.65, marginBottom: '20px' }}>
                Every honeypot touch is automatically mapped against the MITRE ATT&CK framework, giving SOC analysts instant clarity on adversary tactics, techniques, and procedures (TTPs).
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Correlate detected behaviors by MITRE ATT&CK TTPs for immediate forensic review.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Assess progression across Initial Access, Discovery, Lateral Traversal, and Exfiltration.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.84rem', color: '#e2e8f0' }}>
                  <Check size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Trigger one-touch lockdown commands via authenticated Telegram Incident Command Bot.</span>
                </li>
              </ul>
            </div>
            <div style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              boxShadow: '0 18px 45px rgba(0, 0, 0, 0.8)',
            }}>
              <img
                src="/images/soc_analyst.jpg"
                alt="MITRE ATT&CK Threat Mapping"
                style={{
                  width: '100%',
                  height: '320px',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'contrast(1.08) brightness(0.9)',
                }}
              />
            </div>
          </div>
        </section>

        {/* ── 6. Horizontal Ribbon: Comprehensive Deception (Screenshot 2) ── */}
        <section style={{
          background: '#071220',
          borderTop: '1px solid rgba(56, 189, 248, 0.2)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          padding: '44px 32px',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: '980px', margin: '0 auto' }}>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '10px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Comprehensive Deception for Modern Threats
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
              Leverage high-interaction deception surfaces for IT, Database, Web Ingestion, and Cloud environments. Deploy decoys, breadcrumbs, and honeytokens across credential stores, server networks, and perimeter ingress.
            </p>
          </div>
        </section>

        {/* ── 7. Operationalizing Deception with AI (Screenshot 2 Pipeline) ── */}
        <section id="operational-ai" style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '80px 32px 72px 32px',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: 'clamp(1.8rem, 3.2vw, 2.4rem)',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}>
            Operationalizing Deception with AI
          </h2>
          <p style={{ fontSize: '0.92rem', color: '#94a3b8', maxWidth: '680px', margin: '0 auto 48px auto' }}>
            Transforming deception from a static honeypot into an automated, self-healing telemetry pipeline.
          </p>

          {/* 5-Step Pipeline Visual */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '40px',
          }}>
            {[
              { step: '01', title: 'Perimeter Intercept', desc: 'Hostile scanner or IP probes decoy port (8081 / 3306)' },
              { step: '02', title: 'Dynamic Engagement', desc: 'Emulated service returns authentic responses to hold adversary' },
              { step: '03', title: 'Forensic Quarantine', desc: 'Payloads captured and hashed with SHA-256 custody logs' },
              { step: '04', title: 'MITRE Synthesis', desc: 'Auto-mapped against TTPs (T1595, T1078) in real-time' },
              { step: '05', title: 'Telegram Lockdown', desc: 'Root authority alert delivered for instant one-tap IP quarantine' },
            ].map((p, idx) => (
              <div key={idx} style={{
                background: 'rgba(8, 17, 28, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                padding: '24px 18px',
                textAlign: 'left',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: '0.72rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#38bdf8',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}>
                  PHASE {p.step}
                </div>
                <h4 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '8px',
                }}>
                  {p.title}
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  {p.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{
            maxWidth: '820px',
            margin: '0 auto',
            background: 'rgba(6, 14, 24, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '20px 28px',
            fontSize: '0.84rem',
            color: '#cbd5e1',
            lineHeight: 1.65,
          }}>
            Modern APTs and AI-driven attack toolkits advance too quickly for manual triage. By automating decoy deployment, spooling telemetry into air-gapped quarantine storage, and dispatching push-button actions to Telegram, ARGUS closes the dwell-time window to near zero.
          </div>
        </section>

        {/* ── 8. Built for Advanced Threats. Focused on Preemptive Defense (Screenshot 3) ── */}
        <section id="preemptive-defense" style={{
          background: 'linear-gradient(180deg, #071322 0%, #050e18 100%)',
          borderTop: '1px solid rgba(56, 189, 248, 0.25)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '80px 32px 72px 32px',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
            <h2 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: 'clamp(1.8rem, 3.2vw, 2.5rem)',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Built for Advanced Threats. Focused on Preemptive Defense.
            </h2>
            <p style={{ fontSize: '0.92rem', color: '#94a3b8', maxWidth: '640px', margin: '0 auto 52px auto' }}>
              Engineered to operate seamlessly without altering existing security policies or creating agent overhead.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
              textAlign: 'left',
            }}>
              {/* Feature 1 */}
              <div style={{
                background: 'rgba(8, 18, 30, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '32px 24px',
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  marginBottom: '18px',
                }}>
                  <Shield size={20} />
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '10px',
                }}>
                  Expose Advanced Threats Early
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                  Detect stealthy APT in-memory activity, zero-day network probing, and weaponized scanners long before traditional SIEM rules can flag anomalous traffic.
                </p>
              </div>

              {/* Feature 2 */}
              <div style={{
                background: 'rgba(8, 18, 30, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '32px 24px',
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  marginBottom: '18px',
                }}>
                  <Crosshair size={20} />
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '10px',
                }}>
                  Disrupt Evolving Attack Chains
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                  Break lateral movement and escalate adversary work factor. Attackers are trapped in isolated decoy segments with zero risk to operational data.
                </p>
              </div>

              {/* Feature 3 */}
              <div style={{
                background: 'rgba(8, 18, 30, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '32px 24px',
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  marginBottom: '18px',
                }}>
                  <Cpu size={20} />
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '10px',
                }}>
                  Strengthen Defenses Without Operational Disruption
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
                  Zero agent footprint required on production endpoints. Deploy decoys alongside real assets with zero performance impact or false positive alarms.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 9. The ARGUS Deception Portfolio (Screenshot 3) ── */}
        <section style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '72px 32px 64px 32px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h3 style={{
              fontFamily: "'Chakra Petch', sans-serif",
              fontSize: '1.55rem',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}>
              The ARGUS Portfolio of Deception Modules
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Modular sovereign defense surfaces engineered for enterprise enclaves.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
          }}>
            {[
              { title: 'Identity & Credential Deception', bg: '#1e3a5f', border: '#38bdf8', desc: 'Breadcrumb canary credentials seeded into memory, caches, and Active Directory.' },
              { title: 'Advanced Threat Defense (ATD)', bg: '#0f2744', border: '#10b981', desc: 'Core platform orchestrating high-interaction web, SSH, and DB decoys with live MITRE correlation.' },
              { title: 'Database & Cloud Honey-Grids', bg: '#451a1a', border: '#ef4444', desc: 'Synthetically emulated MySQL, S3, and API storage designed to entrap lateral queries.' },
              { title: 'Targeted Threat Intelligence', bg: '#2b3a1a', border: '#84cc16', desc: 'Forensic payload spooling with SHA-256 integrity and automated STIX/TAXII export.' },
            ].map((item, idx) => (
              <div key={idx} style={{
                background: item.bg,
                border: `1px solid ${item.border}`,
                borderRadius: '8px',
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <h4 style={{
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    marginBottom: '8px',
                  }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
                <div style={{
                  marginTop: '16px',
                  fontSize: '0.72rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: item.border,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  ACTIVE ENCLAVE READY &rarr;
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 10. Recognition / Compliance Ribbon (Screenshot 3 & 4) ── */}
        <div style={{
          background: '#881337',
          color: '#ffffff',
          padding: '14px 24px',
          textAlign: 'center',
          fontSize: '0.84rem',
          fontFamily: "'Chakra Petch', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          DISA STIG Enforced Architecture &bull; NIST SP 800-53 Rev. 5 Compliant &bull; Zero-False-Positive Guarantee
        </div>

        {/* ── 11. Schedule a Security Architecture Review / Call (Screenshot 3 & 4 Form) ── */}
        <section id="schedule-briefing" style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '80px 32px 72px 32px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '36px',
            alignItems: 'stretch',
          }}>
            {/* Left Card: Schedule a Call With Us */}
            <div style={{
              background: 'linear-gradient(135deg, #0b1c30 0%, #071322 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              padding: '40px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontSize: '0.74rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#38bdf8',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                }}>
                  // OPERATIONS CONSULTATION //
                </div>
                <h3 style={{
                  fontFamily: "'Chakra Petch', sans-serif",
                  fontSize: '1.85rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '16px',
                  lineHeight: 1.2,
                }}>
                  Schedule a Security Architecture Review
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.65, marginBottom: '24px' }}>
                  Connect directly with our Lead Cyber Defense Engineers. We will demonstrate how autonomous honey-grids deploy in your infrastructure without modifying production routing.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle size={16} color="#10b981" />
                    <span>30-minute tailored threat surface assessment</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle size={16} color="#10b981" />
                    <span>Live honeypot attack simulation and Telegram trigger test</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle size={16} color="#10b981" />
                    <span>Air-gapped quarantine integrity walkthrough</span>
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.78rem',
                color: 'var(--text-dim)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                ARGUS SOC LABS &bull; CLEARANCE LEVEL: UNCLASSIFIED / FOUO
              </div>
            </div>

            {/* Right Card: Interactive Form */}
            <div style={{
              background: '#071018',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '36px 32px',
            }}>
              {briefingSubmitted ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                    marginBottom: '18px',
                  }}>
                    <CheckCircle size={28} />
                  </div>
                  <h4 style={{
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    marginBottom: '10px',
                  }}>
                    Briefing Request Dispatched
                  </h4>
                  <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '380px' }}>
                    Thank you, {briefingName || 'Operator'}. Our Security Operations liaison will reach out to <strong style={{ color: '#fff' }}>{briefingEmail}</strong> within 1 business day.
                  </p>
                  <button
                    onClick={() => {
                      setBriefingSubmitted(false);
                      setBriefingEmail('');
                      setBriefingName('');
                      setBriefingOrg('');
                    }}
                    style={{
                      marginTop: '20px',
                      background: 'none',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '5px',
                      color: '#ffffff',
                      padding: '8px 18px',
                      fontSize: '0.78rem',
                      fontFamily: "'Chakra Petch', sans-serif",
                      cursor: 'pointer',
                    }}
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBriefingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: '0 0 6px 0',
                    textTransform: 'uppercase',
                  }}>
                    Request Operational Briefing
                  </h4>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 14px 0' }}>
                    Complete the secure dispatch fields below.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
                        Business Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={briefingEmail}
                        onChange={(e) => setBriefingEmail(e.target.value)}
                        placeholder="analyst@agency.gov"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(3, 7, 12, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '5px',
                          color: '#ffffff',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={briefingName}
                        onChange={(e) => setBriefingName(e.target.value)}
                        placeholder="John Miller"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(3, 7, 12, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '5px',
                          color: '#ffffff',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
                        Organization / Agency
                      </label>
                      <input
                        type="text"
                        value={briefingOrg}
                        onChange={(e) => setBriefingOrg(e.target.value)}
                        placeholder="Sovereign Defense Enclave"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(3, 7, 12, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '5px',
                          color: '#ffffff',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
                        Job Role
                      </label>
                      <input
                        type="text"
                        value={briefingRole}
                        onChange={(e) => setBriefingRole(e.target.value)}
                        placeholder="CISO / SOC Director"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(3, 7, 12, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '5px',
                          color: '#ffffff',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.82rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' }}>
                      Target Environment Scale
                    </label>
                    <select
                      value={briefingNodes}
                      onChange={(e) => setBriefingNodes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        background: 'rgba(3, 7, 12, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '5px',
                        color: '#ffffff',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.82rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="50 - 500 Nodes">50 - 500 Network Nodes</option>
                      <option value="500 - 2,500 Nodes">500 - 2,500 Network Nodes</option>
                      <option value="2,500+ Enterprise Enclave">2,500+ Enterprise Enclave</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: '5px',
                      color: '#ffffff',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: '0 2px 14px rgba(220, 38, 38, 0.4)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    <Send size={14} />
                    <span>DISPATCH BRIEFING REQUEST</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── 12. Operational Case Studies / Honeytoken Insights (Screenshot 3 & 4) ── */}
        <section style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0 32px 80px 32px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '28px',
          }}>
            <div style={{
              background: 'rgba(8, 17, 28, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
            }}>
              <div style={{ width: '120px', minWidth: '120px', background: '#0a1a2e' }}>
                <img
                  src="/images/cyber_grid.jpg"
                  alt="Case Study 1"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', marginBottom: '6px' }}>
                  OPERATIONAL CASE STUDY
                </div>
                <h4 style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  The organization found itself the frequent target of credential attacks.
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  Deploying high-interaction honey-grids absorbed 4,200+ automated brute-force hits with 0 false alarms.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(8, 17, 28, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
            }}>
              <div style={{ width: '120px', minWidth: '120px', background: '#0a1a2e' }}>
                <img
                  src="/images/defense_terminal.jpg"
                  alt="Case Study 2"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', marginBottom: '6px' }}>
                  RAPID MITIGATION
                </div>
                <h4 style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  How honeytokens detect threats across the enterprise with speed.
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                  Canary files dispatched alerts to the Telegram Incident Command bot in under 45 milliseconds.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── 13. Comprehensive Enterprise Footer (Screenshot 4) ── */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        background: '#03070d',
        borderTop: '1px solid rgba(56, 189, 248, 0.2)',
        padding: '56px 40px 32px 40px',
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          {/* Newsletter Sign-Up Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
            paddingBottom: '36px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '40px',
          }}>
            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '4px',
              }}>
                Sign Up for Security Threat Advisories &amp; Deception Intelligence
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Weekly digest on emerging APT vectors, canary deployment techniques, and MITRE updates.
              </div>
            </div>

            {newsletterSubmitted ? (
              <div style={{ fontSize: '0.84rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={15} />
                <span>Subscription verified. Advisory bulletins active.</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  required
                  placeholder="operator@enclave.mil"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  style={{
                    padding: '9px 14px',
                    background: 'rgba(8, 17, 28, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.8rem',
                    outline: 'none',
                    width: '240px',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    background: '#dc2626',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontFamily: "'Chakra Petch', sans-serif",
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Submit
                </button>
              </form>
            )}
          </div>

          {/* 4 Multi-Column Directory */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '36px',
            marginBottom: '48px',
            fontSize: '0.82rem',
          }}>
            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.06em',
                marginBottom: '14px',
                textTransform: 'uppercase',
              }}>
                PRODUCTS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#94a3b8' }}>
                <span>Advanced Threat Defense</span>
                <span>Active Deception Grids</span>
                <span>Air-Gapped Quarantine Vault</span>
                <span>MySQL Decoy Service</span>
                <span>Web Ingestion Honey-Traps</span>
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.06em',
                marginBottom: '14px',
                textTransform: 'uppercase',
              }}>
                SOLUTIONS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#94a3b8' }}>
                <span>Autonomous Threat Hunting</span>
                <span>Ransomware Containment</span>
                <span>Insider Threat Traps</span>
                <span>Critical Infrastructure Defense</span>
                <span>Zero-Trust Verification</span>
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.06em',
                marginBottom: '14px',
                textTransform: 'uppercase',
              }}>
                RESOURCES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#94a3b8' }}>
                <span>MITRE ATT&amp;CK Matrix</span>
                <span>DISA STIG Security Guide</span>
                <span>Honeytoken Architecture Brief</span>
                <span>Threat Research Whitepapers</span>
                <span>Telegram Bot Integration</span>
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.06em',
                marginBottom: '14px',
                textTransform: 'uppercase',
              }}>
                ABOUT ARGUS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#94a3b8' }}>
                <span>Sovereign Enclave Systems</span>
                <span>Executive Command Team</span>
                <span>SOC Analyst Certification</span>
                <span>Legal &amp; Forensics Custody</span>
                <span>Incident Response SLA</span>
              </div>
            </div>
          </div>

          {/* Bottom Legal Summary & Copyright */}
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            lineHeight: 1.6,
          }}>
            <div>
              ARGUS Panoptes is an autonomous cyber deception platform serving sovereign security operations centers, defending against sophisticated cyber threats including APTs, automated reconnaissance tools, and credential harvesting incursions.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>ARGUS TECHNOLOGIES &bull; ALL RIGHTS RESERVED &copy; 2026</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span>Privacy Policy</span>
                <span>Cookie Policy</span>
                <span>DISA STIG Compliance</span>
                <span>Contact Security Operations</span>
              </div>
            </div>
          </div>
        </div>
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
                      Operator Call-Sign (Username) or Registered Email
                    </label>
                    <input
                      type="text"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="e.g. argus_admin or operator@gmail.com"
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
                    Verify credentials for the registered operator enclave account below:
                  </p>
                </div>

                {/* Real Registered Operator Identity Badge */}
                <div style={{
                  background: 'rgba(7, 16, 26, 0.85)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  fontSize: '0.76rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase' }}>Operator Call-Sign:</span>
                    <strong style={{ color: '#ffffff', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>
                      {operatorCallSign || username || 'argus_admin'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase' }}>Registered Email:</span>
                    <strong style={{ color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>
                      {operatorEmail || recoveryEmail}
                    </strong>
                  </div>
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

                {devCodeHint && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.38)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#10b981',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}>
                        🛡️ SECURITY DISPATCH CODE:
                      </span>
                      <button
                        type="button"
                        onClick={() => setRecoveryCode(devCodeHint)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.22)',
                          border: '1px solid rgba(16, 185, 129, 0.5)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '0.7rem',
                          fontFamily: "'Chakra Petch', sans-serif",
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '3px 8px',
                          textTransform: 'uppercase',
                        }}
                      >
                        Autofill Code
                      </button>
                    </div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#34d399',
                      letterSpacing: '0.2em',
                      textAlign: 'center',
                    }}>
                      {devCodeHint}
                    </div>
                    <div style={{
                      fontSize: '0.68rem',
                      color: '#94a3b8',
                      textAlign: 'center',
                      marginTop: '4px',
                    }}>
                      Dispatched to Telegram (@Deception_argusBot) &bull; No phone verification required.
                    </div>
                  </div>
                )}

                {/* 30-Second Countdown Indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: countdown > 20 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${countdown > 20 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`,
                  borderRadius: '6px',
                  padding: '9px 14px',
                  marginBottom: '14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={15} color={countdown > 20 ? '#38bdf8' : '#ef4444'} />
                    <span style={{ fontSize: '0.78rem', color: countdown > 20 ? '#cbd5e1' : '#fca5a5', fontWeight: 600 }}>
                      {countdown > 0 ? 'Verification code expires in:' : 'Verification code expired!'}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    color: countdown > 20 ? '#38bdf8' : '#ef4444',
                    letterSpacing: '0.04em',
                  }}>
                    {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                {countdown === 0 && (
                  <button
                    type="button"
                    onClick={(e) => handleForgotSubmit(e)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid #38bdf8',
                      borderRadius: '6px',
                      color: '#38bdf8',
                      fontFamily: "'Chakra Petch', sans-serif",
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>DISPATCH NEW VERIFICATION CODE</span>
                  </button>
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
