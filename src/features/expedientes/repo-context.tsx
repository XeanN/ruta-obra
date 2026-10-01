"use client";

import { format } from "date-fns";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { ExpedienteRepository } from "@/data/expediente-repo";
import { crearRepositorioNavegador } from "@/data/expediente-repo.local";

const RepoContext = createContext<ExpedienteRepository | null>(null);

/** Única implementación concreta que conoce la UI: cambiarla aquí cambia el backend. */
export function ExpedienteRepoProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(crearRepositorioNavegador);
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useExpedienteRepo(): ExpedienteRepository {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error("useExpedienteRepo fuera de ExpedienteRepoProvider");
  return repo;
}

/** Fecha local de hoy (yyyy-mm-dd) y fecha-hora ISO para los cambios. */
export const hoyLocal = () => format(new Date(), "yyyy-MM-dd");
export const ahoraISO = () => new Date().toISOString();
