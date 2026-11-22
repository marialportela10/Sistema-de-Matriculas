import { Router } from "express";
import { prisma } from "../database/prisma.js";
import { verificarSenha } from "../services/auth.js";
import { criarSessaoSecretaria, exigirSecretaria, revogarSessaoSecretaria, sessaoSecretaria } from "../services/admin-auth.js";
import { validarCargaHoraria, validarProfessor, validarVagas } from "../services/validacoes-cadastro.js";

export const adminRouter = Router();
adminRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

class ErroAdmin extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

const tentativas = new Map<string, { total: number; ate: number }>();
const JANELA_MS = 15 * 60 * 1000;
const LIMITE = 5;

function eConflito(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
function tratarErro(error: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (error instanceof ErroAdmin) { res.status(error.status).json({ error: error.message }); return; }
  if (eConflito(error)) { res.status(409).json({ error: "Já existe um registro com esses dados." }); return; }
  next(error);
}

function idValido(value: unknown): number | null {
  const id = typeof value === "string" ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

function paginaDaConsulta(query: Record<string, unknown>) {
  const solicitado = Number(query.pagina ?? 1);
  const pagina = Number.isSafeInteger(solicitado) && solicitado > 0 ? Math.min(solicitado, 100000) : 1;
  const busca = typeof query.busca === "string" ? query.busca.trim().slice(0, 100) : "";
  return { pagina, busca, porPagina: 10, skip: (pagina - 1) * 10 };
}

// Perfil independente: aluno autenticado não ganha permissões de secretaria.
adminRouter.post("/auth/login", async (req, res, next) => {
  const { usuario, senha } = req.body ?? {};
  if (typeof usuario !== "string" || !usuario.trim() || usuario.length > 100 ||
      typeof senha !== "string" || !senha || senha.length > 128) {
    res.status(400).json({ error: "Informe usuário e senha da Secretaria." });
    return;
  }

  const chave = (req.ip ?? "unknown") + ":" + usuario.trim().toLowerCase();
  const registro = tentativas.get(chave);
  if (registro && registro.ate > Date.now() && registro.total >= LIMITE) {
    res.status(429).json({ error: "Muitas tentativas. Tente novamente em 15 minutos." });
    return;
  }

  try {
    const conta = await prisma.usuarioSecretaria.findUnique({ where: { usuario: usuario.trim() } });
    if (!conta || !await verificarSenha(senha, conta.senhaHash)) {
      const anterior = registro && registro.ate > Date.now()
        ? registro : { total: 0, ate: Date.now() + JANELA_MS };
      tentativas.set(chave, { ...anterior, total: anterior.total + 1 });
      res.status(401).json({ error: "Usuário ou senha incorretos." });
      return;
    }
    tentativas.delete(chave);
    await criarSessaoSecretaria(res, conta.id);
    res.json({ id: conta.id, usuario: conta.usuario, email: conta.email, perfil: "secretaria" });
  } catch (error) { next(error); }
});

adminRouter.get("/auth/me", async (req, res, next) => {
  try {
    const sessao = await sessaoSecretaria(req);
    if (!sessao) { res.status(401).json({ error: "Sessão da Secretaria expirada." }); return; }
    res.json({ ...sessao.secretaria, perfil: "secretaria" });
  } catch (error) { next(error); }
});

adminRouter.post("/auth/logout", async (req, res, next) => {
  try {
    await revogarSessaoSecretaria(req, res);
    res.status(204).send();
  } catch (error) { next(error); }
});

adminRouter.use(exigirSecretaria);

adminRouter.get("/opcoes", async (_req, res, next) => {
  try {
    const [disciplinas, professores] = await Promise.all([
      prisma.disciplina.findMany({ select: { id: true, codigo: true, nome: true }, orderBy: { nome: "asc" } }),
      prisma.professor.findMany({ select: { id: true, nome: true, email: true }, orderBy: { nome: "asc" } }),
    ]);
    res.json({ disciplinas, professores });
  } catch (error) { next(error); }
});

adminRouter.get("/disciplinas", async (req, res, next) => {
  const { pagina, busca, porPagina, skip } = paginaDaConsulta(req.query);
  const where = busca ? { OR: [{ nome: { contains: busca } }, { codigo: { contains: busca } }] } : {};
  try {
    const [total, items] = await Promise.all([
      prisma.disciplina.count({ where }),
      prisma.disciplina.findMany({ where, skip, take: porPagina, orderBy: { nome: "asc" },
        include: { _count: { select: { turmas: true } } } }),
    ]);
    res.json({ items, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) });
  } catch (error) { next(error); }
});

function dadosDisciplina(body: unknown) {
  if (!body || typeof body !== "object") throw new ErroAdmin(400, "Informe os dados da disciplina.");
  const dados = body as Record<string, unknown>;
  const codigo = typeof dados.codigo === "string" ? dados.codigo.trim().toUpperCase() : "";
  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  const ementa = typeof dados.ementa === "string" ? dados.ementa.trim() : "";
  const erroCH = validarCargaHoraria(dados.cargaHoraria);
  if (!/^[A-Z0-9]{2,16}$/.test(codigo)) {
    throw new ErroAdmin(400, "Código deve ter de 2 a 16 letras maiúsculas ou números.");
  }
  if (!nome || nome.length > 160) throw new ErroAdmin(400, "Informe o nome da disciplina.");
  if (ementa.length > 5000) throw new ErroAdmin(400, "Ementa muito longa.");
  if (erroCH) throw new ErroAdmin(400, erroCH);
  return { codigo, nome, ementa: ementa || null, cargaHoraria: dados.cargaHoraria as number };
}

adminRouter.post("/disciplinas", async (req, res, next) => {
  try {
    const disciplina = await prisma.disciplina.create({ data: dadosDisciplina(req.body) });
    res.status(201).json(disciplina);
  } catch (error) { tratarErro(error, res, next); }
});
adminRouter.put("/disciplinas/:id", async (req, res, next) => {
  const id = idValido(req.params.id);
  if (!id) { res.status(400).json({ error: "Identificador inválido." }); return; }
  try {
    if (!await prisma.disciplina.findUnique({ where: { id } })) {
      throw new ErroAdmin(404, "Disciplina não encontrada.");
    }
    const disciplina = await prisma.disciplina.update({ where: { id }, data: dadosDisciplina(req.body) });
    res.json(disciplina);
  } catch (error) { tratarErro(error, res, next); }
});

adminRouter.get("/professores", async (req, res, next) => {
  const { pagina, busca, porPagina, skip } = paginaDaConsulta(req.query);
  const where = busca ? { OR: [{ nome: { contains: busca } }, { email: { contains: busca } }] } : {};
  try {
    const [total, items] = await Promise.all([
      prisma.professor.count({ where }),
      prisma.professor.findMany({ where, skip, take: porPagina, orderBy: { nome: "asc" },
        include: { _count: { select: { turmas: true } } } }),
    ]);
    res.json({ items, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) });
  } catch (error) { next(error); }
});
adminRouter.post("/professores", async (req, res, next) => {
  const { nome, email } = req.body ?? {};
  const erro = validarProfessor(nome, email);
  if (erro) { res.status(400).json({ error: erro }); return; }
  try {
    const professor = await prisma.professor.create({
      data: { nome: (nome as string).trim(), email: (email as string).trim().toLowerCase() },
    });
    res.status(201).json(professor);
  } catch (error) { tratarErro(error, res, next); }
});

