"use client";

/**
 * GuessGrid
 *
 * Displays the comparison grid for all submitted guesses.
 * Each row shows the guessed monster and the per-column comparison status.
 */

import { clsx } from "clsx";
import type { GuessResult, ColumnComparisonResult, ComparisonStatus } from "@/lib/classic/types";

interface Props {
  guesses: GuessResult[];
  columnHeaders: { key: string; label: string }[];
  revealingSlug: string | null;
}

export const CELL_REVEAL_DURATION_MS = 500;
export const CELL_REVEAL_STAGGER_MS = 750;
const HALF_FLIP_MS = CELL_REVEAL_DURATION_MS / 2;

const STATUS_STYLES: Record<ComparisonStatus, string> = {
  // ok -> green
  match: "bg-green-700 text-emerald-950",
  // nok -> red
  mismatch: "bg-red-700 text-rose-950",
  higher: "bg-red-700 text-rose-950",
  lower: "bg-red-700 text-rose-950",
  // missing data -> neutral
  unknown: "bg-zinc-700 text-zinc-200",
};

const STATUS_LABELS: Record<ComparisonStatus, string> = {
  match: "Match",
  mismatch: "Mismatch",
  higher: "⬇ Lower",
  lower: "⬆ Higher",
  unknown: "Unknown",
};

