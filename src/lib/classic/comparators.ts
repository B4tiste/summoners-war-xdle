/**
 * comparators.ts
 *
 * Pure comparison functions for Classic mode column evaluation.
 * Logic is generic and reusable independently of any API layer.
 */

import type { ComparisonStatus, ColumnComparisonResult, ClassicColumnKey } from "./types";
import type { ColumnDefinition } from "./columns";
import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";

/**
 * Compares two enum (string / boolean) values.
 * Returns "unknown" if either side is null/undefined.
 */
export function compareEnum(
  guessValue: string | boolean | null,
  targetValue: string | boolean | null
): ComparisonStatus {
  if (guessValue == null || targetValue == null) return "unknown";
  return guessValue === targetValue ? "match" : "mismatch";
}

/**
 * Compares two numeric values.
 * Returns "unknown" if either side is null/undefined.
 * Returns "higher" if the guessed value exceeds the target,
 * "lower" if it is below.
 */
export function compareNumber(
  guessValue: number | null,
  targetValue: number | null
): ComparisonStatus {
  if (guessValue == null || targetValue == null) return "unknown";
  if (guessValue === targetValue) return "match";
  return guessValue > targetValue ? "higher" : "lower";
}

/**
 * Compares two boolean values.
 * Returns "unknown" if either side is null/undefined.
 */
export function compareBool(
  guessValue: boolean | null,
  targetValue: boolean | null
): ComparisonStatus {
  if (guessValue == null || targetValue == null) return "unknown";
  return guessValue === targetValue ? "match" : "mismatch";
}

/**
 * Evaluates a single column for one (guess, target) pair.
 */
export function evaluateColumn(
  column: ColumnDefinition,
  guess: ClassicMonster,
  target: ClassicMonster
): ColumnComparisonResult {
  const guessValue = column.getValue(guess);
  const targetValue = column.getValue(target);

  let status: ComparisonStatus;

  if (column.type === "enum") {
    status = compareEnum(
      guessValue as string | boolean | null,
      targetValue as string | boolean | null
    );
  } else if (column.type === "bool") {
    status = compareBool(
      guessValue as boolean | null,
      targetValue as boolean | null
    );
  } else {
    status = compareNumber(
      guessValue as number | null,
      targetValue as number | null
    );
  }

  return {
    key: column.key as ClassicColumnKey,
    label: column.label,
    guessValue,
    status,
  };
}

/**
 * Evaluates all columns for one (guess, target) pair.
 * Returns an ordered array of ColumnComparisonResult.
 */
export function evaluateAllColumns(
  columns: ColumnDefinition[],
  guess: ClassicMonster,
  target: ClassicMonster
): ColumnComparisonResult[] {
  return columns.map((col) => evaluateColumn(col, guess, target));
}

/**
 * Returns true if every column status is "match".
 */
export function isAllMatch(results: ColumnComparisonResult[]): boolean {
  return results.every((r) => r.status === "match");
}
