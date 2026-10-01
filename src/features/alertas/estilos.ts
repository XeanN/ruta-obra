import { CircleAlert, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { NivelAlerta } from "@/domain/diagnostico";

export const ESTILO_NIVEL: Record<NivelAlerta, { icono: LucideIcon; clase: string }> = {
  critica: {
    icono: OctagonAlert,
    clase: "border-red-500/40 bg-red-500/10 [&_svg]:text-red-700 dark:[&_svg]:text-red-400",
  },
  alta: {
    icono: TriangleAlert,
    clase: "border-orange-500/40 bg-orange-500/10 [&_svg]:text-orange-700 dark:[&_svg]:text-orange-400",
  },
  media: {
    icono: CircleAlert,
    clase: "border-amber-500/40 bg-amber-500/10 [&_svg]:text-amber-700 dark:[&_svg]:text-amber-400",
  },
  baja: { icono: Info, clase: "border-border bg-muted/50 [&_svg]:text-muted-foreground" },
};
