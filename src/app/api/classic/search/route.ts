/**
 * GET /api/classic/search?q=<query>
 *
 * Searches the Classic monster dataset and returns up to MAX_RESULTS
 * searchable monsters matching the query string.
 *
 * Matching strategy (in order of priority):
 *  1. Exact slug match
 *  2. Token prefix match (searchTokens)
 *  3. displayName / shortName substring match
 */

import type { NextRequest } from "next/server";
import { loadClassicDataset } from "@/lib/datasets/load-classic-dataset";
import type { ClassicMonster } from "@/lib/schemas/classic-monster.schema";

const MAX_RESULTS = 10;

/** Minimum query length to trigger a search */
const MIN_QUERY_LENGTH = 2;

function scoreMonster(monster: ClassicMonster, q: string): number {
  const lower = q.toLowerCase();

  if (monster.slug === lower) return 100;

  if (monster.searchTokens.some((t) => t.startsWith(lower))) return 80;

  if (
    monster.displayName.toLowerCase().includes(lower) ||
    monster.shortName.toLowerCase().includes(lower)
  ) {
    return 60;
  }

  return 0;
}

function searchMonsters(
  dataset: ClassicMonster[],
  q: string
): ClassicMonster[] {
  const results: { monster: ClassicMonster; score: number }[] = [];

  for (const monster of dataset) {
    if (!monster.searchable) continue;
    const score = scoreMonster(monster, q);
    if (score > 0) results.push({ monster, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, MAX_RESULTS).map((r) => r.monster);
}

export function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = (searchParams.get("q") ?? "").trim();

    if (q.length < MIN_QUERY_LENGTH) {
      return Response.json({ results: [] });
    }

    const dataset = loadClassicDataset();
    const matches = searchMonsters(dataset, q);

    const results = matches.map((m) => ({
      slug: m.slug,
      displayName: m.displayName,
      shortName: m.shortName,
      image: m.image,
      element: m.element,
    }));

    return Response.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
