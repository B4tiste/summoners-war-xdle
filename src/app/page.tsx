import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Summoners War Xdle",
  description:
    "A daily Wordle-style guessing game for Summoners War: Sky Arena monsters.",
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-amber-400">
            SW Xdle
          </h1>
          <p className="text-zinc-400 text-sm uppercase tracking-widest">
            Summoners War Sky Arena
          </p>
        </div>

        <p className="text-zinc-300 leading-relaxed">
          Guess the daily Summoners War monster by comparing its element,
          archetype, stars, and base stats. A new monster is revealed every day!
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/classic"
            className="inline-block rounded-xl bg-amber-400 px-8 py-3 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            Play Classic Mode
          </Link>
          <p className="text-zinc-600 text-xs">More modes coming soon…</p>
        </div>
      </div>
    </main>
  );
}
