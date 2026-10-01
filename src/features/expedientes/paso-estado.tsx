"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ETIQUETA_ESTADO_PASO, type CambiosPaso } from "@/domain/expediente";
import { EstadoPasoSchema } from "@/domain/schemas";
import type { EstadoPaso, Paso } from "@/domain/types";
import { claseSelect } from "@/features/checklist/checklist";
import { cn } from "@/lib/utils";

const ESTILO_ESTADO: Record<EstadoPaso, string> = {
  pendiente: "bg-muted text-foreground",
  en_preparacion: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  presentado: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300",
  observado: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  subsanado: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  aprobado: "bg-green-500/15 text-green-800 dark:text-green-300",
  denegado: "bg-red-500/15 text-red-800 dark:text-red-300",
  no_aplica: "bg-muted text-muted-foreground line-through",
};

export function EstadoPasoBadge({ estado }: { estado: EstadoPaso }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", ESTILO_ESTADO[estado])}>
      {ETIQUETA_ESTADO_PASO[estado]}
    </Badge>
  );
}

const fecha = z.union([z.literal(""), z.iso.date("Fecha inválida")]);

const PasoFormSchema = z.object({
  estado: EstadoPasoSchema,
  numero_expediente_entidad: z.string().trim(),
  fecha_presentacion: fecha,
  fecha_observacion: fecha,
  fecha_resultado: fecha,
  monto_pagado: z.number({ error: "Ingresa un número" }).nonnegative("No puede ser negativo").optional(),
  notas: z.string().trim(),
});

type PasoForm = z.infer<typeof PasoFormSchema>;

const opc = (v: string) => (v === "" ? undefined : v);

/** Montar con key = contenido del paso: al guardar se vuelve a montar con lo que quedó guardado. */
export function PasoEstadoForm({
  paso,
  onGuardar,
}: {
  paso: Paso;
  onGuardar: (cambios: CambiosPaso) => Promise<void> | void;
}) {
  const id = `paso-${paso.procedimiento_id}`;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PasoForm>({
    resolver: zodResolver(PasoFormSchema),
    defaultValues: {
      estado: paso.estado,
      numero_expediente_entidad: paso.numero_expediente_entidad ?? "",
      fecha_presentacion: paso.fecha_presentacion ?? "",
      fecha_observacion: paso.fecha_observacion ?? "",
      fecha_resultado: paso.fecha_resultado ?? "",
      monto_pagado: paso.monto_pagado,
      notas: paso.notas ?? "",
    },
  });
  const estado = useWatch({ control, name: "estado" });
  const mostrarObservacion = estado === "observado" || estado === "subsanado" || paso.fecha_observacion;

  const enviar = handleSubmit(async (f) => {
    await onGuardar({
      estado: f.estado,
      numero_expediente_entidad: opc(f.numero_expediente_entidad),
      fecha_presentacion: opc(f.fecha_presentacion),
      fecha_observacion: opc(f.fecha_observacion),
      fecha_resultado: opc(f.fecha_resultado),
      monto_pagado: f.monto_pagado,
      notas: opc(f.notas),
    });
  });

  const campo = "space-y-1.5";
  const etiqueta = "text-xs font-medium";
  return (
    <form noValidate onSubmit={enviar} className="space-y-3 text-sm" aria-label="Seguimiento del trámite">
      <p className="text-xs font-medium tracking-wide uppercase">Seguimiento</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={campo}>
          <label htmlFor={`${id}-estado`} className={etiqueta}>
            Estado
          </label>
          <select id={`${id}-estado`} className={claseSelect} {...register("estado")}>
            {Object.entries(ETIQUETA_ESTADO_PASO).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className={campo}>
          <label htmlFor={`${id}-numero`} className={etiqueta}>
            N.° de trámite en la entidad
          </label>
          <Input id={`${id}-numero`} className="h-10" {...register("numero_expediente_entidad")} />
        </div>
        <div className={campo}>
          <label htmlFor={`${id}-presentacion`} className={etiqueta}>
            Fecha de presentación
          </label>
          <Input id={`${id}-presentacion`} type="date" className="h-10" {...register("fecha_presentacion")} />
        </div>
        {mostrarObservacion && (
          <div className={campo}>
            <label htmlFor={`${id}-observacion`} className={etiqueta}>
              Fecha de la observación
            </label>
            <Input id={`${id}-observacion`} type="date" className="h-10" {...register("fecha_observacion")} />
            <p className="text-muted-foreground text-xs">Desde aquí corre el plazo para subsanar.</p>
          </div>
        )}
        <div className={campo}>
          <label htmlFor={`${id}-resultado`} className={etiqueta}>
            Fecha del resultado
          </label>
          <Input id={`${id}-resultado`} type="date" className="h-10" {...register("fecha_resultado")} />
        </div>
        <div className={campo}>
          <label htmlFor={`${id}-monto`} className={etiqueta}>
            Monto pagado (S/)
          </label>
          <Input
            id={`${id}-monto`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            className="h-10"
            aria-invalid={errors.monto_pagado ? true : undefined}
            aria-describedby={errors.monto_pagado ? `${id}-monto-error` : undefined}
            {...register("monto_pagado", {
              setValueAs: (v: unknown) => (v === "" || v == null ? undefined : Number(v)),
            })}
          />
          {errors.monto_pagado && (
            <p id={`${id}-monto-error`} role="alert" className="text-destructive text-xs font-medium">
              {errors.monto_pagado.message}
            </p>
          )}
        </div>
      </div>
      <div className={campo}>
        <label htmlFor={`${id}-notas`} className={etiqueta}>
          Notas
        </label>
        <textarea
          id={`${id}-notas`}
          rows={2}
          className={cn(claseSelect, "h-auto py-2")}
          {...register("notas")}
        />
      </div>
      <Button type="submit" disabled={!isDirty || isSubmitting}>
        Guardar seguimiento
      </Button>
    </form>
  );
}
