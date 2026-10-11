import Link from "next/link";
import { ArrowRight, Microphone } from "@phosphor-icons/react/dist/ssr";
import { getDrill, getScenario } from "@antelope/core";
import { createClient } from "@/lib/supabase/server";
import { requireTrainedCohort, requireTrainer } from "@/lib/trainer/dal";
import { ago, duration, ratingLabel, skillName } from "@/lib/trainer/content";
import { Avatar, Badge, Card, EmptyState, focusRing } from "@/components/trainer/ui";
import { Stagger, StaggerItem } from "@/components/trainer/motion";
import { QueueControls } from "@/components/trainer/queue-controls";

export const metadata = { title: "Reviews" };

type Status = "submitted" | "reviewed" | "all";

export default async function ReviewsPage({ params, searchParams }: PageProps<"/trainer/cohorts/[cohortId]/reviews">) {
  await requireTrainer();
  const { cohortId } = await params;
  const sp = await searchParams;
  const status: Status = sp.status === "reviewed" || sp.status === "all" ? sp.status : "submitted";
  const order = sp.sort === "newest" ? "newest" : "oldest";
  const cohort = await requireTrainedCohort(cohortId);
  const supabase = await createClient();

  let q = supabase
    .from("submissions")
    .select(
      "id, status, note_to_trainer, submitted_at, reviewed_at, profiles!submissions_user_id_fkey(display_name), practice_sessions(kind, ref_id, skill, mode, duration_sec), reviews(rating, audio_path, try_again, learner_seen_at)",
    )
    .eq("cohort_id", cohort.id)
    .order("submitted_at", { ascending: order === "oldest" });
  q = status === "all" ? q.in("status", ["submitted", "reviewed"]) : q.eq("status", status);
  const [{ data: rows }, { data: counts }] = await Promise.all([
    q,
    supabase.from("submissions").select("status").eq("cohort_id", cohort.id).in("status", ["submitted", "reviewed"]),
  ]);
  const n = { submitted: 0, reviewed: 0, all: 0 };
  for (const c of counts ?? []) {
    n.all += 1;
    if (c.status === "submitted") n.submitted += 1;
    if (c.status === "reviewed") n.reviewed += 1;
  }

  const items = (rows ?? []).map((r) => {
    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
    const s = one(r.practice_sessions);
    const review = one(r.reviews);
    const learner = one(r.profiles)?.display_name ?? "Learner";
    const scenario = s?.kind === "roleplay" ? getScenario(s.ref_id) : undefined;
    const drill = s?.kind === "drill" ? getDrill(s.ref_id) : undefined;
    return {
      id: r.id,
      status: r.status,
      learner,
      title: scenario ? scenario.title : drill ? drill.instruction : (s?.ref_id ?? "Practice"),
      sub: scenario
        ? `${scenario.persona.name} · ${scenario.context}`
        : drill
          ? `Drill · ${drill.context}`
          : "",
      skill: skillName(s?.skill),
      mode: s?.kind === "roleplay" ? (s.mode === "voice" ? "Voice role-play" : "Text role-play") : "Drill",
      duration: duration(s?.duration_sec),
      note: r.note_to_trainer,
      submitted: ago(r.submitted_at),
      submittedAt: r.submitted_at,
      reviewed: r.reviewed_at ? ago(r.reviewed_at) : null,
      rating: ratingLabel(review?.rating),
      audio: !!review?.audio_path,
      seen: !!review?.learner_seen_at,
    };
  });

  return (
    <div>
      <QueueControls status={status} sort={order} counts={n} />
      {items.length ? (
        <Stagger as="ul" className="mt-6 grid gap-3">
          {items.map((it) => (
            <StaggerItem as="li" key={it.id}>
              <Link
                href={`/trainer/submissions/${it.id}`}
                className={`group grid gap-4 rounded-[20px] border-2 border-line bg-white px-5 py-4 shadow-[0_4px_0_var(--shadow)] transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary-tint hover:shadow-[0_6px_0_var(--shadow)] active:translate-y-[2px] active:shadow-[0_2px_0_var(--shadow)] md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:items-center ${focusRing}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={it.learner} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-extrabold text-ink">{it.learner}</p>
                    <p className="text-[13px] font-semibold text-muted">
                      <time dateTime={it.submittedAt}>Sent {it.submitted.toLowerCase()}</time>
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[17px] font-bold text-ink">{it.title}</span>
                    {it.skill ? <Badge>{it.skill}</Badge> : null}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-bold text-muted">
                    {[it.sub, it.mode, it.duration].filter(Boolean).join(" · ")}
                  </p>
                  {it.note ? <p className="mt-1.5 line-clamp-1 text-[14px] font-semibold italic text-ink/75">“{it.note}”</p> : null}
                </div>
                <div className="flex items-center gap-3 md:justify-end">
                  {it.status === "submitted" ? (
                    <Badge tone="gold">Needs review</Badge>
                  ) : (
                    <span className="flex items-center gap-2">
                      {it.audio ? <Microphone size={16} weight="bold" className="text-muted" aria-label="Has audio feedback" /> : null}
                      <Badge tone="teal">Reviewed{it.rating ? ` · ${it.rating}` : ""}</Badge>
                    </span>
                  )}
                  <ArrowRight size={18} weight="bold" className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Card className="mt-6">
          <EmptyState title={status === "submitted" ? "Nothing waiting for you" : "No reviews here yet"} pose={status === "submitted" ? "celebrate" : "wave"}>
            {status === "submitted"
              ? "When a learner sends you a role-play from the app, it lands here. Learners choose what to share; you never see practice they keep to themselves."
              : "Reviews you save appear here, with the level you gave and whether the learner has seen it."}
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
