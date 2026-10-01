"use client";

import { useCallback, useEffect, useState } from "react";
import { RepositorioNoDisponibleError } from "@/data/expediente-repo";
import type { ExpedienteRegistro } from "@/domain/types";
import { useExpedienteRepo } from "./repo-context";

export type Carga<T> =
  | { estado: "cargando" }
  | { estado: "no_disponible" }
  | { estado: "error"; mensaje: string }
  | ({ estado: "listo" } & T);

function aCargaFallida(e: unknown): Carga<never> {
  if (e instanceof RepositorioNoDisponibleError) return { estado: "no_disponible" };
  return { estado: "error", mensaje: e instanceof Error ? e.message : String(e) };
}

export function useExpedientes() {
  const repo = useExpedienteRepo();
  const [carga, setCarga] = useState<Carga<{ registros: ExpedienteRegistro[]; corruptos: number }>>({
    estado: "cargando",
  });

  const recargar = useCallback(() => {
    repo.listar().then(
      (r) => setCarga({ estado: "listo", ...r }),
      (e: unknown) => setCarga(aCargaFallida(e)),
    );
  }, [repo]);

  useEffect(recargar, [recargar]);
  return { carga, recargar };
}

export function useExpediente(id: string) {
  const repo = useExpedienteRepo();
  const [carga, setCarga] = useState<Carga<{ registro: ExpedienteRegistro | null }>>({
    estado: "cargando",
  });

  useEffect(() => {
    repo.obtener(id).then(
      (registro) => setCarga({ estado: "listo", registro }),
      (e: unknown) => setCarga(aCargaFallida(e)),
    );
  }, [repo, id]);

  return { carga, setCarga };
}
