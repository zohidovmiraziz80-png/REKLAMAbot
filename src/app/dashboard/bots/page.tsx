import type { Metadata } from "next";
import { ProjectsView } from "../projects-view";

export const metadata: Metadata = { title: "Botlar" };

export default function BotsPage() {
  return <ProjectsView title="Botlar" subtitle="Telegram botlaringiz" type="bot" />;
}
