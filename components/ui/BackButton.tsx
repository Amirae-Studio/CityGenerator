import { ArrowLeft } from "lucide-react";

/** The one "go back a step" control. It always sits at the far left of the
 *  header, on every step, so going back is in the same place everywhere. */
export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-cream/[0.14] px-3.5 text-[13px] text-cream/75 transition-colors hover:border-cream/35 hover:bg-cream/[0.04] hover:text-cream"
    >
      <ArrowLeft size={15} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
