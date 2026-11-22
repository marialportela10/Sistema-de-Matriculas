import express from "express";
import cors from "cors";
import { prisma } from "./database/prisma.js";
import { alunosRouter } from "./routes/alunos.js";
import { matriculasRouter } from "./routes/matriculas.js";
import { listaEsperaRouter } from "./routes/lista-espera.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { progressoRouter } from "./routes/progresso.js";
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

// A lista de cursos é pública apenas para o formulário de cadastro de demonstração.
app.get("/api/cursos", async (_req, res, next) => {
  try {
    const cursos = await prisma.curso.findMany({
      where: { codigo: { in: ["SI", "CC"] } },
      select: { id: true, codigo: true, nome: true },
      orderBy: { nome: "asc" },
    });
    res.json(cursos);
  } catch (error) { next(error); }
});

// A Secretaria possui autenticação e rotas independentes das sessões dos alunos.
app.use("/api/admin", adminRouter);

// As outras rotas exigem login e ficam vinculadas ao perfil do aluno.
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
  const alunoId = res.locals.alunoId as number;
  const [turmas, aluno, historico] = await Promise.all([
    prisma.turma.findMany({
      include: {
        disciplina: true,
        docente: true,
        horarios: true,
        _count: { select: { matriculas: { where: { situacao: "ATIVA" } }, listaEspera: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.aluno.findUnique({ where: { id: alunoId }, select: { cursoId: true } }),
    prisma.historico.findMany({
      where: { alunoId, situacao: "APROVADA" },
      select: { disciplinaId: true },
    }),
  ]);
  const curso = aluno ? await prisma.curso.findUnique({ where: { id: aluno.cursoId } }) : null;
  const estrutura = curso ? await prisma.curriculoDisciplina.findMany({ where: { cursoId: curso.id } }) : [];
  const categorias = new Map(estrutura.map((item) => [item.disciplinaId, item.tipo]));
  const aprovadas = new Set(historico.map((item) => item.disciplinaId));

  res.json(turmas.map((turma) => ({
    ...turma,
    professor: turma.docente.nome,
    vagasDisponiveis: Math.max(0, turma.capacidade - turma._count.matriculas),
    classificacao: curso ? (categorias.get(turma.disciplinaId) ?? "eletiva-livre") : null,
    jaAprovada: aprovadas.has(turma.disciplinaId),
  })));
});

app.use("/api/progresso", progressoRouter);
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
