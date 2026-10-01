"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFieldArray, useForm, type FieldError } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActorSchema } from "@/domain/schemas";
import type { Actor, Predio } from "@/domain/types";
import { cn } from "@/lib/utils";

export const ETIQUETA_ROL: Record<Actor["rol"], string> = {
  propietario: "Propietario",
  gestor: "Gestor",
  arquitecto: "Arquitecto",
  ingeniero_estructural: "Ingeniero estructural",
  ingeniero_sanitario: "Ingeniero sanitario",
  ingeniero_electrico: "Ingeniero electricista",
  verificador: "Verificador",
  notario: "Notario",
  maestro_obra: "Maestro de obra",
  obrero: "Obrero",
  supervisor: "Supervisor",
  otro: "Otro",
};

const opcional = z.string().trim();

const FichaSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre al expediente").max(120, "Máximo 120 caracteres"),
  direccion: z.string().trim().min(1, "Indica la dirección del predio"),
  partida_registral: opcional,
  area_terreno_m2: z.number({ error: "Ingresa un número" }).positive("Debe ser mayor que 0").optional(),
  actores: z.array(
    z.object({
      id: z.string(),
      rol: ActorSchema.shape.rol,
      nombre: z.string().trim().min(1, "Indica el nombre"),
      telefono: opcional,
      email: z.union([z.literal(""), z.email("Correo no válido")]),
      colegiatura: opcional,
    }),
  ),
});

type FichaEntrada = z.input<typeof FichaSchema>;
type Ficha = z.output<typeof FichaSchema>;

export interface DatosFicha {
  nombre: string;
  predio: Omit<Predio, "id" | "ubigeo">;
  actores: Actor[];
}

const vacioAUndefined = (v: string) => (v === "" ? undefined : v);

function aDatos(f: Ficha): DatosFicha {
  return {
    nombre: f.nombre,
    predio: {
      direccion: f.direccion,
      partida_registral: vacioAUndefined(f.partida_registral),
      area_terreno_m2: f.area_terreno_m2,
    },
    actores: f.actores.map((a) => ({
      id: a.id,
      rol: a.rol,
      nombre: a.nombre,
      telefono: vacioAUndefined(a.telefono),
      email: vacioAUndefined(a.email),
      colegiatura: vacioAUndefined(a.colegiatura),
    })),
  };
}

function aEntrada(d: DatosFicha | undefined): FichaEntrada {
  return {
    nombre: d?.nombre ?? "",
    direccion: d?.predio.direccion ?? "",
    partida_registral: d?.predio.partida_registral ?? "",
    area_terreno_m2: d?.predio.area_terreno_m2,
    actores: (d?.actores ?? []).map((a) => ({
      id: a.id,
      rol: a.rol,
      nombre: a.nombre,
      telefono: a.telefono ?? "",
      email: a.email ?? "",
      colegiatura: a.colegiatura ?? "",
    })),
  };
}

const claseSelect =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: FieldError;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && <p className="text-muted-foreground text-xs">{ayuda}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs font-medium">
          {error.message}
        </p>
      )}
    </div>
  );
}

const errorProps = (id: string, error?: FieldError) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
});

export function FichaExpediente({
  inicial,
  distrito,
  textoGuardar,
  generarId,
  onGuardar,
}: {
  inicial?: DatosFicha;
  /** Distrito del predio (sale del diagnóstico; para cambiarlo hay que rehacer el diagnóstico). */
  distrito: string;
  textoGuardar: string;
  generarId: () => string;
  onGuardar: (datos: DatosFicha) => Promise<void> | void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FichaEntrada, unknown, Ficha>({
    resolver: zodResolver(FichaSchema),
    defaultValues: aEntrada(inicial),
  });
  const actores = useFieldArray({ control, name: "actores" });

  return (
    <form noValidate onSubmit={handleSubmit((f) => onGuardar(aDatos(f)))} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold">Expediente y predio</legend>
        <Campo id="ficha-nombre" etiqueta="Nombre del expediente" error={errors.nombre} ayuda="Ej.: Casa Pérez – ampliación">
          <Input className="h-10" {...errorProps("ficha-nombre", errors.nombre)} {...register("nombre")} />
        </Campo>
        <Campo id="ficha-direccion" etiqueta="Dirección del predio" error={errors.direccion}>
          <Input className="h-10" autoComplete="street-address" {...errorProps("ficha-direccion", errors.direccion)} {...register("direccion")} />
        </Campo>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Distrito</p>
          <p className="text-sm">{distrito}</p>
          <p className="text-muted-foreground text-xs">Sale del diagnóstico. Para cambiarlo, rehaz el diagnóstico.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="ficha-partida" etiqueta="Partida registral (opcional)" error={errors.partida_registral}>
            <Input className="h-10" {...errorProps("ficha-partida")} {...register("partida_registral")} />
          </Campo>
          <Campo id="ficha-area" etiqueta="Área del terreno en m² (opcional)" error={errors.area_terreno_m2}>
            <Input
              className="h-10"
              type="number"
              inputMode="decimal"
              step="any"
              {...errorProps("ficha-area", errors.area_terreno_m2)}
              {...register("area_terreno_m2", {
                setValueAs: (v: unknown) => (v === "" || v == null ? undefined : Number(v)),
              })}
            />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Actores</legend>
        <p className="text-muted-foreground text-sm">
          Propietario, profesionales que firman, maestro de obra y otros responsables.
        </p>
        {actores.fields.map((campo, i) => {
          const err = errors.actores?.[i];
          return (
            <div key={campo.id} className="bg-muted/30 space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo id={`actor-${i}-rol`} etiqueta="Rol">
                  <select id={`actor-${i}-rol`} className={claseSelect} {...register(`actores.${i}.rol`)}>
                    {Object.entries(ETIQUETA_ROL).map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo id={`actor-${i}-nombre`} etiqueta="Nombre" error={err?.nombre}>
                  <Input className="h-10" {...errorProps(`actor-${i}-nombre`, err?.nombre)} {...register(`actores.${i}.nombre`)} />
                </Campo>
                <Campo id={`actor-${i}-telefono`} etiqueta="Teléfono">
                  <Input className="h-10" type="tel" inputMode="tel" {...errorProps(`actor-${i}-telefono`)} {...register(`actores.${i}.telefono`)} />
                </Campo>
                <Campo id={`actor-${i}-email`} etiqueta="Correo" error={err?.email}>
                  <Input className="h-10" type="email" {...errorProps(`actor-${i}-email`, err?.email)} {...register(`actores.${i}.email`)} />
                </Campo>
                <Campo id={`actor-${i}-colegiatura`} etiqueta="Colegiatura (CAP / CIP)">
                  <Input className="h-10" {...errorProps(`actor-${i}-colegiatura`)} {...register(`actores.${i}.colegiatura`)} />
                </Campo>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => actores.remove(i)}>
                <Trash2 data-icon="inline-start" />
                Quitar
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            actores.append({ id: generarId(), rol: "propietario", nombre: "", telefono: "", email: "", colegiatura: "" })
          }
        >
          <Plus data-icon="inline-start" />
          Agregar actor
        </Button>
      </fieldset>

      <Button
        type="submit"
        size="lg"
        className={cn("h-11 w-full sm:w-auto")}
        disabled={isSubmitting || (inicial !== undefined && !isDirty)}
      >
        {textoGuardar}
      </Button>
    </form>
  );
}