function validarHorario(horarios: unknown) {
  if (!Array.isArray(horarios) || horarios.length < 1 || horarios.length > 10) {
    throw new ErroAdmin(400, "Informe de 1 a 10 horários para a turma.");
  }
  const validados = horarios.map((horario: unknown) => {
    if (!horario || typeof horario !== "object") throw new ErroAdmin(400, "Horário inválido.");
    const h = horario as Record<string, unknown>;
    const diaSemana = idValido(h.diaSemana);
    const horaValida = (value: unknown) => typeof value === "string" &&
      /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
    if (!diaSemana || diaSemana > 7 || !horaValida(h.inicio) || !horaValida(h.fim) ||
        (h.inicio as string) >= (h.fim as string)) throw new ErroAdmin(400, "Dia ou intervalo inválido.");
    return { diaSemana, inicio: h.inicio as string, fim: h.fim as string };
  });
  for (let a = 0; a < validados.length; a++) {
    for (let b = a + 1; b < validados.length; b++) {
      const x = validados[a], y = validados[b];
      if (x.diaSemana === y.diaSemana && x.inicio < y.fim && y.inicio < x.fim) {
        throw new ErroAdmin(400, "Os horários da própria turma não podem se sobrepor.");
      }
    }
  }
  return validados;
}

const PERIODO = process.env.PERIODO_CORRENTE ?? "2026.2";

