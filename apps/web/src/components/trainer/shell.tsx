import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { signOut } from "@/app/trainer/actions";
import { RailNav, type RailCohort } from "./rail-nav";
import { Avatar, buttonClass, focusRing } from "./ui";

export function TrainerShell({
  viewer,
  cohorts,
  children,
}: {
  viewer: { name: string; email: string };
  cohorts: RailCohort[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 font-extrabold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Rail (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r-2 border-line bg-[#f6f7fe] lg:flex">
        <div className="px-6 pt-6 pb-5">
          <Link href="/trainer" className={`block w-fit rounded-lg ${focusRing}`} aria-label="Affirming Antelope trainer home">
            <Image src="/brand-lockup-horizontal-deep.svg" alt="Affirming Antelope" width={700} height={180} className="h-10 w-auto" priority />
          </Link>
          <p className="mt-2 pl-0.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-muted">Trainer</p>
        </div>
        <RailNav cohorts={cohorts} />
        <div className="mt-auto border-t-2 border-line px-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl px-2 py-1.5">
            <Avatar name={viewer.name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-extrabold text-ink">{viewer.name}</p>
              <p className="truncate text-[12px] font-semibold text-muted">{viewer.email}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className={buttonClass("ghost", "sm", "!px-2")} aria-label="Sign out" title="Sign out">
                <SignOut size={18} weight="bold" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Top bar (tablet and below) */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b-2 border-line bg-white/95 px-5 backdrop-blur-md lg:hidden">
        <Link href="/trainer" className={`rounded-lg ${focusRing}`} aria-label="Affirming Antelope trainer home">
          <Image src="/brand-lockup-horizontal-deep.svg" alt="Affirming Antelope" width={700} height={180} className="h-8 w-auto" />
        </Link>
        <span className="rounded-lg bg-soft px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-primary-shadow">
          Trainer
        </span>
        <nav aria-label="Cohorts" className="ml-auto flex items-center gap-1">
          <Link href="/trainer" className={buttonClass("ghost", "sm")}>
            Cohorts
          </Link>
          <form action={signOut}>
            <button type="submit" className={buttonClass("ghost", "sm")}>
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main id="main" className="min-w-0">
        {children}
      </main>
    </div>
  );
}
