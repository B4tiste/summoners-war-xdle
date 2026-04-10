/**
 * game-engine.ts
 *
 * Core Classic mode game logic: resolves a guess against the daily target
 * and builds the GuessResult payload returned by the API.
 */

import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";
import type { GuessResult } from "./types";
import { CLASSIC_COLUMNS } from "./columns";
import { evaluateAllColumns } from "./comparators";

/** Maximum number of guesses allowed per day */
export const MAX_ATTEMPTS = 10;

export type ClassicPlayMode = "daily" | "free";

/**
 * Processes a single guess and returns the full GuessResult.
 *
 * @param guess  - The monster the player guessed
 * @param target - The daily target monster
 */
export function processGuess(
  guess: ClassicMonster,
  target: ClassicMonster
): GuessResult {
  const results = evaluateAllColumns(CLASSIC_COLUMNS, guess, target);
  // Winning must require the exact monster, not only matching compared columns.
  const isWin = guess.com2usId === target.com2usId;

  return {
    guess: {
      com2usId: guess.com2usId,
      slug: guess.slug,
      displayName: guess.displayName,
      image: guess.image,
    },
    results,
    isWin,
  };
}

/**
 * Returns a lightweight description of the Classic puzzle for a given date.
 * Does NOT include the target monster identity.
 */
export function buildPuzzleMeta(date: string, mode: ClassicPlayMode = "daily") {
  return {
    mode,
    date,
    columns: CLASSIC_COLUMNS.map((c) => ({ key: c.key, label: c.label })),
    maxAttempts: mode === "free" ? Number.MAX_SAFE_INTEGER : MAX_ATTEMPTS,
  };
}
