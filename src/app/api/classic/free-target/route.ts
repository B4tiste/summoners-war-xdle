/**
 * POST /api/classic/free-target
 *
 * Returns a random eligible monster target for free play.
 * If previousTargetCom2usId is provided, the endpoint avoids returning the
 * same target consecutively whenever there is more than one eligible entry.
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import { loadClassicDataset } from "@/lib/datasets/load-classic-dataset";

const FreeTargetBodySchema = z.object({
  previousTargetCom2usId: z.number().int().optional(),
});

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

    const { previousTargetCom2usId } = parsed.data;

    const eligible = loadClassicDataset().filter(
      (m) => m.searchable && m.obtainable !== false
    );

    if (eligible.length === 0) {
      return Response.json(
        { error: "No eligible monsters available for free play." },
        { status: 500 }
      );
    }

    const candidates =
      previousTargetCom2usId != null && eligible.length > 1
        ? eligible.filter((m) => m.com2usId !== previousTargetCom2usId)
        : eligible;

    const pool = candidates.length > 0 ? candidates : eligible;
    const index = Math.floor(Math.random() * pool.length);
    const target = pool[index];

    return Response.json({ targetCom2usId: target.com2usId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