adminRouter.get("/turmas", async (req, res, next) => {
  const { pagina, busca, porPagina, skip } = paginaDaConsulta(req.query);
  const where = { periodo: PERIODO, ...(busca ? { OR: [
    { id: { contains: busca } }, { codigo: { contains: busca } },
    { disciplina: { nome: { contains: busca } } }, { docente: { nome: { contains: busca } } },
  ] } : {}) };
  try {
    const [total, items] = await Promise.all([
      prisma.turma.count({ where }),
      prisma.turma.findMany({
        where, skip, take: porPagina, orderBy: [{ disciplina: { nome: "asc" } }, { codigo: "asc" }],
        include: { disciplina: true, docente: true, horarios: true,
          _count: { select: { matriculas: { where: { situacao: "ATIVA" } } } } },
      }),
    ]);
    res.json({ items: items.map((t) => ({ ...t, ocupadas: t._count.matriculas,
      vagasDisponiveis: Math.max(0, t.capacidade - t._count.matriculas) })),
      total, pagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) });
  } catch (error) { next(error); }
});

adminRouter.post("/turmas", async (req, res, next) => {
  const { disciplinaId, professorId, codigo, capacidade, horarios } = req.body ?? {};
  const disciplina = idValido(disciplinaId), professor = idValido(professorId);
  const secao = typeof codigo === "string" ? codigo.trim().toUpperCase() : "";
  const erroVagas = validarVagas(capacidade, 0);
  if (!disciplina || !professor || !/^[A-Z][0-9]{0,2}$/.test(secao) || erroVagas) {
    res.status(400).json({ error: erroVagas ?? "Selecione disciplina e professor e informe uma turma com uma letra e até dois números (A, A1 ou A12)." });
    return;
  }
  let horariosValidados: ReturnType<typeof validarHorario>;
  try { horariosValidados = validarHorario(horarios); }
  catch (error) { tratarErro(error, res, next); return; }

  try {
    const criada = await prisma.$transaction(async (tx) => {
      const [d, p, existente] = await Promise.all([
        tx.disciplina.findUnique({ where: { id: disciplina } }),
        tx.professor.findUnique({ where: { id: professor } }),
        tx.turma.findUnique({ where: {
          disciplinaId_codigo_periodo: { disciplinaId: disciplina, codigo: secao, periodo: PERIODO },
        } }),
      ]);
      if (!d || !p) throw new ErroAdmin(404, "Disciplina ou professor não encontrado.");
      if (existente) throw new ErroAdmin(409, "Já existe essa seção para a disciplina neste semestre.");

      const prefixo = d.codigo.replace(/[^A-Z]/g, "").slice(0, 2).padEnd(2, "X");
      const usadas = await tx.turma.findMany({ where: { id: { startsWith: prefixo } }, select: { id: true } });
      const proximo = usadas.reduce((maior, t) =>
        Math.max(maior, Number(t.id.slice(2)) || 0), 0) + 1;
      if (proximo > 9999) throw new ErroAdmin(409, "Não há mais códigos disponíveis para esse prefixo.");
      const id = prefixo + String(proximo).padStart(4, "0");
      return tx.turma.create({
        data: { id, codigo: secao, periodo: PERIODO, capacidade,
          disciplinaId: disciplina, professorId: professor,
          horarios: { create: horariosValidados } },
        include: { disciplina: true, docente: true, horarios: true },
      });
    });
    res.status(201).json({ ...criada, ocupadas: 0, vagasDisponiveis: criada.capacidade });
  } catch (error) { tratarErro(error, res, next); }
});

adminRouter.put("/turmas/:id/vagas", async (req, res, next) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!/^[A-Z]{2}[0-9]{4}$/.test(id)) {
    res.status(400).json({ error: "Identificador de turma inválido." });
    return;
  }
  try {
    const atualizada = await prisma.$transaction(async (tx) => {
      const turma = await tx.turma.findUnique({
        where: { id }, include: {
          _count: { select: { matriculas: { where: { situacao: "ATIVA" } } } },
        },
      });
      if (!turma) throw new ErroAdmin(404, "Turma não encontrada.");
      const erro = validarVagas(req.body?.capacidade, turma._count.matriculas);
      if (erro) throw new ErroAdmin(400, erro);
      return tx.turma.update({ where: { id }, data: { capacidade: req.body.capacidade } });
    });
    res.json(atualizada);
  } catch (error) { tratarErro(error, res, next); }
});
