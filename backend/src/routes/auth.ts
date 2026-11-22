import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { abrirSessao, encerrarSessao, gerarHashSenha, obterSessao, verificarSenha } from "../services/auth.js";

export const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Proteção básica contra tentativas repetidas no protótipo (em memória por processo).
const tentativas = new Map<string, { total: number; ate: number }>();
const JANELA = 15 * 60 * 1000;
const LIMITE = 5;

function chaveLogin(matricula: string, ip: string) {
  return `${ip}:${matricula.toLowerCase()}`;
}

authRouter.post("/register", async (req, res, next) => {
  const { nome, email, numeroMatricula, senha, curso } = req.body ?? {};

  if (
    typeof nome !== "string" || !nome.trim() || nome.trim().length > 120 ||
    typeof email !== "string" || email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof numeroMatricula !== "string" || !numeroMatricula.trim() ||
    numeroMatricula.trim().length > 32 ||
    typeof curso !== "string" || !curso.trim() || curso.trim().length > 120 ||
    typeof senha !== "string" || senha.length < 8 || senha.length > 128
  ) {
    res.status(400).json({
      error: "Informe nome, e-mail, matrícula e senha de 8 a 128 caracteres.",
    });
    return;
  }

  try {
    const aluno = await prisma.aluno.create({
      data: {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        numeroMatricula: numeroMatricula.trim(),
        senhaHash: await gerarHashSenha(senha),
        curso: curso.trim(),
      },
      select: { id: true, nome: true, email: true, numeroMatricula: true, curso: true },
    });
    await abrirSessao(res, aluno.id);
    res.status(201).json(aluno);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      res.status(409).json({ error: "E-mail ou número de matrícula já cadastrado." });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  const { numeroMatricula, senha } = req.body ?? {};
  if (
    typeof numeroMatricula !== "string" || !numeroMatricula.trim() ||
    numeroMatricula.length > 32 ||
    typeof senha !== "string" || senha.length < 1 || senha.length > 128
  ) {
    res.status(400).json({ error: "Informe a matrícula e a senha." });
    return;
  }

  const chave = chaveLogin(numeroMatricula.trim(), req.ip ?? "unknown");
  const atual = tentativas.get(chave);
  if (atual && atual.ate > Date.now() && atual.total >= LIMITE) {
    res.status(429).json({ error: "Muitas tentativas. Tente novamente em 15 minutos." });
    return;
  }

  try {
    const aluno = await prisma.aluno.findUnique({
      where: { numeroMatricula: numeroMatricula.trim() },
    });
    const valida = await verificarSenha(senha, aluno?.senhaHash ?? null);
    if (!aluno || !valida) {
      const inicio = !atual || atual.ate <= Date.now() ? { total: 0, ate: Date.now() + JANELA } : atual;
      tentativas.set(chave, { total: inicio.total + 1, ate: inicio.ate });
      res.status(401).json({ error: "Matrícula ou senha incorreta." });
      return;
    }

    tentativas.delete(chave);
    await abrirSessao(res, aluno.id);
    res.json({ id: aluno.id, nome: aluno.nome, email: aluno.email, numeroMatricula: aluno.numeroMatricula, curso: aluno.curso });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const sessao = await obterSessao(req);
    if (!sessao) {
      res.status(401).json({ error: "Sessão não encontrada ou expirada." });
      return;
    }
    res.json(sessao.aluno);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await encerrarSessao(req, res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
