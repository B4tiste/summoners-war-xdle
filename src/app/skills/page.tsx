import { SkillsGame } from "@/components/skills/SkillsGame";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SWdle – Skills Mode",
  description: "Guess the daily Summoners War monster from its skill icons.",
};

export default function SkillsPage() {
  return (
    <main className="min-h-screen text-white flex flex-col">
      <div className="mx-auto w-full max-w-xl px-3 pt-4 sm:px-4 sm:pt-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
        >
          Back to Mode Selection
        </Link>
      </div>
      <SkillsGame />
    </main>
  );
}
