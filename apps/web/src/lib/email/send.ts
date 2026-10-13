import "server-only";

/**
 * Transactional email through the Resend HTTP API (no SDK). Server only.
 *
 *   RESEND_API_KEY  required to send. Missing: skip, log once, carry on.
 *   EMAIL_MODE=log  print each email to the server console instead of sending (local
 *                   dev and tests). Nothing leaves the machine.
 *
 * sendEmail never throws: an email is a courtesy on top of an action that already
 * succeeded, so a Resend outage must not fail the action. Callers run it in after().
 */

export const EMAIL_FROM = "Affirming Antelope <access@affirmingantelope.com>";

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { sent: true; id?: string } | { sent: false; reason: "logged" | "no_key" | "no_recipients" | "failed" };

let warnedNoKey = false;

export async function sendEmail(email: Email): Promise<SendResult> {
  const to = (Array.isArray(email.to) ? email.to : [email.to]).map((t) => t.trim()).filter(Boolean);
  if (!to.length) return { sent: false, reason: "no_recipients" };

  if (process.env.EMAIL_MODE === "log") {
    console.info(
      ["[email] EMAIL_MODE=log, not sent", `From: ${EMAIL_FROM}`, `To: ${to.join(", ")}`, `Subject: ${email.subject}`, "", email.text].join("\n"),
    );
    return { sent: false, reason: "logged" };
  }

  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn("[email] RESEND_API_KEY is not set; skipping transactional email.");
    }
    return { sent: false, reason: "no_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Resend's error body names the problem (bad domain, bad address); no secrets in it.
      console.error(`[email] Resend answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { sent: false, reason: "failed" };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: body.id };
  } catch (e) {
    console.error("[email] Resend request failed:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "failed" };
  }
}
