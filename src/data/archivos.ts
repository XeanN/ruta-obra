import "server-only";
// Archivos en Cloudflare R2 con la API de S3 (el mismo código sirve para AWS S3 cambiando
// R2_ENDPOINT y las credenciales). El bucket es privado: solo enlaces firmados y temporales.
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { tipoPorClave, validarArchivo, type ArchivoPermitido } from "./archivos-reglas";

let cliente: S3Client | null = null;
function s3(): S3Client {
  cliente ??= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  return cliente;
}
const bucket = () => process.env.R2_BUCKET ?? "";

/**
 * URL para que el navegador suba el archivo directo a R2 (PUT, 5 minutos). El tamaño y el tipo
 * van firmados: con otro tamaño u otro Content-Type, R2 rechaza la subida (probado contra R2).
 */
export async function urlDeSubida(clave: string, archivo: ArchivoPermitido): Promise<string> {
  validarArchivo(archivo);
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: clave, ContentType: archivo.tipo, ContentLength: archivo.tamano }),
    // Sin esto el presigner no firma content-type y aceptaría, por ejemplo, text/html.
    { expiresIn: 5 * 60, signableHeaders: new Set(["content-type"]) },
  );
}

/**
 * URL temporal para ver o descargar un archivo (GET, 10 minutos). El tipo de la respuesta se
 * fuerza según la extensión de la clave: aunque se hubiera subido otra cosa, nunca se sirve como HTML.
 */
export async function urlDeDescarga(clave: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: clave,
      ResponseContentType: tipoPorClave(clave),
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 10 * 60 },
  );
}

export async function eliminarObjetos(claves: readonly string[]): Promise<void> {
  for (let i = 0; i < claves.length; i += 1000) {
    const lote = claves.slice(i, i + 1000);
    if (lote.length === 0) continue;
    await s3().send(
      new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: lote.map((Key) => ({ Key })), Quiet: true } }),
    );
  }
}
