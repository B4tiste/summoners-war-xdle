/**
 * POST /api/skills/guess
 *
 * Accepts a monster slug guess for the Skills mode.
 * Returns whether the guess is correct and (on win) reveals the target.
 *
 * Request body: { slug: string, mode?: "daily" | "free", targetCom2usId?: number }
 * Response: { isWin: boolean, targetSummary?: { ... } }
 */

import { z } from "zod";
import type { NextRequest } from "next/server";
import {
  findSkillsMonsterById,
  findSkillsMonsterBySlug,
  getDailySkillsTarget,
  todayFranceSkills,
} from "@/lib/datasets/load-skills-dataset";
import { loadClassicDataset } from "@/lib/datasets/load-classic-dataset";

const GuessBodySchema = z.object({
  slug: z.string().min(1),
  mode: z.enum(["daily", "free"]).optional(),
  targetCom2usId: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = GuessBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body", details: parsed.error.message },
        { status: 400 }
      );
    }

    const { slug, mode = "daily", targetCom2usId } = parsed.data;

    // Validate the guessed monster exists in the classic dataset (searchable monsters)
    const classicDataset = loadClassicDataset();
    const guessMonster = classicDataset.find((m) => m.slug === slug);
    if (!guessMonster) {
      return Response.json(
        { error: `Monster with slug "${slug}" not found.` },
        { status: 404 }
      );
    }

    if (mode === "free" && targetCom2usId == null) {
      return Response.json(
        { error: "Missing targetCom2usId for free mode." },
        { status: 400 }
      );
    }

    const date = todayFranceSkills();
    const target =
      mode === "free"
        ? findSkillsMonsterById(targetCom2usId!)
        : getDailySkillsTarget(date);

    if (!target) {
      return Response.json(
        { error: `Free target com2usId=${targetCom2usId} not found.` },
        { status: 404 }
      );
    }

    const isWin = target.slug === slug;

    if (isWin) {
      return Response.json({
        isWin: true,
        targetSummary: {
          com2usId: target.com2usId,
          slug: target.slug,
          displayName: target.displayName,
          image: target.image,
          element: target.element,
          skills: target.skills.map((s) => ({
            id: s.id,
            name: s.name,
            iconUrl: `https://swarfarm.com/static/herders/images/skills/${s.iconFilename}`,
          })),
        },
      });
    }

    return Response.json({ isWin: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
