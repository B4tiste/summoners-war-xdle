import type { Metadata } from "next";
import { ClassicGame } from "@/components/classic/ClassicGame";

export const metadata: Metadata = {
  title: "Classic Mode - SW Xdle",
  description: "Guess today's Summoners War monster in Classic mode.",
};

export default function ClassicPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <ClassicGame />
    </main>
  );
}
