import type { Metadata } from "next";
import Link from "next/link";
import { ClassicGame } from "@/components/classic/ClassicGame";

export const metadata: Metadata = {
  title: "Classic Mode - SWdle",
  description: "Guess today's Summoners War monster in Classic mode.",
};

export default function ClassicPage() {
  return (
    <main className="min-h-screen text-white flex flex-col">
      <div className="mx-auto w-full max-w-4xl px-3 pt-4 sm:px-4 sm:pt-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
        >
          Back to Mode Selection
        </Link>
      </div>
      <ClassicGame />
    </main>
  );
}
