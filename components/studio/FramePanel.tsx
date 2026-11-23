import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Frame as FrameIcon,
  Loader2,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Type,
} from "lucide-react";
import Scrubber from "../ui/Scrubber";
import SegmentedToggle from "../ui/Switch";
import { fitScale, type Printer } from "@/lib/studio";
import {
  FONT_LABELS,
  FRAME_DEFAULTS,
  MIN_HANGER_BORDER,
  autoLabelSize,
  maxLabelSize,
  PROFILE_LABELS,
  TEXTURE_LABELS,
  textureHeight,
  type FrameOptions,
  type LabelFont,
  type FrameProfile,
  type FrameSize,
  type FrameTexture,
} from "@/lib/frame";

/** Filament colours that suit a frame, from the Bambu PLA Basic line. */
const FRAME_COLORS: [string, string][] = [
  ["Black", "#000000"],
  ["Jade White", "#FFFFFF"],
  ["Dark Gray", "#545454"],
  ["Silver", "#A6A9AA"],
  ["Beige", "#F7E6DE"],
  ["Gold", "#E4BD68"],
  ["Bronze", "#847D48"],
  ["Cocoa Brown", "#6F5034"],
  ["Brown", "#9D432C"],
  ["Maroon Red", "#9D2235"],
  ["Blue Gray", "#5B6579"],
  ["Mistletoe Green", "#3F8E43"],
];

const STYLES: { name: string; note: string; opts: Partial<FrameOptions> }[] = [
  { name: "Gallery", note: "Clean & flat", opts: { profile: "flat", texture: "smooth", radius: 0, border: 15, color: "#000000", labelColor: "#FFFFFF", labelFont: "sans" } },
  { name: "Oak", note: "Wood look", opts: { profile: "rounded", texture: "wood", radius: 2, border: 20, textureDepth: 0.6, textureScale: 1, color: "#6F5034", labelColor: "#E4BD68", labelFont: "serif" } },
  { name: "Modern", note: "Soft corners", opts: { profile: "chamfer", texture: "smooth", radius: 8, border: 15, color: "#FFFFFF", labelColor: "#000000", labelFont: "sans" } },
  { name: "Antique", note: "Classic, aged", opts: { profile: "stepped", texture: "crackle", radius: 0, border: 22, textureDepth: 0.5, textureScale: 1, color: "#E4BD68", labelColor: "#000000", labelFont: "serif" } },
];

const colorName = (hex: string) => FRAME_COLORS.find(([, h]) => h.toLowerCase() === hex.toLowerCase())?.[0] ?? hex.toUpperCase();

const fontStack = (f: LabelFont) => (f === "serif" ? "Georgia, serif" : f === "mono" ? "Menlo, monospace" : undefined);

/** Plain-language names for the shape presets of each slider. */
const BORDER_PRESETS: [string, number][] = [
  ["Thin", 10],
  ["Medium", 15],
  ["Wide", 25],
];

