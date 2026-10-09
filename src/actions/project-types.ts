// Klient komponentlar ham ishlatadigan turlar — server kodini brauzerga olib kirmaslik uchun alohida fayl.

export const PROJECT_TYPES = ["website", "bot", "automation"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export type Project = {
  id: string;
  name: string;
  type: ProjectType;
  created_at: string;
  updated_at: string;
};
