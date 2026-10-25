export interface LoginSuccessOtp {
  otp_required: true
  username: string
  masked_phone: string
}
export interface LoginFailure { message: string }
export interface OtpFailure { error: 'verification_failed'; message: string }
export interface OtpResendSuccess { message: string }
export interface TransferSuccess { message: string }
export interface RecoverResponse { message: string }
export interface KycUploadSuccess { message: string }
export interface SupportSuccess { message: string }
export interface TransferFields {
  from_acct: string; routing: string; recipient: string; amount: string; memo: string
}
export interface SupportFields {
  full_name: string; email: string; subject: string; message: string
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

async function postForm<T>(url: string, fields: Record<string, string>): Promise<ApiResult<T>> {
  try {
    const body = new URLSearchParams(fields)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    if (res.ok) return { ok: true, data: data as T }
    return { ok: false, status: res.status, message: data.message ?? data.error ?? '' }
  } catch {
    return { ok: false, status: 0, message: 'network_error' }
  }
}

async function postFile(url: string, file: File): Promise<ApiResult<KycUploadSuccess>> {
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(url, { method: 'POST', body })
    const data = await res.json()
    if (res.ok) return { ok: true, data }
    return { ok: false, status: res.status, message: data.message ?? '' }
  } catch {
    return { ok: false, status: 0, message: 'network_error' }
  }
}

export const bankApi = {
  login: (username: string, password: string) =>
    postForm<LoginSuccessOtp>('/api/v1/bank/auth/login', { username, password }),
  otp: (username: string, otp_code: string) =>
    postForm<OtpFailure>('/api/v1/bank/auth/otp', { username, otp_code }),
  otpResend: (username: string) =>
    postForm<OtpResendSuccess>('/api/v1/bank/auth/otp', { username, otp_code: '', action: 'resend_requested' }),
  recover: (identifier: string) =>
    postForm<RecoverResponse>('/api/v1/bank/auth/recover', { identifier }),
  transfer: (fields: TransferFields) =>
    postForm<TransferSuccess>('/api/v1/bank/transfer', fields as unknown as Record<string, string>),
  supportContact: (fields: SupportFields) =>
    postForm<SupportSuccess>('/api/v1/bank/support/contact', fields as unknown as Record<string, string>),
  kycUpload: (file: File) =>
    postFile('/api/v1/bank/kyc/upload', file),
}
