import type { Metadata } from "next";
import { ProjectsView } from "./projects-view";

export const metadata: Metadata = { title: "Bosh sahifa" };

export default function DashboardPage() {
  return <ProjectsView title="Loyihalar" subtitle="Barcha saytlar, botlar va avtomatlashtirishlar" />;
}
