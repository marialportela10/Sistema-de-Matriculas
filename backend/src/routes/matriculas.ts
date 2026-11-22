import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { horariosConflitam } from "../services/horarios.js";
import { idTurmaValido } from "../services/ids.js";

export const matriculasRouter = Router();

class RegraDeMatriculaError extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

// Mostra as matriculas de um aluno.
matriculasRouter.get("/", async (req, res, next) => {
  const alunoId = Number(req.query.alunoId);
  if (!Number.isSafeInteger(alunoId) || alunoId <= 0) {
    res.status(400).json({ error: "Informe alunoId na consulta." });
    return;
  }

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { alunoId },
      include: {
        turma: { include: { disciplina: true, horarios: true } },
      },
      orderBy: { criadaEm: "asc" },
    });
    res.json(matriculas);
  } catch (error) {
    next(error);
  }
});

// Matricula um aluno em uma turma se todas as regras forem atendidas.
matriculasRouter.post("/", async (req, res, next) => {
  const { alunoId, turmaId } = req.body ?? {};

  if (
    typeof alunoId !== "number" || !Number.isSafeInteger(alunoId) || alunoId <= 0 ||
    !idTurmaValido(turmaId)
  ) {
    res.status(400).json({ error: "Informe alunoId positivo e turmaId no formato AA0000." });
    return;
  }

  try {
    // A verificacao e o cadastro acontecem na mesma transacao.
    const matricula = await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.findUnique({ where: { id: alunoId } });
      if (!aluno) throw new RegraDeMatriculaError(404, "Aluno nao encontrado.");

      const turma = await tx.turma.findUnique({
        where: { id: turmaId },
        include: {
          horarios: true,
          _count: { select: { matriculas: true } },
        },
      });
      if (!turma) throw new RegraDeMatriculaError(404, "Turma nao encontrada.");

      const atuais = await tx.matricula.findMany({
        where: { alunoId, turma: { periodo: turma.periodo } },
        include: { turma: { include: { horarios: true } } },
      });

      if (atuais.some((m) => m.turmaId === turmaId)) {
        throw new RegraDeMatriculaError(409, "Aluno ja matriculado nesta turma.");
      }

      if (atuais.some((m) => m.turma.disciplinaId === turma.disciplinaId)) {
        throw new RegraDeMatriculaError(409, "Aluno ja matriculado nesta disciplina.");
      }

      if (atuais.some((m) => horariosConflitam(m.turma.horarios, turma.horarios))) {
        throw new RegraDeMatriculaError(409, "Conflito de horario com outra turma.");
      }

      if (turma._count.matriculas >= turma.capacidade) {
        throw new RegraDeMatriculaError(409, "Turma sem vagas disponiveis.");
      }

      return tx.matricula.create({
        data: { alunoId, turmaId },
        include: {
          aluno: true,
          turma: { include: { disciplina: true } },
        },
      });
    });

    res.status(201).json(matricula);
  } catch (error) {
    if (error instanceof RegraDeMatriculaError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({ error: "Matricula duplicada." });
      return;
    }

    next(error);
  }
});
