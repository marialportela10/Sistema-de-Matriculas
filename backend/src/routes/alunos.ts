import { Router } from "express";
import { prisma } from "../database/prisma.js";

export const alunosRouter = Router();

// Lista os alunos cadastrados.
alunosRouter.get("/", async (_req, res) => {
  const alunos = await prisma.aluno.findMany({
    orderBy: { nome: "asc" },
  });

  res.json(alunos);
});

// Cadastra um aluno para testar as operacoes de matricula.
alunosRouter.post("/", async (req, res, next) => {
  const { nome, email, numeroMatricula } = req.body ?? {};

  if (
    typeof nome !== "string" || !nome.trim() ||
    typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof numeroMatricula !== "string" || !numeroMatricula.trim()
  ) {
    res.status(400).json({ error: "Informe nome, email valido e numeroMatricula." });
    return;
  }

  try {
    const aluno = await prisma.aluno.create({
      data: {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        numeroMatricula: numeroMatricula.trim(),
      },
    });

    res.status(201).json(aluno);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({ error: "Email ou numero de matricula ja cadastrado." });
      return;
    }
    next(error);
  }
});
