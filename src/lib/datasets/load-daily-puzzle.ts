/**
 * load-daily-puzzle.ts
 *
 * Resolves the daily target monster for a given mode and date.
 * Reads the pre-generated daily-puzzles.json file (offline, no DB needed).
 */

import fs from "fs";
import path from "path";
import { z } from "zod";
import { findMonsterById } from "./load-classic-dataset";
import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";
import type { DailyPuzzleEntry } from "@/lib/classic/types";

const FRANCE_TIME_ZONE = "Europe/Paris";

const PUZZLES_PATH = path.join(
  process.cwd(),
  "data",
  "generated",
  "daily-puzzles.json"
);

const DailyPuzzleEntrySchema = z.object({
  date: z.string(),
  mode: z.literal("classic"),
  targetCom2usId: z.number().int(),
});

const DailyPuzzlesFileSchema = z.array(DailyPuzzleEntrySchema);

/** Cache parsed puzzles for the process lifetime */
let _puzzlesCache: DailyPuzzleEntry[] | null = null;

function loadPuzzles(): DailyPuzzleEntry[] {
  if (_puzzlesCache !== null) return _puzzlesCache;

  if (!fs.existsSync(PUZZLES_PATH)) {
    throw new Error(
      `Daily puzzles file not found at ${PUZZLES_PATH}. ` +
        "Run `pnpm data:puzzles` to generate it."
    );
  }

  const raw = fs.readFileSync(PUZZLES_PATH, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const result = DailyPuzzlesFileSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Daily puzzles validation failed: ${result.error.message}`
    );
  }

  _puzzlesCache = result.data;
  return _puzzlesCache;
}

/** Returns today's date in YYYY-MM-DD format for France timezone. */
export function todayFrance(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: FRANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Resolves puzzle date for daily challenge.
 * Daily reset is server-authoritative and always follows France timezone.
 */
export function resolvePuzzleDate(): string {
  return todayFrance();
}

export function shiftIsoDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Resolves the target ClassicMonster for the given date (UTC).
 * Throws if no puzzle is found for that date or if the monster is missing.
 */
export function getDailyTarget(
  date: string = todayFrance()
): ClassicMonster {
  const puzzles = loadPuzzles();
  const entry = puzzles.find((p) => p.date === date && p.mode === "classic");

  if (!entry) {
    throw new Error(
      `No classic puzzle found for date ${date}. ` +
        "Run `pnpm data:puzzles` to regenerate."
    );
  }

  const monster = findMonsterById(entry.targetCom2usId);

  if (!monster) {
    throw new Error(
      `Target monster com2usId=${entry.targetCom2usId} not found in dataset.`
    );
  }

  return monster;
}

export function getPreviousDailyTarget(
  date: string = todayFrance()
): ClassicMonster {
  return getDailyTarget(shiftIsoDate(date, -1));
}
