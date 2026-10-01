import { HardDriveDownload, LoaderCircle, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <p role="status" className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {texto}
    </p>
  );
}

export function AlmacenamientoNoDisponible() {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <HardDriveDownload aria-hidden className="size-5" />
          No podemos guardar en este navegador
        </CardTitle>
        <CardDescription>
          Los expedientes se guardan en tu navegador y aquí está bloqueado (modo privado,
          almacenamiento lleno o desactivado). Prueba en una ventana normal o en otro navegador.
          El diagnóstico y la hoja de ruta siguen funcionando.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function ErrorCarga({ mensaje }: { mensaje: string }) {
  return (
    <Card className="border-red-500/40 bg-red-500/5">
      <CardContent className="flex gap-2 text-sm">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>Algo salió mal al leer tus expedientes: {mensaje}</p>
      </CardContent>
    </Card>
  );
}
