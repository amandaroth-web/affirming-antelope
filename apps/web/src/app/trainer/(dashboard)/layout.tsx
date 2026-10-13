import { getNeedsReviewCounts, getTrainerCohorts, requireTrainer } from "@/lib/trainer/dal";
import { getAdmin } from "@/lib/trainer/admin";
import { TrainerIdentify } from "@/components/analytics/trainer-identify";
import { TrainerShell } from "@/components/trainer/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireTrainer();
  const [cohorts, counts, admin] = await Promise.all([getTrainerCohorts(), getNeedsReviewCounts(), getAdmin()]);
  return (
    <TrainerShell
      viewer={{ name: viewer.displayName, email: viewer.email ?? "" }}
      isAdmin={!!admin}
      cohorts={cohorts
        .filter((c) => !c.archivedAt)
        .map((c) => ({ id: c.id, name: c.name, needsReview: counts.get(c.id) ?? 0 }))}
    >
      {/* Supabase uuid only; the name and email above never reach analytics. */}
      <TrainerIdentify userId={viewer.id} />
      {children}
    </TrainerShell>
  );
}
