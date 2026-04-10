/**
 * POST /api/skills/free-solution
 *
 * Returns target summaries for a Skills free-play round.
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import { findSkillsMonsterById } from "@/lib/datasets/load-skills-dataset";

const FreeSolutionBodySchema = z.object({
  targetCom2usIds: z.array(z.number().int()).length(3),
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

    const targets = parsed.data.targetCom2usIds.map((id, index) => {
      const target = findSkillsMonsterById(id);
      if (!target) {
        throw new Error(`Free target com2usId=${id} not found.`);
      }

      return {
        slotId: index + 1,
        target: {
          com2usId: target.com2usId,
          slug: target.slug,
          displayName: target.displayName,
          image: target.image,
          element: target.element,
        },
      };
    });

    return Response.json({ targets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
