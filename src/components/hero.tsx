"use client";

import { motion, useReducedMotion } from "motion/react";
import { GetTheApp } from "./get-the-app";
import { Mascot } from "./mascot";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section>
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 py-10 md:grid-cols-12 md:gap-8 md:px-8 md:py-14">
        <div className="md:col-span-6">
          <p className="mb-4 inline-flex rounded-xl bg-soft px-3 py-1.5 text-sm font-extrabold text-primary-shadow">
            MI practice that sticks
          </p>
          <h1 className="max-w-[15ch] pb-1 font-display text-4xl font-bold leading-[1.04] tracking-tight text-ink md:text-5xl lg:text-[3.4rem]">
            Practice better conversations.
          </h1>
          <p className="mt-5 max-w-[36ch] text-lg font-semibold leading-snug text-muted">
            Five-minute OARS drills from Amanda. Practice out loud, build a
            streak, and walk into your next session ready.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <GetTheApp />
            <a
              href="#how-it-works"
              className="text-base font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              How it works
            </a>
          </div>
        </div>

        <div className="relative md:col-span-6">
          <div className="relative mx-auto max-w-[24rem] overflow-visible rounded-[2rem] border-2 border-line bg-soft px-4 pt-4 shadow-[0_6px_0_var(--shadow)] md:max-w-[28rem]">
            <motion.p
              className="absolute top-5 left-5 z-10 max-w-[15rem] origin-bottom-left rounded-2xl rounded-bl-md border-2 border-line bg-white px-4 py-3 font-extrabold text-ink shadow-[0_4px_0_var(--shadow)]"
              initial={reduce ? false : { opacity: 0, scale: 0.84, y: 10 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
              transition={
                reduce
                  ? undefined
                  : {
                      type: "spring",
                      stiffness: 240,
                      damping: 18,
                      delay: 0.55,
                    }
              }
            >
              Ready when you are.
            </motion.p>
            <div className="pt-12">
              <Mascot
                pose="wave"
                alt="Affirming Antelope waving hello"
                width={674}
                height={978}
                priority
                className="mx-auto h-[24rem] w-auto max-w-full md:h-[27rem]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
