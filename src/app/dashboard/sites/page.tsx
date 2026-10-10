import type { Metadata } from "next";
import { ProjectsView } from "../projects-view";

export const metadata: Metadata = { title: "Saytlar" };

export default function SitesPage() {
  return <ProjectsView title="Konstruktor" subtitle="Saytlaringiz — tayyor shablondan yarating va tahrirlang" type="website" />;
}
