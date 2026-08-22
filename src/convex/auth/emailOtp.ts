import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

const OTP_EXPIRY_MINUTES = 15;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Email OTP is not configured. Missing RESEND_API_KEY environment variable.",
    );
  }
  return new Resend(apiKey);
}

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * OTP_EXPIRY_MINUTES, // 15 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array<ArrayBuffer>) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const resend = getResendClient();

    const fromEmail = process.env.RESEND_FROM_EMAIL || "DispatchOS <onboarding@resend.dev>";

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your DispatchOS Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#080B0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080B0F;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#111821;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 0;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#F5F7FA;letter-spacing:-0.02em;">
                DispatchOS
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#8F9AAA;">
                Verification Code
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:14px;color:#F5F7FA;line-height:1.6;">
                Your verification code is:
              </p>
              <div style="background-color:#080B0F;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
                <span style="font-size:36px;font-weight:800;color:#4F8CFF;letter-spacing:8px;font-family:monospace;">
                  ${token}
                </span>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#8F9AAA;line-height:1.5;">
                This code expires in <strong style="color:#F5F7FA;">${OTP_EXPIRY_MINUTES} minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#8F9AAA;line-height:1.5;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;">
                <p style="margin:0;font-size:11px;color:#8F9AAA;line-height:1.5;">
                  DispatchOS — Dispatch Operations Platform
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: "Your DispatchOS verification code",
        html: htmlContent,
      });

      if (error) {
        // SECURITY: Log only safe diagnostic info — never the API key or OTP.
        console.error("[emailOtp] Resend API error:", {
          status: error.statusCode,
          message: error.message,
        });
        throw new Error(
          "Unable to send your verification code. Please try again or contact your administrator.",
        );
      }
    } catch (error) {
      // SECURITY: Never expose raw error details to the client.
      // Re-throw our own safe message; let any unexpected errors through as-is
      // only if they already carry a safe message.
      if (
        error instanceof Error &&
        error.message.includes("Unable to send")
      ) {
        throw error;
      }
      console.error("[emailOtp] Failed to send verification code:", error);
      throw new Error(
        "Unable to send your verification code. Please try again or contact your administrator.",
      );
    }
  },
});
