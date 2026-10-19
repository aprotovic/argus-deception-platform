export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type EventType =
  | 'login_attempt'
  | 'file_upload'
  | 'recon_probe'
  | 'unauthorized_access'
  | 'malformed_request'
  | 'command_injection'
  | 'honeytoken_accessed'
  | 'sql_injection'
  | 'terminal_execution';
export type UserRole = 'admin' | 'analyst' | 'auditor';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface LoginAttempt {
  id: string;
  event_id: string;
  submitted_username: string;
  password_length: number;
  password_hmac_fingerprint: string;
  is_flagged_credential: boolean;
  success: boolean;
  failure_reason: string;
  client_ip: string;
  user_agent: string;
  created_at: string;
}

export interface CapturedFile {
  id: string;
  event_id: string;
  original_filename_sanitized: string;
  sha256_hash: string;
  file_size_bytes: number;
  declared_mime_type: string;
  detected_mime_type: string;
  quarantine_status: string;
  rejection_reason?: string;
  source_ip: string;
  upload_timestamp: string;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  decoy_service_id?: string;
  timestamp: string;
  source_ip: string;
  source_port?: number;
  http_method: string;
  request_path: string;
  query_params: Record<string, any>;
  headers_sanitized: Record<string, string>;
  user_agent: string;
  event_type: EventType;
  severity: Severity;
  is_test_event: boolean;
  correlation_id?: string;
  metadata_payload: Record<string, any>;
  created_at: string;
  login_attempt?: LoginAttempt;
  captured_file?: CapturedFile;
}

export interface SecurityEventDetail extends SecurityEvent {
  correlated_events: SecurityEvent[];
}

export interface HourlyActivity {
  hour: string;
  count: number;
}

export interface OverviewMetrics {
  total_events: number;
  events_last_24h: number;
  unique_ips: number;
  failed_logins: number;
  quarantined_files: number;
  rejected_uploads: number;
  events_by_severity: Record<Severity, number>;
  events_by_type: Record<EventType, number>;
  recent_activity: HourlyActivity[];
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  target_type: string;
  target_id: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface WebSocketEventMessage {
  type: string;
  timestamp?: string;
  event?: {
    id: string;
    timestamp: string;
    source_ip: string;
    event_type: EventType;
    severity: Severity;
    request_path: string;
    http_method: string;
    user_agent: string;
    is_test_event: boolean;
    summary: string;
  };
}

export interface NotificationItem {
  id: string;
  eventId: string;
  timestamp: string;
  source_ip: string;
  event_type: EventType;
  severity: Severity;
  summary: string;
  read: boolean;
}

