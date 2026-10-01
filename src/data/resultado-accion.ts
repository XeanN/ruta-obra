// Formato de respuesta de las Server Actions. En producción Next oculta el mensaje de los
// errores lanzados en el servidor, así que los errores esperados viajan como datos.
export type CodigoError = "sesion" | "no_encontrado" | "ya_existe" | "conflicto" | "invalido" | "interno";

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: CodigoError; mensaje: string };