function formatCellValue(value: string | number | boolean | null): string {
  if (value == null) return "?";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatMoreLessDisplay(result: ColumnComparisonResult): string {
  const value = typeof result.guessValue === "number" ? result.guessValue : null;
  if (value == null) return "?";

  if (result.status === "lower") {
    return `More than ${value}`;
  }

  if (result.status === "higher") {
    return `Less than ${value}`;
  }

  return String(value);
}

function ComparisonCell({
  result,
  shouldReveal,
  revealDelayMs,
}: {
  result: ColumnComparisonResult;
  shouldReveal: boolean;
  revealDelayMs: number;
}) {
  const style = STATUS_STYLES[result.status];
  const formattedValue = formatCellValue(result.guessValue);
  const isSpeedColumn = result.key === "speed";
  const isSkillUpsColumn = result.key === "skillUpsToMax";
  const isElementColumn = result.key === "element";
  const isNaturalStarsColumn = result.key === "naturalStars";

  const displayText =
    isSpeedColumn || isSkillUpsColumn
      ? formatMoreLessDisplay(result)
      : formattedValue;

  const maxWidth = isSkillUpsColumn
    ? "max-w-[110px]"
    : isElementColumn
      ? "max-w-[60px]"
      : isNaturalStarsColumn
        ? "max-w-[80px]"
        : "max-w-[80px]";

  // Render element image
  if (isElementColumn && result.guessValue) {
    const elementLower = String(result.guessValue).toLowerCase();
    return (
      <td
        className="rounded-xl border border-zinc-700 overflow-hidden relative bg-zinc-950"
        title={`${result.label}: ${result.guessValue} (${STATUS_LABELS[result.status]})`}
      >
        {shouldReveal && (
          <div
            className="absolute inset-0 bg-zinc-950 z-10 classic-cell-flip-out"
            style={{
              animationDelay: `${revealDelayMs}ms`,
              animationDuration: `${HALF_FLIP_MS}ms`,
            }}
          />
        )}
        <div
          className={clsx(
            "absolute inset-0 flex items-center justify-center px-2 py-1.5",
            style,
            shouldReveal && "classic-cell-flip-in"
          )}
          style={
            shouldReveal
              ? {
                  animationDelay: `${revealDelayMs + HALF_FLIP_MS}ms`,
                  animationDuration: `${HALF_FLIP_MS}ms`,
                }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/Images/${elementLower}.png`}
            alt={elementLower}
            width={24}
            height={24}
            className="w-6 h-6"
          />
        </div>
        <div className="invisible px-2 py-1.5 pointer-events-none" aria-hidden="true">
          <div className="w-8 h-8" />
        </div>
      </td>
    );
  }

  // Render natural stars as star images
  if (isNaturalStarsColumn && result.guessValue) {
    const starCount = Number(result.guessValue);
    return (
      <td
        className="rounded-xl border border-zinc-700 overflow-hidden relative bg-zinc-950"
        title={`${result.label}: ${starCount} (${STATUS_LABELS[result.status]})`}
      >
        {shouldReveal && (
          <div
            className="absolute inset-0 bg-zinc-950 z-10 classic-cell-flip-out"
            style={{
              animationDelay: `${revealDelayMs}ms`,
              animationDuration: `${HALF_FLIP_MS}ms`,
            }}
          />
        )}
        <div
          className={clsx(
            "absolute inset-0 flex items-center justify-center px-2 py-1.5",
            style,
            shouldReveal && "classic-cell-flip-in"
          )}
          style={
            shouldReveal
              ? {
                  animationDelay: `${revealDelayMs + HALF_FLIP_MS}ms`,
                  animationDuration: `${HALF_FLIP_MS}ms`,
                }
              : undefined
          }
        >
          <div className="flex gap-1">
            {Array.from({ length: starCount }).map((_, i) => (
              <img
                key={i}
                src="/Images/star.png"
                alt="star"
                width={16}
                height={16}
                className="w-4 h-4"
              />
            ))}
          </div>
        </div>
        <div className="invisible px-2 py-1.5 pointer-events-none" aria-hidden="true">
          <div className="flex gap-1">
            {Array.from({ length: Math.max(1, starCount) }).map((_, i) => (
              <div key={i} className="w-4 h-4" />
            ))}
          </div>
        </div>
      </td>
    );
  }

  return (
    <td
      className="rounded-xl border border-zinc-700 overflow-hidden relative bg-zinc-950"
      title={`${result.label}: ${String(result.guessValue ?? "unknown")} (${STATUS_LABELS[result.status]})`}
    >
      {/* Phase 1: black overlay squishes away */}
      {shouldReveal && (
        <div
          className="absolute inset-0 bg-zinc-950 z-10 classic-cell-flip-out"
          style={{
            animationDelay: `${revealDelayMs}ms`,
            animationDuration: `${HALF_FLIP_MS}ms`,
          }}
        />
      )}
      {/* Phase 2: colored layer expands in */}
      <div
        className={clsx(
          "absolute inset-0 flex items-center justify-center px-2 py-1.5",
          style,
          shouldReveal && "classic-cell-flip-in"
        )}
        style={
          shouldReveal
            ? {
                animationDelay: `${revealDelayMs + HALF_FLIP_MS}ms`,
                animationDuration: `${HALF_FLIP_MS}ms`,
              }
            : undefined
        }
      >
        <span
          className={clsx(
            "text-xs font-bold text-white text-center",
            isSpeedColumn ? "whitespace-nowrap" : ["truncate", maxWidth]
          )}
        >
          {displayText}
        </span>
      </div>
      {/* Invisible spacer — gives the <td> its natural dimensions */}
      <div className="invisible px-2 py-1.5 pointer-events-none" aria-hidden="true">
        <span className={clsx("text-xs font-bold", isSpeedColumn ? "whitespace-nowrap" : maxWidth)}>
          {displayText}
        </span>
      </div>
    </td>
  );
}

export function GuessGrid({ guesses, columnHeaders, revealingSlug }: Props) {
  if (guesses.length === 0) return null;

  return (
    <div className="w-full">
      <table className="w-full border-separate border-spacing-x-2 border-spacing-y-2 text-sm">
        <thead>
          <tr>
            <th className="border-b-2 border-zinc-100 px-3 py-2 text-left text-zinc-100 font-medium whitespace-nowrap">
              Monster
            </th>
            {columnHeaders.map((col) => (
              <th
                key={col.key}
                className="border-b-2 border-zinc-100 px-2 py-2 text-center text-zinc-100 font-medium text-xs whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guesses.map((guess) => {
            const isRowRevealing = revealingSlug === guess.guess.slug;

            return (
            <tr key={guess.guess.slug}>
              <td className="px-3 py-2 whitespace-nowrap rounded-xl border border-zinc-700 bg-zinc-950/70">
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={guess.guess.image}
                    alt={guess.guess.displayName}
                    width={40}
                    height={40}
                    className="rounded-full shrink-0"
                  />
                </div>
              </td>
              {guess.results.map((result, colIndex) => (
                <ComparisonCell
                  key={result.key}
                  result={result}
                  shouldReveal={isRowRevealing}
                  revealDelayMs={colIndex * CELL_REVEAL_STAGGER_MS}
                />
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
