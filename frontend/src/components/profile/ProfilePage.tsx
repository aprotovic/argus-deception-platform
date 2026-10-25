import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Lock,
  Shield,
  UserPlus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { User as UserType } from '../../types';

// ─── Toast helper ────────────────────────────────────────────────────────────
interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning';
  message: string;
}

let _toastId = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: Toast['type'], message: string) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return { toasts, push };
}

// ─── Reusable section card ────────────────────────────────────────────────────
const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title, icon, children,
}) => (
  <div style={{
    background: 'rgba(10, 20, 15, 0.85)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '10px',
    padding: '24px',
    marginBottom: '24px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
      <span style={{ color: '#10b981' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: '0.95rem', fontFamily: "'Chakra Petch', sans-serif", color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {title}
      </h2>
    </div>
    {children}
  </div>
);

// ─── Input field ──────────────────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  suffix?: React.ReactNode;
  error?: string | null;
}> = ({ label, value, onChange, type = 'text', placeholder, disabled, readOnly, suffix, error }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '0.72rem', color: error ? '#f87171' : 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: error ? 'rgba(239, 68, 68, 0.08)' : (readOnly || disabled ? 'rgba(16, 185, 129, 0.04)' : 'rgba(4, 10, 7, 0.8)'),
          border: error ? '1px solid #ef4444' : ('1px solid ' + (readOnly ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-subtle)')),
          boxShadow: error ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none',
          borderRadius: '6px',
          color: readOnly ? 'var(--text-muted)' : '#fff',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.85rem',
          boxSizing: 'border-box',
          outline: 'none',
          cursor: readOnly ? 'default' : 'text',
          transition: 'all 0.15s ease',
        }}
      />
      {suffix && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>}
    </div>
    {error && (
      <div style={{
        color: '#f87171',
        fontSize: '0.72rem',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginTop: '6px',
        fontFamily: "'Chakra Petch', sans-serif",
      }}>
        <AlertTriangle size={13} />
        <span>{error}</span>
      </div>
    )}
  </div>
);

// ─── Password field with toggle ───────────────────────────────────────────────
const PasswordField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string | null;
}> = ({ label, value, onChange, placeholder, error }) => {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      value={value}
      onChange={onChange}
      type={show ? 'text' : 'password'}
      placeholder={placeholder}
      error={error}
      suffix={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      }
    />
  );
};

// ─── Role badge ───────────────────────────────────────────────────────────────
const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const colors: Record<string, string> = {
    admin: '#f59e0b',
    analyst: '#10b981',
    auditor: '#6366f1',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '0.72rem',
      fontFamily: "'Chakra Petch', sans-serif",
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      border: `1px solid ${colors[role] || '#888'}55`,
      color: colors[role] || '#888',
      background: `${colors[role] || '#888'}18`,
    }}>
      {role}
    </span>
  );
};

// ─── Action button ────────────────────────────────────────────────────────────
const Btn: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
  children: React.ReactNode;
  small?: boolean;
}> = ({ onClick, disabled, loading, variant = 'primary', children, small }) => {
  const bg: Record<string, string> = {
    primary: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.12) 100%)',
    danger: 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.12) 100%)',
    ghost: 'transparent',
  };
  const border: Record<string, string> = {
    primary: 'rgba(16,185,129,0.45)',
    danger: 'rgba(239,68,68,0.45)',
    ghost: 'var(--border-subtle)',
  };
  const color: Record<string, string> = {
    primary: '#10b981',
    danger: '#ef4444',
    ghost: 'var(--text-muted)',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: small ? '6px 12px' : '9px 18px',
        background: bg[variant],
        border: `1px solid ${border[variant]}`,
        borderRadius: '6px',
        color: disabled ? 'var(--text-dim)' : color[variant],
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontFamily: "'Chakra Petch', sans-serif",
        fontSize: small ? '0.72rem' : '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {loading && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  );
};

