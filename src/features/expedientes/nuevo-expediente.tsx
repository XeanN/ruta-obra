"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RepositorioNoDisponibleError, SesionRequeridaError } from "@/data/expediente-repo";
import type { BaseExpedientes } from "@/domain/analisis";
import { crearRegistro } from "@/domain/expediente";
import { diagnosticar } from "@/domain/rules-engine";
import type { Respuestas } from "@/domain/types";
import { AlmacenamientoNoDisponible } from "./avisos";
import { FichaExpediente } from "./ficha-expediente";
import { ahoraISO, useExpedienteRepo, useModoAlmacenamiento } from "./repo-context";

export function NuevoExpediente({
  respuestas,
  distrito,
  base,
}: {
  respuestas: Respuestas;
  distrito: string;
  base: BaseExpedientes;
}) {
  const repo = useExpedienteRepo();
  const modo = useModoAlmacenamiento();
  const router = useRouter();
  const [bloqueado, setBloqueado] = useState(false);

  if (bloqueado) return <AlmacenamientoNoDisponible />;

  return (
    <FichaExpediente
      distrito={distrito}
      textoGuardar="Crear expediente"
      generarId={() => crypto.randomUUID()}
      onGuardar={async (datos) => {
        const id = crypto.randomUUID();
        const registro = crearRegistro({
          id,
          predioId: crypto.randomUUID(),
          nombre: datos.nombre,
          respuestas,
          predio: { ...datos.predio, ubigeo: String(respuestas.distrito ?? "") },
          actores: datos.actores,
          diagnostico: diagnosticar(respuestas, base),
          versionDatos: base.versionDatos,
          ahora: ahoraISO(),
        });
        try {
          await repo.crear(registro);
          toast.success("Expediente creado");
          router.push(`/expedientes/${id}`);
        } catch (e) {
          if (e instanceof SesionRequeridaError) toast.error("Tu sesión venció. Vuelve a ingresar.");
          else if (e instanceof RepositorioNoDisponibleError && modo === "invitado") setBloqueado(true);
          else toast.error("No se pudo crear el expediente. Revisa tu conexión e inténtalo de nuevo.");
        }
      }}
    />
  );
}
