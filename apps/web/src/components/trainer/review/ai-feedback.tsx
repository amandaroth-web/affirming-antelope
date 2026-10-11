import { Lightbulb, Sparkle, Star } from "@phosphor-icons/react/dist/ssr";
import type { Debrief, Turn } from "@antelope/core";
import type { Exchange } from "@/lib/trainer/exchanges";
import { FAMILY, TALLY_ROWS, moveLabel, MOVE } from "@/lib/trainer/content";
import { Card, SectionTitle } from "../ui";
import { TrajectoryChart } from "./trajectory-chart";

export function AiFeedback({
  debrief,
  turns,
  exchanges,
  personaName,
  counterpart,
  learnerFirst,
}: {
  debrief: Debrief;
  turns: Turn[];
  exchanges: Exchange[];
  personaName: string;
  /** "Patient" or "Employee". */
  counterpart: string;
  learnerFirst: string;
}) {
  const max = Math.max(1, ...TALLY_ROWS.map((r) => debrief.tallies[r.key] ?? 0));
  const byId = new Map(turns.map((t) => [t.id, t]));
  const ann = new Map(debrief.annotations.map((a) => [a.turnId, a]));

  return (
    <section aria-labelledby="ai-feedback" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle id="ai-feedback">AI practice feedback</SectionTitle>
          <p className="mt-1 max-w-[62ch] text-[14px] font-semibold leading-relaxed text-muted">
            What the AI coach showed {learnerFirst} after the conversation. It&apos;s a practice aid, not an assessment;
            your read of the conversation is the one that counts.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-white px-3 py-1 text-[12px] font-extrabold text-muted">
          <Sparkle size={13} weight="fill" className="text-primary" aria-hidden /> AI-generated · practice aid
        </span>
      </div>

      <Card className="p-6" aria-label="Conversation trajectory">
        <h3 className="font-display text-[17px] font-bold text-ink">How the conversation moved</h3>
        <div className="mt-2">
          <TrajectoryChart exchanges={exchanges} personaName={personaName} counterpart={counterpart} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6" aria-labelledby="tallies">
          <h3 id="tallies" className="font-display text-[17px] font-bold text-ink">
            Moves {learnerFirst} used
          </h3>
          <dl className="mt-4 grid gap-2.5">
            {TALLY_ROWS.map((r) => {
              const v = debrief.tallies[r.key] ?? 0;
              return (
                <div key={r.key} className="grid grid-cols-[150px_minmax(0,1fr)_24px] items-center gap-3">
                  <dt className={`text-[14px] font-bold ${v ? "text-ink" : "text-muted"}`}>{r.label}</dt>
                  <dd className="h-2.5 overflow-hidden rounded-full bg-soft" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: FAMILY[r.family].color }} />
                  </dd>
                  <dd className={`text-right text-[14px] font-extrabold ${v ? "text-ink" : "text-faint"}`}>{v}</dd>
                </div>
              );
            })}
          </dl>
        </Card>

        <Card className="p-6" aria-labelledby="strengths">
          <h3 id="strengths" className="font-display text-[17px] font-bold text-ink">
            Strengths the coach named
          </h3>
          {debrief.strengths.length ? (
            <ul className="mt-4 grid gap-3">
              {debrief.strengths.map((s) => (
                <li key={s} className="flex gap-3 text-[15px] font-semibold leading-relaxed text-ink/85">
                  <Star size={18} weight="fill" className="mt-0.5 shrink-0 text-gold" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] font-semibold text-muted">None listed.</p>
          )}
          {debrief.tryNext ? (
            <div className="mt-5 rounded-2xl bg-soft px-4 py-3">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">Try next</p>
              <p className="mt-1 text-[14px] font-bold leading-snug text-ink">{debrief.tryNext}</p>
            </div>
          ) : null}
        </Card>
      </div>

      {debrief.keyMoments.length ? (
        <div className="grid gap-4">
          <h3 className="font-display text-[17px] font-bold text-ink">Key moments</h3>
          {debrief.keyMoments.map((k, i) => {
            const turn = byId.get(k.turnId);
            const move = ann.get(k.turnId)?.move;
            return (
              <Card key={`${k.turnId}-${i}`} as="article" className="overflow-hidden" id={`km-${k.turnId}`} aria-label={`Key moment ${i + 1}`}>
                <div className="border-b-2 border-soft bg-[#fffaf0] px-6 py-4">
                  <p className="flex flex-wrap items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-gold-ink">
                    <Star size={13} weight="fill" aria-hidden /> Key moment
                    {move ? (
                      <span className="rounded-full bg-white px-2 py-0.5 normal-case tracking-normal" style={{ color: FAMILY[MOVE[move].family].color }}>
                        {moveLabel(move)}
                      </span>
                    ) : null}
                    <a href={`#turn-${k.turnId}`} className="ml-auto normal-case tracking-normal text-primary-shadow underline decoration-2 underline-offset-2">
                      See in transcript
                    </a>
                  </p>
                  {turn ? <p className="mt-2 text-[16px] font-bold leading-snug text-ink">“{turn.text}”</p> : null}
                  <p className="mt-2 text-[15px] font-semibold leading-relaxed text-ink/80">{k.observation}</p>
                </div>
                <div className="px-6 py-5">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">One possible MI-consistent response</p>
                  <ul className="mt-2.5 grid gap-2">
                    {k.possibleResponses.map((r, j) => (
                      <li key={r} className="flex gap-3 rounded-2xl bg-soft/70 px-4 py-2.5 text-[15px] font-semibold leading-snug text-ink">
                        <span className="mt-0.5 text-[12px] font-extrabold text-primary-shadow">{j === 0 ? "e.g." : "or"}</span>“{r}”
                      </li>
                    ))}
                  </ul>
                  {k.why ? (
                    <p className="mt-3 flex gap-2 text-[14px] font-semibold leading-relaxed text-muted">
                      <Lightbulb size={17} weight="bold" className="mt-0.5 shrink-0 text-gold-ink" aria-hidden /> {k.why}
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {debrief.reflectionResponse ? (
        <details className="group rounded-[20px] border-2 border-line bg-white px-6 py-4">
          <summary className="cursor-pointer list-none text-[15px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
            <span className="text-primary-shadow">What the coach said to {learnerFirst}&apos;s reflection</span>
            <span className="ml-2 text-[13px] font-bold text-muted group-open:hidden">Show</span>
          </summary>
          <p className="mt-3 text-[15px] font-semibold leading-relaxed text-ink/80">{debrief.reflectionResponse}</p>
        </details>
      ) : null}
    </section>
  );
}
