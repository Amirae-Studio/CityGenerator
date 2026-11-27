import { Crown, Move, MousePointerClick, RotateCcw, Trash2 } from "lucide-react";
import { FILAMENT_LINES, BUILDING_EDIT_DEFAULT, type BuildingEdit, type BuildingEdits } from "@/lib/studio";
import type { Pro } from "@/lib/makerlab/usePro";
import { PRO_ELSEWHERE } from "@/components/ProUpsell";
import Scrubber from "../ui/Scrubber";
import SegmentedToggle from "../ui/Switch";
import { Step } from "../ui/Step";

/** PLA Basic, the line most people own — one compact row of swatches. */
const SWATCHES = Object.entries(FILAMENT_LINES[0].colors).slice(0, 14);

/**
 * Pro "Edit buildings": pick buildings in the 3D view and change their size,
 * colour and place. The view does the picking and dragging (StudioScene);
 * this panel holds the switches and sliders for whatever is selected.
 */
export function BuildingsPanel({
  pro,
  note,
  editing,
  onEditing,
  selected,
  edits,
  onPatch,
  onClearSelection,
  onResetSelected,
  onResetAll,
  onRemove,
  onRestoreRemoved,
}: {
  pro: Pro;
  note: string | null;
  editing: boolean;
  /** Turning it on goes through requestAccess (Pro). */
  onEditing: (on: boolean) => void;
  selected: string[];
  edits: BuildingEdits;
  /** Applies to every selected building. */
  onPatch: (patch: Partial<BuildingEdit>) => void;
  onClearSelection: () => void;
  onResetSelected: () => void;
  onResetAll: () => void;
  /** Takes the selected buildings out of the model. */
  onRemove: () => void;
  /** Brings every removed building back. */
  onRestoreRemoved: () => void;
}) {
  if (!pro.owned) return <ProPitch pro={pro} note={note} onTry={() => onEditing(true)} />;

  const first = selected.length ? { ...BUILDING_EDIT_DEFAULT, ...edits[selected[0]] } : BUILDING_EDIT_DEFAULT;
  const editedCount = Object.keys(edits).length;
  const none = selected.length === 0;
  const selectedEdited = selected.some((id) => edits[id]);
  const removedCount = Object.values(edits).filter((e) => e.removed).length;

  return (
    <div className="flex flex-col gap-5">
      <Step n={1} title="Pick buildings" hint={editing ? `${selected.length} selected` : undefined}>
        <SegmentedToggle label="Select in the view" checked={editing} onCheckedChange={onEditing} />
        {editing ? (
          <div className="flex flex-col gap-1.5 rounded-xl border border-cream/[0.12] bg-cream/[0.03] p-3 text-[11.5px] leading-snug text-cream/65">
            <span className="flex items-center gap-2">
              <MousePointerClick size={13} className="shrink-0 text-[var(--accent)]" />
              Click a building to select it
            </span>
            <span className="flex items-center gap-2">
              <kbd className="shrink-0 rounded border border-cream/20 px-1 font-mono text-[9.5px] text-cream/70">Shift</kbd>
              Shift-click to pick more than one
            </span>
            <span className="flex items-center gap-2">
              <Move size={13} className="shrink-0 text-[var(--accent)]" />
              Drag a selected building to move it
            </span>
          </div>
        ) : (
          <p className="m-0 text-[11.5px] leading-snug text-cream/50">
            Turn this on, then click buildings in the 3D view. Changes stay put and go into your download.
          </p>
        )}
        {editing && !none && (
          <button
            type="button"
            onClick={onClearSelection}
            className="self-start text-[11.5px] text-cream/55 underline underline-offset-2 hover:text-cream"
          >
            Clear selection
          </button>
        )}
      </Step>

      <div className={`flex flex-col gap-5 transition-opacity ${editing && !none ? "" : "pointer-events-none opacity-40"}`} aria-disabled={!editing || none}>
        <Step n={2} title="Size">
          <Scrubber label="Size (%)" value={first.size} min={40} max={250} step={1} decimals={0} onValueChange={(v) => onPatch({ size: v })} />
          <Scrubber label="Height (%)" value={first.height} min={30} max={400} step={1} decimals={0} onValueChange={(v) => onPatch({ height: v })} />
        </Step>

        <Step n={3} title="Colour" hint="adds a filament">
          <div className="grid grid-cols-8 gap-1.5">
            <button
              type="button"
              title="Same as its layer"
              onClick={() => onPatch({ color: null })}
              className={`relative h-7 rounded-[8px] border border-dashed border-cream/30 text-[9px] font-bold text-cream/60 transition-transform hover:scale-105 ${
                first.color === null ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--color-panel)]" : ""
              }`}
            >
              Auto
            </button>
            {SWATCHES.map(([name, hex]) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => onPatch({ color: hex })}
                className={`h-7 rounded-[8px] border border-black/15 transition-transform hover:scale-110 ${
                  first.color?.toLowerCase() === hex.toLowerCase()
                    ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--color-panel)]"
                    : ""
                }`}
                style={{ background: hex }}
              />
            ))}
          </div>
        </Step>

        <Step n={4} title="Place">
          <p className="m-0 text-[11.5px] leading-snug text-cream/55">
            Drag a selected building in the view. It follows the ground wherever you drop it.
          </p>
          <button
            type="button"
            onClick={() => onPatch({ dx: 0, dz: 0 })}
            disabled={first.dx === 0 && first.dz === 0}
            className="self-start rounded-full border border-cream/20 px-3 py-1.5 text-[11.5px] text-cream/70 transition-colors hover:border-cream/40 hover:text-cream disabled:opacity-40"
          >
            Back to original spot
          </button>
        </Step>

        <Step n={5} title="Remove" hint={<kbd className="rounded border border-cream/20 px-1 font-mono text-[9.5px]">Delete</kbd>}>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#d9534f]/50 py-2 text-[12.5px] font-medium text-[#d9534f] transition-colors hover:bg-[#d9534f]/10"
          >
            <Trash2 size={13} />
            Remove {selected.length > 1 ? `${selected.length} buildings` : "building"}
          </button>
          <p className="m-0 text-[11px] leading-snug text-cream/45">Left out of the view and the download. You can bring it back below.</p>
        </Step>
      </div>

      {removedCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-cream/[0.12] bg-cream/[0.03] px-3 py-2 text-[11.5px] text-cream/65">
          <span>
            {removedCount} building{removedCount > 1 ? "s" : ""} removed
          </span>
          <button type="button" onClick={onRestoreRemoved} className="font-medium text-[var(--accent-text)] underline underline-offset-2">
            Bring back
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-cream/[0.09] pt-3.5">
        <button
          type="button"
          onClick={onResetSelected}
          disabled={!selectedEdited}
          className="flex items-center gap-1.5 rounded-full border border-cream/20 px-3 py-1.5 text-[11.5px] text-cream/70 transition-colors hover:border-cream/40 hover:text-cream disabled:opacity-40"
        >
          <RotateCcw size={12} />
          Reset selected
        </button>
        <button
          type="button"
          onClick={onResetAll}
          disabled={editedCount === 0}
          className="ml-auto text-[11.5px] text-cream/55 underline underline-offset-2 hover:text-cream disabled:no-underline disabled:opacity-40"
        >
          Reset all{editedCount ? ` (${editedCount})` : ""}
        </button>
      </div>
    </div>
  );
}

