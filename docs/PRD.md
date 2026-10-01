# PRD — RutaObra (prototipo de validación)

> Nombre de trabajo. Versión 0.2 · 01-10-2026 · Autor: Angel Ponce
> Cambios respecto de 0.1: el backend (cuentas, base de datos y archivos) entra al prototipo; se agregan el mantenimiento de datos, el agente de consultas como fase futura, la arquitectura de datos, privacidad, riesgos y el registro de decisiones.

## 1. Problema

En Perú, construir o regularizar una edificación privada exige recorrer 7 etapas repartidas entre SUNARP, notarías, municipalidad distrital, Municipalidad de Lima, autoridades sectoriales (PROHVILLA, SERNANP, Ministerio de Cultura), empresas de servicios y el Ministerio de Trabajo. Ninguna entidad ni herramienta privada conecta el recorrido completo. Hoy el propietario o el profesional:

- no sabe qué sigue ni en qué orden;
- se entera tarde de requisitos que dependen de la ubicación (p. ej. la opinión de PROHVILLA), cuando la municipalidad observa el expediente;
- pierde documentos por vencimiento (la copia literal vale 30 días; la licencia, 1095 días);
- lleva la obra (maestro, obreros, pagos, avance) en WhatsApp y cuadernos.

No existe una API pública del Estado para presentar trámites ni consultar su estado (la PIDE es solo para entidades públicas). La oportunidad es **orquestar con datos propios**, no automatizar el envío.

## 2. Usuarios

| Segmento | Qué necesita | Prioridad |
|---|---|---|
| **Profesional gestor** (arquitecto, ingeniero, consultora de saneamiento) con 5–30 expedientes, a veces con un asistente | Ver en qué va cada caso, qué falta, qué vence, sin rehacer la investigación por distrito; compartir los expedientes con su equipo | **Principal: quien paga** |
| **Propietario / familia** que construye una vez | Entender su ruta, cuánto cuesta y cuánto demora | Secundario (captación vía SEO, freemium; puede usar el modo invitado sin cuenta) |
| **Pequeña inmobiliaria / constructora** | Multi-expediente + bitácora de obra | Futuro |

## 3. Objetivo del prototipo

Validar con 5–10 profesionales de Lima Sur si:

1. el diagnóstico y la hoja de ruta les ahorran tiempo real;
2. el seguimiento multi-expediente reemplaza su método actual;
3. confían en cargar expedientes reales de sus clientes (requiere cuentas y datos en servidor);
4. pagarían y cuánto (por expediente o suscripción).

**No es objetivo del prototipo:** pagos y facturación, presentación electrónica de trámites, integración con sistemas del Estado, aplicación móvil nativa (la web móvil basta).

## 4. Estado actual

Producción: https://ruta-obra.vercel.app. Detalle por fase en `prompts/fases.md`.

| Funcionalidad | Estado |
|---|---|
| F1 Diagnóstico, F2 Hoja de ruta, F7 Fuentes | Hecho |
| F3 Checklist, F4 Alertas, F5 Seguimiento multi-expediente | Hecho, con datos guardados en el navegador |
| F8 Cuentas y persistencia en servidor | Siguiente (Fase 5) |
| F6 Bitácora de obra | Después de F8 (las fotos necesitan almacenamiento real) |
| F9 Mantenimiento de datos | Planificado (Fases 8–10) |

## 5. Alcance funcional

### F1. Diagnóstico del predio
- Asistente paso a paso con las preguntas de `data/diagnostico_preguntas.json` (preguntas condicionales con `mostrar_si`).
- Resultado inmediato: modalidad estimada (A/B/C/D) explicada con su licencia, alertas por prioridad y programas aplicables.
- Las respuestas viajan en la URL: se puede recargar y compartir el resultado.

### F2. Hoja de ruta personalizada
- Procedimientos agrupados por etapa (E1–E7), en orden, generados por el motor de reglas (`data/reglas.json`).
- Cada paso: entidad (la municipalidad concreta del distrito), requisitos, plazo, costo, profesionales que firman, normas, **fuente con enlace** y **estado de verificación** (etiqueta visible si no está `verificado`).
- Costo: tarifa del distrito, si no costo referencial, si no "Consultar TUPA". Si el TUPA tiene variantes, se muestra el rango. Nunca se inventa un monto.
- Pasos opcionales y alternativas (p. ej. revisores urbanos en vez de comisión municipal).
- Resumen: costo estatal estimado (montos conocidos, cuántos faltan, cuántos no verificados) y tiempo estimado.

### F3. Checklist de documentos
- Unión de los requisitos de todos los pasos, sin duplicados, con quién lo emite, en qué paso se obtiene y su vigencia.
- Estados: falta / en trámite / obtenido / vencido (automático según la fecha de emisión).

### F4. Alertas
- Vencimientos según `data/vencimientos.json` (copia literal 30 días, parámetros y factibilidades 1095 días, licencia 1095 días desde su aprobación), con avisos en los días definidos en los datos.
- Plazo para subsanar observaciones: 5 días hábiles desde la observación (regla de datos). Días hábiles sin fines de semana; los feriados se pueden pasar al cálculo (carga de feriados nacionales: pendiente).
- Panel por expediente y resumen en el tablero. Las alertas con plazo van primero; las advertencias del diagnóstico, después.

