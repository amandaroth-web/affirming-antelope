import { Play, Quotes } from "@phosphor-icons/react/dist/ssr";

const participants = [
  { name: "Jordan", done: 3, last: "Today", review: true },
  { name: "Marcus", done: 3, last: "Yesterday" },
  { name: "Priya", done: 1, last: "3 days ago" },
];

const ratings = ["Emerging", "Developing", "Proficient", "Strong"];

function Avatar({ name, tone }: { name: string; tone: string }) {
  return (
    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-navy ${tone}`}>
      {name[0]}
    </span>
  );
}

/**
 * A faithful mini version of the trainer dashboard's review screen
 * (apps/web/docs/screens/review.jpg) and participants table (participants.jpg), in HTML
 * so it stays sharp at any size. Sample cohort and names.
 */
export function DashboardMock() {
  return (
    <figure className="relative">
      <figcaption className="sr-only">
        The trainer dashboard reviewing a shared role-play: the learner&apos;s note, a chart
        of how the conversation moved, and the trainer&apos;s written feedback, voice note and
        skill rating. Below it, the cohort&apos;s participants and their progress.
      </figcaption>

      <div aria-hidden className="overflow-hidden rounded-[1.5rem] border-2 border-line bg-white text-ink shadow-[0_6px_0_var(--shadow)]">
        {/* Cohort header and tabs */}
        <div className="border-b-2 border-line px-5 pt-4">
          <p className="text-[11px] font-extrabold text-muted">Cohort</p>
          <p className="font-display text-lg font-bold leading-tight">MI for Leaders, fall pilot</p>
          <div className="mt-3 flex gap-5 text-[13px] font-extrabold">
            <span className="pb-2 text-muted">Participants</span>
            <span className="pb-2 text-muted">Assignments</span>
            <span className="flex items-center gap-1.5 border-b-[3px] border-primary pb-[5px] text-primary-shadow">
              Reviews
              <span className="grid size-[18px] place-items-center rounded-full bg-primary text-[10px] text-white">1</span>
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1.15fr_1fr]">
          {/* The shared session */}
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap gap-1.5 text-[11px] font-extrabold">
              <span className="rounded-full bg-soft px-2 py-0.5 text-primary-shadow">Sustain talk</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-ink">Voice role-play</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-ink">9 min</span>
            </div>
            <p className="font-display text-base font-bold leading-tight">The reports are late again</p>
            <div className="rounded-xl border-2 border-primary-tint bg-soft px-3 py-2.5">
              <p className="text-[11px] font-extrabold text-primary-shadow">Jordan&apos;s note to you</p>
              <p className="mt-1 text-[13px] font-bold leading-snug">
                &ldquo;I lost him around the time-blocking question. How would you have handled
                that moment?&rdquo;
              </p>
            </div>
            <div className="hidden rounded-xl border-2 border-line p-3 sm:block">
              <p className="text-[12px] font-extrabold">How the conversation moved</p>
              <svg viewBox="0 0 220 72" className="mt-2 h-auto w-full">
                <rect x="0" y="0" width="220" height="22" rx="6" fill="var(--zone-change)" />
                <rect x="0" y="50" width="220" height="22" rx="6" fill="var(--zone-hold)" />
                <path
                  d="M10 60 L40 60 L70 44 L100 36 L130 14 L160 58 L190 30 L210 18"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {[
                  [10, 60],
                  [40, 60],
                  [100, 36],
                  [130, 14],
                  [190, 30],
                  [210, 18],
                ].map(([x, y]) => (
                  <circle key={x} cx={x} cy={y} r="3.5" fill="#fff" stroke="var(--primary)" strokeWidth="2" />
                ))}
                <rect x="66" y="40" width="8" height="8" transform="rotate(45 70 44)" fill="var(--move-reflection)" />
                <circle cx="160" cy="58" r="7" fill="#fff" stroke="var(--gold)" strokeWidth="2.5" />
                <path d="M160 54.5 l3.5 6 h-7 Z" fill="var(--move-inconsistent)" />
              </svg>
            </div>
          </div>

          {/* The trainer's feedback panel */}
          <div className="space-y-3 border-t-2 border-line bg-white p-4 sm:border-t-0 sm:border-l-2 sm:p-5">
            <p className="font-display text-base font-bold">Your feedback</p>
            <div>
              <p className="text-[12px] font-extrabold">Written feedback</p>
              <p className="mt-1 rounded-xl border-2 border-line px-3 py-2 text-[12.5px] font-semibold leading-snug text-ink/90">
                Your reflection about being the one finance counts on is what opened him up.
                At the time-blocking moment, try reflecting first.
              </p>
            </div>
            <div>
              <p className="text-[12px] font-extrabold">Voice note</p>
              <div className="mt-1 flex items-center gap-2.5 rounded-xl border-2 border-line px-2.5 py-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-white">
                  <Play size={12} weight="fill" />
                </span>
                <span className="relative h-1.5 flex-1 rounded-full bg-soft-deep">
                  <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary" />
                </span>
                <span className="text-[11px] font-extrabold text-muted">0:42</span>
              </div>
            </div>
            <div>
              <p className="text-[12px] font-extrabold">Where Jordan is with this skill</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11px] font-extrabold">
                {ratings.map((r) => (
                  <span
                    key={r}
                    className={`rounded-lg border-2 px-2 py-1 text-center ${
                      r === "Proficient" ? "border-primary bg-soft text-primary-shadow" : "border-line text-ink"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <span className="block rounded-xl bg-primary py-2 text-center text-[12px] font-extrabold uppercase tracking-wide text-white shadow-[0_3px_0_var(--primary-shadow)]">
              Send review
            </span>
          </div>
        </div>
      </div>

      {/* Who's practicing, layered under the review */}
      <div
        aria-hidden
        className="relative z-10 mx-3 -mt-3 rounded-[1.25rem] border-2 border-line bg-white p-4 text-ink shadow-[0_6px_0_var(--shadow)] sm:mx-auto sm:-mt-8 sm:w-[88%] lg:absolute lg:-bottom-14 lg:-left-8 lg:mx-0 lg:w-[19rem]"
      >
        <div className="flex items-baseline justify-between">
          <p className="font-display text-[15px] font-bold">Participants</p>
          <p className="text-[11px] font-extrabold text-muted">Completed</p>
        </div>
        <ul className="mt-2 space-y-2">
          {participants.map((p, i) => (
            <li key={p.name} className="flex items-center gap-2.5 text-[13px] font-bold">
              <Avatar name={p.name} tone={["bg-soft-deep", "bg-gold-tint", "bg-primary-tint"][i]} />
              <span className="flex-1">{p.name}</span>
              {p.review && (
                <span className="flex items-center gap-1 rounded-md bg-soft px-1.5 py-0.5 text-[10px] font-extrabold text-primary-shadow">
                  <Quotes size={10} weight="fill" />
                  Shared
                </span>
              )}
              <span className="w-16 text-right text-[12px] text-muted">{p.last}</span>
              <span className="w-10 text-right text-[12px]">{p.done} of 7</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
