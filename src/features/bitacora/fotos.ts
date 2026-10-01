"use client";

// Fotos de la bitácora: se comprimen en el navegador antes de subirlas (las del celular pesan
// 3–8 MB) y se suben directo a R2 con una URL firmada que entrega el servidor.
import { useEffect, useState } from "react";
import { solicitarSubida, urlsDeArchivos } from "../../../app/expedientes/acciones-archivos";

export const LADO_MAXIMO = 1600;
export const CALIDAD_JPEG = 0.8;

export class FotoError extends Error {}

/** Redimensiona a LADO_MAXIMO (respetando la orientación EXIF) y convierte a JPEG. */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new FotoError(`No se pudo leer «${archivo.name}». Usa una foto JPG o PNG.`);
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new FotoError("Tu navegador no permite procesar fotos.");
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", CALIDAD_JPEG));
  if (!blob) throw new FotoError(`No se pudo comprimir «${archivo.name}».`);
  return blob;
}

/** Comprime y sube una foto del expediente. Devuelve el id del archivo para guardarlo en la entrada. */
export async function subirFoto(expedienteId: string, archivo: File): Promise<string> {
  const blob = await comprimirImagen(archivo);
  const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
  const r = await solicitarSubida({ expedienteId, nombre, tipo: "image/jpeg", tamano: blob.size });
  if (!r.ok) {
    throw new FotoError(r.error === "sesion" ? "Tu sesión venció. Vuelve a ingresar." : r.mensaje);
  }
  const subida = await fetch(r.datos.url, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
  if (!subida.ok) throw new FotoError(`No se pudo subir «${archivo.name}». Revisa tu conexión.`);
  return r.datos.archivoId;
}

/** URLs temporales de las fotos (solo las del estudio de la sesión). */
export function useUrlsFotos(expedienteId: string, ids: readonly string[], activo: boolean): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const clave = [...ids].sort().join(",");
  useEffect(() => {
    if (!activo || clave === "") return;
    let vigente = true;
    urlsDeArchivos(expedienteId, clave.split(",")).then(
      (r) => {
        if (vigente && r.ok) setUrls(r.datos);
      },
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [expedienteId, clave, activo]);
  return urls;
}
