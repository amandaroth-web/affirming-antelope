export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 md:flex-row md:items-baseline md:justify-between md:px-8">
        <p className="font-display font-bold text-primary-shadow">
          Affirming Antelope
        </p>
        <p className="font-semibold text-muted">
          Amanda&apos;s daily drill for Motivational Interviewing.
          <a
            href="/trainer"
            className="ml-4 font-extrabold text-ink underline decoration-primary decoration-2 underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            For trainers
          </a>
        </p>
      </div>
    </footer>
  );
}
