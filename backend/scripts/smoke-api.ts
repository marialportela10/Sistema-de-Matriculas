import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";

// HTTP smoke test against the CI SQLite database. Never run on real student data.
const servidor = app.listen(0, "127.0.0.1");
const endereco = servidor.address();
if (!endereco || typeof endereco === "string") {
  throw new Error("Nao foi possivel abrir uma porta de testes.");
}
const base = `http://127.0.0.1:${endereco.port}`;

type Resultado<T = Record<string, unknown>> = { status: number; data: T };

async function chamar<T = Record<string, unknown>>(
  metodo: string,
  rota: string,
  corpo?: Record<string, unknown>,
): Promise<Resultado<T>> {
  const response = await fetch(`${base}${rota}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data: data as T };
}

type Aluno = { id: number };
type Matricula = { id: number; alunoId: number; turmaId: string };
type Espera = { id: number; alunoId: number; turmaId: string };

async function criarAluno(numero: string): Promise<Aluno> {
  const resposta = await chamar<Aluno>("POST", "/api/alunos", {
    nome: `Aluno Teste ${numero}`,
    email: `teste-${numero}@example.com`,
    numeroMatricula: `TESTE-${numero}`,
  });
  assert.equal(resposta.status, 201);
  return resposta.data;
}

async function testar() {
  const health = await chamar("GET", "/api/health");
  assert.equal(health.status, 200);

  const ofertas = await chamar<Array<{ id: string; vagasDisponiveis: number }>>(
    "GET", "/api/turmas",
  );
  assert.equal(ofertas.status, 200);
  assert.ok(ofertas.data.some((t) => t.id === "IP0001"));
  assert.ok(ofertas.data.some((t) => t.id === "ED0001"));

  const sufixo = Date.now().toString(36);
  const a = await criarAluno(`a-${sufixo}`);
  const b = await criarAluno(`b-${sufixo}`);
  const c = await criarAluno(`c-${sufixo}`);

  const primeira = await chamar<Matricula>("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "IP0001",
  });
  assert.equal(primeira.status, 201);

  const duplicada = await chamar("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "IP0001",
  });
  assert.equal(duplicada.status, 409);

  const disciplinaDuplicada = await chamar("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "IP0002",
  });
  assert.equal(disciplinaDuplicada.status, 409);

  const choque = await chamar("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: "ED0001",
  });
  assert.equal(choque.status, 409);

  const idInvalido = await chamar("POST", "/api/matriculas", {
    alunoId: a.id, turmaId: 1,
  });
  assert.equal(idInvalido.status, 400);

  await prisma.turma.update({ where: { id: "ED0001" }, data: { capacidade: 1 } });

  const matriculaB = await chamar<Matricula>("POST", "/api/matriculas", {
    alunoId: b.id, turmaId: "ED0001",
  });
  assert.equal(matriculaB.status, 201);

  const lotada = await chamar("POST", "/api/matriculas", {
    alunoId: c.id, turmaId: "ED0001",
  });
  assert.equal(lotada.status, 409);

  const espera = await chamar<Espera>("POST", "/api/lista-espera", {
    alunoId: c.id, turmaId: "ED0001",
  });
  assert.equal(espera.status, 201);

  const cancelamento = await chamar<{
    promovido: { alunoId: number; matriculaId: number } | null;
  }>("DELETE", `/api/matriculas/${matriculaB.data.id}`, { alunoId: b.id });
  assert.equal(cancelamento.status, 200);
  assert.equal(cancelamento.data.promovido?.alunoId, c.id);

  const matriculasC = await chamar<Matricula[]>("GET", `/api/matriculas?alunoId=${c.id}`);
  assert.equal(matriculasC.status, 200);
  assert.ok(matriculasC.data.some((m) => m.turmaId === "ED0001"));

  const esperaC = await chamar<Espera[]>("GET", `/api/lista-espera?alunoId=${c.id}`);
  assert.equal(esperaC.status, 200);
  assert.equal(esperaC.data.length, 0);

  console.log("HTTP smoke test passou: matriculas, bloqueios e promocao da fila.");
}

try {
  await testar();
} finally {
  await new Promise<void>((resolve, reject) => {
    servidor.close((error) => error ? reject(error) : resolve());
  });
  await prisma.$disconnect();
}
