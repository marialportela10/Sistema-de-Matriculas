import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { idTurmaValido } from "../services/ids.js";
import { impedimentoAcademico } from "../services/regras-matricula.js";

export const listaEsperaRouter = Router();

class ErroDaFila extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// Mostra a lista de espera do aluno, sem expor dados dos demais alunos.
listaEsperaRouter.get("/", async (req, res, next) => {
  const alunoId = Number(req.query.alunoId);
  if (!Number.isSafeInteger(alunoId) || alunoId <= 0) {
    res.status(400).json({ error: "Informe alunoId na consulta." });
    return;
  }
  if (alunoId !== res.locals.alunoId) {
    res.status(403).json({ error: "Você só pode consultar sua própria lista." });
    return;
  }

  try {
    const registros = await prisma.listaEspera.findMany({
      where: { alunoId },
      include: { turma: { include: { disciplina: true, horarios: true, docente: true } } },
      orderBy: [{ criadaEm: "asc" }, { id: "asc" }],
    });
    res.json(registros.map((r) => ({ ...r, turma: { ...r.turma, professor: r.turma.docente.nome } })));
  } catch (error) {
    next(error);
  }
});

// Aluno so entra na lista se a turma estiver cheia e nao houver impedimentos.
listaEsperaRouter.post("/", async (req, res, next) => {
  const { alunoId, turmaId } = req.body ?? {};
  if (
    typeof alunoId !== "number" ||
    !Number.isSafeInteger(alunoId) || alunoId <= 0 ||
    !idTurmaValido(turmaId)
  ) {
    res.status(400).json({ error: "Informe alunoId positivo e turmaId no formato AA0000." });
    return;
  }
  if (alunoId !== res.locals.alunoId) {
    res.status(403).json({ error: "Não é permitido colocar outro aluno na lista." });
    return;
  }

  try {
    const registro = await prisma.$transaction(async (tx) => {
      const aluno = await tx.aluno.findUnique({ where: { id: alunoId } });
      if (!aluno) throw new ErroDaFila(404, "Aluno nao encontrado.");

      const turma = await tx.turma.findUnique({
        where: { id: turmaId },
        include: {
          horarios: true,
          _count: { select: { matriculas: { where: { situacao: "ATIVA" } } } },
        },
      });
      if (!turma) throw new ErroDaFila(404, "Turma nao encontrada.");
      const aprovado = await tx.historico.findFirst({
        where: { alunoId, disciplinaId: turma.disciplinaId, situacao: "APROVADA" },
        select: { id: true },
      });
      if (aprovado) throw new ErroDaFila(409, "Disciplina já aprovada. Não é permitido cursá-la novamente.");

      if (turma._count.matriculas < turma.capacidade) {
        throw new ErroDaFila(409, "Ainda ha vagas. Faca a matricula diretamente.");
      }

      const atuais = await tx.matricula.findMany({
        where: { alunoId, situacao: "ATIVA", turma: { periodo: turma.periodo } },
        include: { turma: { include: { horarios: true } } },
      });
      const impedimento = impedimentoAcademico(turma, atuais);
      if (impedimento) throw new ErroDaFila(409, impedimento);

      return tx.listaEspera.create({
        data: { alunoId, turmaId },
        include: { turma: { include: { disciplina: true } } },
      });
    });

    res.status(201).json(registro);
  } catch (error) {
    if (error instanceof ErroDaFila) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "Aluno ja esta na lista de espera desta turma." });
      return;
    }
    next(error);
  }
});

// Retira o aluno autenticado da lista.
listaEsperaRouter.delete("/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  const alunoId = req.body?.alunoId;

  if (
    !Number.isSafeInteger(id) || id <= 0 ||
    typeof alunoId !== "number" || !Number.isSafeInteger(alunoId) || alunoId <= 0
  ) {
    res.status(400).json({ error: "Informe o id da fila e alunoId positivo." });
    return;
  }
  if (alunoId !== res.locals.alunoId) {
    res.status(403).json({ error: "Não é permitido remover outro aluno da lista." });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const registro = await tx.listaEspera.findFirst({ where: { id, alunoId } });
      if (!registro) {
        throw new ErroDaFila(404, "Registro de espera nao encontrado para o aluno.");
      }
      await tx.listaEspera.delete({ where: { id } });
    });
    res.status(204).send();
  } catch (error) {
    if (error instanceof ErroDaFila) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});
