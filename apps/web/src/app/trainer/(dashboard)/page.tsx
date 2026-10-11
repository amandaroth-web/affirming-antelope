import Link from "next/link";
import { ArrowRight, CalendarBlank, ChatCircleText, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { getNeedsReviewCounts, getTrainerCohorts, requireTrainer } from "@/lib/trainer/dal";
import { dueLabel, isOverdue } from "@/lib/trainer/content";
import { CreateCohortButton } from "@/components/trainer/create-cohort";
import { Badge, Card, EmptyState, Eyebrow, PageTitle, SectionTitle, buttonClass, focusRing } from "@/components/trainer/ui";
import { Stagger, StaggerItem } from "@/components/trainer/motion";

export const metadata = { title: "Cohorts" };

function greeting(name: string): string {
  const first = name.replace(/^(dr|mr|ms|mrs)\.?\s+/i, "").split(/\s+/)[0] ?? name;
  return `Welcome back, ${first}`;
}

export default async function CohortsHome({ searchParams }: PageProps<"/trainer">) {
  const viewer = await requireTrainer();
  const welcome = (await searchParams).welcome === "1";
  const [cohorts, counts] = await Promise.all([getTrainerCohorts(), getNeedsReviewCounts()]);
  const ids = cohorts.map((c) => c.id);

  const supabase = await createClient();
  const [{ data: members }, { data: assignments }, { data: oldest }] = await Promise.all([
    ids.length
      ? supabase.from("cohort_members").select("cohort_id").in("cohort_id", ids).eq("role", "learner")
      : Promise.resolve({ data: [] as { cohort_id: string }[] }),
    ids.length
      ? supabase.from("assignments").select("cohort_id, title, due_at").in("cohort_id", ids).is("archived_at", null)
      : Promise.resolve({ data: [] as { cohort_id: string; title: string; due_at: string | null }[] }),
    ids.length
      ? supabase
          .from("submissions")
          .select("id, cohort_id, submitted_at")
          .in("cohort_id", ids)
          .eq("status", "submitted")
          .order("submitted_at", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [] as { id: string; cohort_id: string; submitted_at: string }[] }),
  ]);

  const learnerCount = new Map<string, number>();
  for (const m of members ?? []) learnerCount.set(m.cohort_id, (learnerCount.get(m.cohort_id) ?? 0) + 1);
  const nextDue = new Map<string, { title: string; due_at: string }>();
  for (const a of assignments ?? []) {
    if (!a.due_at || isOverdue(a.due_at, 86_400_000)) continue;
    const cur = nextDue.get(a.cohort_id);
    if (!cur || a.due_at < cur.due_at) nextDue.set(a.cohort_id, { title: a.title, due_at: a.due_at });
  }

  const active = cohorts.filter((c) => !c.archivedAt);
  const archived = cohorts.filter((c) => c.archivedAt);
  const totalNeeds = active.reduce((n, c) => n + (counts.get(c.id) ?? 0), 0);
  const needsCohorts = active.filter((c) => counts.get(c.id)).length;

  return (
    <div className="mx-auto max-w-[1120px] px-6 py-8 md:px-10 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Cohorts</Eyebrow>
          <PageTitle className="mt-1">{welcome ? "You're a trainer now" : greeting(viewer.displayName)}</PageTitle>
        </div>
        {active.length ? <CreateCohortButton /> : null}
      </div>

      {active.length ? (
        <Card className="mt-8 overflow-hidden" depth="md" aria-labelledby="attention">
          <div className="flex flex-wrap items-center gap-5 px-6 py-5">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${totalNeeds ? "bg-gold-tint text-gold-ink" : "bg-soft text-primary"}`}
              aria-hidden
            >
              <ChatCircleText size={26} weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="attention" className="font-display text-[20px] font-bold text-ink">
                {totalNeeds
                  ? `${totalNeeds} ${totalNeeds === 1 ? "submission needs" : "submissions need"} review`
                  : "You're all caught up"}
              </h2>
              <p className="mt-0.5 text-[15px] font-semibold text-muted">
                {totalNeeds
                  ? needsCohorts > 1
                    ? `Across ${needsCohorts} cohorts. Learners see your feedback in the app.`
                    : "Learners see your feedback in the app as soon as you save it."
                  : "New role-plays your learners send you will show up here."}
              </p>
            </div>
            {totalNeeds && oldest?.[0] ? (
              <Link href={`/trainer/submissions/${oldest[0].id}`} className={buttonClass("primary")}>
                Start with the oldest <ArrowRight size={16} weight="bold" aria-hidden />
              </Link>
            ) : null}
          </div>
        </Card>
      ) : null}

      {active.length ? (
        <section className="mt-10" aria-labelledby="active-cohorts">
          <SectionTitle id="active-cohorts">Active cohorts</SectionTitle>
          <Stagger as="ul" className="mt-4 grid gap-5 md:grid-cols-2">
            {active.map((c) => {
              const needs = counts.get(c.id) ?? 0;
              const learners = learnerCount.get(c.id) ?? 0;
              const due = nextDue.get(c.id);
              return (
                <StaggerItem as="li" key={c.id}>
                  <Link
                    href={`/trainer/cohorts/${c.id}`}
                    className={`group block h-full rounded-[20px] border-2 border-line bg-white p-6 shadow-[0_5px_0_var(--shadow)] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary-tint hover:shadow-[0_7px_0_var(--shadow)] active:translate-y-[3px] active:shadow-[0_2px_0_var(--shadow)] ${focusRing}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-[21px] font-bold leading-tight text-ink">{c.name}</h3>
                      {needs ? <Badge tone="gold">{needs} to review</Badge> : <Badge tone="teal">Caught up</Badge>}
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-4 text-[14px]">
                      <div>
                        <dt className="flex items-center gap-1.5 font-bold text-muted">
                          <UsersThree size={16} weight="bold" aria-hidden /> Learners
                        </dt>
                        <dd className="mt-0.5 font-extrabold text-ink">{learners ? `${learners} joined` : "No one yet"}</dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-1.5 font-bold text-muted">
                          <CalendarBlank size={16} weight="bold" aria-hidden /> Next due
                        </dt>
                        <dd className="mt-0.5 truncate font-extrabold text-ink">{due ? `${due.title} · ${dueLabel(due.due_at).replace(/^Due /, "")}` : "Nothing due"}</dd>
                      </div>
                    </dl>
                    <div className="mt-5 flex items-center justify-between border-t-2 border-soft pt-4">
                      <p className="text-[13px] font-bold text-muted">
                        Join code <span className="ml-1 font-display text-[15px] tracking-[0.06em] text-navy">{c.joinCode}</span>
                      </p>
                      <span className="flex items-center gap-1 text-[14px] font-extrabold text-primary transition-transform group-hover:translate-x-0.5">
                        Open <ArrowRight size={15} weight="bold" aria-hidden />
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      ) : (
        <Card className="mt-8">
          <EmptyState
            title="Create your first cohort"
            action={<CreateCohortButton size="lg" label="Create a cohort" />}
          >
            A cohort is a group of learners you train together. You&apos;ll get a join code to share; learners enter it in
            the Affirming Antelope app, and their submitted role-plays land here for your review.
          </EmptyState>
        </Card>
      )}

      {archived.length ? (
        <section className="mt-12" aria-labelledby="archived-cohorts">
          <h2 id="archived-cohorts" className="text-[14px] font-extrabold uppercase tracking-[0.08em] text-muted">
            Archived
          </h2>
          <ul className="mt-3 grid gap-2">
            {archived.map((c) => (
              <li key={c.id}>
                <Link href={`/trainer/cohorts/${c.id}`} className={`flex items-center justify-between rounded-2xl border-2 border-line px-5 py-3 font-bold text-ink/75 hover:bg-soft/50 ${focusRing}`}>
                  {c.name}
                  <span className="text-[13px] text-muted">Archived</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
