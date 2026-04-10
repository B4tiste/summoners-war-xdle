/**
 * POST /api/classic/guess
 *
 * Accepts a monster slug guess from the player and returns the
 * column-by-column comparison result against today's target.
 *
 * Request body: { slug: string }
 *
 * Response:
 * {
 *   guess: { com2usId, slug, displayName, image },
 *   results: ColumnComparisonResult[],
 *   isWin: boolean,
 *   targetSummary?: TargetSummary  // only present on win
 * }
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import { findMonsterById, findMonsterBySlug } from "@/lib/datasets/load-classic-dataset";
import { getDailyTarget, resolvePuzzleDate } from "@/lib/datasets/load-daily-puzzle";
import { processGuess } from "@/lib/classic/game-engine";
import type { TargetSummary } from "@/lib/classic/types";

const GuessBodySchema = z.object({
  slug: z.string().min(1),
  mode: z.enum(["daily", "free"]).optional(),
  targetCom2usId: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body: unknown = await request.json();
    const parsed = GuessBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body", details: parsed.error.message },
        { status: 400 }
      );
    }

    const { slug, mode = "daily", targetCom2usId } = parsed.data;

    // Resolve guessed monster
    const guessMonster = findMonsterBySlug(slug);
    if (!guessMonster) {
      return Response.json(
        { error: `Monster with slug "${slug}" not found.` },
        { status: 404 }
      );
    }

    // Resolve target based on selected mode
    if (mode === "free" && targetCom2usId == null) {
      return Response.json(
        { error: "Missing targetCom2usId for free mode." },
        { status: 400 }
      );
    }

    const target =
      mode === "free"
        ? findMonsterById(targetCom2usId!)
        : getDailyTarget(resolvePuzzleDate());

    if (!target) {
      return Response.json(
        { error: `Free target com2usId=${targetCom2usId} not found.` },
        { status: 404 }
      );
    }

    // Evaluate guess
    const result = processGuess(guessMonster, target);

    // Build response – only expose target identity on win
    const response: typeof result & { targetSummary?: TargetSummary } = result;

    if (result.isWin) {
      response.targetSummary = {
        com2usId: target.com2usId,
        slug: target.slug,
        displayName: target.displayName,
        image: target.image,
      };
    }

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
