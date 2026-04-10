/**
 * game-engine.ts
 *
 * Core Classic mode game logic: resolves a guess against the daily target
 * and builds the GuessResult payload returned by the API.
 */

import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";
import type { GuessResult } from "./types";
import { CLASSIC_COLUMNS, FREEPLAY_EXTENDED_COLUMNS } from "./columns";
import { evaluateAllColumns } from "./comparators";

/** Maximum number of guesses allowed per day */
export const MAX_ATTEMPTS = 10;

export type ClassicPlayMode = "daily" | "free";

function getColumnsForMode(mode: ClassicPlayMode) {
  return mode === "free" ? FREEPLAY_EXTENDED_COLUMNS : CLASSIC_COLUMNS;
}

/**
 * Processes a single guess and returns the full GuessResult.
 *
 * @param guess  - The monster the player guessed
 * @param target - The daily target monster
 */
export function processGuess(
  guess: ClassicMonster,
  target: ClassicMonster,
  mode: ClassicPlayMode = "daily"
): GuessResult {
  const results = evaluateAllColumns(getColumnsForMode(mode), guess, target);
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
  const columns = getColumnsForMode(mode);

  return {
    mode,
    date,
    columns: columns.map((c) => ({ key: c.key, label: c.label })),
    maxAttempts: mode === "daily" ? MAX_ATTEMPTS : Number.MAX_SAFE_INTEGER,
  };
}