// ─── Main ProfilePage Component ───────────────────────────────────────────────
export const ProfilePage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { toasts, push } = useToasts();

  // Profile edit state
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [currentPwError, setCurrentPwError] = useState<string | null>(null);

  // Team management state
  const [teamUsers, setTeamUsers] = useState<UserType[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'analyst' as 'admin' | 'analyst' | 'auditor' });
  const [creating, setCreating] = useState(false);

  // Role change dropdown
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingTeam(true);
    try {
      const users = await api.listUsers();
      setTeamUsers(users);
    } catch (e: any) {
      push('error', e.message || 'Failed to load team');
    } finally {
      setLoadingTeam(false);
    }
  }, [isAdmin, push]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateProfile({ username, email });
      push('success', 'Profile updated successfully');
    } catch (e: any) {
      push('error', e.message || 'Profile update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      push('error', 'New passwords do not match');
      return;
    }
    if (newPw.length < 8) {
      push('error', 'New password must be at least 8 characters');
      return;
    }
    setCurrentPwError(null);
    setSavingPw(true);
    try {
      await api.changePassword({ current_password: currentPw, new_password: newPw, confirm_password: confirmPw });
      push('success', 'Password changed successfully');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      const msg = e.message || 'Password change failed';
      if (msg.toLowerCase().includes('current password')) {
        setCurrentPwError('Current password is not correct. Verify your active passcode.');
      }
      push('error', msg);
    } finally {
      setSavingPw(false);
    }
  };

  const handleCreateUser = async () => {
    setCreating(true);
    try {
      await api.createUser(newUser);
      push('success', `User "${newUser.username}" created`);
      setShowCreate(false);
      setNewUser({ username: '', email: '', password: '', role: 'analyst' });
      await loadTeam();
    } catch (e: any) {
      push('error', e.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingRole(userId);
    setRoleDropdown(null);
    try {
      await api.updateUserRole(userId, role);
      push('success', 'Role updated');
      await loadTeam();
    } catch (e: any) {
      push('error', e.message || 'Role update failed');
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleToggleStatus = async (u: UserType) => {
    setTogglingStatus(u.id as string);
    try {
      await api.updateUserStatus(u.id as string, !u.is_active);
      push('success', `User ${u.is_active ? 'deactivated' : 'activated'}`);
      await loadTeam();
    } catch (e: any) {
      push('error', e.message || 'Status update failed');
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleDelete = async (u: UserType) => {
    if (!confirm(`Permanently delete user "${u.username}"? This cannot be undone.`)) return;
    setDeletingId(u.id as string);
    try {
      await api.deleteUser(u.id as string);
      push('success', `User "${u.username}" deleted`);
      await loadTeam();
    } catch (e: any) {
      push('error', e.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '72px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '12px 18px',
            borderRadius: '8px',
            background: t.type === 'success' ? 'rgba(16,185,129,0.15)' : t.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${t.type === 'success' ? 'rgba(16,185,129,0.4)' : t.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
            color: t.type === 'success' ? '#10b981' : t.type === 'error' ? '#ef4444' : '#f59e0b',
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: '8px',
            minWidth: '260px',
          }}>
            {t.type === 'success' ? <CheckCircle size={14} /> : t.type === 'error' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontFamily: "'Chakra Petch', sans-serif", color: '#fff', letterSpacing: '0.06em' }}>
          PROFILE & TEAM
        </h1>
        <p style={{ margin: '6px 0 0 0', color: 'var(--text-dim)', fontSize: '0.82rem', fontFamily: "'JetBrains Mono', monospace" }}>
          Manage your identity and team access
        </p>
      </div>

      {/* ── Section 1: My Profile ── */}
      <SectionCard title="My Profile" icon={<User size={18} />}>
        {/* Read-only role and ID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '14px', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Role</div>
            <RoleBadge role={user?.role ?? 'analyst'} />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>User ID</div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'var(--text-muted)' }}>{String(user?.id ?? '—').slice(0, 16)}…</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Username" value={username} onChange={setUsername} placeholder="Enter username" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="Enter email" type="email" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Btn onClick={handleSaveProfile} loading={savingProfile}>
            <Save size={13} /> Save Profile
          </Btn>
        </div>
      </SectionCard>

      {/* ── Section 2: Change Password ── */}
      <SectionCard title="Change Password" icon={<Lock size={18} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <PasswordField
            label="Current Password"
            value={currentPw}
            onChange={(v) => {
              setCurrentPw(v);
              if (currentPwError) setCurrentPwError(null);
            }}
            placeholder="••••••••"
            error={currentPwError}
          />
          <PasswordField label="New Password" value={newPw} onChange={setNewPw} placeholder="••••••••" />
          <PasswordField label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} placeholder="••••••••" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <Btn
            onClick={handleChangePassword}
            loading={savingPw}
            disabled={!currentPw || !newPw || !confirmPw}
          >
            <Lock size={13} /> Update Password
          </Btn>
        </div>
      </SectionCard>

      {/* ── Section 3: Team Management (Admin only) ── */}
      {isAdmin && (
        <SectionCard title="Team Management" icon={<Shield size={18} />}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <Btn onClick={() => setShowCreate(true)}>
              <UserPlus size={13} /> Add User
            </Btn>
          </div>

          {/* Create User Modal */}
          {showCreate && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                background: '#050d08',
                border: '1px solid var(--border-accent)',
                borderRadius: '12px',
                padding: '28px',
                width: '440px',
                maxWidth: '95vw',
              }}>
                <h3 style={{ margin: '0 0 20px 0', fontFamily: "'Chakra Petch', sans-serif", color: '#fff', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Create New User
                </h3>
                <Field label="Username" value={newUser.username} onChange={(v) => setNewUser((p) => ({ ...p, username: v }))} placeholder="analyst_001" />
                <Field label="Email" value={newUser.email} onChange={(v) => setNewUser((p) => ({ ...p, email: v }))} placeholder="analyst@argus.local" type="email" />
                <PasswordField label="Password" value={newUser.password} onChange={(v) => setNewUser((p) => ({ ...p, password: v }))} placeholder="Min 8 characters" />
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as any }))}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'rgba(4,10,7,0.8)', border: '1px solid var(--border-subtle)',
                      borderRadius: '6px', color: '#fff',
                      fontFamily: "'Chakra Petch', sans-serif", fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                    <option value="auditor">Auditor</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <Btn variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Btn>
                  <Btn
                    onClick={handleCreateUser}
                    loading={creating}
                    disabled={!newUser.username || !newUser.email || !newUser.password}
                  >
                    <UserPlus size={13} /> Create User
                  </Btn>
                </div>
              </div>
            </div>
          )}

          {/* Users Table */}
          {loadingTeam ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}>
              Loading team roster…
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Username', 'Email', 'Role', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '10px 12px',
                        fontSize: '0.68rem', fontFamily: "'Chakra Petch', sans-serif",
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'var(--text-dim)', fontWeight: 600,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamUsers.map((u) => {
                    const isMe = u.id === user?.id;
                    return (
                      <tr key={String(u.id)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: u.is_active ? 1 : 0.55 }}>
                        <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem', color: '#fff' }}>
                          {u.username}{isMe && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: '#10b981' }}>(you)</span>}
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {!isMe ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                onClick={() => setRoleDropdown(roleDropdown === String(u.id) ? null : String(u.id))}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  padding: '2px 4px', borderRadius: '4px',
                                }}
                              >
                                <RoleBadge role={u.role} />
                                {updatingRole === String(u.id) ? <RefreshCw size={10} style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} /> : <ChevronDown size={10} style={{ color: 'var(--text-dim)' }} />}
                              </button>
                              {roleDropdown === String(u.id) && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, zIndex: 100,
                                  background: '#080f0c', border: '1px solid var(--border-subtle)',
                                  borderRadius: '6px', minWidth: '120px', marginTop: '4px',
                                  overflow: 'hidden',
                                }}>
                                  {['admin', 'analyst', 'auditor'].map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => handleRoleChange(String(u.id), r)}
                                      style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        padding: '8px 14px', background: u.role === r ? 'rgba(16,185,129,0.1)' : 'transparent',
                                        border: 'none', cursor: 'pointer',
                                        fontFamily: "'Chakra Petch', sans-serif", fontSize: '0.78rem',
                                        color: u.role === r ? '#10b981' : 'var(--text-muted)',
                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                      }}
                                    >
                                      {r}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <RoleBadge role={u.role} />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
                            fontSize: '0.68rem', fontFamily: "'Chakra Petch', sans-serif", fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            border: u.is_active ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
                            color: u.is_active ? '#10b981' : '#ef4444',
                            background: u.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          }}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {!isMe ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <Btn
                                variant={u.is_active ? 'ghost' : 'primary'}
                                small
                                loading={togglingStatus === String(u.id)}
                                onClick={() => handleToggleStatus(u)}
                              >
                                {u.is_active ? <XCircle size={11} /> : <CheckCircle size={11} />}
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </Btn>
                              <Btn
                                variant="danger"
                                small
                                loading={deletingId === String(u.id)}
                                onClick={() => handleDelete(u)}
                              >
                                <Trash2 size={11} /> Delete
                              </Btn>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: "'Chakra Petch', sans-serif" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
