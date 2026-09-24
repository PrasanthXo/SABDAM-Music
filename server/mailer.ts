import nodemailer from 'nodemailer';
import https from 'https';

type MailTransporter = ReturnType<typeof nodemailer.createTransport>;

interface SendMailResult {
  success: boolean;
  error?: string;
  messageId?: string;
  previewUrl?: string;
}

let cachedTransporter: MailTransporter | null = null;

function normalizeSmtpConfig(): any | null {
  const rawHost = process.env.SMTP_HOST?.trim();
  const rawUser = (process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER)?.trim();
  let rawPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD)?.trim();
  const rawPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;

  if (!rawUser || !rawPass) {
    return null;
  }

  // If using a 16-character Google App Password with spaces or quotes, strip them cleanly
  rawPass = rawPass.replace(/['"]/g, '').trim();
  if (rawPass.replace(/\s+/g, '').length === 16) {
    rawPass = rawPass.replace(/\s+/g, '');
  }

  let host = rawHost || '';
  
  // Clean host: remove protocol schemes (http://, https://, smtp://, smtps://, //, etc.)
  host = host.replace(/^(?:https?:|smtps?:)?\/\//i, '').trim();
  // Remove trailing slashes and path components
  host = host.split('/')[0].trim();

  // If port is embedded in host (e.g. "smtp.gmail.com:587")
  let port = rawPort;
  if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0].trim();
    const p = parseInt(parts[1], 10);
    if (!isNaN(p) && p > 0) {
      port = p;
    }
  }

  const isGmailUser = rawUser.toLowerCase().endsWith('@gmail.com') || rawUser.toLowerCase().endsWith('@googlemail.com');
  const isGmailHost = !host || host.toLowerCase() === 'gmail.com' || host.toLowerCase() === 'gmail' || host.toLowerCase() === 'smtp.gmail.com';

  if (isGmailHost || (isGmailUser && !host)) {
    return {
      service: 'gmail',
      auth: {
        user: rawUser,
        pass: rawPass,
      },
    };
  }

  if (host.toLowerCase() === 'gmail.com' || host.toLowerCase() === 'gmail') {
    host = 'smtp.gmail.com';
  }

  if (!host) {
    return null;
  }

  const finalPort = port || (host === 'smtp.gmail.com' ? 465 : 587);
  const isSecure = finalPort === 465;

  return {
    host,
    port: finalPort,
    secure: isSecure,
    auth: {
      user: rawUser,
      pass: rawPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };
}

function getTransporter(): MailTransporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = normalizeSmtpConfig();
  if (config) {
    try {
      cachedTransporter = nodemailer.createTransport(config);
      const hostLabel = config.service ? `service: ${config.service}` : `${config.host}:${config.port}`;
      console.log(`✉️ [Mailer] Initialized transporter (${hostLabel}) for: ${config.auth?.user}`);
      return cachedTransporter;
    } catch (err) {
      console.error('Failed to initialize nodemailer transporter:', err);
      cachedTransporter = null;
    }
  }

  return null;
}

/**
 * Sends OTP verification email via Resend API if RESEND_API_KEY is available
 */
async function sendViaResend(
  apiKey: string,
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<SendMailResult> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'SABDHAM Music <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html: htmlContent,
      text: textContent,
    });

    const req = https.request(
      {
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve({ success: true, messageId: parsed.id });
            } catch {
              resolve({ success: true });
            }
          } else {
            console.error('Resend API error:', res.statusCode, data);
            resolve({ success: false, error: `Resend error: ${data}` });
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('Resend request failed:', err);
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Dispatches a 6-digit OTP code directly to the user's inbox
 */
export async function sendOtpEmail(
  toEmail: string,
  code: string,
  purpose: 'signin' | 'signup' | 'any' = 'signin',
  recipientName?: string
): Promise<SendMailResult> {
  const isSignUp = purpose === 'signup';
  const purposeLabel = isSignUp ? 'sign up and account creation' : 'sign in';
  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
  const subject = `Your SABDHAM Verification Code: ${code}`;

  const textContent = `
${greeting}

Your 6-digit SABDHAM verification code is: ${code}

Use this code to complete your ${purposeLabel}.
This code is valid for 10 minutes.

If you did not request this verification code, please ignore this email.
— SABDHAM Music
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SABDHAM Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#09090b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#18181b;border:1px solid rgba(255,255,255,0.1);border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="padding:32px 32px 24px 32px;text-align:center;background:linear-gradient(135deg,#f59e0b 0%,#ea580c 100%);">
              <div style="display:inline-block;background:#09090b;color:#f59e0b;font-size:22px;font-weight:900;letter-spacing:4px;padding:8px 20px;border-radius:12px;margin-bottom:8px;">
                SABDHAM
              </div>
              <div style="color:#ffffff;font-size:13px;letter-spacing:1px;font-weight:600;text-transform:uppercase;">
                Morning Music &amp; Curated Soundtracks
              </div>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
                ${isSignUp ? 'Welcome! Verify Your Email' : 'Sign In Verification Code'}
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#a1a1aa;text-align:center;">
                ${greeting} Use the verification code below to complete your ${purposeLabel} on SABDHAM.
              </p>

              <!-- OTP Code Display Box -->
              <div style="text-align:center;margin:28px 0;">
                <div style="display:inline-block;background:#09090b;border:2px solid #f59e0b;border-radius:16px;padding:18px 32px;box-shadow:0 8px 24px rgba(245,158,11,0.15);">
                  <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#f59e0b;margin-left:10px;">
                    ${code}
                  </span>
                </div>
              </div>

              <p style="margin:0 0 20px 0;font-size:12px;color:#71717a;text-align:center;">
                This code expires in <strong>10 minutes</strong>. Never share this code with anyone.
              </p>

              <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;margin-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
                  If you didn't request this code, you can safely ignore this email. No action is required.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#121215;padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0;font-size:11px;color:#52525b;">
                &copy; 2026 Sabdham Audio Inc. All rights reserved. High fidelity Tamil, Sinhala, & Global streaming engine.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // A. Check Resend API
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_')) {
    const res = await sendViaResend(
      process.env.RESEND_API_KEY,
      toEmail,
      subject,
      htmlContent,
      textContent
    );
    if (res.success) {
      console.log(`📨 [Email Delivered via Resend] To: ${toEmail} | Code: [${code}] | ID: ${res.messageId}`);
      return res;
    }
  }

  // B. Check SMTP or Gmail transporter
  const transporter = getTransporter();
  if (transporter) {
    try {
      const fromAddr =
        process.env.SMTP_FROM ||
        process.env.EMAIL_FROM ||
        process.env.GMAIL_USER ||
        process.env.EMAIL_USER ||
        process.env.SMTP_USER ||
        `SABDHAM Music <noreply@sabdham.com>`;

      const info = await transporter.sendMail({
        from: fromAddr,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`📨 [Email Delivered via SMTP] To: ${toEmail} | MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('SMTP delivery error:', errMsg);
      cachedTransporter = null; // Clear cached transporter so invalid state does not stick
      return { success: false, error: errMsg };
    }
  }

  // C. Fallback: Log email dispatch to console
  console.log(`\n======================================================`);
  console.log(`📨 [EMAIL DISPATCH TO INBOX]`);
  console.log(`To: ${toEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Verification Code: [${code}] (Valid for 10 minutes)`);
  console.log(`Purpose: ${purpose}`);
  console.log(`======================================================\n`);

  return { success: true };
}
