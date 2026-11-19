import { BadgeCheck, Briefcase } from "lucide-react";
import { useMakerLab } from "@/lib/makerlab/MakerLabProvider";

/**
 * "Buy commercial license" — MakerLab's reserved `commercial_eeee` feature.
 *
 * Shown only inside MakerLab, when the price catalog offers the license. The
 * host runs payment and verification; ownership (the "Commercial" badge)
 * updates from onPaymentChange, never from the purchase promise. The price
 * comes from the platform, so it's never hard-coded here.
 */
export function CommercialLicenseButton({ compact = false }: { compact?: boolean }) {
  const { commercial, buyCommercial, buying, can } = useMakerLab();
  if (!commercial || !can("requestAccess")) return null;

  if (commercial.owned) {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-3 py-[7px] font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--accent)] sm:inline-flex"
        title="You own the commercial license: physical prints may be used commercially."
      >
        <BadgeCheck size={13} />
        Commercial
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void buyCommercial()}
      disabled={buying}
      title={`${commercial.feature.functionName}: use physical prints of your models commercially`}
      className="hidden items-center gap-1.5 rounded-full border border-[var(--accent)]/50 px-3.5 py-[8px] text-[12px] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 disabled:opacity-50 sm:inline-flex"
    >
      <Briefcase size={13} />
      {buying ? (
        "Processing…"
      ) : (
        <>
          <span className={compact ? "hidden xl:inline" : "hidden md:inline"}>Commercial license</span>
          <span className="md:hidden">License</span>
          {commercial.originalPrice && <del className="text-cream/40">{commercial.originalPrice}</del>}
          <span className="font-mono font-bold">{commercial.price}</span>
        </>
      )}
    </button>
  );
}
