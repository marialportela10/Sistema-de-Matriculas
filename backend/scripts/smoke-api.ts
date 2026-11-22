import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";

// Tests run against the isolated CI SQLite database, never real student records.
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  if (server.listening) return resolve();
  server.once("listening", resolve);
  server.once("error", reject);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Test server unavailable");
const base = `http://127.0.0.1:${address.port}`;

type ResponseData<T> = { status: number; data: T; cookie: string };
type Aluno = { id: number; nome: string; numeroMatricula: string };
type Conta = Aluno & { cookie: string };
type Matricula = { id: number; alunoId: number; turmaId: string };
type Espera = { id: number; alunoId: number; turmaId: string };

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
): Promise<ResponseData<T>> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: (response.status === 204 ? null : await response.json()) as T,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}

const password = "TesteForte123!";

async function register(suffix: string): Promise<Conta> {
  const response = await call<Aluno>("POST", "/api/auth/register", {
    nome: `Aluno Teste ${suffix}`,
    email: `teste-${suffix}@example.com`,
    numeroMatricula: `TESTE-${suffix}`,
    curso: "Sistemas de Informação",
    senha: password,
  });
  assert.equal(response.status, 201);
  assert.ok(response.cookie.startsWith("matricula_session="));
  assert.equal("senhaHash" in response.data, false);
  return { ...response.data, cookie: response.cookie };
}

