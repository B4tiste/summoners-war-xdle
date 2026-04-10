/**
 * fetch-skills-icons.ts
 *
 * Fetches skill name + icon_filename for every skill ID referenced in
 * merged-monsters.json and stores them in data/snapshots/skills-icons-cache.json.
 *
 * Existing cache entries are reused to avoid re-fetching.
 * Run with: pnpm data:skills:fetch
 */

import fs from "fs";
import path from "path";

const MERGED_PATH = path.join(
  process.cwd(),
  "data",
  "snapshots",
  "merged-monsters.json"
);

const CACHE_PATH = path.join(
  process.cwd(),
  "data",
  "snapshots",
  "skills-icons-cache.json"
);

interface RawMergedMonster {
  com2usId: number;
  skillIds: number[];
  searchable?: boolean;
  obtainable?: boolean | null;
}

interface SkillIconEntry {
  id: number;
  name: string;
  icon_filename: string;
}

type SkillIconsCache = Record<string, SkillIconEntry>;

async function fetchSkill(id: number): Promise<SkillIconEntry> {
  const url = `https://swarfarm.com/api/v2/skills/${id}/`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64)",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Skill ${id} -> ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { id: number; name: string; icon_filename: string };
  return { id: data.id, name: data.name, icon_filename: data.icon_filename };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  if (!fs.existsSync(MERGED_PATH)) {
    console.error(`merged-monsters.json not found at ${MERGED_PATH}. Run pnpm data:merge first.`);
    process.exit(1);
  }

  // Load merged monsters and collect all skill IDs from eligible monsters
  const allMonsters = JSON.parse(fs.readFileSync(MERGED_PATH, "utf-8")) as RawMergedMonster[];
  const eligibleMonsters = allMonsters.filter(
    (m) => m.searchable && m.obtainable !== false
  );

  const allSkillIds = new Set<number>();
  for (const monster of eligibleMonsters) {
    for (const id of monster.skillIds ?? []) {
      allSkillIds.add(id);
    }
  }

  console.log(`Found ${allSkillIds.size} unique skill IDs across ${eligibleMonsters.length} eligible monsters.`);

  // Load existing cache
  let cache: SkillIconsCache = {};
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as SkillIconsCache;
    console.log(`Loaded ${Object.keys(cache).length} cached skills.`);
  }

  const missing = Array.from(allSkillIds).filter((id) => !(id.toString() in cache));
  console.log(`Need to fetch ${missing.length} new skills...`);

  let fetched = 0;
  let errors = 0;

  for (const id of missing) {
    try {
      const entry = await fetchSkill(id);
      cache[id.toString()] = entry;
      fetched++;

      if (fetched % 20 === 0) {
        console.log(`  Fetched ${fetched}/${missing.length}...`);
        // Save progress periodically
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
      }

      // Be respectful to the API
      await sleep(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Failed skill ${id}: ${msg}`);
      errors++;
    }
  }

  // Final save
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
  console.log(`\nDone. Fetched: ${fetched}, Errors: ${errors}, Total cached: ${Object.keys(cache).length}`);
}

main();
