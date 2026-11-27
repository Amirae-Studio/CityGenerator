import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Crown, Lock, X } from "lucide-react";
import { usePro, type Pro } from "@/lib/makerlab/usePro";

/** Everything City Generator Pro adds — one list for the modal and the card. */
export const PRO_FEATURES: { title: string; detail: string }[] = [
  { title: "Edit buildings", detail: "Pick any buildings — resize, colour, move or remove them" },
  { title: "8 more frame looks", detail: "Botanical, Ocean, Hive, Loft, Baroque, Art Deco, Linen, Starry" },
  { title: "5 more edge shapes", detail: "Bevel, Scoop, Ogee, Bead, Tiered" },
  { title: "6 more textures", detail: "Leaves, Waves, Honeycomb, Brick, Weave, Stars" },
  { title: "Your own pattern", detail: "Upload an SVG and it's carved into the frame" },
  { title: "Road types", detail: "Hide motorways, streets, service roads or footpaths one by one" },
  { title: "Optimize roads", detail: "One switch: keep only the main roads" },
];

export const PRO_ELSEWHERE = "Pro is available in City Generator on MakerWorld.";

/** Small "PRO" tag with a lock on a premium option. Hidden once the user has access. */
export function ProBadge({ owned, className = "" }: { owned: boolean; className?: string }) {
  if (owned) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-wider ${className}`}
      style={{ background: "rgba(229, 178, 41, 0.16)", color: "#a87b06" }}
    >
      <Lock size={8} strokeWidth={3} />
      Pro
    </span>
  );
}

/** Compact "Unlock Pro" card inside a panel. Nothing for users who already have access. */
export function ProBanner({ pro, onMore }: { pro: Pro; onMore?: () => void }) {
  if (pro.owned) return null;
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "rgba(229, 178, 41, 0.45)", background: "rgba(229, 178, 41, 0.07)" }}>
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Crown size={15} style={{ color: "#c89a12" }} />
        Get more with Pro
        {pro.price && <span className="ml-auto font-mono text-[12px] font-bold">{pro.price}</span>}
      </div>
      <p className="m-0 mt-1 text-[11.5px] leading-snug text-cream/60">
        Edit single buildings, 8 more looks, more edges and textures, your own SVG pattern and road tools.
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <BuyProAction pro={pro} className="flex-1" />
        {onMore && (
          <button type="button" onClick={onMore} className="text-[11.5px] text-cream/60 underline underline-offset-2 hover:text-cream">
            What's included
          </button>
        )}
      </div>
    </div>
  );
}

/** The gold "Unlock Pro · $6" action; explains where to buy when Pro isn't offered here. */
function BuyProAction({ pro, className = "" }: { pro: Pro; className?: string }) {
  if (!pro.available) return <p className={`m-0 text-[11px] leading-snug text-cream/50 ${className}`}>{PRO_ELSEWHERE}</p>;
  return (
    <button
      type="button"
      disabled={pro.busy}
      onClick={() => void pro.unlock()}
      className={`rounded-full py-2 text-[12.5px] font-medium text-[#3a2a00] transition-transform hover:scale-[1.02] disabled:opacity-60 ${className}`}
      style={{ background: "#f0c341" }}
    >
      {pro.busy ? "Opening payment…" : `Unlock Pro${pro.price ? ` · ${pro.price}` : ""}`}
    </button>
  );
}

/** Everything in Pro, with the price and the buy button. */
export function ProModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pro = usePro();
  // Close by itself once the purchase lands (onPaymentChange → owned).
  useEffect(() => {
    if (open && pro.owned) onClose();
  }, [open, pro.owned, onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-title"
    >
      <div className="float-panel w-full max-w-[420px] rounded-2xl p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Crown size={18} style={{ color: "#c89a12" }} />
              <h2 id="pro-title" className="m-0 text-[17px] font-semibold">
                City Generator Pro
              </h2>
            </div>
            <p className="m-0 mt-1 text-[12px] text-cream/55">One payment, yours to keep. Also included with the Commercial license.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-cream/40 hover:text-cream">
            <X size={17} />
          </button>
        </div>
        <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
          {PRO_FEATURES.map((f) => (
            <li key={f.title} className="flex gap-2.5">
              <Check size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span>
                <span className="block text-[13px] font-medium">{f.title}</span>
                <span className="block text-[11.5px] leading-snug text-cream/55">{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          {pro.price && (
            <span className="font-mono text-[20px] font-bold">
              {pro.originalPrice && <del className="mr-1.5 text-[13px] font-normal text-cream/40">{pro.originalPrice}</del>}
              {pro.price}
            </span>
          )}
          <BuyProAction pro={pro} className="flex-1" />
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Header "Buy Pro" button. Not shown to users who already have Pro (or the commercial license). */
export function BuyProButton() {
  const pro = usePro();
  const [open, setOpen] = useState(false);
  if (pro.owned || !pro.available) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="See everything in City Generator Pro"
        // Same look as MakerWorld's own "Upgrade Plan" button.
        className="hidden items-center rounded-lg px-4 py-[7px] text-[14px] font-semibold transition-[filter] hover:brightness-[0.97] sm:inline-flex"
        style={{ background: "linear-gradient(90deg, #fff4d6, #ffe5bf)", color: "#8a4b12" }}
      >
        Buy Pro
      </button>
      <ProModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
