import type { ReactNode } from "react";

/** A numbered step in a Studio panel: plain heading, optional hint on the right. */
export function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13.5px] font-medium">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold"
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

/** A small labelled group inside a step. */
export function SubSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="text-[11.5px] text-cream/60">{label}</div>
      {children}
    </section>
  );
}
