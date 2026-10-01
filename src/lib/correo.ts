import "server-only";

/** Remitente verificado en Resend (dominio aliiatech.com). */
export const REMITENTE = process.env.EMAIL_FROM ?? "RutaObra <acceso@aliiatech.com>";

export async function enviarCorreo(para: string, asunto: string, html: string, texto: string): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) throw new Error("Falta RESEND_API_KEY para enviar correos.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, to: [para], subject: asunto, html, text: texto }),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new Error(`Resend respondió ${r.status}: ${detalle.slice(0, 200)}`);
  }
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Correo simple con un botón; sin imágenes externas para que llegue bien a la bandeja. */
export function plantilla(titulo: string, parrafo: string, boton: string, url: string): { html: string; texto: string } {
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,sans-serif;color:#111">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
<tr><td><p style="margin:0 0 4px;font-weight:bold">RutaObra</p>
<h1 style="font-size:20px;margin:16px 0">${escapar(titulo)}</h1>
<p style="font-size:15px;line-height:1.5">${escapar(parrafo)}</p>
<p style="margin:24px 0"><a href="${escapar(url)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapar(boton)}</a></p>
<p style="font-size:12px;color:#666">Si no pediste este correo, ignóralo.</p></td></tr></table></body></html>`;
  return { html, texto: `${titulo}\n\n${parrafo}\n\n${boton}: ${url}\n\nSi no pediste este correo, ignóralo.` };
}
