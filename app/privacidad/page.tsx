import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad · RutaObra",
  description: "Qué datos guarda RutaObra, para qué, dónde y cómo ejercer tus derechos (Ley 29733).",
};

const ACTUALIZADA = "01/10/2026";
/** Correo público para ejercer derechos (Ley 29733). Se puede cambiar con NEXT_PUBLIC_CORREO_CONTACTO. */
const CONTACTO = process.env.NEXT_PUBLIC_CORREO_CONTACTO || "info@aliiatech.com";

export default function PrivacidadPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <article className="space-y-6 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Política de privacidad</h1>
          <p className="text-muted-foreground">Última actualización: {ACTUALIZADA}. Prototipo en validación.</p>
        </header>

        <p>
          RutaObra ayuda a profesionales y propietarios a organizar los trámites de construcción en
          Perú. Tratamos tus datos personales conforme a la Ley N.° 29733, Ley de Protección de Datos
          Personales, y su reglamento.
        </p>

        <h2>Qué datos guardamos</h2>
        <ul>
          <li>De tu cuenta: nombre, correo y foto de perfil (si ingresas con Google).</li>
          <li>
            De tus expedientes: respuestas del diagnóstico, dirección y partida del predio, estado de los
            trámites, documentos, notas, bitácora y archivos que subas.
          </li>
          <li>
            De terceros que registres (propietarios, profesionales, maestro de obra): nombre, rol,
            teléfono, correo y colegiatura. Registra solo lo necesario y con autorización de la persona.
          </li>
          <li>Datos técnicos de la sesión: fecha, dirección IP y navegador, para mantenerla segura.</li>
        </ul>

        <h2>Para qué los usamos</h2>
        <ul>
          <li>Darte el servicio: guardar tus expedientes, calcular rutas, checklist y alertas.</li>
          <li>Compartir los expedientes solo con las personas de tu estudio.</li>
          <li>Enviarte los correos de acceso e invitaciones. No enviamos publicidad.</li>
        </ul>
        <p>No vendemos ni cedemos tus datos.</p>

        <h2>Dónde se guardan</h2>
        <ul>
          <li>Base de datos: Neon (Postgres), en São Paulo, Brasil.</li>
          <li>Archivos: Cloudflare R2, almacenamiento privado con enlaces temporales.</li>
          <li>Aplicación: Vercel. Correos: Resend. Ingreso con Google: Google.</li>
        </ul>
        <p>
          Algunos proveedores están fuera del Perú (flujo transfronterizo). Si usas RutaObra sin cuenta
          (modo invitado), tus expedientes quedan solo en tu navegador y no los recibimos.
        </p>

        <h2>Cuánto tiempo</h2>
        <p>
          Mientras tengas la cuenta. Si la eliminas, borramos tus estudios en los que seas la única
          persona, con sus expedientes y archivos.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes pedir acceso, rectificación, cancelación u oposición sobre tus datos. Puedes corregir y
          eliminar tus expedientes y tu cuenta desde{" "}
          <Link href="/cuenta" className="underline underline-offset-2">
            Mi cuenta
          </Link>

          {CONTACTO ? (
            <>
              , o escribir a{" "}
              <a href={`mailto:${CONTACTO}`} className="underline underline-offset-2">
                {CONTACTO}
              </a>
            </>
          ) : null}
          . Si no quedas conforme, puedes acudir a la Autoridad Nacional de Protección de Datos
          Personales.
        </p>

        <h2>Responsable</h2>
        <p>Angel Ponce, responsable del proyecto RutaObra (prototipo de validación).</p>
      </article>
    </main>
  );
}
