import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/components/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gates of Wisdom — Bible Quiz Platformer" },
      { name: "description", content: "A cinematic 2.5D side-scrolling platformer. Pass through ten gates by choosing the door of truth in this Bible-themed quiz adventure." },
      { property: "og:title", content: "Gates of Wisdom" },
      { property: "og:description", content: "A cinematic Bible quiz platformer — choose the right door, pass the gates." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Game />;
}
