import { runAction } from "@/actions/run";
import { listProjects, type ProjectType } from "@/actions/projects";
import { CreateProject } from "./create-project";
import { ProjectRow } from "./project-row";

export async function ProjectsView({
  title,
  subtitle,
  type,
}: {
  title: string;
  subtitle: string;
  type?: ProjectType;
}) {
  const result = await runAction(listProjects, { type });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
        </div>
        <CreateProject defaultType={type} />
      </div>

      <div className="mt-8">
        {!result.ok ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>
        ) : result.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
            <p className="font-medium">Hali loyiha yo&apos;q</p>
            <p className="mt-1 text-sm text-muted">&quot;Yangi loyiha&quot; tugmasini bosib birinchisini yarating.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {result.data.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
