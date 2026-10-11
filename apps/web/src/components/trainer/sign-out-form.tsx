"use client";

import type { ReactNode } from "react";
import { signOut } from "@/app/trainer/actions";
import { resetAnalytics } from "@/lib/analytics/client";

/** The sign-out Server Action, plus forgetting the analytics identity on this device. */
export function SignOutForm({ children }: { children: ReactNode }) {
  return (
    <form action={signOut} onSubmit={() => resetAnalytics()}>
      {children}
    </form>
  );
}
