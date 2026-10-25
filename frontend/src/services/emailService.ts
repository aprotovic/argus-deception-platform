import emailjs from '@emailjs/browser';

export interface BriefingRequestPayload {
  fullName: string;
  email: string;
  organization?: string;
  jobRole?: string;
  targetScale?: string;
}

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  recipientEmail: string;
}

const STORAGE_KEY = 'argus_emailjs_config';

/**
 * Retrieve current EmailJS configuration.
 * Checks localStorage first (for quick live testing), falling back to Vite environment variables.
 */
export const getEmailJsConfig = (): EmailJsConfig => {
  let localConfig: Partial<EmailJsConfig> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      localConfig = JSON.parse(saved);
    }
  } catch {
    // ignore localStorage parse error
  }

  const serviceId =
    localConfig.serviceId?.trim() ||
    (import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined)?.trim() ||
    'service_i3pzooe';

  const templateId =
    localConfig.templateId?.trim() ||
    (import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined)?.trim() ||
    'template_938ohlm';

  const publicKey =
    localConfig.publicKey?.trim() ||
    (import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined)?.trim() ||
    'bAGkeaZfcAEUnT7tM';

  const recipientEmail =
    localConfig.recipientEmail?.trim() ||
    (import.meta.env.VITE_EMAILJS_RECIPIENT_EMAIL as string | undefined)?.trim() ||
    'huz949505@gmail.com';

  return {
    serviceId,
    templateId,
    publicKey,
    recipientEmail,
  };
};

/**
 * Save manual credentials in localStorage for convenience during testing.
 */
export const saveEmailJsConfig = (config: Partial<EmailJsConfig>): void => {
  const current = getEmailJsConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Check if the required EmailJS credentials are provided.
 */
export const isEmailJsReady = (): boolean => {
  const config = getEmailJsConfig();
  return Boolean(
    config.serviceId &&
    config.serviceId !== 'your_service_id_here' &&
    config.templateId &&
    config.templateId !== 'your_template_id_here' &&
    config.publicKey &&
    config.publicKey !== 'your_public_key_here'
  );
};

/**
 * Dispatch operational briefing request via EmailJS.
 */
export const sendBriefingEmail = async (
  payload: BriefingRequestPayload
): Promise<{ success: boolean; recipient: string; message: string }> => {
  const config = getEmailJsConfig();

  if (!isEmailJsReady()) {
    throw new Error(
      'EmailJS credentials are missing. Please add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY to frontend/.env or configure them in the quick setup.'
    );
  }

  const templateParams: Record<string, string> = {
    // Primary recipient requested by the user
    to_email: config.recipientEmail,
    recipient_email: config.recipientEmail,
    to_name: 'ARGUS SOC Administrator',
    
    // Sender information from form
    from_name: payload.fullName.trim(),
    name: payload.fullName.trim(),
    from_email: payload.email.trim(),
    reply_to: payload.email.trim(),
    email: payload.email.trim(),

    // Briefing details
    organization: payload.organization?.trim() || 'Not specified',
    job_role: payload.jobRole?.trim() || 'Not specified',
    target_scale: payload.targetScale?.trim() || '50 - 500 Network Nodes',
    // Template compatibility fields
    title: 'ARGUS Operational Briefing Request',
    time: new Date().toLocaleTimeString(),
    timestamp: new Date().toLocaleString(),

    // Formatted message body
    message: `[ARGUS OPERATIONAL BRIEFING INQUIRY]
Full Name: ${payload.fullName.trim()}
Business Email: ${payload.email.trim()}
Organization: ${payload.organization?.trim() || 'Not specified'}
Job Role: ${payload.jobRole?.trim() || 'Not specified'}
Target Scale: ${payload.targetScale?.trim() || '50 - 500 Network Nodes'}
Timestamp: ${new Date().toISOString()}
Target Recipient: ${config.recipientEmail}`,
  };

  const response = await emailjs.send(
    config.serviceId,
    config.templateId,
    templateParams,
    config.publicKey
  );

  if (response.status !== 200 && response.text !== 'OK') {
    throw new Error(`EmailJS responded with status: ${response.status} (${response.text})`);
  }

  return {
    success: true,
    recipient: config.recipientEmail,
    message: `Briefing request successfully transmitted to ${config.recipientEmail}`,
  };
};
