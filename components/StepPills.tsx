const STEPS = ["Pick an area", "Customise", "Preview & export"];

/** Where the visitor is in the three-step flow. Shown in every header. */
export function StepPills({ step }: { step: 0 | 1 | 2 }) {
  return (
    <ol className="m-0 hidden list-none items-center gap-1 p-0 text-[12px] lg:flex" aria-label="Steps">
      {STEPS.map((s, i) => {
        const state = i === step ? "now" : i < step ? "done" : "next";
        return (
          <li key={s} className="flex items-center gap-1" aria-current={state === "now" ? "step" : undefined}>
            {i > 0 && <span className="mx-1 h-px w-4 bg-cream/15" aria-hidden />}
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-semibold ${
                state === "now"
                  ? "bg-[var(--accent-strong)] text-white"
                  : state === "done"
                    ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "bg-cream/[0.07] text-cream/40"
              }`}
            >
              {i + 1}
            </span>
            {/* Only the current step keeps its label until there is room for all three. */}
            <span
              className={`whitespace-nowrap ${
                state === "now" ? "font-medium text-cream" : state === "done" ? "hidden text-cream/60 xl:inline" : "hidden text-cream/35 xl:inline"
              }`}
            >
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
