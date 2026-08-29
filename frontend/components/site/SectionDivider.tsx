/**
 * Graphic break between homepage sections — a page torn out of «الدفتر»
 * itself: a perforation line (dotted, not a solid rule) on a shaded band, with
 * the notebook-margin ticks sitting where the tear would start. Reuses the
 * signature mark rather than introducing new ornament, and the band gives the
 * break an actual felt colour pause instead of a hairline two white card
 * grids could still read as touching.
 */
export default function SectionDivider() {
  return (
    // py-4 (48px total with the 16px rule inside it) rather than py-7: this
    // divider renders thirteen times, so every 8px of padding here is ~100px
    // of homepage. 48px is the spec's section rhythm, and the perforation
    // still reads as a deliberate pause rather than a hairline.
    <div aria-hidden className="bg-surface-2 py-4">
      <div className="mx-auto flex max-w-container items-center gap-3 px-6">
        <span className="flex flex-shrink-0 gap-1">
          <span className="h-4 w-[3px] rounded-sm bg-brand" />
          <span className="h-4 w-[3px] rounded-sm bg-brand/55" />
          <span className="h-4 w-[3px] rounded-sm bg-brand/25" />
        </span>
        <span className="section-divider-perf h-[3px] flex-1" />
      </div>
    </div>
  );
}
