export default function StatCard({
  label,
  value,
  changeLabel,
  up,
}: {
  label: string;
  value: string | number;
  changeLabel: string;
  up: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-paper px-5 py-[18px]">
      <div className="mb-2.5 text-[14px] font-semibold text-ink-3">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <span className="tnum text-[28px] font-extrabold leading-none text-ink">{value}</span>
        <span className={`tnum inline-flex items-center rounded-pill px-[7px] py-0.5 text-xs font-bold ${up ? "bg-up-tint text-up" : "bg-down-tint text-down"}`}>
          {changeLabel}
        </span>
      </div>
    </div>
  );
}
