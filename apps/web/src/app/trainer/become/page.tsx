import Image from "next/image";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/trainer/dal";
import { BecomeTrainerForm } from "@/components/trainer/become-form";
import { signOut } from "../actions";
import { buttonClass } from "@/components/trainer/ui";

export const metadata = { title: "Become a trainer" };

export default async function BecomeTrainerPage() {
  const viewer = await requireUser("/trainer/become");
  if (viewer.canTrain) redirect("/trainer");

  return (
    <div className="flex min-h-dvh flex-col bg-soft/50">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Image src="/brand-lockup-horizontal-deep.svg" alt="Affirming Antelope" width={700} height={180} className="h-9 w-auto" priority />
        <form action={signOut}>
          <button type="submit" className={buttonClass("ghost", "sm")}>
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="grid w-full max-w-[880px] items-center gap-10 md:grid-cols-[1fr_auto]">
          <div className="rounded-[24px] border-2 border-line bg-white p-8 shadow-[0_6px_0_var(--shadow)] sm:p-10">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-primary-shadow">One more step</p>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] text-ink">Become a trainer</h1>
            <p className="mt-3 max-w-[46ch] text-[16px] font-semibold leading-relaxed text-muted">
              You&apos;re signed in as <span className="font-extrabold text-ink">{viewer.email}</span>. Enter the trainer code
              from your program lead to create cohorts and review practice.
            </p>
            <BecomeTrainerForm defaultName={viewer.displayName} />
            <p className="mt-8 border-t-2 border-soft pt-5 text-[14px] font-semibold leading-relaxed text-muted">
              Joining as a learner? You don&apos;t need a trainer code. Open the Affirming Antelope app and enter the join
              code your trainer shared.
            </p>
          </div>
          <Image src="/brand-mascot-wave-cartoon.png" alt="" width={674} height={978} className="hidden h-72 w-auto md:block" />
        </div>
      </main>
    </div>
  );
}
