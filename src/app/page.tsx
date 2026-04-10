import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SWdle - A Summoners War Wordle Clone",
  description:
    "A daily Wordle-style guessing game for Summoners War: Sky Arena monsters.",
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white sm:px-6">
      <div className="w-full max-w-lg space-y-6 text-center sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-amber-400 sm:text-5xl">
            SWdle
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-300 sm:text-sm">
            By B4tiste with the help of Layn
          </p>
        </div>

        <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
          Guess the daily Summoners War monster by comparing its element,
          archetype, stars, and base stats. A new monster is revealed every day!
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/classic"
            className="inline-block rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-950 sm:px-8 sm:text-base"
          >
            Play Classic Mode
          </Link>
          <p className="text-zinc-300 text-xs">More modes coming soon…</p>
        </div>
      </div>
    </main>
  );
}
