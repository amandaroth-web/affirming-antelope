import { getNeedsReviewCounts, requireTrainedCohort, requireTrainer } from "@/lib/trainer/dal";
import { CohortTabs } from "@/components/trainer/cohort-tabs";
import { ArchiveCohort } from "@/components/trainer/archive-cohort";
import { Badge, Eyebrow } from "@/components/trainer/ui";

export default async function CohortLayout({ children, params }: LayoutProps<"/trainer/cohorts/[cohortId]">) {
  await requireTrainer();
  const { cohortId } = await params;
  const cohort = await requireTrainedCohort(cohortId);
  const needs = (await getNeedsReviewCounts()).get(cohort.id) ?? 0;
  const starts = cohort.startsOn
    ? new Date(`${cohort.startsOn}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-8 pb-16 md:px-10 md:pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>MI for Leaders{starts ? ` · Started ${starts}` : ""}</Eyebrow>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-[1.1] tracking-tight text-ink">
            {cohort.name}
            {cohort.archivedAt ? (
              <Badge className="ml-3 align-middle" tone="neutral">
                Archived
              </Badge>
            ) : null}
          </h1>
        </div>
        <ArchiveCohort cohortId={cohort.id} archived={!!cohort.archivedAt} />
      </div>
      <CohortTabs cohortId={cohort.id} needsReview={needs} />
      <div className="pt-8">{children}</div>
    </div>
  );
}
