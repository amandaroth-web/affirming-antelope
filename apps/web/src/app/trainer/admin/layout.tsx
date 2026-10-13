import { getNeedsReviewCounts, getTrainerCohorts, getViewer } from "@/lib/trainer/dal";
import { requireAdmin } from "@/lib/trainer/admin";
import { TrainerIdentify } from "@/components/analytics/trainer-identify";
import { TrainerShell } from "@/components/trainer/shell";

// Outside the (dashboard) group on purpose: that layout sends non-trainers to "Become a
// trainer", and /trainer/admin must answer 404 to everyone who isn't an admin, trainer
// or not. The page checks requireAdmin() again; layouts don't guard their pages.
export default async function AdminLayout({ children }: LayoutProps<"/trainer/admin">) {
  await requireAdmin();
  const viewer = (await getViewer())!;
  const [cohorts, counts] = viewer.canTrain
    ? await Promise.all([getTrainerCohorts(), getNeedsReviewCounts()])
    : [[], new Map<string, number>()];
  return (
    <TrainerShell
      viewer={{ name: viewer.displayName, email: viewer.email ?? "" }}
      isAdmin
      cohorts={cohorts
        .filter((c) => !c.archivedAt)
        .map((c) => ({ id: c.id, name: c.name, needsReview: counts.get(c.id) ?? 0 }))}
    >
      {viewer.canTrain ? <TrainerIdentify userId={viewer.id} /> : null}
      {children}
    </TrainerShell>
  );
}