async function run() {
  assert.equal((await call("GET", "/api/health")).status, 200);
  assert.equal((await call("GET", "/api/turmas")).status, 401);
  assert.equal((await call("GET", "/api/matriculas?alunoId=1")).status, 401);

  const secretaria = await prisma.usuarioSecretaria.findUnique({ where: { usuario: "secretaria.demo" } });
  assert.ok(secretaria);
  assert.notEqual(secretaria.senhaHash, "Secretaria@12345");
  const reserva = await prisma.aluno.findUnique({
    where: { numeroMatricula: "RESERVA2026" }, include: { curso: true, historico: true },
  });
  assert.equal(reserva?.curso.codigo, "CC");
  assert.ok(reserva?.historico.some((h) => h.situacao === "APROVADA"));
  assert.ok(reserva?.historico.some((h) => h.situacao === "REPROVADA"));

  const demo = await call<Aluno>("POST", "/api/auth/login", {
    numeroMatricula: "DEMO2026",
    senha: "Demo@12345",
  });
  assert.equal(demo.status, 200);
  const progresso = await call<{ grupos: Array<{ tipo: string; integralizada: number; emCurso: number }> }>(
    "GET", "/api/progresso", undefined, demo.cookie,
  );
  assert.equal(progresso.status, 200);
  assert.equal(progresso.data.grupos.length, 3);
  assert.equal(progresso.data.grupos.find((g) => g.tipo === "obrigatoria")?.integralizada, 60);
  assert.equal(progresso.data.grupos.find((g) => g.tipo === "eletiva-perfil")?.integralizada, 60);
  const ofertasDemo = await call<Array<{ id: string; classificacao: string; jaAprovada: boolean; vagasDisponiveis: number }>>(
    "GET", "/api/turmas", undefined, demo.cookie,
  );
  assert.equal(ofertasDemo.status, 200);
  assert.equal(ofertasDemo.data.find((t) => t.id === "IP0001")?.jaAprovada, true);
  assert.equal(ofertasDemo.data.find((t) => t.id === "IP0003")?.vagasDisponiveis, 0);
  assert.equal(ofertasDemo.data.find((t) => t.id === "DS0001")?.classificacao, "eletiva-perfil");
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: demo.data.id, turmaId: "IP0001",
  }, demo.cookie)).status, 409);

  // Percentual nunca supera 100%; excedente de perfil deve contar como eletiva livre.
  await prisma.curso.update({
    where: { codigo: "SI" },
    data: { chObrigatorias: 15, chPerfil: 45, chLivre: 10 },
  });
  const limite = await call<{
    grupos: Array<{ tipo: string; integralizada: number; falta: number; percentual: number }>;
  }>("GET", "/api/progresso", undefined, demo.cookie);
  assert.equal(limite.status, 200);
  for (const grupo of limite.data.grupos) {
    assert.ok(grupo.percentual >= 0 && grupo.percentual <= 100);
    assert.ok(grupo.falta >= 0);
  }
  assert.equal(limite.data.grupos.find((g) => g.tipo === "eletiva-perfil")?.integralizada, 45);
  assert.equal(limite.data.grupos.find((g) => g.tipo === "eletiva-livre")?.integralizada, 10);

  // O nome do curso deve existir; texto arbitrário não cria um curso novo.
  assert.equal((await call("POST", "/api/auth/register", {
    nome: "Aluno Sem Curso", email: "semcurso@example.test", numeroMatricula: "SEM-CURSO",
    curso: "Curso Inexistente", senha: password,
  })).status, 400);

  const suffix = Date.now().toString(36);
  const a = await register(`a-${suffix}`);
  const b = await register(`b-${suffix}`);
  const c = await register(`c-${suffix}`);

  const classes = await call<Array<{ id: string }>>("GET", "/api/turmas", undefined, a.cookie);
  assert.equal(classes.status, 200);
  assert.ok(classes.data.some((t) => t.id === "IP0001"));

  assert.equal((await call("POST", "/api/auth/login", {
    numeroMatricula: a.numeroMatricula, senha: "Errada123",
  })).status, 401);
  const login = await call<Aluno>("POST", "/api/auth/login", {
    numeroMatricula: a.numeroMatricula, senha: password,
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.id, a.id);
  assert.ok(login.cookie.startsWith("matricula_session="));
  assert.equal((await call<Aluno>("GET", "/api/auth/me", undefined, login.cookie)).data.id, a.id);

  assert.equal((await call("GET", `/api/alunos/${b.id}`, undefined, a.cookie)).status, 403);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: b.id, turmaId: "IP0001",
  }, a.cookie)).status, 403);

  const first = await call<Matricula>("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "IP0001",
  }, a.cookie);
  assert.equal(first.status, 201);

  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "IP0001",
  }, a.cookie)).status, 409);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "IP0002",
  }, a.cookie)).status, 409);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "ED0001",
  }, a.cookie)).status, 409);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: 1,
  }, a.cookie)).status, 400);

  await prisma.turma.update({ where: { id: "ED0001" }, data: { capacidade: 1 } });
  const enrolledB = await call<Matricula>("POST", "/api/matriculas", {
    alunoId: b.id, turmaId: "ED0001",
  }, b.cookie);
  assert.equal(enrolledB.status, 201);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: c.id, turmaId: "ED0001",
  }, c.cookie)).status, 409);

  const waiting = await call<Espera>("POST", "/api/lista-espera", {
    alunoId: c.id, turmaId: "ED0001",
  }, c.cookie);
  assert.equal(waiting.status, 201);
  assert.equal((await call("GET", `/api/lista-espera?alunoId=${c.id}`, undefined, b.cookie)).status, 403);
  const canceled = await call<{ promovido: { alunoId: number } | null }>(
    "DELETE", `/api/matriculas/${enrolledB.data.id}`, { alunoId: b.id }, b.cookie,
  );
  assert.equal(canceled.status, 200);
  assert.equal(canceled.data.promovido?.alunoId, c.id);
  const finalEnrollments = await call<Matricula[]>(
    "GET", `/api/matriculas?alunoId=${c.id}`, undefined, c.cookie,
  );
  assert.ok(finalEnrollments.data.some((m) => m.turmaId === "ED0001"));
  const afterWait = await call<Espera[]>(
    "GET", `/api/lista-espera?alunoId=${c.id}`, undefined, c.cookie,
  );
  assert.equal(afterWait.data.length, 0);

  const cancelada = await prisma.matricula.findUnique({ where: { id: enrolledB.data.id } });
  assert.equal(cancelada?.situacao, "CANCELADA");
  assert.ok(cancelada?.canceladaEm);

  // Depois da entrada na fila, uma aprovação torna o primeiro candidato inelegível.
  const d = await register(`d-${suffix}`);
  const e = await register(`e-${suffix}`);
  assert.equal((await call("POST", "/api/lista-espera", {
    alunoId: d.id, turmaId: "ED0001",
  }, d.cookie)).status, 201);
  assert.equal((await call("POST", "/api/lista-espera", {
    alunoId: e.id, turmaId: "ED0001",
  }, e.cookie)).status, 201);
  const edoo = await prisma.disciplina.findUniqueOrThrow({ where: { codigo: "EDOO" } });
  await prisma.historico.create({
    data: { alunoId: d.id, disciplinaId: edoo.id, periodo: "2025.2", situacao: "APROVADA" },
  });
  const cMatricula = finalEnrollments.data.find((m) => m.turmaId === "ED0001");
  assert.ok(cMatricula);
  const segundaPromocao = await call<{ promovido: { alunoId: number } | null }>(
    "DELETE", `/api/matriculas/${cMatricula.id}`, { alunoId: c.id }, c.cookie,
  );
  assert.equal(segundaPromocao.status, 200);
  assert.equal(segundaPromocao.data.promovido?.alunoId, e.id);
  assert.equal((await call("GET", `/api/lista-espera?alunoId=${d.id}`, undefined, d.cookie))
    .status, 200);

  // Cancelar e depois reativar a mesma turma não perde a identidade do registro.
  await prisma.turma.update({ where: { id: "ED0001" }, data: { capacidade: 2 } });
  const readmitida = await call<Matricula>("POST", "/api/matriculas", {
    alunoId: c.id, turmaId: "ED0001",
  }, c.cookie);
  assert.equal(readmitida.status, 201);
  assert.equal(readmitida.data.id, cMatricula.id);

  assert.equal((await call("POST", "/api/auth/logout", undefined, a.cookie)).status, 204);
  assert.equal((await call("GET", "/api/auth/me", undefined, a.cookie)).status, 401);
  console.log("Smoke test passed: login, access controls, enrollment and waitlist.");
}

try {
  await run();
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await prisma.$disconnect();
}
