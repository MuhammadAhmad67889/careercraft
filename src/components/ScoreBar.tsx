/**
 * One labelled score bar. Used for match components and ATS
 * scores so every number is shown with its weight and the
 * plain-English detail behind it.
 */
export function ScoreBar({
  detail,
  label,
  score,
  weightLabel,
}: {
  detail?: string;
  label: string;
  score: number;
  weightLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          {label}
          {weightLabel ? (
            <span className="ml-2 font-normal text-[var(--color-muted)]">
              {weightLabel}
            </span>
          ) : null}
        </p>
        <p className="text-sm font-semibold text-[var(--color-accent)]">
          {score}/100
        </p>
      </div>
      <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={score}
        className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-line)]"
        role="progressbar"
      >
        <div
          className="h-full bg-[var(--color-accent)]"
          style={{ width: `${score}%` }}
        />
      </div>
      {detail ? (
        <p className="mt-1 text-sm text-[var(--color-muted)]">{detail}</p>
      ) : null}
    </div>
  );
}
