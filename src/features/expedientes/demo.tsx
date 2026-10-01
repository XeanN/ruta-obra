"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { buttonVariants, Button } from "@/components/ui/button";
import { borrarDemo, cargarDemo, COOKIE_DEMO } from "@/data/demo-repo";
import { crearRepositorioNavegador } from "@/data/expediente-repo.local";
import type { BaseExpedientes } from "@/domain/analisis";
import { armarExpedientesDemo, type DefinicionDemo } from "@/domain/demo";
import { AlmacenamientoNoDisponible } from "./avisos";
import { hoyLocal } from "./repo-context";

const UN_MES = 60 * 60 * 24 * 30;

function cookieDemo(activa: boolean) {
  document.cookie = `${COOKIE_DEMO}=${activa ? "1" : ""}; path=/; max-age=${activa ? UN_MES : 0}; samesite=lax`;
}

/** Página /demo: carga los ejemplos en este navegador y lleva al tablero. */
export function CargarDemo({ base, definiciones }: { base: BaseExpedientes; definiciones: DefinicionDemo[] }) {
  const router = useRouter();
  const [fallo, setFallo] = useState(false);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return; // en desarrollo el efecto corre dos veces
    iniciado.current = true;
    cargarDemo(crearRepositorioNavegador(), armarExpedientesDemo(definiciones, base, hoyLocal())).then(
      () => {
        cookieDemo(true);
        router.replace("/expedientes");
        router.refresh();
      },
      () => setFallo(true),
    );
  }, [base, definiciones, router]);

  if (fallo) return <AlmacenamientoNoDisponible />;
  return (
    <p role="status" className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      Preparando los expedientes de ejemplo…
    </p>
  );
}

/** Aviso en el tablero mientras se ve la demo, con la salida (borra solo los ejemplos). */
export function AvisoDemo() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    await borrarDemo(crearRepositorioNavegador()).catch(() => 0);
    cookieDemo(false);
    toast.success("Saliste de la demo. Se borraron los ejemplos.");
    router.refresh();
  }

  return (
    <div className="flex gap-3 rounded-lg border border-violet-500/40 bg-violet-500/5 p-3 text-sm">
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-2">
        <p>
          <span className="font-medium">Estás viendo la demo.</span> Son expedientes de ejemplo
          guardados solo en este navegador; puedes cambiarlos sin miedo. No se guardan en ninguna
          cuenta.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={salir} disabled={saliendo}>
            Salir de la demo
          </Button>
          <Link href="/demo" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Reiniciar los ejemplos
          </Link>
        </div>
      </div>
    </div>
  );
}
