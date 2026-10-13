import "server-only";
import { SITE_URL } from "@/lib/site";
import { learnerCountLabel } from "@/lib/trainer/access";
import type { Email } from "./send";

// Short, plain emails in the brand voice. Inline styles only (email clients ignore
// <style>), no images, no tracking pixels, no click tracking. Every email has a text
// part that says the same thing.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** One header line can't carry a newline, and long names make subjects unreadable. */
function oneLine(s: string, max = 80): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#ffffff;color:#2E3448;font-family:Nunito,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.55;">
<div style="max-width:520px;margin:0 auto;">
${bodyHtml}
<p style="margin:32px 0 0;color:#68708C;font-size:13px;">Affirming Antelope · Motivational Interviewing practice</p>
</div>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${esc(href)}" style="display:inline-block;background:#4F6BED;color:#ffffff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:14px;">${esc(label)}</a></p>`;
}

export interface RequestDetails {
  name: string;
  email: string;
  organization: string;
  learnerCount: string;
  note: string | null;
}

/** To every ADMIN_EMAILS address when someone asks for trainer access. */
export function newTrainerRequestEmail(r: RequestDetails, adminUrl = `${SITE_URL}/trainer/admin`): Omit<Email, "to"> {
  const learners = learnerCountLabel(r.learnerCount);
  const rows: [string, string][] = [
    ["Name", r.name],
    ["Email", r.email],
    ["Organization", r.organization],
    ["Learners", learners],
  ];
  if (r.note) rows.push(["Note", r.note]);

  const html = layout(`
<p style="margin:0 0 16px;font-size:20px;font-weight:800;">New trainer request</p>
<p style="margin:0 0 16px;">${esc(r.name)} asked for trainer access.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#68708C;font-weight:700;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:6px 0;font-weight:700;white-space:pre-wrap;">${esc(v)}</td></tr>`,
  )
  .join("\n")}
</table>
${button(adminUrl, "Review the request")}
<p style="margin:0;color:#68708C;font-size:14px;">Approve or decline it at ${esc(adminUrl)}</p>`);

  const text = [
    `${r.name} asked for trainer access.`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Review it: ${adminUrl}`,
  ].join("\n");

  return { subject: `New trainer request: ${oneLine(r.name)}, ${oneLine(r.organization)}`, html, text };
}

/** To the requester when an admin approves them. */
export function trainerApprovedEmail(name: string, dashboardUrl = "https://affirmingantelope.com/trainer"): Omit<Email, "to"> {
  const first = oneLine(name).split(" ")[0] || "there";
  const html = layout(`
<p style="margin:0 0 16px;">Hi ${esc(first)},</p>
<p style="margin:0 0 16px;">Your trainer access is on. Sign in with this email address to create a cohort, share its join code with your learners, and review the role-plays they send you.</p>
${button(dashboardUrl, "Open the trainer dashboard")}
<p style="margin:0;">Blake</p>`);

  const text = [
    `Hi ${first},`,
    "",
    "Your trainer access is on. Sign in with this email address to create a cohort, share its join code with your learners, and review the role-plays they send you.",
    "",
    `Open the trainer dashboard: ${dashboardUrl}`,
    "",
    "Blake",
  ].join("\n");

  return { subject: "You're in: trainer access for Affirming Antelope", html, text };
}
