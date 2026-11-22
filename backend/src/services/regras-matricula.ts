import { horariosConflitam } from "./horarios.js";

type Horario = { diaSemana: number; inicio: string; fim: string };

type Turma = {
  id: string;
  disciplinaId: number;
  capacidade: number;
  horarios: Horario[];
};

type MatriculaExistente = {
  turmaId: string;
  turma: { disciplinaId: number; horarios: Horario[] };
};

// Regras compartilhadas entre matricula direta e lista de espera.
export function impedimentoAcademico(
  turma: Turma,
  matriculas: MatriculaExistente[],
): string | null {
  if (matriculas.some((m) => m.turmaId === turma.id)) {
    return "Aluno ja matriculado nesta turma.";
  }

  if (matriculas.some((m) => m.turma.disciplinaId === turma.disciplinaId)) {
    return "Aluno ja matriculado nesta disciplina.";
  }

  if (matriculas.some((m) => horariosConflitam(m.turma.horarios, turma.horarios))) {
    return "Conflito de horario com outra turma.";
  }

  return null;
}

export function impedimentoDeMatricula(
  turma: Turma,
  matriculas: MatriculaExistente[],
  quantidadeMatriculados: number,
): string | null {
  return impedimentoAcademico(turma, matriculas) ??
    (quantidadeMatriculados >= turma.capacidade ? "Turma sem vagas disponiveis." : null);
}
