import { getAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/trainer/admin";
import { ago } from "@/lib/trainer/content";
import { learnerCountLabel } from "@/lib/trainer/access";
import { PendingRequests, type PendingRequestRow } from "@/components/trainer/admin/pending-requests";
import { CreateTrainerCode } from "@/components/trainer/admin/create-code";
import { Avatar, Badge, Card, EmptyState, Eyebrow, PageTitle, SectionTitle } from "@/components/trainer/ui";

export const metadata = { title: "Admin" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function fmtDate(iso: string | null): string {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

export default async function AdminPage() {
  await requireAdmin();
  const db = getAdminClient();

  if (!db) {
    return (
      <div className="mx-auto max-w-[1120px] px-6 py-8 md:px-10 md:py-10">
        <Eyebrow>Admin</Eyebrow>
        <PageTitle className="mt-1">Trainer access</PageTitle>
        <Card className="mt-8 p-6">
          <p className="text-[15px] font-semibold text-muted">
            The server has no Supabase secret key (SUPABASE_SECRET_KEY), so it can&apos;t read requests or codes.
          </p>
        </Card>
      </div>
    );
  }

  const [requests, trainers, codes] = await Promise.all([
    db.rpc("admin_pending_trainer_requests"),
    db.rpc("admin_trainers"),
    db.rpc("admin_trainer_codes"),
  ]);

  const now = new Date();
  const pending: PendingRequestRow[] = (requests.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    organization: r.organization,
    learners: learnerCountLabel(r.learner_count),
    note: r.note,
    age: ago(r.created_at, now),
  }));
  const loadFailed = !!(requests.error || trainers.error || codes.error);

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-8 md:px-10 md:py-10">
      <Eyebrow>Admin</Eyebrow>
      <PageTitle className="mt-1">Trainer access</PageTitle>
      {loadFailed ? (
        <p role="alert" className="mt-4 text-[14px] font-bold text-[#a4472a]">
          Part of this page didn&apos;t load. Refresh to try again.
        </p>
      ) : null}

      <section className="mt-8" aria-labelledby="pending">
        <div className="flex items-center gap-3">
          <SectionTitle id="pending">Pending requests</SectionTitle>
          {pending.length ? <Badge tone="gold">{pending.length}</Badge> : null}
        </div>
        {pending.length ? (
          <PendingRequests requests={pending} />
        ) : (
          <Card className="mt-4" depth="md">
            <EmptyState title="No one is waiting" pose="celebrate">
              New requests from &ldquo;Become a trainer&rdquo; show up here, and each one sends you an email.
            </EmptyState>
          </Card>
        )}
      </section>

      <section className="mt-12" aria-labelledby="trainers">
        <SectionTitle id="trainers">Trainers</SectionTitle>
        <Card className="mt-4 overflow-hidden" depth="md">
          {trainers.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[14px]">
                <thead>
                  <tr className="border-b-2 border-line text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">
                    <th scope="col" className="px-6 py-3">Trainer</th>
                    <th scope="col" className="px-4 py-3">Cohorts</th>
                    <th scope="col" className="px-4 py-3">Trainer since</th>
                    <th scope="col" className="px-6 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.data.map((t) => (
                    <tr key={t.user_id} className="border-b-2 border-soft last:border-0">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={t.display_name} size={34} />
                          <div className="min-w-0">
                            <p className="truncate font-extrabold text-ink">{t.display_name}</p>
                            <p className="truncate text-[13px] font-semibold text-muted">{t.email ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-extrabold text-ink">{t.cohort_count}</td>
                      <td className="px-4 py-3 font-bold text-ink/80">{fmtDate(t.trainer_since)}</td>
                      <td className="px-6 py-3 font-bold text-ink/80">{fmtDate(t.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-5 text-[15px] font-semibold text-muted">No trainers yet.</p>
          )}
        </Card>
      </section>

      <section className="mt-12" aria-labelledby="codes">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionTitle id="codes">Trainer codes</SectionTitle>
            <p className="mt-1 max-w-[60ch] text-[14px] font-semibold text-muted">
              For bulk invites: anyone with a code gets trainer access right away, until it runs out or expires.
            </p>
          </div>
        </div>
        <CreateTrainerCode />
        <Card className="mt-5 overflow-hidden" depth="md">
          {codes.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[14px]">
                <thead>
                  <tr className="border-b-2 border-line text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">
                    <th scope="col" className="px-6 py-3">Code</th>
                    <th scope="col" className="px-4 py-3">Uses</th>
                    <th scope="col" className="px-4 py-3">Expires</th>
                    <th scope="col" className="px-6 py-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.data.map((c) => {
                    const expired = !!c.expires_at && new Date(c.expires_at) <= now;
                    const usedUp = c.max_uses != null && c.uses >= c.max_uses;
                    return (
                      <tr key={c.code} className="border-b-2 border-soft last:border-0">
                        <td className="px-6 py-3">
                          <span className="font-display text-[16px] font-bold tracking-[0.06em] text-navy">{c.code}</span>
                          {expired ? (
                            <Badge tone="clay" className="ml-2">Expired</Badge>
                          ) : usedUp ? (
                            <Badge tone="neutral" className="ml-2">Used up</Badge>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-ink">
                          {c.uses} / {c.max_uses ?? "∞"}
                        </td>
                        <td className="px-4 py-3 font-bold text-ink/80">{c.expires_at ? fmtDate(c.expires_at) : "Never"}</td>
                        <td className="px-6 py-3 font-semibold text-muted">{c.note ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-5 text-[15px] font-semibold text-muted">No trainer codes yet.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
