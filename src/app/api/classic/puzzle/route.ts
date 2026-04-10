/**
 * GET /api/classic/puzzle
 *
 * Returns the puzzle metadata for today's Classic mode challenge.
 * Never includes the target monster identity.
 */

import type { NextRequest } from "next/server";
import { buildPuzzleMeta } from "@/lib/classic/game-engine";
import { resolvePuzzleDate } from "@/lib/datasets/load-daily-puzzle";

export function GET(request: NextRequest) {
  try {
    const modeParam = request.nextUrl.searchParams.get("mode");
    const mode = modeParam === "free" ? "free" : "daily";
    const clientDate = request.nextUrl.searchParams.get("clientDate");
    const tz = request.nextUrl.searchParams.get("tz");
    const date = resolvePuzzleDate({ clientDate, tz });
    const meta = buildPuzzleMeta(date, mode);
    return Response.json(meta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
