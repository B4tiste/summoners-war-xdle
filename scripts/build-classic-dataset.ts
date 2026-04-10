/**
 * build-classic-dataset.ts
 *
 * Transforms the merged raw monsters snapshot into the normalized
 * ClassicMonster dataset used by the game at runtime.
 *
 * Input : data/snapshots/merged-monsters.json
 * Output: data/generated/classic-monsters.json
 *
 * Run with: pnpm data:classic
 */

import fs from "fs";
import path from "path";
import type { RawMergedMonster } from "../src/lib/domain/monster";
import type { ClassicMonster } from "../src/lib/schemas/classic-monster.schema";

const MERGED_PATH = path.join(
  process.cwd(),
  "data",
  "snapshots",
  "merged-monsters.json"
);
const SKILLS_CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "snapshots",
  "skills-passive-cache.json"
);
const OUTPUT_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "classic-monsters.json");

interface SkillApiResponse {
  id: number;
  passive: boolean;
}

interface SkillsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SkillApiResponse[];
}

/**
 * Builds search tokens from a monster's names and metadata so that
 * front-end search can run without a database.
 */
function buildSearchTokens(monster: RawMergedMonster): string[] {
  const tokens = new Set<string>();

  const addTokens = (text: string): void => {
    text
      .toLowerCase()
      .split(/\s+/)
      .forEach((t) => {
        if (t.length > 1) tokens.add(t);
      });
    tokens.add(text.toLowerCase());
  };

  addTokens(monster.label);
  addTokens(monster.slabel);
  addTokens(monster.slug.replace(/-/g, " "));
  if (monster.element) addTokens(monster.element);
  if (monster.archetype) addTokens(monster.archetype);

  return Array.from(tokens);
}

/**
 * Derives a family name from the family_id using a simple naming convention.
 * In V1 we don't have a family name lookup table, so we return null.
 */
function deriveFamilyName(_familyId: number | null): string | null {
  // TODO: enrich with a family name lookup table when available
  return null;
}

function loadPassiveCache(): Record<string, boolean> {
  if (!fs.existsSync(SKILLS_CACHE_PATH)) return {};

  try {
    const raw = fs.readFileSync(SKILLS_CACHE_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function savePassiveCache(cache: Record<string, boolean>): void {
  fs.writeFileSync(SKILLS_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

async function fetchSkillsPage(page: number): Promise<SkillsListResponse> {
  const url = `https://swarfarm.com/api/v2/skills/?page=${page}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64)",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `skills page ${page} -> ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as SkillsListResponse;
}

async function loadOrFetchPassiveBySkillId(): Promise<Map<number, boolean>> {
  const cache = loadPassiveCache();

  // Reuse existing cache when available to keep builds fast.
  if (Object.keys(cache).length > 0) {
    console.log(`  Using cached passives: ${Object.keys(cache).length} skills.`);
  } else {
    console.log("  Fetching skills passives in paginated mode...");
    let page = 1;
    while (true) {
      const payload = await fetchSkillsPage(page);
      for (const skill of payload.results) {
        cache[skill.id.toString()] = Boolean(skill.passive);
      }

      console.log(`  Page ${page}: ${payload.results.length} skills`);

      if (!payload.next) break;
      page += 1;
    }

    savePassiveCache(cache);
    console.log(`  Cached      : ${Object.keys(cache).length} skills`);
  }

  const passiveBySkillId = new Map<number, boolean>();
  for (const [idStr, value] of Object.entries(cache)) {
    if (typeof value === "boolean") {
      passiveBySkillId.set(parseInt(idStr, 10), value);
    }
  }

  return passiveBySkillId;
}

function computeHasPassive(
  skillIds: number[],
  passiveBySkillId: Map<number, boolean>
): boolean | null {
  if (skillIds.length === 0) return false;

  let unresolved = false;
  for (const skillId of skillIds) {
    const passive = passiveBySkillId.get(skillId);
    if (passive == null) {
      unresolved = true;
      continue;
    }
    if (passive) return true;
  }

  return unresolved ? null : false;
}

function transformMonster(
  raw: RawMergedMonster,
  passiveBySkillId: Map<number, boolean>
): ClassicMonster {
  return {
    id: raw.slug,
    com2usId: raw.com2usId,
    slug: raw.slug,
    displayName: raw.label,
    shortName: raw.slabel,
    familyName: deriveFamilyName(raw.familyId),
    element: raw.element,
    archetype: raw.archetype,
    naturalStars: raw.naturalStars,
    awakenLevel: raw.awakenLevel,
    obtainable: raw.obtainable,
    fusionFood: raw.fusionFood,
    skillUpsToMax: raw.skillUpsToMax,
    hasLeaderSkill: raw.hasLeaderSkill,
    hasPassive: computeHasPassive(raw.skillIds, passiveBySkillId),
    speed: raw.speed,
    baseHp: raw.baseHp,
    baseAttack: raw.baseAttack,
    baseDefense: raw.baseDefense,
    critRate: raw.critRate,
    critDamage: raw.critDamage,
    resistance: raw.resistance,
    accuracy: raw.accuracy,
    image: raw.image,
    searchable: raw.searchable,
    searchTokens: buildSearchTokens(raw),
  };
}

async function main(): Promise<void> {
  if (!fs.existsSync(MERGED_PATH)) {
    console.error(
      `Merged snapshot not found at ${MERGED_PATH}. Run \`pnpm data:merge\` first.`
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Loading merged dataset...");
  const raw = fs.readFileSync(MERGED_PATH, "utf-8");
  const merged = JSON.parse(raw) as RawMergedMonster[];
  console.log(`  ${merged.length} monsters loaded.`);

  console.log("Resolving passive skills from SWARFARM skills API...");
  const passiveBySkillId = await loadOrFetchPassiveBySkillId();

  console.log("Transforming to ClassicMonster format...");
  const dataset: ClassicMonster[] = merged.map((monster) =>
    transformMonster(monster, passiveBySkillId)
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");

  const searchable = dataset.filter((m) => m.searchable).length;
  console.log(`\nBuild complete:`);
  console.log(`  Total     : ${dataset.length}`);
  console.log(`  Searchable: ${searchable}`);
  console.log(`  -> Saved to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to build classic dataset: ${message}`);
  process.exit(1);
});
