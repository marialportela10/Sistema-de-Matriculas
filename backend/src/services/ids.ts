// Two uppercase letters followed by four digits, e.g. IP0001 or ED0001.
export const FORMATO_ID_TURMA = /^[A-Z]{2}[0-9]{4}$/;

export function idTurmaValido(value: unknown): value is string {
  return typeof value === "string" && FORMATO_ID_TURMA.test(value);
}
