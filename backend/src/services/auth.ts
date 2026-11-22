import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma.js";

const scrypt = promisify(scryptCallback);
const COOKIE = "matricula_session";
const SESSAO_MS = 8 * 60 * 60 * 1000;

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16).toString("hex");
  const hash = (await scrypt(senha, sal, 64)) as Buffer;
  return `scrypt$${sal}$${hash.toString("hex")}`;
}

export async function verificarSenha(senha: string, armazenado: string | null): Promise<boolean> {
  if (!armazenado) return false;
  const partes = armazenado.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt" ||
      !/^[0-9a-f]{32}$/.test(partes[1]) || !/^[0-9a-f]{128}$/.test(partes[2])) return false;

  const esperado = Buffer.from(partes[2], "hex");
  const fornecido = (await scrypt(senha, partes[1], 64)) as Buffer;
  return timingSafeEqual(esperado, fornecido);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function lerToken(req: Request): string | null {
  const cookie = req.headers.cookie?.split(";").map((parte) => parte.trim())
    .find((parte) => parte.startsWith(COOKIE + "="));
  if (!cookie) return null;
  const token = cookie.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function obterSessao(req: Request) {
  const token = lerToken(req);
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { aluno: { select: { id: true, nome: true, email: true, numeroMatricula: true, curso: { select: { nome: true } } } } },
  });
  if (!sessao || sessao.expiresAt <= new Date()) return null;
  return sessao;
}

export async function abrirSessao(res: Response, alunoId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await prisma.sessao.create({
    data: {
      tokenHash: tokenHash(token),
      alunoId,
      expiresAt: new Date(Date.now() + SESSAO_MS),
    },
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSAO_MS,
  });
}

export async function encerrarSessao(req: Request, res: Response): Promise<void> {
  const token = lerToken(req);
  if (token) await prisma.sessao.deleteMany({ where: { tokenHash: tokenHash(token) } });
  res.clearCookie(COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });
}

export async function exigirAutenticacao(req: Request, res: Response, next: NextFunction) {
  try {
    const sessao = await obterSessao(req);
    if (!sessao) {
      res.status(401).json({ error: "Entre com sua matrícula e senha para continuar." });
      return;
    }
    res.locals.alunoId = sessao.aluno.id;
    next();
  } catch (error) {
    next(error);
  }
}

// A sessão define o aluno autorizado; IDs fornecidos pelo navegador não concedem acesso.
export function conferirAluno(res: Response, id: unknown): boolean {
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Informe um alunoId válido." });
    return false;
  }
  if (res.locals.alunoId !== id) {
    res.status(403).json({ error: "Esta operação pertence a outro aluno." });
    return false;
  }
  return true;
}