export function FramePanel({
  enabled,
  onEnabled,
  opts,
  onOpts,
  size,
  busy,
  printer,
  defaultLabel,
  onShrinkToFit,
  onDownload,
  downloading,
}: {
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  opts: FrameOptions;
  onOpts: (patch: Partial<FrameOptions>) => void;
  size: FrameSize | null;
  busy: boolean;
  printer: Printer;
  defaultLabel: string;
  onShrinkToFit: () => void;
  onDownload: (format: "stl" | "3mf") => void;
  downloading: "stl" | "3mf" | null;
}) {
  const [more, setMore] = useState(false);

  if (!enabled) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-cream/[0.12] bg-cream/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2 text-[14px] font-medium">
            <FrameIcon size={16} className="text-[var(--accent)]" />
            Put your city in a frame
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] leading-snug text-cream/65">
            <li>• Made to fit this model exactly</li>
            <li>• Pick a style and colour, add a name or date</li>
            <li>• Hang it on the wall or stand it on a shelf</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => onEnabled(true)}
          className="w-full rounded-full btn-primary py-3 text-[13.5px] transition-transform hover:scale-[1.02]"
        >
          + Add a frame
        </button>
      </div>
    );
  }

  const [bw, bd] = printer.bed;
  const fits = size ? fitScale(printer, size.w, size.d, size.h) >= 0.999 : true;
  const hangerOk = opts.border >= MIN_HANGER_BORDER && opts.depth >= 10;
  const hasText = !!opts.label.trim();
  const sameColor = opts.labelColor.toLowerCase() === opts.color.toLowerCase();
  // Two colours need a prime tower on the frame's plate. An open window has
  // room for it; a solid back leaves only the side margins.
  const towerCramped =
    hasText && !sameColor && opts.back === "solid" && !!size && Math.max(bw - size.w, bd - size.d) / 2 < 30;
  const activeStyle = STYLES.find((s) =>
    (Object.keys(s.opts) as (keyof FrameOptions)[]).every((k) => opts[k] === s.opts[k])
  );
  const textSize =
    Math.round((opts.labelSize > 0 ? Math.min(opts.labelSize, maxLabelSize(opts)) : autoLabelSize(opts)) * 2) / 2;

  return (
    <div className="flex flex-col gap-5">
      {/* On/off + size check, in plain words */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <SegmentedToggle label="Frame" checked={enabled} onCheckedChange={onEnabled} />
          {busy && <Loader2 size={14} className="animate-spin text-cream/45" aria-label="Updating frame" />}
        </div>
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-[12.5px] leading-snug ${
            fits ? "border-cream/[0.12] bg-cream/[0.03] text-cream/80" : "border-[#e07a5f]/45 bg-[#e07a5f]/[0.08] text-cream"
          }`}
        >
          {fits ? (
            <Check size={15} className="mt-px shrink-0 text-[var(--accent)]" />
          ) : (
            <TriangleAlert size={15} className="mt-px shrink-0 text-[#e07a5f]" />
          )}
          <div className="min-w-0 flex-1">
            {size ? (
              <>
                {fits ? `Fits your ${printer.name}` : `Too big for your ${printer.name}`}
                <span className="block font-mono text-[10px] text-cream/45">
                  Frame {Math.round(size.w)} × {Math.round(size.d)} mm · {Math.round(size.h)} mm thick
                </span>
              </>
            ) : (
              "Measuring the model…"
            )}
          </div>
          {!fits && (
            <button
              type="button"
              onClick={onShrinkToFit}
              className="shrink-0 rounded-full btn-primary px-3 py-1 text-[11.5px]"
              title="Makes the model a little smaller so the model and its frame fit the bed"
            >
              Make it fit
            </button>
          )}
        </div>
      </div>

      {/* 1 · Look */}
      <Step n={1} title="Choose a look">
        <div className="grid grid-cols-2 gap-2">
          {STYLES.map((s) => {
            const on = activeStyle === s;
            return (
              <button
                key={s.name}
                type="button"
                aria-pressed={on}
                onClick={() => onOpts(s.opts)}
                className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${
                  on ? "seg-on border-transparent" : "border-cream/[0.12] hover:border-cream/35 hover:bg-cream/[0.04]"
                }`}
              >
                <StyleThumb color={s.opts.color!} radius={s.opts.radius ?? 0} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium">{s.name}</span>
                  <span className="block text-[10.5px] opacity-60">{s.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      {/* 2 · Edge & texture */}
      <Step n={2} title="Edge & texture">
            <SubSection label="Edge shape">
              <div className="grid grid-cols-5 gap-1">
                {(Object.keys(PROFILE_LABELS) as FrameProfile[]).map((p) => (
                  <Chip key={p} on={opts.profile === p} onClick={() => onOpts({ profile: p })} title={PROFILE_LABELS[p]}>
                    <ProfileIcon p={p} />
                    <span className="text-[10px]">{PROFILE_LABELS[p]}</span>
                  </Chip>
                ))}
              </div>
            </SubSection>

            <SubSection label="Surface texture">
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TEXTURE_LABELS) as FrameTexture[]).map((t) => (
                  <Chip key={t} on={opts.texture === t} onClick={() => onOpts({ texture: t })} title={TEXTURE_LABELS[t]}>
                    <TextureSwatch t={t} />
                    <span className="text-[10.5px]">{TEXTURE_LABELS[t]}</span>
                  </Chip>
                ))}
              </div>
              {opts.texture !== "smooth" && (
                <div className="mt-1 flex flex-col gap-2">
                  <Scrubber
                    label="Texture depth (mm)"
                    value={opts.textureDepth}
                    min={0.2}
                    max={1.2}
                    step={0.1}
                    decimals={1}
                    onValueChange={(v) => onOpts({ textureDepth: v })}
                  />
                  <Scrubber
                    label="Pattern size (%)"
                    value={Math.round(opts.textureScale * 100)}
                    min={50}
                    max={250}
                    step={10}
                    decimals={0}
                    onValueChange={(v) => onOpts({ textureScale: v / 100 })}
                  />
                </div>
              )}
            </SubSection>
      </Step>

      {/* 3 · Colour */}
      <Step n={3} title="Frame colour" hint={colorName(opts.color)}>
        <Swatches value={opts.color} onPick={(hex) => onOpts({ color: hex })} />
      </Step>

      {/* 4 · Text */}
      <Step n={4} title="Add text" hint="optional">
        {!hasText ? (
          <button
            type="button"
            onClick={() => onOpts({ label: defaultLabel || "My city" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cream/30 py-3 text-[13px] text-cream/75 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
          >
            <Type size={15} />
            Add a name or date to the bottom of the frame
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Live preview: the bottom rail with the text on it */}
            <div
              className="flex h-12 items-center justify-center overflow-hidden rounded-lg border border-black/15 px-3"
              style={{ background: opts.color }}
              aria-label="Text preview"
            >
              <span
                className="truncate text-[16px] font-bold"
                style={{ color: opts.labelColor, fontFamily: fontStack(opts.labelFont) }}
              >
                {opts.label}
              </span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-cream/60">Your text</span>
              <div className="flex items-center gap-2">
                <input
                  value={opts.label}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => onOpts({ label: e.target.value || " " })}
                  className="min-w-0 flex-1 rounded-[10px] border border-cream/[0.18] bg-transparent px-3 py-2 text-[13px] text-cream outline-none focus:border-[var(--accent)]"
                  placeholder="Paris · 2026"
                />
                <span className="font-mono text-[10px] text-cream/35">{opts.label.trim().length}/40</span>
              </div>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-cream/60">Font</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(FONT_LABELS) as LabelFont[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={opts.labelFont === f}
                    onClick={() => onOpts({ labelFont: f })}
                    className={`flex flex-col items-center rounded-lg border py-1.5 transition-colors ${
                      opts.labelFont === f ? "seg-on border-transparent" : "border-cream/[0.12] text-cream/65 hover:text-cream"
                    }`}
                  >
                    <span className="text-[16px] font-bold leading-tight" style={{ fontFamily: fontStack(f) }}>
                      Aa
                    </span>
                    <span className="text-[10px]">{FONT_LABELS[f]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] text-cream/60">Text size</span>
              <Scrubber
                label="Letter height (mm)"
                value={textSize}
                min={2}
                max={Math.floor(maxLabelSize(opts) * 2) / 2}
                step={0.5}
                decimals={1}
                onValueChange={(v) => onOpts({ labelSize: v })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between text-[11.5px] text-cream/60">
                Text colour
                <span className="text-[10.5px] text-cream/40">{colorName(opts.labelColor)}</span>
              </span>
              <Swatches value={opts.labelColor} onPick={(hex) => onOpts({ labelColor: hex })} />
              <p className="m-0 text-[11px] leading-snug text-cream/45">
                {sameColor
                  ? "Same colour as the frame — the letters will be raised but not stand out. Pick another colour to make them pop."
                  : "The letters print in this second colour."}
              </p>
            </div>

            {towerCramped && (
              <p className="m-0 rounded-lg border border-[#e07a5f]/40 bg-[#e07a5f]/[0.07] p-2.5 text-[11.5px] leading-snug text-cream/80">
                Two colours need some free space on the bed, and a solid back leaves none on the {printer.name}.{" "}
                <button type="button" onClick={() => onOpts({ back: "open" })} className="underline underline-offset-2">
                  Switch to an open back
                </button>{" "}
                or use the frame colour for the text.
              </p>
            )}

            <button
              type="button"
              onClick={() => onOpts({ label: "" })}
              className="flex items-center gap-1.5 self-start text-[11.5px] text-cream/45 hover:text-cream"
            >
              <Trash2 size={12} />
              Remove text
            </button>
          </div>
        )}
      </Step>

      {/* Fine-tuning, folded away */}
      <div className="rounded-xl border border-cream/[0.12]">
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex w-full items-center justify-between px-3 py-2.5 text-[12.5px] text-cream/75 hover:text-cream"
        >
          <span className="flex min-w-0 items-center gap-2.5 text-left">
            <SlidersHorizontal size={14} className="shrink-0" />
            <span className="min-w-0">
              <span className="block whitespace-nowrap">More options</span>
              <span className="block text-[10.5px] text-cream/40">Frame width, back, wall hook, exact sizes</span>
            </span>
          </span>
          <ChevronDown size={15} className={`transition-transform ${more ? "rotate-180" : ""}`} />
        </button>

        {more && (
          <div className="flex flex-col gap-4 border-t border-cream/[0.1] p-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-cream/60">Frame width</span>
          <div className="grid grid-cols-3 gap-1.5">
            {BORDER_PRESETS.map(([name, mm]) => (
              <button
                key={name}
                type="button"
                aria-pressed={opts.border === mm}
                onClick={() => onOpts({ border: mm, radius: Math.min(opts.radius, mm) })}
                className={`rounded-lg border py-1.5 text-[12px] transition-colors ${
                  opts.border === mm ? "seg-on border-transparent" : "border-cream/[0.12] text-cream/65 hover:text-cream"
                }`}
              >
                {name}
                <span className="block font-mono text-[9.5px] opacity-60">{mm} mm</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11.5px] text-cream/60">Back of the frame</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["open", "Open back", "Uses less filament"],
                ["solid", "Solid back", "Fully closed"],
              ] as const
            ).map(([v, label, note]) => (
              <button
                key={v}
                type="button"
                aria-pressed={opts.back === v}
                onClick={() => onOpts({ back: v })}
                className={`rounded-lg border px-2 py-1.5 text-left text-[12px] transition-colors ${
                  opts.back === v ? "seg-on border-transparent" : "border-cream/[0.12] text-cream/65 hover:text-cream"
                }`}
              >
                {label}
                <span className="block text-[10px] opacity-60">{note}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-cream/[0.12] p-2.5">
          <SegmentedToggle
            label="Wall hook on the back"
            checked={opts.hanger && hangerOk}
            disabled={!hangerOk}
            onCheckedChange={(v) => onOpts({ hanger: v })}
          />
          <p className="m-0 mt-1 text-[11px] leading-snug text-cream/45">
            {hangerOk
              ? "A keyhole slot so the frame hangs on a nail or screw."
              : `Needs a ${MIN_HANGER_BORDER} mm frame width and 10 mm thickness.`}
          </p>
        </div>

            <SubSection label="Exact sizes">
              <Scrubber
                label="Frame width (mm)"
                value={opts.border}
                min={8}
                max={40}
                step={1}
                decimals={0}
                onValueChange={(v) => onOpts({ border: v, radius: Math.min(opts.radius, v) })}
              />
              <Scrubber
                label="Thickness (mm)"
                value={opts.depth}
                min={8}
                max={40}
                step={1}
                decimals={0}
                onValueChange={(v) => onOpts({ depth: v })}
              />
              <Scrubber
                label="Corner rounding (mm)"
                value={opts.radius}
                min={0}
                max={opts.border}
                step={1}
                decimals={0}
                onValueChange={(v) => onOpts({ radius: v })}
              />
              <Scrubber
                label="Gap around model (mm)"
                value={opts.clearance}
                min={0.1}
                max={1}
                step={0.05}
                decimals={2}
                onValueChange={(v) => onOpts({ clearance: v })}
              />
              <p className="m-0 text-[11px] leading-snug text-cream/45">
                Gap: a little room so the model slides into the frame. Raise it if the fit is too tight.
              </p>
            </SubSection>

            <button
              type="button"
              onClick={() => onOpts({ ...FRAME_DEFAULTS, label: opts.label, labelColor: opts.labelColor })}
              className="self-start text-[11.5px] text-cream/45 hover:text-cream"
            >
              ↺ Reset frame to default
            </button>
          </div>
        )}
      </div>

      {/* Download */}
      <section className="flex flex-col gap-2 border-t border-cream/[0.09] pt-4">
        <p className="m-0 text-[12px] leading-snug text-cream/60">
          The main <strong className="font-medium text-cream">Download 3MF</strong> at the top already includes this
          frame (on plate 2). Or get the frame on its own:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["3mf", "stl"] as const).map((f) => (
            <button
              key={f}
              type="button"
              disabled={busy || !size || downloading !== null}
              onClick={() => onDownload(f)}
              className="flex items-center justify-center gap-1.5 rounded-full border border-cream/25 py-2 text-[12px] text-cream/75 transition-colors hover:border-cream/45 hover:text-cream disabled:opacity-40"
            >
              <Download size={12} />
              {downloading === f ? "…" : `Frame only (${f.toUpperCase()})`}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Tiny frame thumbnail for a style card. */
function StyleThumb({ color, radius }: { color: string; radius: number }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center border border-black/20"
      style={{ background: color, borderRadius: Math.min(10, radius * 1.2) }}
      aria-hidden
    >
      <span className="h-5 w-5 rounded-[2px] bg-[var(--color-panel-2)] shadow-inner" />
    </span>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {FRAME_COLORS.map(([name, hex]) => {
        const on = hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={on}
            onClick={() => onPick(hex)}
            className={`relative aspect-square rounded-lg border border-black/25 transition-transform hover:scale-110 ${
              on ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--color-panel)]" : ""
            }`}
            style={{ background: hex }}
          />
        );
      })}
    </div>
  );
}

/** A numbered step: big, plain heading, optional hint on the right. */
function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13.5px] font-medium">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-bold"
            style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
          >
            {n}
          </span>
          {title}
        </span>
        {hint && <span className="text-[11px] text-cream/40">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function SubSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="text-[11.5px] text-cream/60">{label}</div>
      {children}
    </section>
  );
}

function Chip({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition-colors ${
        on
          ? "border-[var(--accent)] bg-[var(--accent)]/[0.08] text-cream"
          : "border-cream/[0.12] text-cream/60 hover:border-cream/30 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

/** Cross-section of each edge profile: outer edge on the left, opening on the right. */
function ProfileIcon({ p }: { p: FrameProfile }) {
  const d: Record<FrameProfile, string> = {
    flat: "M3 19V6h18v13",
    chamfer: "M3 19V10l4-4h14v13",
    rounded: "M3 19V11a5 5 0 0 1 5-5h13v13",
    stepped: "M3 19V6h9v4h9v9",
    cove: "M3 19V6h6c0 5 6 6 12 6v7",
  };
  return (
    <svg width="22" height="16" viewBox="0 0 24 22" fill="none" aria-hidden>
      <path d={d[p]} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

/** A small shaded preview of a texture, drawn from the same function the frame uses. */
function TextureSwatch({ t }: { t: FrameTexture }) {
  const url = useMemo(() => {
    if (typeof document === "undefined") return "";
    const N = 44;
    const span = 16; // mm shown
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const img = ctx.createImageData(N, N);
    const h = (i: number, j: number) => {
      const x = (i / N) * span, y = (j / N) * span;
      return textureHeight(t, x, y, x, y, 1);
    };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        // Light from the top-left: shade by the slope.
        const s = (h(i + 1, j + 1) - h(i, j)) * -1.4;
        const v = Math.max(0, Math.min(255, 150 + 90 * (h(i, j) - 0.5) + 160 * s));
        const k = (j * N + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, [t]);
  return (
    <img src={url || undefined} alt="" className="h-9 w-full rounded-md object-cover" />
  );
}
