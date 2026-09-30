"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  limpiarRespuestas,
  preguntasFaltantes,
  preguntasVisibles,
  respuestasAParams,
} from "@/domain/diagnostico";
import type { Pregunta, Respuestas } from "@/domain/types";
import { PreguntaForm } from "./pregunta-form";

interface Props {
  preguntas: Pregunta[];
  respuestasIniciales: Respuestas;
  /** id de la pregunta con la que empezar (viene de ?paso= en la URL). */
  pasoInicial?: string;
}

function urlDiagnostico(ruta: string, preguntas: Pregunta[], r: Respuestas, paso?: string) {
  const params = respuestasAParams(preguntas, r);
  if (paso) params.set("paso", paso);
  const qs = params.toString();
  return qs ? `${ruta}?${qs}` : ruta;
}

export function DiagnosticoWizard({ preguntas, respuestasIniciales, pasoInicial }: Props) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales);
  const [pasoId, setPasoId] = useState<string | undefined>(() => {
    const visibles = preguntasVisibles(preguntas, respuestasIniciales);
    if (pasoInicial && visibles.some((p) => p.id === pasoInicial)) return pasoInicial;
    return visibles[0]?.id;
  });
  const [interactuado, setInteractuado] = useState(false);
  // Cambia al reiniciar, para que el formulario de la primera pregunta se vacíe.
  const [reinicios, setReinicios] = useState(0);

  const visibles = preguntasVisibles(preguntas, respuestas);
  const indice = Math.max(0, visibles.findIndex((p) => p.id === pasoId));
  const pregunta = visibles[indice];

  // Guarda el avance en la URL sin recargar: recargar o compartir el enlace no pierde nada.
  function irA(r: Respuestas, paso: string | undefined) {
    setRespuestas(r);
    setPasoId(paso);
    setInteractuado(true);
    window.history.replaceState(null, "", urlDiagnostico("/diagnostico", preguntas, r, paso));
  }

  function responder(valor: string | number | undefined) {
    if (!pregunta) return;
    const nuevas: Respuestas = { ...respuestas };
    if (valor === undefined) delete nuevas[pregunta.id];
    else nuevas[pregunta.id] = valor;
    const limpias = limpiarRespuestas(preguntas, nuevas);

    const nuevasVisibles = preguntasVisibles(preguntas, limpias);
    const siguiente = nuevasVisibles[nuevasVisibles.findIndex((p) => p.id === pregunta.id) + 1];
    if (siguiente) {
      irA(limpias, siguiente.id);
      return;
    }
    const faltante = preguntasFaltantes(preguntas, limpias)[0];
    if (faltante) {
      irA(limpias, faltante.id);
      return;
    }
    router.push(urlDiagnostico("/diagnostico/resultado", preguntas, limpias));
  }

  function volver() {
    const anterior = visibles[indice - 1];
    if (anterior) irA(respuestas, anterior.id);
  }

  if (!pregunta) return null;

  const total = visibles.length;
  const valor = respuestas[pregunta.id];

  return (
    <div className="flex flex-col gap-8">
      <Progress value={Math.round((indice / total) * 100)} aria-label="Avance del diagnóstico">
        <ProgressLabel className="text-muted-foreground font-normal">
          Pregunta {indice + 1} de {total}
        </ProgressLabel>
        <ProgressValue />
      </Progress>

      <PreguntaForm
        key={`${pregunta.id}-${reinicios}`}
        pregunta={pregunta}
        valorInicial={typeof valor === "string" || typeof valor === "number" ? valor : undefined}
        esUltima={indice === total - 1}
        puedeVolver={indice > 0}
        enfocar={interactuado}
        onResponder={responder}
        onVolver={volver}
      />

      {Object.keys(respuestas).length > 0 && (
        <Button
          type="button"
          variant="link"
          className="text-muted-foreground self-start px-0"
          onClick={() => {
            setReinicios((n) => n + 1);
            irA({}, preguntasVisibles(preguntas, {})[0]?.id);
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Empezar de nuevo
        </Button>
      )}
    </div>
  );
}
