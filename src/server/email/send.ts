import { Resend } from 'resend';
import { logger } from "@/server/utils/logger";

// Initialize Resend with API key from environment
// Falls back to null if not configured (emails will fail gracefully)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export type EmailAttachment = {
  filename: string;
  content: Buffer | Uint8Array;
};

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult = {
  success: boolean;
  error?: string;
  messageId?: string;
};

/**
 * Send an email using Resend
 * Requires RESEND_API_KEY environment variable to be set
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    return {
      success: false,
      error: 'Email not configured. Please set RESEND_API_KEY environment variable.',
    };
  }

  try {
    // Use a verified domain for production, or Resend's test domain
    const fromAddress = params.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((att) => ({
        filename: att.filename,
        content: Buffer.from(att.content),
      })),
    });

    if (error) {
      logger.email.error("Resend API error", error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    logger.email.error("Unexpected email send error", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    };
  }
}
