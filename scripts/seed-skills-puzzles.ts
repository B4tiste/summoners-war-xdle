/**
 * seed-skills-puzzles.ts
 *
 * Generates a deterministic list of daily puzzle assignments for the Skills
 * mode and saves them to data/generated/skills-puzzles.json.
 *
 * Uses the same LCG-style hash as seed-daily-puzzles.ts but with mode="skills".
 *
 * Run with: pnpm data:skills:puzzles
 *
 * Requires: DATASET_SEED in .env (or process.env.DATASET_SEED)
 */

import fs from "fs";
import path from "path";
import { loadEnv } from "./lib/env";
import type { SkillsMonster } from "../src/lib/schemas/skills-monster.schema";

const SKILLS_DATASET_PATH = path.join(process.cwd(), "data", "generated", "skills-monsters.json");
const OUTPUT_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "skills-puzzles.json");

/** How many days ahead to pre-generate puzzles */
const DAYS_AHEAD = 365;

loadEnv();

const DATASET_SEED = process.env.DATASET_SEED;
if (!DATASET_SEED) {
  console.error("DATASET_SEED is not set. Add it to your .env file.");
  process.exit(1);
}

export interface SkillsPuzzleEntry {
  date: string;
  mode: "skills";
  targetCom2usId: number;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function pickMonster(
  monsters: SkillsMonster[],
  seed: string,
  date: string,
  mode: string
): SkillsMonster {
  const hash = hashString(`${seed}:${mode}:${date}`);
  return monsters[hash % monsters.length];
}

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
  if (!fs.existsSync(SKILLS_DATASET_PATH)) {
    console.error(
      `Skills dataset not found at ${SKILLS_DATASET_PATH}. Run pnpm data:skills:build first.`
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allMonsters = JSON.parse(
    fs.readFileSync(SKILLS_DATASET_PATH, "utf-8")
  ) as SkillsMonster[];

  if (allMonsters.length === 0) {
    console.error("No eligible monsters in skills dataset. Aborting.");
    process.exit(1);
  }

  console.log(`Eligible monsters for skills mode: ${allMonsters.length}`);

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const dates = generateDateRange(startDate, DAYS_AHEAD);

  const puzzles: SkillsPuzzleEntry[] = dates.map((date) => {
    const monster = pickMonster(allMonsters, DATASET_SEED!, date, "skills");
    return {
      date,
      mode: "skills",
      targetCom2usId: monster.com2usId,
    };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(puzzles, null, 2), "utf-8");

  console.log(`\nSkills puzzle seeding complete:`);
  console.log(`  Days generated: ${puzzles.length}`);
  console.log(`  From: ${dates[0]} to: ${dates[dates.length - 1]}`);
  console.log(`  -> Saved to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
