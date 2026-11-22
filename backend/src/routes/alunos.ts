import { Router } from "express";
import { prisma } from "../database/prisma.js";

export const alunosRouter = Router();

const dadosPublicos = {
  id: true,
  nome: true,
  email: true,
  numeroMatricula: true,
} as const;

// Nenhum aluno pode consultar a conta de outra pessoa.
alunosRouter.get("/", async (_req, res, next) => {
  try {
    const aluno = await prisma.aluno.findUnique({
      where: { id: res.locals.alunoId },
      select: dadosPublicos,
    });
    res.json(aluno ? [aluno] : []);
  } catch (error) {
    next(error);
  }
});

alunosRouter.get("/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Informe um ID de aluno válido." });
    return;
  }
  if (id !== res.locals.alunoId) {
    res.status(403).json({ error: "Você só pode consultar sua própria conta." });
    return;
  }
  try {
    const aluno = await prisma.aluno.findUnique({
      where: { id },
      select: dadosPublicos,
    });
    if (!aluno) {
      res.status(404).json({ error: "Aluno não encontrado." });
      return;
    }
    res.json(aluno);
  } catch (error) {
    next(error);
  }
});
