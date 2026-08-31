import Image from "next/image";
import { GetTheApp } from "./get-the-app";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-20 h-16 border-b-2 border-line bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
        <a
          href="#top"
          aria-label="Affirming Antelope"
          className="flex min-w-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Image
            src="/brand-lockup-horizontal.svg?v=2"
            alt="Affirming Antelope"
            width={700}
            height={180}
            className="h-9 w-auto shrink-0 object-contain"
          />
        </a>
        <nav className="flex items-center gap-5" aria-label="Primary">
          <a
            href="#how-it-works"
            className="hidden text-[15px] font-extrabold text-ink/80 hover:text-ink md:inline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            How it works
          </a>
          <GetTheApp className="px-4 py-2 text-[13px]" />
        </nav>
      </div>
    </header>
  );
}
