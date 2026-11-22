import express from "express";
import cors from "cors";
import { prisma } from "./database/prisma.js";
import { alunosRouter } from "./routes/alunos.js";
import { matriculasRouter } from "./routes/matriculas.js";
import { listaEsperaRouter } from "./routes/lista-espera.js";
import { authRouter } from "./routes/auth.js";
import { exigirAutenticacao } from "./services/auth.js";

export const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "sistema-de-matriculas-api",
  });
});

// Apenas as rotas de autenticação e de saúde são públicas.
app.use("/api/auth", authRouter);
app.use("/api", exigirAutenticacao);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Lista as disciplinas cadastradas.
app.get("/api/disciplinas", async (_req, res) => {
  const disciplinas = await prisma.disciplina.findMany({
    orderBy: { nome: "asc" },
  });

  res.json(disciplinas);
});

// Lista as turmas com sua disciplina e horarios.
app.get("/api/turmas", async (_req, res) => {
  const turmas = await prisma.turma.findMany({
    include: {
      disciplina: true,
      horarios: true,
      _count: { select: { matriculas: true, listaEspera: true } },
    },
    orderBy: { id: "asc" },
  });

  res.json(turmas.map((turma) => ({
    ...turma,
    vagasDisponiveis: Math.max(0, turma.capacidade - turma._count.matriculas),
  })));
});

app.use("/api/alunos", alunosRouter);
app.use("/api/matriculas", matriculasRouter);
app.use("/api/lista-espera", listaEsperaRouter);

// Resposta simples quando houver falha no acesso ao banco.
app.use((
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno no servidor" });
});
