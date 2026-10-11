import { getNeedsReviewCounts, getTrainerCohorts, requireTrainer } from "@/lib/trainer/dal";
import { TrainerShell } from "@/components/trainer/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireTrainer();
  const [cohorts, counts] = await Promise.all([getTrainerCohorts(), getNeedsReviewCounts()]);
  return (
    <TrainerShell
      viewer={{ name: viewer.displayName, email: viewer.email ?? "" }}
      cohorts={cohorts
        .filter((c) => !c.archivedAt)
        .map((c) => ({ id: c.id, name: c.name, needsReview: counts.get(c.id) ?? 0 }))}
    >
      {children}
    </TrainerShell>
  );
}
