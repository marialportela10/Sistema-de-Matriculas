// Shared input rules for the secretary's future create/edit endpoints.
// Keep them independent of HTTP to make the business rules testable.
export function validarCargaHoraria(valor: unknown): string | null {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) ||
      valor < 15 || valor > 120 || valor % 15 !== 0) {
    return "A carga horária deve ser múltipla de 15, entre 15h e 120h.";
  }
  return null;
}

export function validarVagas(valor: unknown, matriculadosAtivos: number): string | null {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 1) {
    return "A turma deve ter pelo menos uma vaga.";
  }
  if (valor < matriculadosAtivos) {
    return "Não é permitido definir menos vagas que as matrículas ativas.";
  }
  return null;
}

export function validarProfessor(nome: unknown, email: unknown): string | null {
  if (typeof nome !== "string" || !nome.trim() || nome.trim().length > 120) {
    return "Informe o nome do professor.";
  }
  if (typeof email !== "string" || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Informe um e-mail válido para o professor.";
  }
  return null;
}
