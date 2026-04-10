/**
 * POST /api/classic/free-solution
 *
 * Returns the target summary for a Classic free-play round.
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import { findMonsterById } from "@/lib/datasets/load-classic-dataset";

const FreeSolutionBodySchema = z.object({
  targetCom2usId: z.number().int(),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = FreeSolutionBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body", details: parsed.error.message },
        { status: 400 }
      );
    }

    const target = findMonsterById(parsed.data.targetCom2usId);
    if (!target) {
      return Response.json(
        { error: `Free target com2usId=${parsed.data.targetCom2usId} not found.` },
        { status: 404 }
      );
    }

    return Response.json({
      targetSummary: {
        com2usId: target.com2usId,
        slug: target.slug,
        displayName: target.displayName,
        image: target.image,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
