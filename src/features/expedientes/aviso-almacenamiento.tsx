"use client";

import { CloudUpload, HardDrive } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { buttonVariants, Button } from "@/components/ui/button";
import { serializarRespaldo } from "@/data/expediente-repo";
import { crearRepositorioNavegador } from "@/data/expediente-repo.local";
import { esDemo } from "@/domain/demo";
import type { ExpedienteRegistro } from "@/domain/types";
import { AvisoDemo } from "./demo";
import { ahoraISO, useExpedienteRepo, useModoAlmacenamiento, useModoDemo } from "./repo-context";

/** Demo: aviso y salida. Invitado: todo vive en el navegador. Con cuenta: ofrece subir lo que quedó ahí. */
export function AvisoAlmacenamiento({ onCambio }: { onCambio: () => void }) {
  const modo = useModoAlmacenamiento();
  const demo = useModoDemo();
  if (demo) return <AvisoDemo />;
  if (modo === "invitado") {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <HardDrive aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          <p>
            <span className="font-medium">Se guardan solo en este navegador.</span> Si borras sus
            datos o cambias de equipo, se pierden. Crea tu cuenta para guardarlos en la nube y
            compartirlos con tu equipo.
          </p>
          <Link href="/ingresar?volver=/expedientes" className={buttonVariants({ size: "sm" })}>
            Crear cuenta o ingresar
          </Link>
        </div>
      </div>
    );
  }
  return <SubirDesdeNavegador onCambio={onCambio} />;
}

function SubirDesdeNavegador({ onCambio }: { onCambio: () => void }) {
  const repo = useExpedienteRepo();
  const [locales, setLocales] = useState<ExpedienteRegistro[]>([]);
  const [subidos, setSubidos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    crearRepositorioNavegador()
      .listar()
      .then((r) => setLocales(r.registros.filter((x) => !esDemo(x.expediente.id))), () => setLocales([]));
  }, []);

  if (locales.length === 0) return null;
  const pendientes = locales.filter((r) => !subidos.includes(r.expediente.id));

  if (pendientes.length === 0) {
    return (
      <div role="status" className="space-y-2 rounded-lg border p-3 text-sm">
        <p>Subimos {subidos.length} expedientes a tu cuenta. ¿Los borramos de este navegador?</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              const local = crearRepositorioNavegador();
              for (const id of subidos) await local.eliminar(id).catch(() => undefined);
              setLocales([]);
              toast.success("Listo: quedaron solo en tu cuenta");
            }}
          >
            Sí, borrarlos del navegador
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLocales([])}>
            Dejarlos también aquí
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3 text-sm">
      <CloudUpload aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-2">
        <p>
          Tienes {pendientes.length} {pendientes.length === 1 ? "expediente guardado" : "expedientes guardados"} solo
          en este navegador. Súbelos a tu cuenta para no perderlos.
        </p>
        <Button
          size="sm"
          disabled={subiendo}
          onClick={async () => {
            setSubiendo(true);
            let fallidos = 0;
            for (const r of pendientes) {
              try {
                await repo.importar(serializarRespaldo(r, ahoraISO()), "duplicar");
                setSubidos((s) => [...s, r.expediente.id]);
              } catch {
                fallidos++;
              }
            }
            setSubiendo(false);
            onCambio();
            if (fallidos > 0) toast.error(`${fallidos} no se pudieron subir. Inténtalo de nuevo.`);
          }}
        >
          Subir a mi cuenta
        </Button>
      </div>
    </div>
  );
}
