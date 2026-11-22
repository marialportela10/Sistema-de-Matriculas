import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { impedimentoAcademico, impedimentoDeMatricula } from "../services/regras-matricula.js";
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
  if (alunoId !== res.locals.alunoId) {
    res.status(403).json({ error: "Você só pode consultar suas próprias matrículas." });
    return;
  }

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { alunoId, situacao: "ATIVA" },
      include: {
        turma: { include: { disciplina: true, horarios: true, docente: true } },
      },
      orderBy: { criadaEm: "asc" },
    });
    res.json(matriculas.map((m) => ({ ...m, turma: { ...m.turma, professor: m.turma.docente.nome } })));
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
  if (alunoId !== res.locals.alunoId) {
    res.status(403).json({ error: "Não é permitido matricular outro aluno." });
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
          _count: { select: { matriculas: { where: { situacao: "ATIVA" } } } },
        },
      });
      if (!turma) throw new RegraDeMatriculaError(404, "Turma nao encontrada.");
      const aprovado = await tx.historico.findFirst({
        where: { alunoId, disciplinaId: turma.disciplinaId, situacao: "APROVADA" },
        select: { id: true },
      });
      if (aprovado) throw new RegraDeMatriculaError(409, "Disciplina já aprovada. Não é permitido cursá-la novamente.");

      const atuais = await tx.matricula.findMany({
        where: { alunoId, situacao: "ATIVA", turma: { periodo: turma.periodo } },
        include: { turma: { include: { horarios: true } } },
      });

      const impedimento = impedimentoDeMatricula(turma, atuais, turma._count.matriculas);
      if (impedimento) {
        throw new RegraDeMatriculaError(409, impedimento);
      }

      // Reactivation of a cancelled row keeps one record per student/class.
      const criada = await tx.matricula.upsert({
        where: { alunoId_turmaId: { alunoId, turmaId } },
        create: { alunoId, turmaId, situacao: "ATIVA" },
        update: { situacao: "ATIVA", canceladaEm: null, criadaEm: new Date() },
        include: {
          aluno: { select: { id: true, nome: true, email: true, numeroMatricula: true } },
          turma: { include: { disciplina: true } },
        },
      });
      // O aluno matriculado nao deve continuar na lista de espera.
      await tx.listaEspera.deleteMany({ where: { alunoId, turmaId } });
      return criada;
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

// Cancela uma matricula e tenta promover a primeira pessoa elegivel da fila.
matriculasRouter.delete("/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  const alunoId = req.body?.alunoId;

  if (
    !Number.isSafeInteger(id) || id <= 0 ||
    typeof alunoId !== "number" || !Number.isSafeInteger(alunoId) || alunoId <= 0
  ) {
    res.status(400).json({ error: "Informe o id da matricula e alunoId positivo." });
    return;
  }
  if (alunoId !== res.locals.alunoId) {
    res.status(403).json({ error: "Não é permitido cancelar a matrícula de outro aluno." });
    return;
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const existente = await tx.matricula.findFirst({ where: { id, alunoId, situacao: "ATIVA" } });
      if (!existente) {
        throw new RegraDeMatriculaError(404, "Matricula nao encontrada para o aluno.");
      }

      const cancelada = await tx.matricula.update({
        where: { id }, data: { situacao: "CANCELADA", canceladaEm: new Date() },
      });
      const turma = await tx.turma.findUnique({
        where: { id: cancelada.turmaId },
        include: {
          horarios: true,
          _count: { select: { matriculas: true } },
        },
      });

      let promovido: { alunoId: number; matriculaId: number } | null = null;

      if (turma && turma._count.matriculas < turma.capacidade) {
        const fila = await tx.listaEspera.findMany({
          where: { turmaId: turma.id },
          orderBy: [{ criadaEm: "asc" }, { id: "asc" }],
        });

        for (const candidato of fila) {
          const atuais = await tx.matricula.findMany({
            where: { alunoId: candidato.alunoId, turma: { periodo: turma.periodo } },
            include: { turma: { include: { horarios: true } } },
          });

          // Conferir também o histórico: a aprovação pode ter ocorrido após entrar na fila.
          const aprovada = await tx.historico.findFirst({
            where: { alunoId: candidato.alunoId, disciplinaId: turma.disciplinaId, situacao: "APROVADA" },
            select: { id: true },
          });
          if (aprovada || impedimentoAcademico(turma, atuais)) continue;

          const matricula = await tx.matricula.upsert({
            where: { alunoId_turmaId: { alunoId: candidato.alunoId, turmaId: turma.id } },
            create: { alunoId: candidato.alunoId, turmaId: turma.id, situacao: "ATIVA" },
            update: { situacao: "ATIVA", canceladaEm: null, criadaEm: new Date() },
          });
          await tx.listaEspera.delete({ where: { id: candidato.id } });

          promovido = { alunoId: candidato.alunoId, matriculaId: matricula.id };
          break;
        }
      }

      return { cancelada, promovido };
    });

    res.json(resultado);
  } catch (error) {
    if (error instanceof RegraDeMatriculaError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});
