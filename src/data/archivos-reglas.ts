// Reglas de archivos (puras, testeables): tipos y tamaño permitidos y formato de la clave.
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export interface ArchivoPermitido {
  tipo: string;
  tamano: number;
}

export class ArchivoNoPermitidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ArchivoNoPermitidoError";
  }
}

export function validarArchivo(a: ArchivoPermitido): void {
  if (!(a.tipo in TIPOS_PERMITIDOS)) {
    throw new ArchivoNoPermitidoError("Solo se aceptan fotos (JPG, PNG, WebP) y PDF.");
  }
  if (!Number.isInteger(a.tamano) || a.tamano <= 0) throw new ArchivoNoPermitidoError("Archivo vacío.");
  if (a.tamano > TAMANO_MAXIMO) throw new ArchivoNoPermitidoError("El archivo supera los 10 MB.");
}

/** Tipo con el que se sirve un archivo según la extensión de su clave; desconocido → descarga binaria. */
export function tipoPorClave(clave: string): string {
  const ext = clave.split(".").at(-1)?.toLowerCase();
  const tipo = Object.entries(TIPOS_PERMITIDOS).find(([, e]) => e === ext)?.[0];
  return tipo ?? "application/octet-stream";
}

/** <estudio>/<expediente>/<uuid>.<ext>: el estudio va primero para poder borrar todo lo suyo. */
export function claveDeArchivo(estudioId: string, expedienteId: string, archivoId: string, tipo: string): string {
  const ext = TIPOS_PERMITIDOS[tipo];
  if (!ext) throw new ArchivoNoPermitidoError("Tipo de archivo no permitido.");
  const seguro = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "");
  return `${seguro(estudioId)}/${seguro(expedienteId)}/${seguro(archivoId)}.${ext}`;
}
