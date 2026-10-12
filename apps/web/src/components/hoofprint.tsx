/**
 * The antelope's cloven hoofprint, the app's streak mark (antelopes leave tracks, not
 * flames). Same paths as `Hoofprint` in apps/mobile/src/design/icons.tsx.
 */
export function Hoofprint({
  className = "size-6",
  fill = "var(--gold)",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M10.2 2.2C7.1 4.6 4.4 9.4 4.5 14.3c.1 4.3 2 6.9 4.5 6.9 1.6 0 2.4-1.2 2.3-3.2l-.4-15c0-.9-.3-1.1-.7-.8Z"
        fill={fill}
      />
      <path
        d="M13.8 2.2c3.1 2.4 5.8 7.2 5.7 12.1-.1 4.3-2 6.9-4.5 6.9-1.6 0-2.4-1.2-2.3-3.2l.4-15c0-.9.3-1.1.7-.8Z"
        fill={fill}
      />
    </svg>
  );
}
