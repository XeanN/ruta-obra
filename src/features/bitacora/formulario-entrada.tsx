"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ETIQUETA_TIPO_ENTRADA } from "@/domain/bitacora";
import { EntradaBitacoraSchema } from "@/domain/schemas";
import type { Actor, EntradaBitacora } from "@/domain/types";
import { claseSelect } from "@/features/checklist/checklist";
import { ETIQUETA_ROL } from "@/features/expedientes/ficha-expediente";
import { FotoError, subirFoto } from "./fotos";

const numeroOpcional = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v));

const FormSchema = z.object({
  tipo: EntradaBitacoraSchema.shape.tipo,
  fecha: z.iso.date("Indica la fecha"),
  descripcion: z.string().trim().min(1, "Describe qué pasó").max(2000, "Máximo 2000 caracteres"),
  monto: z.number({ error: "Ingresa un número" }).nonnegative("No puede ser negativo").optional(),
  avance_pct: z.number({ error: "Ingresa un número" }).min(0, "Entre 0 y 100").max(100, "Entre 0 y 100").optional(),
  actor_id: z.string(),
});
type Form = z.infer<typeof FormSchema>;

const MAX_FOTOS = 6;

export function FormularioEntrada({
  expedienteId,
  inicial,
  hoy,
  actores,
  conFotos,
  generarId,
  onGuardar,
  onCancelar,
}: {
  expedienteId: string;
  inicial?: EntradaBitacora;
  hoy: string;
  actores: readonly Actor[];
  /** Solo con cuenta: las fotos se guardan en el servidor. */
  conFotos: boolean;
  generarId: () => string;
  onGuardar: (entrada: EntradaBitacora) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [fotosGuardadas, setFotosGuardadas] = useState<string[]>(inicial?.fotos ?? []);
  const [nuevas, setNuevas] = useState<File[]>([]);
  const [progreso, setProgreso] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      tipo: inicial?.tipo ?? "avance",
      fecha: inicial?.fecha ?? hoy,
      descripcion: inicial?.descripcion ?? "",
      monto: inicial?.monto,
      avance_pct: inicial?.avance_pct,
      actor_id: inicial?.actor_id ?? "",
    },
  });
  const pref = inicial ? `entrada-${inicial.id}` : "entrada-nueva";
  const err = (id: string, e?: { message?: string }) =>
    e?.message ? (
      <p id={`${id}-error`} role="alert" className="text-destructive text-xs font-medium">
        {e.message}
      </p>
    ) : null;
  const aria = (id: string, e?: unknown) => ({
    id,
    "aria-invalid": e ? true : undefined,
    "aria-describedby": e ? `${id}-error` : undefined,
  });

  return (
    <form
      noValidate
      aria-label={inicial ? "Editar entrada" : "Nueva entrada de bitácora"}
      className="bg-card space-y-3 rounded-lg border p-3"
      onSubmit={handleSubmit(async (f) => {
        let subidas: string[] = [];
        try {
          for (const [i, archivo] of nuevas.entries()) {
            setProgreso(`Subiendo foto ${i + 1} de ${nuevas.length}…`);
            subidas = [...subidas, await subirFoto(expedienteId, archivo)];
          }
        } catch (e) {
          setProgreso(null);
          toast.error(e instanceof FotoError ? e.message : "No se pudieron subir las fotos.");
          return;
        }
        setProgreso(null);
        const fotos = [...fotosGuardadas, ...subidas];
        const ok = await onGuardar({
          id: inicial?.id ?? generarId(),
          tipo: f.tipo,
          fecha: f.fecha,
          descripcion: f.descripcion,
          ...(f.monto !== undefined ? { monto: f.monto } : {}),
          ...(f.avance_pct !== undefined ? { avance_pct: f.avance_pct } : {}),
          ...(f.actor_id ? { actor_id: f.actor_id } : {}),
          ...(fotos.length > 0 ? { fotos } : {}),
        });
        if (ok) setNuevas([]);
      })}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${pref}-tipo`} className="text-xs font-medium">
            Tipo
          </label>
          <select {...aria(`${pref}-tipo`)} className={claseSelect} {...register("tipo")}>
            {Object.entries(ETIQUETA_TIPO_ENTRADA).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${pref}-fecha`} className="text-xs font-medium">
            Fecha
          </label>
          <Input type="date" className="h-10" {...aria(`${pref}-fecha`, errors.fecha)} {...register("fecha")} />
          {err(`${pref}-fecha`, errors.fecha)}
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${pref}-descripcion`} className="text-xs font-medium">
          Qué pasó
        </label>
        <textarea
          rows={2}
          className={`${claseSelect} h-auto py-2`}
          {...aria(`${pref}-descripcion`, errors.descripcion)}
          {...register("descripcion")}
        />
        {err(`${pref}-descripcion`, errors.descripcion)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${pref}-monto`} className="text-xs font-medium">
            Monto (S/)
          </label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            className="h-10"
            {...aria(`${pref}-monto`, errors.monto)}
            {...register("monto", { setValueAs: numeroOpcional })}
          />
          {err(`${pref}-monto`, errors.monto)}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${pref}-avance`} className="text-xs font-medium">
            Avance de obra (%)
          </label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            className="h-10"
            {...aria(`${pref}-avance`, errors.avance_pct)}
            {...register("avance_pct", { setValueAs: numeroOpcional })}
          />
          {err(`${pref}-avance`, errors.avance_pct)}
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${pref}-actor`} className="text-xs font-medium">
          Responsable
        </label>
        <select {...aria(`${pref}-actor`)} className={claseSelect} {...register("actor_id")}>
          <option value="">Sin responsable</option>
          {actores.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre} ({ETIQUETA_ROL[a.rol]})
            </option>
          ))}
        </select>
        {actores.length === 0 && (
          <p className="text-muted-foreground text-xs">Agrega actores en la pestaña Datos para elegir responsable.</p>
        )}
      </div>

      {conFotos ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">Fotos</p>
          {(fotosGuardadas.length > 0 || nuevas.length > 0) && (
            <ul className="flex flex-wrap gap-2 text-xs">
              {fotosGuardadas.map((id, i) => (
                <li key={id} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1">
                  Foto {i + 1}
                  <button
                    type="button"
                    aria-label={`Quitar foto ${i + 1}`}
                    onClick={() => setFotosGuardadas((f) => f.filter((x) => x !== id))}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
              {nuevas.map((a, i) => (
                <li key={`${a.name}-${i}`} className="bg-muted flex max-w-48 items-center gap-1 rounded-md px-2 py-1">
                  <span className="truncate">{a.name}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${a.name}`}
                    onClick={() => setNuevas((n) => n.filter((_, j) => j !== i))}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fotosGuardadas.length + nuevas.length < MAX_FOTOS && (
            <label className="hover:bg-muted inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
              <Camera aria-hidden className="size-4" />
              Agregar fotos
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(ev) => {
                  const elegidas = Array.from(ev.target.files ?? []);
                  ev.target.value = "";
                  const libres = MAX_FOTOS - fotosGuardadas.length - nuevas.length;
                  if (elegidas.length > libres) toast.info(`Máximo ${MAX_FOTOS} fotos por entrada.`);
                  setNuevas((n) => [...n, ...elegidas.slice(0, libres)]);
                }}
              />
            </label>
          )}
          <p className="text-muted-foreground text-xs">Se comprimen antes de subirse (máx. {MAX_FOTOS} por entrada).</p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Para agregar fotos, crea tu cuenta: se guardan en la nube, no en el navegador.</p>
      )}

      {progreso && (
        <p role="status" className="text-sm">
          {progreso}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {inicial ? "Guardar cambios" : "Agregar a la bitácora"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
