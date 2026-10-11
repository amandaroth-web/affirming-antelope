import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireTrainedCohort, requireTrainer } from "@/lib/trainer/dal";
import { AssignmentComposer } from "@/components/trainer/assignment-composer";
import { buttonClass } from "@/components/trainer/ui";

export const metadata = { title: "New assignment" };

/** The coming Friday (or next week's, if today is Thursday or later). */
function defaultDue(): string {
  const d = new Date();
  const add = ((5 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + (add < 2 ? add + 7 : add));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function NewAssignmentPage({ params }: PageProps<"/trainer/cohorts/[cohortId]/assignments/new">) {
  const viewer = await requireTrainer();
  const { cohortId } = await params;
  const cohort = await requireTrainedCohort(cohortId);
  if (cohort.archivedAt) redirect(`/trainer/cohorts/${cohort.id}/assignments`);

  return (
    <div>
      <Link href={`/trainer/cohorts/${cohort.id}/assignments`} className={buttonClass("ghost", "sm", "-ml-3")}>
        <ArrowLeft size={16} weight="bold" aria-hidden /> Assignments
      </Link>
      <h2 className="mt-3 font-display text-[24px] font-bold text-ink">New assignment</h2>
      <AssignmentComposer cohortId={cohort.id} trainerName={viewer.displayName} defaultDue={defaultDue()} />
    </div>
  );
}