/** What non-Pro users see in place of the editor. */
function ProPitch({ pro, note, onTry }: { pro: Pro; note: string | null; onTry: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-cream/[0.12] bg-cream/[0.03]">
        <BuildingsArt />
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium">Make the city yours</span>
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(229, 178, 41, 0.16)", color: "#a87b06" }}
            >
              <Crown size={10} />
              Pro
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12px] leading-snug text-cream/70">
            <li>• Pick any building — or several at once</li>
            <li>• Make it bigger, smaller or taller</li>
            <li>• Give it its own filament colour</li>
            <li>• Drag it to a new spot on the map</li>
            <li>• Remove the ones you don't want</li>
          </ul>
          {pro.available ? (
            <button
              type="button"
              disabled={pro.busy}
              onClick={onTry}
              className="mt-1 rounded-lg py-2.5 text-[13px] font-semibold transition-[filter] hover:brightness-[0.97] disabled:opacity-60"
              style={{ background: "linear-gradient(90deg, #fff4d6, #ffe5bf)", color: "#8a4b12" }}
            >
              {pro.busy ? "Opening payment…" : "Unlock with Pro"}
            </button>
          ) : (
            <p className="m-0 text-[11.5px] leading-snug text-cream/50">{PRO_ELSEWHERE}</p>
          )}
          {note && <p className="m-0 text-[11.5px] leading-snug text-cream/55">{note}</p>}
        </div>
      </div>
    </div>
  );
}

/** Three little buildings, one picked and coloured — what the tool does, at a glance. */
function BuildingsArt() {
  return (
    <svg viewBox="0 0 280 96" className="block h-24 w-full" aria-hidden>
      <rect width="280" height="96" fill="rgba(var(--accent-rgb),0.07)" />
      <path d="M0 80h280" stroke="rgba(var(--ink-rgb),0.15)" />
      <rect x="62" y="40" width="34" height="40" rx="2" fill="rgba(var(--ink-rgb),0.18)" />
      <rect x="104" y="22" width="40" height="58" rx="2" fill="var(--accent)" />
      <rect x="99" y="17" width="50" height="68" rx="5" fill="none" stroke="var(--accent)" strokeDasharray="4 3" />
      <rect x="152" y="48" width="30" height="32" rx="2" fill="rgba(var(--ink-rgb),0.18)" />
      <rect x="190" y="34" width="28" height="46" rx="2" fill="rgba(var(--ink-rgb),0.12)" strokeDasharray="3 3" stroke="rgba(var(--ink-rgb),0.35)" />
      <path d="M186 57h-0" />
      <path d="M160 30l14 0m-4-4 4 4-4 4" stroke="rgba(var(--ink-rgb),0.45)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
