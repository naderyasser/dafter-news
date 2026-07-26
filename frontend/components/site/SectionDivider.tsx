/**
 * Graphic break between homepage sections. A hairline rule interrupted by
 * three notebook-margin ticks in brand red — it reuses the signature mark
 * rather than introducing new ornament, so the page gains rhythm without
 * gaining a new visual idea.
 */
export default function SectionDivider() {
  return (
    <div aria-hidden className="mx-auto flex max-w-container items-center gap-2 px-6 py-1">
      <span className="h-px flex-1 bg-line" />
      <span className="flex gap-1">
        <span className="h-3 w-[3px] bg-brand" />
        <span className="h-3 w-[3px] bg-brand/55" />
        <span className="h-3 w-[3px] bg-brand/25" />
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
