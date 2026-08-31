type GetTheAppProps = {
  className?: string;
};

export function GetTheApp({ className = "" }: GetTheAppProps) {
  return (
    <a
      href="#download"
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-primary px-5 py-3 text-[15px] font-extrabold uppercase tracking-wide text-primary-ink shadow-[0_6px_0_var(--primary-shadow)] transition-[transform,filter,box-shadow] duration-75 ease-out hover:brightness-105 active:translate-y-1.5 active:shadow-[0_0_0_var(--primary-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      Get the app
    </a>
  );
}