### F5. Seguimiento multi-expediente
- Crear expediente = diagnóstico + datos del predio + actores.
- Tablero: etapa actual, % de avance, próximo paso, próximas alertas; filtros por distrito y estado.
- Por paso: estado (pendiente → en preparación → presentado → observado → subsanado → aprobado / denegado / no aplica), número de trámite, fechas, monto pagado y notas.
- Respaldo: exportar e importar un expediente en JSON.
- Cuando cambian los datos (`version_datos`), el expediente recalcula su ruta y conserva el avance.

### F6. Bitácora de obra
- Entradas fechadas: avance, compra, pago, visita municipal, reunión, incidencia, cambio de obra; monto, % de avance, responsable y fotos.
- Fotos comprimidas en el celular y guardadas en almacenamiento privado (F8).
- Vista cronológica y totales de gasto por tipo y por mes.

### F7. Fuentes y transparencia
- Página "Cómo sabemos esto": fecha de corte, significado de las etiquetas, cobertura por distrito, normas y fuentes. Aviso legal visible.

### F8. Cuentas y persistencia (nuevo en 0.2)
- Ingreso con Google o enlace mágico por correo, sin contraseñas.
- **Estudio**: espacio compartido por varias personas (dueño y miembros invitados); todos ven los expedientes del estudio.
- Expedientes, pasos, documentos, actores y bitácora guardados en el servidor; archivos (fotos, escaneos) en almacenamiento privado con enlaces temporales.
- **Modo invitado** sin cuenta: funciona como hoy, en el navegador, con aviso de que solo vive ahí. Al crear la cuenta se ofrece subir esos expedientes sin perder nada.
- Concurrencia simple: si otro miembro guardó antes, se avisa en vez de pisar sus cambios.

### F9. Mantenimiento de datos (nuevo en 0.2)
- Vigilancia semanal de fuentes (fuera de la app): enlaces caídos, documentos que cambiaron y datos sin revisar hace más de 6 meses, reportados en un issue.
- Antigüedad visible: un dato verificado hace más de 12 meses se muestra como "Versión anterior".
- "Reportar un dato desactualizado" desde la app.
- Extracción asistida por IA de TUPAs nuevos, siempre como `por_verificar` hasta revisión humana.

## 6. Arquitectura de datos y decisiones técnicas

### Dónde vive cada dato

| Dato | Dónde | Por qué |
|---|---|---|
| Base de conocimiento: trámites, requisitos, tarifas, reglas, fuentes | JSON en `data/`, versionado en git | Es igual para todos; cada cambio se revisa por PR con CI (esquema, paridad del motor, build). En una base de datos se perdería ese control. |
| Datos de usuario: estudios, miembros, expedientes, predios, actores, pasos, documentos, bitácora | Postgres (Neon) | Persistencia, acceso desde cualquier equipo, trabajo en equipo, control de acceso y respaldo. |
| Archivos: fotos de obra, documentos escaneados | Cloudflare R2 (privado) | Los archivos no caben en el navegador (~5 MB por sitio) ni conviene guardarlos en la base de datos. |
| Navegador (`localStorage`) | Solo modo invitado y demo | Probar sin cuenta. Nunca como almacenamiento principal de clientes reales. |

### Stack

| Pieza | Elección actual | Camino a AWS (Fase 11) |
|---|---|---|
| App | Next.js (App Router) + TypeScript en Vercel | Mantener Vercel o pasar a Amplify / ECS |
| Base de datos | Neon (Postgres serverless) + Drizzle ORM con migraciones en el repo | RDS o Aurora Postgres (`pg_dump` / `pg_restore`; Drizzle no cambia) |
| Archivos | Cloudflare R2 con la API de S3 (`@aws-sdk/client-s3`) | S3: mismo código, cambia endpoint y credenciales |
| Cuentas | Better Auth (tablas en el mismo Postgres), Google + enlace mágico (Resend) | Se queda: viaja con la base de datos |
| Modelo de IA (agente, extracción) | API de Claude | Claude vía Amazon Bedrock o API de Anthropic |

Criterio: servicios con plan gratuito ahora, sin atarse a ellos (Postgres estándar, API de S3, autenticación propia). Los planes gratuitos tienen límites (cómputo, almacenamiento, retención de respaldos); antes de cargar datos reales de clientes hay que revisar los límites vigentes y decidir plan o rutina de respaldo.

### Reglas de arquitectura
- El dominio (`src/domain`) es TypeScript puro y testeado; la UI solo usa `ExpedienteRepository` (implementaciones: navegador para invitados, servidor para cuentas).
- La base de datos y el almacenamiento solo se usan desde el servidor; los secretos solo en variables de entorno.
- Toda consulta de datos de usuario filtra por el estudio de la sesión, con tests que lo verifican.

## 7. Privacidad y seguridad

