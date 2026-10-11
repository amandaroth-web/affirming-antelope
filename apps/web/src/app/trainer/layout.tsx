import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s · Affirming Antelope for trainers", default: "Trainer dashboard · Affirming Antelope" },
  description: "Manage cohorts, assign practice, and review learner role-plays.",
  robots: { index: false, follow: false },
};

export default function TrainerLayout({ children }: LayoutProps<"/trainer">) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
