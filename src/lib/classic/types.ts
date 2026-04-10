/**
 * types.ts
 *
 * Shared TypeScript types for the Classic game mode.
 */

import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";

/** Keys that identify a column in the Classic comparison grid */
export type ClassicColumnKey =
  | "element"
  | "archetype"
  | "naturalStars"
  | "skillUpsToMax"
  | "hasLeaderSkill"
  | "speed"
  | "hasPassive";

/**
 * Status results for a single column comparison.
 *
 * - match   : the guessed value equals the target
 * - mismatch: the guessed value differs from the target (for enum columns)
 * - higher  : the guessed number is higher than the target
 * - lower   : the guessed number is lower than the target
 * - unknown : one or both values are missing (null)
 */
export type ComparisonStatus =
  | "match"
  | "mismatch"
  | "higher"
  | "lower"
  | "unknown";

/** Result for a single column after comparing guess vs target */
export interface ColumnComparisonResult {
  key: ClassicColumnKey;
  /** Label displayed in the UI */
  label: string;
  /** The value from the guessed monster */
  guessValue: string | number | boolean | null;
  status: ComparisonStatus;
}

/** Full result for one guess attempt */
export interface GuessResult {
  /** The monster the user guessed */
  guess: Pick<ClassicMonster, "com2usId" | "slug" | "displayName" | "image">;
  /** Per-column comparison results */
  results: ColumnComparisonResult[];
  /** True if all columns are "match" */
  isWin: boolean;
}

/** Lightweight summary returned on win or in debug mode */
export interface TargetSummary {
  com2usId: number;
  slug: string;
  displayName: string;
  image: string;
}

/** Shape of the daily-puzzles.json file */
export interface DailyPuzzleEntry {
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: string;
  /** Game mode identifier */
  mode: "classic";
  /** com2us_id of the target monster */
  targetCom2usId: number;
}
