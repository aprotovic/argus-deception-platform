import type { OverviewMetrics, PaginatedResponse, SecurityEvent, SecurityEventDetail, CapturedFile, AuditLog, User } from '../types';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('argus_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('argus_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('argus_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      window.dispatchEvent(new Event('argus_auth_expired'));
    }
    let errorMsg = 'An error occurred';
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errData.message || errorMsg;
    } catch {
      errorMsg = response.statusText || errorMsg;
    }
    throw new ApiError(response.status, errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ access_token: string; user_id: string; username: string; role: string }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async forgotPassword(email: string): Promise<{ detail: string; dev_code?: string; code?: string; sent_via_telegram?: boolean; sent_via_smtp?: boolean }> {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(data: { email: string; token: string; new_password: string; confirm_password: string }): Promise<{ detail: string }> {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMe(): Promise<User> {
    return request('/auth/me');
  },

  // Overview Metrics
  async getMetrics(): Promise<OverviewMetrics> {
    return request('/overview/metrics');
  },

  // Events
  async getEvents(params: {
    page?: number;
    limit?: number;
    severity?: string;
    event_type?: string;
    source_ip?: string;
    is_test_event?: boolean;
    search?: string;
  } = {}): Promise<PaginatedResponse<SecurityEvent>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.severity) query.set('severity', params.severity);
    if (params.event_type) query.set('event_type', params.event_type);
    if (params.source_ip) query.set('source_ip', params.source_ip);
    if (params.is_test_event !== undefined) query.set('is_test_event', params.is_test_event.toString());
    if (params.search) query.set('search', params.search);

    const qs = query.toString();
    return request(`/events${qs ? `?${qs}` : ''}`);
  },

  async getEventDetail(id: string): Promise<SecurityEventDetail> {
    return request(`/events/${id}`);
  },

  // Evidence Management
  async getEvidence(params: { page?: number; limit?: number; quarantine_status?: string } = {}): Promise<PaginatedResponse<CapturedFile>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.quarantine_status) query.set('quarantine_status', params.quarantine_status);

    const qs = query.toString();
    return request(`/evidence${qs ? `?${qs}` : ''}`);
  },

  async downloadEvidence(id: string, filename: string): Promise<void> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/evidence/${id}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Evidence download failed. Ensure you hold Administrator clearance.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Audit Trail
  async getAuditLogs(params: { page?: number; limit?: number; action?: string } = {}): Promise<PaginatedResponse<AuditLog>> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.action) query.set('action', params.action);

    const qs = query.toString();
    return request(`/audit-logs${qs ? `?${qs}` : ''}`);
  },

  // Export
  getExportUrl(format: 'json' | 'csv', params: { severity?: string; event_type?: string; is_test_event?: boolean } = {}): string {
    const query = new URLSearchParams({ export_format: format });
    if (params.severity) query.set('severity', params.severity);
    if (params.event_type) query.set('event_type', params.event_type);
    if (params.is_test_event !== undefined) query.set('is_test_event', params.is_test_event.toString());
    const token = getAuthToken();
    if (token) query.set('token', token);
    return `${API_BASE}/export/events?${query.toString()}`;
  },

  // Threat Intelligence
  async getGeoMap(): Promise<any[]> {
    return request('/intel/geo-map');
  },

  async getThreatScores(): Promise<any[]> {
    return request('/intel/threat-scores');
  },

  async simulateGlobalThreats(): Promise<any> {
    return request('/intel/simulate-sample', { method: 'POST' });
  },

  async downloadIncidentReport(ip: string): Promise<void> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/export/incident-report/${encodeURIComponent(ip)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new ApiError(response.status, 'Incident report export failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus_incident_${ip.replace(/\./g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },


  // User Profile & Management
  async updateProfile(data: { username?: string; email?: string }): Promise<User> {
    return request("/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: { current_password: string; new_password: string; confirm_password: string }): Promise<{ detail: string }> {
    return request("/users/me/password", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async listUsers(): Promise<User[]> {
    return request("/users");
  },

  async createUser(data: { username: string; email: string; password: string; role: string }): Promise<User> {
    return request("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateUserRole(userId: string, role: string): Promise<User> {
    return request(`/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    return request(`/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async deleteUser(userId: string): Promise<void> {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      let errorMsg = "Failed to delete user";
      try {
        const errData = await response.json();
        errorMsg = errData.detail || errorMsg;
      } catch {
        errorMsg = response.statusText || errorMsg;
      }
      throw new ApiError(response.status, errorMsg);
    }
  },
};
