import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../database/prisma.js";

const COOKIE = "matricula_admin_session";
const VIDA_MS = 8 * 60 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function tokenDaRequisicao(req: Request): string | null {
  const parte = req.headers.cookie?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(COOKIE + "="));
  const token = parte?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function sessaoSecretaria(req: Request) {
  const token = tokenDaRequisicao(req);
  if (!token) return null;
  const sessao = await prisma.sessaoSecretaria.findUnique({
    where: { tokenHash: hash(token) },
    include: { secretaria: { select: { id: true, usuario: true, email: true } } },
  });
  return sessao && sessao.expiresAt > new Date() ? sessao : null;
}

export async function criarSessaoSecretaria(res: Response, secretariaId: number) {
  const token = randomBytes(32).toString("hex");
  await prisma.sessaoSecretaria.create({
    data: { secretariaId, tokenHash: hash(token), expiresAt: new Date(Date.now() + VIDA_MS) },
  });
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/api/admin", maxAge: VIDA_MS,
  });
}

export async function revogarSessaoSecretaria(req: Request, res: Response) {
  const token = tokenDaRequisicao(req);
  if (token) await prisma.sessaoSecretaria.deleteMany({ where: { tokenHash: hash(token) } });
  res.clearCookie(COOKIE, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/api/admin",
  });
}

export async function exigirSecretaria(req: Request, res: Response, next: NextFunction) {
  try {
    const sessao = await sessaoSecretaria(req);
    if (!sessao) {
      res.status(401).json({ error: "Acesso restrito à Secretaria de Graduação." });
      return;
    }
    res.locals.secretariaId = sessao.secretariaId;
    next();
  } catch (error) { next(error); }
}
