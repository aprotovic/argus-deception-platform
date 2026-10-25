"""Email dispatch service for ARGUS SOC security notifications and verification codes."""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.logging_config import logger


def _send_smtp_sync(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    """Synchronous SMTP email delivery."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(
            f"SMTP not fully configured (SMTP_USER/SMTP_PASSWORD empty in .env). "
            f"Skipping direct network dispatch for {to_email}."
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["From"] = f"ARGUS Panoptes Defense <{from_addr}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD

    try:
        if port == 465 or settings.SMTP_SSL:
            server = smtplib.SMTP_SSL(host, port, timeout=12)
        else:
            server = smtplib.SMTP(host, port, timeout=12)
            if settings.SMTP_TLS:
                server.ehlo()
                server.starttls()
                server.ehlo()

        server.login(user, password)
        server.sendmail(from_addr, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Successfully dispatched security verification email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch security verification email to {to_email}: {e}")
        return False


async def send_password_reset_email(to_email: str, code: str, username: str) -> bool:
    """Dispatches a 6-digit security verification code to the operator's email address."""
    subject = f"[ARGUS DEFENSE] Passcode Verification Code: {code}"

    text_body = f"""ARGUS PANOPTES CYBER DEFENSE ENCLAVE
========================================
SECURITY PASSCODE RECOVERY REQUEST

Operator Call-Sign: {username}
Registered Email: {to_email}

Your 6-digit verification code is:

    {code}

This code expires in 2 minutes.
Enter this code in the ARGUS Operator Portal to set your new security passcode.

If you did not request this recovery code, someone may be attempting to access
your account. Contact your SOC Administrator or Super Admin immediately.

Security Level: DISA STIG / FOUO
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #04080e; color: #f1f5f9; margin: 0; padding: 24px; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #071220; border: 1px solid #1e3a5f; border-radius: 10px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .header {{ border-bottom: 1px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px; }}
    .badge {{ background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-size: 11px; padding: 4px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }}
    h1 {{ font-size: 20px; color: #ffffff; margin: 16px 0 6px 0; }}
    p {{ font-size: 14px; line-height: 1.6; color: #94a3b8; }}
    .code-box {{ background: #04080e; border: 2px dashed #10b981; border-radius: 8px; text-align: center; padding: 20px; margin: 24px 0; }}
    .code {{ font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #10b981; font-family: 'Courier New', monospace; }}
    .notice {{ font-size: 12px; color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 12px; margin-top: 24px; }}
    .footer {{ font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e3a5f; padding-top: 16px; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">ARGUS PANOPTES ENCLAVE</span>
    </div>
    <h1>Security Passcode Recovery</h1>
    <p>Operator <strong>{username}</strong>,</p>
    <p>A request was received to reset your ARGUS Security Operations passcode. Use the verification code below to authorize the change:</p>
    
    <div class="code-box">
      <div class="code">{code}</div>
    </div>
    
    <p>This verification code is valid for <strong>2 minutes</strong>. If you did not initiate this request, notify your SOC Super Administrator immediately.</p>
    
    <div class="notice">
      <strong>SECURITY NOTICE:</strong> Never share this verification code with anyone. ARGUS security staff will never request your code.
    </div>
    
    <div class="footer">
      ARGUS PANOPTES &bull; AUTONOMOUS CYBER DECEPTION PLATFORM<br>
      DISA STIG ENFORCED &bull; NIST SP 800-53 COMPLIANT
    </div>
  </div>
</body>
</html>
"""

    return await asyncio.to_thread(_send_smtp_sync, to_email, subject, text_body, html_body)
