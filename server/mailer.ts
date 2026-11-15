import nodemailer from 'nodemailer';

export interface EmailDispatchPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailDispatchResult {
  sent: boolean;
  mode: 'smtp' | 'simulated_outbox';
  recipient: string;
  error?: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_USER !== 'your-email@example.com',
  );
}

function getTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendCareEmail(
  payload: EmailDispatchPayload,
): Promise<EmailDispatchResult> {
  if (!payload.to || !payload.to.includes('@')) {
    return {
      sent: false,
      mode: 'simulated_outbox',
      recipient: payload.to,
      error: 'Invalid recipient email address.',
    };
  }

  if (!isSmtpConfigured()) {
    console.info(
      `[WellAge Mailer - SMTP not configured, queued in-app] To: ${payload.to} | Subject: ${payload.subject}`,
    );
    return {
      sent: false,
      mode: 'simulated_outbox',
      recipient: payload.to,
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        `WellAge <${process.env.SMTP_USER}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return {
      sent: true,
      mode: 'smtp',
      recipient: payload.to,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP delivery failed';
    console.error('[WellAge Mailer Error]', message);
    return {
      sent: false,
      mode: 'smtp',
      recipient: payload.to,
      error: message,
    };
  }
}

export function buildCareAlertEmailHtml(params: {
  recipientName: string;
  elderName: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}): string {
  const accent =
    params.severity === 'critical'
      ? '#DC2626'
      : params.severity === 'warning'
        ? '#D97706'
        : '#0284C7';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #F8FAFC; padding: 24px;">
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 24px;">
        <div style="font-size: 13px; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
          WellAge · Care Circle Alert
        </div>
        <h2 style="margin: 0 0 12px 0; color: #0F172A; font-size: 20px;">${params.title}</h2>
        <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.6;">
          Hello ${params.recipientName},
        </p>
        <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px; line-height: 1.6;">
          ${params.message}
        </p>
        <div style="background: #F1F5F9; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #475569;">
          Care Profile: <strong>${params.elderName}</strong>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748B;">
          This automated care notification was sent by WellAge (Smarter Care. Healthier Aging.). Never adjust medication dosages without consulting a licensed clinician.
        </p>
      </div>
    </div>
  `;
}
