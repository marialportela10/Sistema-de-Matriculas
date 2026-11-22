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
