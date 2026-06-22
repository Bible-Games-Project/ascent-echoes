import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Game } from "@/components/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dunewalker — A Side-Scrolling Journey" },
      { name: "description", content: "A cinematic mobile platformer. Pick the right path through 10 decision points before the world catches you." },
      { property: "og:title", content: "Dunewalker" },
      { property: "og:description", content: "A cinematic mobile platformer. Pick the right path before the world catches you." },
    ],
  }),
  component: Index,
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[100svh] w-screen bg-black" />;
  return <Game />;
}
