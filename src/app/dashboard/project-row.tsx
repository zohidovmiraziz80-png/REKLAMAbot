"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Project } from "@/actions/project-types";
import { deleteProjectAction, renameProjectAction } from "./project-actions";
import { PROJECT_TYPE_LABELS } from "./nav";

// Server va brauzerda bir xil chiqishi uchun Intl o'rniga qo'lda formatlaymiz (hydration xatosining oldini oladi)
const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
function formatDate(iso: string) {
  const d = new Date(iso);
  const tashkent = new Date(d.getTime() + 5 * 60 * 60 * 1000); // UTC+5
  return `${tashkent.getUTCDate()}-${UZ_MONTHS[tashkent.getUTCMonth()]}, ${tashkent.getUTCFullYear()}`;
}

export function ProjectRow({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (trimmed === project.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await renameProjectAction({ id: project.id, name: trimmed });
      if (result.ok) {
        setEditing(false);
        setError(undefined);
      } else {
        setError(result.error);
      }
    });
  }

  function remove() {
    if (!window.confirm(`"${project.name}" loyihasi butunlay o'chiriladi. Davom etasizmi?`)) return;
    startTransition(async () => {
      const result = await deleteProjectAction({ id: project.id });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className={`px-4 py-4 sm:px-5 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="min-w-0 flex-1 rounded-lg border border-brand-500 px-3 py-1.5 outline-none focus:ring-4 focus:ring-brand-100"
              />
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                Saqlash
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(project.name);
                  setEditing(false);
                  setError(undefined);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface"
              >
                Bekor
              </button>
            </form>
          ) : (
            project.type !== "automation" ? (
              <Link href={`/dashboard/${project.type === "website" ? "sites" : "bots"}/${project.id}`} className="block truncate font-medium hover:text-brand-600">
                {project.name}
              </Link>
            ) : (
              <p className="truncate font-medium">{project.name}</p>
            )
          )}
          <p className="mt-1 text-sm text-muted">
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
              {PROJECT_TYPE_LABELS[project.type]}
            </span>{" "}
            · {formatDate(project.created_at)}
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-1">
            {project.type !== "automation" && (
              <Link
                href={`/dashboard/${project.type === "website" ? "sites" : "bots"}/${project.id}`}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Ochish
              </Link>
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface"
            >
              Nomini o&apos;zgartirish
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              O&apos;chirish
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
