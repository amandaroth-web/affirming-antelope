import { Barbell, BookOpenText, ChatsCircle } from "@phosphor-icons/react/dist/ssr";
import type { ItemKind } from "@/lib/trainer/content";

export function ItemIcon({ kind, size = 20 }: { kind: ItemKind; size?: number }) {
  const k = kind === "any-drill" ? "drill" : kind === "any-roleplay" ? "roleplay" : kind;
  const style =
    k === "drill"
      ? "bg-primary-tint/60 text-primary-shadow"
      : k === "roleplay"
        ? "bg-gold-tint text-gold-ink"
        : "bg-[#e3f3f0] text-[#1f6b60]";
  const Icon = k === "drill" ? Barbell : k === "roleplay" ? ChatsCircle : BookOpenText;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${style}`} style={{ width: size + 16, height: size + 16 }} aria-hidden>
      <Icon size={size} weight="bold" />
    </span>
  );
}
