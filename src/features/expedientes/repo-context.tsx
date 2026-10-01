"use client";

import { format } from "date-fns";
import { createContext, useContext, useState, type ReactNode } from "react";
import * as acciones from "../../../app/expedientes/acciones";
import type { ExpedienteRepository } from "@/data/expediente-repo";
import { crearRepositorioNavegador } from "@/data/expediente-repo.local";
import { crearRepositorioRemoto } from "@/data/expediente-repo.remoto";

/** "cuenta": datos en el servidor (estudio de la sesión). "invitado": solo en este navegador. */
export type ModoAlmacenamiento = "cuenta" | "invitado";

const RepoContext = createContext<{ repo: ExpedienteRepository; modo: ModoAlmacenamiento; demo: boolean } | null>(null);

/** Única elección de implementación de la UI: con sesión, servidor; sin sesión, navegador. */
export function ExpedienteRepoProvider({
  modo,
  demo = false,
  children,
}: {
  modo: ModoAlmacenamiento;
  /** Modo demo: expedientes de ejemplo en el navegador (siempre con modo "invitado"). */
  demo?: boolean;
  children: ReactNode;
}) {
  const [repo] = useState(() => (modo === "cuenta" ? crearRepositorioRemoto(acciones) : crearRepositorioNavegador()));
  return <RepoContext.Provider value={{ repo, modo, demo }}>{children}</RepoContext.Provider>;
}

function useContexto() {
  const c = useContext(RepoContext);
  if (!c) throw new Error("useExpedienteRepo fuera de ExpedienteRepoProvider");
  return c;
}

export const useExpedienteRepo = (): ExpedienteRepository => useContexto().repo;
export const useModoAlmacenamiento = (): ModoAlmacenamiento => useContexto().modo;
export const useModoDemo = (): boolean => useContexto().demo;

/** Fecha local de hoy (yyyy-mm-dd) y fecha-hora ISO para los cambios. */
export const hoyLocal = () => format(new Date(), "yyyy-MM-dd");
export const ahoraISO = () => new Date().toISOString();
