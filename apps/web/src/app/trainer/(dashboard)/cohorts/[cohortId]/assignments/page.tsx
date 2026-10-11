import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getPathway } from "@antelope/core";
import { createClient } from "@/lib/supabase/server";
import { requireTrainedCohort, requireTrainer } from "@/lib/trainer/dal";
import { dueLabel, isOverdue, itemDetail, itemTitle, summarizeItems, type ItemDraft, type ItemKind } from "@/lib/trainer/content";
import { AssignmentCard, type AssignmentView } from "@/components/trainer/assignment-card";
import { Card, EmptyState, buttonClass } from "@/components/trainer/ui";
import { Stagger, StaggerItem } from "@/components/trainer/motion";

export const metadata = { title: "Assignments" };

export default async function AssignmentsPage({ params, searchParams }: PageProps<"/trainer/cohorts/[cohortId]/assignments">) {
  await requireTrainer();
  const { cohortId } = await params;
  const created = (await searchParams).created;
  const cohort = await requireTrainedCohort(cohortId);
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, instructions, due_at, created_at, archived_at, assignment_items(id, kind, ref_id, skill, quantity, position)")
    .eq("cohort_id", cohort.id)
    .is("archived_at", null)
    .order("due_at", { ascending: true, nullsFirst: false });

  const progress = await Promise.all(
    (assignments ?? []).map((a) => supabase.rpc("assignment_progress", { assignment_id: a.id }).then((r) => r.data ?? [])),
  );

  const views: AssignmentView[] = (assignments ?? []).map((a, idx) => {
    const items = [...(a.assignment_items ?? [])].sort((x, y) => x.position - y.position);
    const drafts: ItemDraft[] = items.map((i) => ({
      kind: i.kind as ItemKind,
      refId: i.ref_id,
      skill: (i.skill ?? null) as ItemDraft["skill"],
      quantity: i.quantity,
    }));
    const byLearner = new Map<string, { name: string; done: number; total: number }>();
    for (const row of progress[idx]) {
      const cur = byLearner.get(row.user_id) ?? { name: row.display_name, done: 0, total: 0 };
      cur.done += row.done;
      cur.total += row.quantity;
      byLearner.set(row.user_id, cur);
    }
    return {
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      dueLabel: dueLabel(a.due_at),
      overdue: isOverdue(a.due_at),
      summary: summarizeItems(drafts),
      items: drafts.map((d, i) => ({ id: items[i].id, kind: d.kind, title: itemTitle(d), detail: itemDetail(d), quantity: d.quantity })),
      learners: [...byLearner.entries()]
        .map(([id, v]) => ({ id, ...v }))
        .sort((x, y) => y.done / (y.total || 1) - x.done / (x.total || 1) || x.name.localeCompare(y.name)),
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[60ch] text-[15px] font-semibold text-muted">
          Assignments appear on each learner&apos;s path in the app. Progress counts practice done since you assigned it.
        </p>
        {!cohort.archivedAt ? (
          <Link href={`/trainer/cohorts/${cohort.id}/assignments/new`} className={buttonClass("primary")}>
            <Plus size={18} weight="bold" aria-hidden /> New assignment
          </Link>
        ) : null}
      </div>

      {views.length ? (
        <Stagger as="ul" className="mt-6 grid gap-6">
          {views.map((v) => (
            <StaggerItem as="li" key={v.id}>
              <AssignmentCard cohortId={cohort.id} a={v} highlight={created === v.id} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Card className="mt-6">
          <EmptyState
            title="Nothing assigned yet"
            action={
              !cohort.archivedAt ? (
                <Link href={`/trainer/cohorts/${cohort.id}/assignments/new`} className={buttonClass("primary", "lg")}>
                  Create an assignment
                </Link>
              ) : null
            }
          >
            Pick a few short practices, a role-play, or a lesson from the {getPathway(cohort.pathwayId).title} pathway, and give it a due date.
            Learners see it at the top of their path.
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
