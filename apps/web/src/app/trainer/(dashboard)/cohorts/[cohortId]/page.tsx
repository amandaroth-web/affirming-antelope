import { createClient } from "@/lib/supabase/server";
import { requireTrainedCohort, requireTrainer } from "@/lib/trainer/dal";
import { ago } from "@/lib/trainer/content";
import { JoinCode } from "@/components/trainer/join-code";
import { ParticipantsTable, type ParticipantRow } from "@/components/trainer/participants-table";
import { Card, EmptyState } from "@/components/trainer/ui";

export const metadata = { title: "Participants" };

export default async function ParticipantsPage({ params }: PageProps<"/trainer/cohorts/[cohortId]">) {
  await requireTrainer();
  const { cohortId } = await params;
  const cohort = await requireTrainedCohort(cohortId);
  const supabase = await createClient();
  const { data: stats } = await supabase.rpc("cohort_member_stats", { cohort_id: cohort.id });

  const rows: ParticipantRow[] = (stats ?? []).map((s) => ({
    id: s.user_id,
    name: s.display_name,
    assigned: s.assigned,
    completed: s.completed,
    needsReview: s.needs_review,
    lastActiveAt: s.last_active_at ?? null,
    lastActiveLabel: s.last_active_at ? ago(s.last_active_at) : "Not yet",
  }));

  return (
    <div className="grid gap-8">
      {!cohort.archivedAt ? (
        <Card depth="md" className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 bg-soft/40 px-7 py-6" aria-labelledby="invite">
          <div className="max-w-[42ch]">
            <h2 id="invite" className="font-display text-[19px] font-bold text-ink">
              Invite learners
            </h2>
            <p className="mt-1 text-[14px] font-semibold leading-relaxed text-muted">
              Share this code. Learners open the Affirming Antelope app, tap <span className="font-extrabold text-ink">Join a cohort</span>,
              and enter it. They appear here as soon as they join.
            </p>
          </div>
          <JoinCode cohortId={cohort.id} code={cohort.joinCode} size="md" />
        </Card>
      ) : null}

      {rows.length ? (
        <ParticipantsTable cohortId={cohort.id} rows={rows} />
      ) : (
        <Card>
          <EmptyState title="No learners yet">
            <p>
              Once someone joins with code <span className="font-display font-bold tracking-[0.06em] text-navy">{cohort.joinCode}</span>,
              you&apos;ll see what they&apos;ve been assigned, what they&apos;ve finished, and anything they&apos;ve sent you to review.
            </p>
            <ol className="mt-4 grid gap-1.5 text-[14px] text-ink/80">
              <li>1. Learner installs the Affirming Antelope app and signs in with their email.</li>
              <li>2. They tap Join a cohort and enter the code.</li>
              <li>3. Your assignments show up on their path straight away.</li>
            </ol>
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
