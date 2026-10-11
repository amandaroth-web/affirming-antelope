"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, EnvelopeSimple } from "@phosphor-icons/react";
import { identify, track } from "@/lib/analytics/client";
import { createClient } from "@/lib/supabase/client";
import { buttonClass } from "./ui";

type Step = { kind: "email" } | { kind: "code"; email: string };

const inputClass =
  "w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-[16px] font-bold text-ink placeholder:font-semibold placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [navigating, startNav] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);
  const busy = pending || navigating;

  useEffect(() => {
    if (step.kind === "code") codeRef.current?.focus();
  }, [step.kind]);

  async function sendCode(target: string) {
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email: target, options: { shouldCreateUser: true } });
    setPending(false);
    if (error) {
      setError(
        error.status === 429
          ? "That's a lot of codes in a row. Wait a minute, then try again."
          : "We couldn't send a code to that address. Check it and try again.",
      );
      return false;
    }
    return true;
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setError("Enter the email address you use for training.");
      return;
    }
    if (await sendCode(target)) {
      setCode("");
      setNotice(null);
      setStep({ kind: "code", email: target });
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "code") return;
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("The code is 6 digits.");
      return;
    }
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: step.email, token, type: "email" });
    setPending(false);
    if (!error && data.user) {
      // Supabase user uuid only. A first sign-in confirms the email at the same moment it signs in.
      identify(data.user.id);
      const { last_sign_in_at: signedInAt, email_confirmed_at: confirmedAt } = data.user;
      track("trainer_signed_in", {
        is_new_user: !!signedInAt && !!confirmedAt && Math.abs(Date.parse(signedInAt) - Date.parse(confirmedAt)) < 5000,
      });
    }
    if (error) {
      setError("That code didn't match or has expired. Check the latest email, or send a new code.");
      return;
    }
    startNav(() => {
      router.replace(next);
      router.refresh();
    });
  }

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      };

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {step.kind === "email" ? (
          <motion.form key="email" onSubmit={onEmail} noValidate {...slide} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">For trainers</p>
            <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.08] text-ink">Sign in to your dashboard</h1>
            <p className="mt-3 text-[16px] font-semibold leading-relaxed text-muted">
              We&apos;ll email you a 6-digit code. No password to remember.
            </p>
            <label htmlFor="email" className="mt-8 block text-[14px] font-extrabold text-ink">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "signin-error" : undefined}
              placeholder="you@organisation.org"
              className={`mt-2 ${inputClass}`}
            />
            <ErrorLine id="signin-error" error={error} />
            <button type="submit" disabled={busy} className={buttonClass("primary", "lg", "mt-6 w-full")}>
              {pending ? "Sending…" : "Email me a code"}
            </button>
          </motion.form>
        ) : (
          <motion.form key="code" onSubmit={onCode} noValidate {...slide} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep({ kind: "email" });
              }}
              className={buttonClass("ghost", "sm", "-ml-3 mb-4")}
            >
              <ArrowLeft size={16} weight="bold" aria-hidden /> Use a different email
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-primary" aria-hidden>
              <EnvelopeSimple size={26} weight="bold" />
            </div>
            <h1 className="mt-4 font-display text-[34px] font-bold leading-[1.08] text-ink">Check your email</h1>
            <p className="mt-3 text-[16px] font-semibold leading-relaxed text-muted">
              We sent a 6-digit code to <span className="font-extrabold text-ink">{step.email}</span>. It works for 10
              minutes.
            </p>
            <label htmlFor="code" className="mt-8 block text-[14px] font-extrabold text-ink">
              6-digit code
            </label>
            <input
              ref={codeRef}
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={7}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "code-error" : "code-hint"}
              placeholder="••••••"
              className={`mt-2 ${inputClass} text-center font-display text-[30px] tracking-[0.5em] placeholder:tracking-[0.5em]`}
            />
            <p id="code-hint" className="sr-only">
              Enter the six digits from the email.
            </p>
            <ErrorLine id="code-error" error={error} />
            <AnimatePresence>
              {notice ? (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-[14px] font-bold text-[#1f6b60]"
                >
                  {notice}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <button type="submit" disabled={busy || code.length !== 6} className={buttonClass("primary", "lg", "mt-6 w-full")}>
              {navigating ? "Opening your dashboard…" : pending ? "Checking…" : "Sign in"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await sendCode(step.email)) setNotice("A new code is on its way.");
              }}
              className={buttonClass("ghost", "md", "mt-3 w-full")}
            >
              Send a new code
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function ErrorLine({ id, error }: { id: string; error: string | null }) {
  return (
    <div aria-live="polite" id={id}>
      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pt-2.5 text-[14px] font-bold text-[#a4472a]"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