- Los expedientes contienen datos personales de terceros (propietarios, profesionales): aplica la **Ley 29733** de Protección de Datos Personales y su reglamento.
- Página de privacidad (qué datos, para qué, dónde, cuánto tiempo, derechos y contacto), consentimiento al crear la cuenta y aviso al registrar datos de terceros.
- Mínimos datos necesarios; eliminar la cuenta borra los datos del estudio.
- Antes de cargar datos reales de clientes: revisar con un abogado la inscripción del banco de datos ante la Autoridad Nacional de Protección de Datos Personales.
- Acceso por estudio aplicado en el servidor; archivos privados con enlaces temporales; sin claves en el repo.

## 8. Requisitos no funcionales

- **Móvil primero**: se usa en el celular, en obra; probado a 375 px.
- **Trazabilidad**: todo dato mostrado conoce su `fuente_id` y su `estado_verificacion`.
- **Idioma**: español (Perú); moneda PEN (`S/ 1,234.50`); fechas `dd/mm/aaaa`.
- **Accesibilidad**: contraste AA, formularios con etiquetas, navegación por teclado.
- **Calidad**: CI obligatorio en cada PR (validación de datos, paridad del motor TS con el de Python, cobertura del dominio ≥ 90 %, build y pruebas E2E).
- **Portabilidad**: cambiar de proveedor (p. ej. a AWS) no debe requerir cambios en el dominio ni en las pantallas.

## 9. Métricas de la validación

| Métrica | Umbral para seguir |
|---|---|
| Profesionales entrevistados | ≥ 8 |
| Dicen que el diagnóstico les ahorra ≥ 1 h por caso | ≥ 5 de 8 |
| Crean cuenta y cargan al menos 1 expediente real | ≥ 4 |
| Siguen usando la herramienta a las 2 semanas (al menos 1 cambio de estado o documento por semana) | ≥ 3 |
| Aceptan un precio concreto (compromiso: prueba pagada o carta de intención) | ≥ 3 |
| Reportan un dato desactualizado o un error de ruta | Se registra (señal de uso real y de calidad de datos) |

Detalle en `docs/validacion.md`.

## 10. Hoja de ruta

| Fase | Qué | Estado |
|---|---|---|
| 0–4 | Setup, dominio y motor, diagnóstico, hoja de ruta y fuentes, expedientes | Hechas |
| 5 | Backend, cuentas y persistencia (F8) | Siguiente |
| 6 | Bitácora de obra (F6) | Pendiente |
| 7 | Landing, pulido, modo demo | Pendiente (antes de las entrevistas) |
| 8–10 | Mantenimiento de datos (F9) | Pendiente |
| 11 | Agente de consultas y migración a AWS | Futuro |

Después del prototipo:
1. **Agente de consultas** (Fase 11): Claude con herramientas que llaman al motor y a los datos (diagnóstico, hoja de ruta, tarifas, fuentes, estado de expedientes), siempre citando fuentes y sin inventar montos; opcionalmente como servidor MCP.
2. **Migración a AWS** junto con el agente (ver tabla del stack).
3. Mapa: cruce de coordenadas del predio con polígonos de zonas especiales.
4. Páginas SEO por distrito × trámite, generadas desde el JSON.
5. Más distritos (con la extracción asistida de TUPAs); convenio municipal (vía PIDE) a largo plazo.
6. Pagos y suscripciones, cuando la validación confirme el precio.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Datos desactualizados (TUPAs, normas, tasas) | Etiquetas de verificación, vigilancia semanal, antigüedad visible, reportes de usuarios, aviso legal |
| Que un usuario tome un monto o plazo como asesoría legal | Aviso legal en cada resultado; montos no verificados siempre etiquetados; "Consultar TUPA" cuando no hay dato |
| Pérdida de datos de usuarios | Datos en servidor desde la Fase 5; respaldo de la base de datos; exportación JSON |
| Datos personales de terceros | Ley 29733: privacidad, consentimiento, mínimos datos, acceso por estudio |
| Límites o cambios de los planes gratuitos | Stack portable (Postgres, API de S3); revisar límites antes de datos reales; migración a AWS prevista |
| Adopción: los profesionales siguen con WhatsApp y Excel | Validar con entrevistas; modo invitado sin fricción; importar y exportar |

## 12. Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 30-09-2026 | Next.js + TypeScript estricto, dominio puro, motor de reglas en JSON con paridad contra el motor Python | Reglas revisables por PR; lógica testeada y portable |
| 30-09-2026 | Hosting en Vercel | Next.js sin configuración y vista previa por PR |
| 01-10-2026 | Costos como rango cuando el TUPA tiene variantes | Elegir la variante sería una regla escondida en el código; si se necesita, va a `reglas.json` |
| 01-10-2026 | El backend entra al prototipo (antes era "fase posterior") | Sin datos en servidor no se puede validar con expedientes reales, compartir con el equipo ni guardar fotos |
| 01-10-2026 | Neon + Cloudflare R2 + Better Auth + Drizzle | Gratis ahora y portable a AWS cuando se construya el agente |
| 01-10-2026 | La base de conocimiento sigue en JSON en el repo | Revisión humana por PR y CI; nunca actualización automática sin revisión |
