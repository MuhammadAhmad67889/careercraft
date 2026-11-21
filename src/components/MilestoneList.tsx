"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MilestoneItem {
  done: boolean;
  id: string;
  title: string;
  week: number;
}

/**
 * Roadmap milestones with done checkboxes. Ticking a box saves
 * immediately; if the save fails the box flips back and an error
 * is shown, so the screen never claims progress that was not
 * stored.
 */
export function MilestoneList({
  milestones,
  roadmapId,
}: {
  milestones: MilestoneItem[];
  roadmapId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(milestones);
  const [error, setError] = useState<string | null>(null);

  async function toggle(milestone: MilestoneItem) {
    const nextDone = !milestone.done;
    setError(null);
    setItems((previous) =>
      previous.map((item) =>
        item.id === milestone.id ? { ...item, done: nextDone } : item,
      ),
    );
    try {
      const response = await fetch(
        `/api/roadmaps/${roadmapId}/milestones/${milestone.id}`,
        {
          body: JSON.stringify({ done: nextDone }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      if (!response.ok) {
        throw new Error("save failed");
      }
      router.refresh();
    } catch {
      setItems((previous) =>
        previous.map((item) =>
          item.id === milestone.id ? { ...item, done: milestone.done } : item,
        ),
      );
      setError("Could not save that change. Try again.");
    }
  }

  const doneCount = items.filter((item) => item.done).length;

  return (
    <div>
      <p className="text-sm text-[var(--color-muted)]">
        {doneCount} of {items.length} milestones done.
      </p>
      {error && <p className="error-text mt-2">{error}</p>}
      <ul className="mt-3 space-y-2">
        {items.map((milestone) => (
          <li
            className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] p-3"
            key={milestone.id}
          >
            <input
              aria-label={`Mark milestone done: ${milestone.title}`}
              checked={milestone.done}
              className="mt-1"
              onChange={() => toggle(milestone)}
              type="checkbox"
            />
            <div className="min-w-0 flex-1">
              <p
                className={
                  milestone.done
                    ? "text-sm text-[var(--color-muted)] line-through"
                    : "text-sm"
                }
              >
                {milestone.title}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Week {milestone.week}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
