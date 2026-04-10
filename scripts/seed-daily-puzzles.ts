/**
 * seed-daily-puzzles.ts
 *
 * Generates a deterministic list of daily puzzle assignments for the Classic
 * mode and saves them to data/generated/daily-puzzles.json.
 *
 * Determinism is achieved by seeding a simple LCG (Linear Congruential
 * Generator) with DATASET_SEED + date + mode, then picking a monster index.
 *
 * Run with: pnpm data:puzzles
 *
 * Requires: DATASET_SEED in .env (or process.env.DATASET_SEED)
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "./lib/env";
import type { ClassicMonster } from "../src/lib/schemas/classic-monster.schema";
import type { DailyPuzzleEntry } from "../src/lib/classic/types";

const DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "generated",
  "classic-monsters.json"
);
const OUTPUT_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "daily-puzzles.json");

/** How many days ahead to pre-generate puzzles */
const DAYS_AHEAD = 365;

loadEnv();

const DATASET_SEED = process.env.DATASET_SEED;
if (!DATASET_SEED) {
  console.error("DATASET_SEED is not set. Add it to your .env file.");
  process.exit(1);
}

/**
 * A simple non-cryptographic hash that converts a string into an integer.
 * Used to seed the daily selection without a PRNG library dependency.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Picks a monster for a given (seed, date, mode) triplet.
 * The result is stable as long as the dataset and seed don't change.
 */
function pickMonster(
  monsters: ClassicMonster[],
  seed: string,
  date: string,
  mode: string
): ClassicMonster {
  const hash = hashString(`${seed}:${mode}:${date}`);
  return monsters[hash % monsters.length];
}

/**
 * Returns an array of ISO date strings starting from today (UTC)
 * for `count` consecutive days.
 */
function generateDateRange(startDate: Date, count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function main(): void {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(
      `Classic dataset not found at ${DATASET_PATH}. Run \`pnpm data:classic\` first.`
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const raw = fs.readFileSync(DATASET_PATH, "utf-8");
  const allMonsters = JSON.parse(raw) as ClassicMonster[];

  // Only eligible monsters can be daily targets
  const eligible = allMonsters.filter(
    (m) => m.searchable && m.obtainable !== false
  );

  if (eligible.length === 0) {
    console.error(
      "No eligible monsters found (searchable + obtainable). Aborting."
    );
    process.exit(1);
  }

  console.log(`Eligible monsters: ${eligible.length}`);

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const dates = generateDateRange(startDate, DAYS_AHEAD);

  const puzzles: DailyPuzzleEntry[] = dates.map((date) => {
    const monster = pickMonster(eligible, DATASET_SEED!, date, "classic");
    return {
      date,
      mode: "classic",
      targetCom2usId: monster.com2usId,
    };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(puzzles, null, 2), "utf-8");

  console.log(`\nPuzzle seeding complete:`);
  console.log(`  Days generated: ${puzzles.length}`);
  console.log(`  From: ${dates[0]} to: ${dates[dates.length - 1]}`);
  console.log(`  -> Saved to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
