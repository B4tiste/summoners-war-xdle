/**
 * POST /api/skills/free-target
 *
 * Returns 3 unique random eligible monster targets for Skills free play.
 * If previousTargetCom2usIds are provided, avoid immediately repeating them
 * when possible.
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import { loadSkillsDataset } from "@/lib/datasets/load-skills-dataset";

const FreeTargetBodySchema = z.object({
  previousTargetCom2usIds: z.array(z.number().int()).optional(),
});

const TARGETS_PER_ROUND = 3;

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = FreeTargetBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body", details: parsed.error.message },
        { status: 400 }
      );
    }

    const { previousTargetCom2usIds = [] } = parsed.data;
    const eligible = loadSkillsDataset();

    if (eligible.length < TARGETS_PER_ROUND) {
      return Response.json(
        { error: `Not enough eligible monsters to generate ${TARGETS_PER_ROUND} free-play targets.` },
        { status: 500 }
      );
    }

    const previousSet = new Set(previousTargetCom2usIds);
    const candidates =
      previousSet.size > 0 && eligible.length > TARGETS_PER_ROUND
        ? eligible.filter((m) => !previousSet.has(m.com2usId))
        : eligible;

    const pool = candidates.length > 0 ? candidates : eligible;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, TARGETS_PER_ROUND);

    if (targets.length < TARGETS_PER_ROUND) {
      return Response.json(
        { error: `Failed to pick ${TARGETS_PER_ROUND} unique targets.` },
        { status: 500 }
      );
    }

    return Response.json({ targetCom2usIds: targets.map((t) => t.com2usId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
