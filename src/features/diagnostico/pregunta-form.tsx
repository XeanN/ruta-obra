"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { esquemaRespuesta } from "@/domain/diagnostico";
import type { Pregunta } from "@/domain/types";
import { cn } from "@/lib/utils";

type Valores = { valor: string | number | undefined };

interface Props {
  pregunta: Pregunta;
  valorInicial: string | number | undefined;
  esUltima: boolean;
  puedeVolver: boolean;
  /** Mover el foco al título al montar (al avanzar o volver, no al cargar la página). */
  enfocar: boolean;
  onResponder: (valor: string | number | undefined) => void;
  onVolver: () => void;
}

export function PreguntaForm({
  pregunta,
  valorInicial,
  esUltima,
  puedeVolver,
  enfocar,
  onResponder,
  onVolver,
}: Props) {
  const schema = useMemo(
    () => z.object({ valor: esquemaRespuesta(pregunta) }),
    [pregunta],
  );
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: { valor: valorInicial },
  });

  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (enfocar) titulo.current?.focus();
  }, [enfocar]);

  const error = errors.valor?.message;
  const errorId = `${pregunta.id}-error`;
  const tituloId = `${pregunta.id}-titulo`;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => onResponder(v.valor))}
      className="flex flex-col gap-6"
      aria-labelledby={tituloId}
    >
      <div className="space-y-1">
        <h2
          id={tituloId}
          ref={titulo}
          tabIndex={-1}
          className="text-xl font-semibold leading-snug outline-none"
        >
          {pregunta.texto}
        </h2>
        {!pregunta.obligatoria && (
          <p className="text-muted-foreground text-sm">Opcional</p>
        )}
      </div>

      {pregunta.tipo === "opcion" ? (
        <Controller
          control={control}
          name="valor"
          render={({ field }) => (
            <RadioGroup
              aria-labelledby={tituloId}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              value={field.value ?? null}
              onValueChange={(v) => field.onChange(typeof v === "string" ? v : undefined)}
              className="gap-3"
            >
              {pregunta.opciones.map((o) => (
                <label
                  key={o.valor}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-base transition-colors",
                    "hover:bg-muted has-data-checked:border-primary has-data-checked:bg-primary/5",
                  )}
                >
                  <RadioGroupItem value={o.valor} />
                  <span>{o.etiqueta}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        />
      ) : (
        <div className="space-y-2">
          <label htmlFor={`${pregunta.id}-input`} className="sr-only">
            {pregunta.texto}
          </label>
          <Input
            id={`${pregunta.id}-input`}
            type="number"
            inputMode="decimal"
            step="any"
            min={pregunta.min}
            max={pregunta.max}
            className="h-12 text-lg"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            {...register("valor", {
              setValueAs: (v: unknown) =>
                v === "" || v === null || v === undefined ? undefined : Number(v),
            })}
          />
          {(pregunta.min !== undefined || pregunta.max !== undefined) && (
            <p className="text-muted-foreground text-sm">
              {pregunta.min !== undefined && pregunta.max !== undefined
                ? `Entre ${pregunta.min} y ${pregunta.max.toLocaleString("en-US")}`
                : pregunta.min !== undefined
                  ? `Mínimo ${pregunta.min}`
                  : `Máximo ${pregunta.max}`}
            </p>
          )}
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onVolver}
          disabled={!puedeVolver}
          className="h-11 px-4"
        >
          <ArrowLeft data-icon="inline-start" />
          Atrás
        </Button>
        {!pregunta.obligatoria && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-11 px-4"
            onClick={() => onResponder(undefined)}
          >
            Omitir
          </Button>
        )}
        <Button type="submit" size="lg" className="ml-auto h-11 px-5">
          {esUltima ? "Ver resultado" : "Siguiente"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
