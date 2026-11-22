import assert from "node:assert/strict";
import { app } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";

const servidor = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve, reject) => {
  if (servidor.listening) return resolve();
  servidor.once("listening", resolve);
  servidor.once("error", reject);
});
const endereco = servidor.address();
if (!endereco || typeof endereco === "string") throw new Error("Servidor indisponível");
const base = "http://127.0.0.1:" + endereco.port;

async function call<T = Record<string, unknown>>(method: string, path: string,
  data?: Record<string, unknown>, cookie?: string) {
  const res = await fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { status: res.status, data: (res.status === 204 ? null : await res.json()) as T,
    cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

type Conta = { id: number; usuario: string; perfil: string };
type Lista<T> = { items: T[]; total: number; pagina: number; totalPaginas: number };
type Disciplina = { id: number; codigo: string; nome: string; cargaHoraria: number };
type Professor = { id: number; nome: string; email: string };
type Turma = { id: string; codigo: string; capacidade: number; ocupadas: number;
  vagasDisponiveis: number; disciplinaId: number; professorId: number };
type Aluno = { id: number; numeroMatricula: string };

async function run() {
  assert.equal((await call("GET", "/api/admin/disciplinas")).status, 401);
  assert.equal((await call("POST", "/api/admin/auth/login", {
    usuario: "secretaria.demo", senha: "errada",
  })).status, 401);

  const acesso = await call<Conta>("POST", "/api/admin/auth/login", {
    usuario: "secretaria.demo", senha: "Secretaria@12345",
  });
  assert.equal(acesso.status, 200);
  assert.equal(acesso.data.perfil, "secretaria");
  assert.ok(acesso.cookie.startsWith("matricula_admin_session="));
  const adminCookie = acesso.cookie;
  assert.equal((await call("GET", "/api/admin/auth/me", undefined, adminCookie)).status, 200);
  assert.equal((await call("GET", "/api/turmas", undefined, adminCookie)).status, 401);

  const alunoLogin = await call<Aluno>("POST", "/api/auth/login", {
    numeroMatricula: "DEMO2026", senha: "Demo@12345",
  });
  assert.equal(alunoLogin.status, 200);
  assert.equal((await call("GET", "/api/admin/professores", undefined, alunoLogin.cookie)).status, 401);
  assert.equal((await call("GET", "/api/turmas", undefined, alunoLogin.cookie)).status, 200);

  const sufixo = Date.now().toString(36).toUpperCase();
  const codigo = "T" + sufixo.replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const invalidCh = await call("POST", "/api/admin/disciplinas",
    { codigo, nome: "Curso Teste", cargaHoraria: 70 }, adminCookie);
  assert.equal(invalidCh.status, 400);
  const criada = await call<Disciplina>("POST", "/api/admin/disciplinas", {
    codigo, nome: "Disciplina administrativa de teste", cargaHoraria: 45, ementa: "Exercício de cadastro.",
  }, adminCookie);
  assert.equal(criada.status, 201);
  assert.equal(criada.data.cargaHoraria, 45);
  assert.equal((await call("POST", "/api/admin/disciplinas", {
    codigo, nome: "Duplicada", cargaHoraria: 45,
  }, adminCookie)).status, 409);
  assert.equal((await call("PUT", "/api/admin/disciplinas/" + criada.data.id, {
    codigo, nome: "Editada", cargaHoraria: 13,
  }, adminCookie)).status, 400);
  const editada = await call<Disciplina>("PUT", "/api/admin/disciplinas/" + criada.data.id, {
    codigo, nome: "Disciplina atualizada", cargaHoraria: 60, ementa: "",
  }, adminCookie);
  assert.equal(editada.status, 200);
  assert.equal(editada.data.nome, "Disciplina atualizada");

  const pesquisa = await call<Lista<Disciplina>>("GET",
    "/api/admin/disciplinas?busca=" + encodeURIComponent(codigo) + "&pagina=1",
    undefined, adminCookie);
  assert.equal(pesquisa.status, 200);
  assert.ok(pesquisa.data.items.some((d) => d.codigo === codigo));
  assert.equal(pesquisa.data.pagina, 1);
  assert.equal((await call("GET", "/api/admin/disciplinas?busca=inexistente-xyz",
    undefined, adminCookie)).status, 200);

  assert.equal((await call("POST", "/api/admin/professores", {
    nome: "Professora Teste", email: "inválido",
  }, adminCookie)).status, 400);
  const email = "prof-" + sufixo.toLowerCase() + "@example.test";
  const novaProfessora = await call<Professor>("POST", "/api/admin/professores", {
    nome: "Professora de Testes", email,
  }, adminCookie);
  assert.equal(novaProfessora.status, 201);
  assert.equal((await call("POST", "/api/admin/professores", {
    nome: "Duplicado", email,
  }, adminCookie)).status, 409);
  const opcoes = await call<{ disciplinas: Disciplina[]; professores: Professor[] }>(
    "GET", "/api/admin/opcoes", undefined, adminCookie);
  assert.ok(opcoes.data.disciplinas.some((d) => d.id === criada.data.id));
  assert.ok(opcoes.data.professores.some((p) => p.id === novaProfessora.data.id));

  const turmaDados = {
    disciplinaId: criada.data.id, professorId: novaProfessora.data.id,
    codigo: "A", capacidade: 2,
    horarios: [{ diaSemana: 2, inicio: "18:00", fim: "20:00" }],
  };
  assert.equal((await call("POST", "/api/admin/turmas", {
    ...turmaDados, capacidade: 0,
  }, adminCookie)).status, 400);
  assert.equal((await call("POST", "/api/admin/turmas", {
    ...turmaDados, professorId: 999999,
  }, adminCookie)).status, 404);
  assert.equal((await call("POST", "/api/admin/turmas", {
    ...turmaDados, horarios: [{ diaSemana: 8, inicio: "10:00", fim: "12:00" }],
  }, adminCookie)).status, 400);
  for (const invalida of ["AB", "12", "A123", "A1B", ""]) {
    assert.equal((await call("POST", "/api/admin/turmas", {
      ...turmaDados, codigo: invalida,
    }, adminCookie)).status, 400, "Turma inválida: " + invalida);
  }
  const turma = await call<Turma>("POST", "/api/admin/turmas", turmaDados, adminCookie);
  assert.equal(turma.status, 201);
  assert.match(turma.data.id, /^[A-Z]{2}\d{4}$/);
  assert.equal(turma.data.capacidade, 2);
  assert.equal((await call("POST", "/api/admin/turmas", turmaDados, adminCookie)).status, 409);
  // Também aceita letra + 1 número ou letra + 2 números; normaliza minúsculas.
  const comNumero = await call<Turma>("POST", "/api/admin/turmas", {
    ...turmaDados, codigo: "B1",
  }, adminCookie);
  assert.equal(comNumero.status, 201);
  assert.equal(comNumero.data.codigo, "B1");
  const comDoisNumeros = await call<Turma>("POST", "/api/admin/turmas", {
    ...turmaDados, codigo: "c12",
  }, adminCookie);
  assert.equal(comDoisNumeros.status, 201);
  assert.equal(comDoisNumeros.data.codigo, "C12");
  assert.equal((await call("POST", "/api/admin/turmas", {
    ...turmaDados, codigo: "a",
  }, adminCookie)).status, 409);


  const aluno = await call<Aluno>("POST", "/api/auth/register", {
    nome: "Aluno Admin Smoke", email: "aluno-" + sufixo.toLowerCase() + "@example.test",
    numeroMatricula: "ADMSMOKE-" + sufixo, senha: "TesteForte123!",
    curso: "Sistemas de Informação",
  });
  assert.equal(aluno.status, 201);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: aluno.data.id, turmaId: turma.data.id,
  }, aluno.cookie)).status, 201);

  assert.equal((await call("PUT", "/api/admin/turmas/" + turma.data.id + "/vagas", {
    capacidade: 0,
  }, adminCookie)).status, 400);
  assert.equal((await call("PUT", "/api/admin/turmas/" + turma.data.id + "/vagas", {
    capacidade: 1,
  }, adminCookie)).status, 200);

  const aluno2 = await call<Aluno>("POST", "/api/auth/register", {
    nome: "Segundo Aluno", email: "aluno2-" + sufixo.toLowerCase() + "@example.test",
    numeroMatricula: "ADMSMOKE2-" + sufixo, senha: "TesteForte123!",
    curso: "Ciência da Computação",
  });
  assert.equal(aluno2.status, 201);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: aluno2.data.id, turmaId: turma.data.id,
  }, aluno2.cookie)).status, 409);
  assert.equal((await call("PUT", "/api/admin/turmas/" + turma.data.id + "/vagas", {
    capacidade: 2,
  }, adminCookie)).status, 200);
  assert.equal((await call("POST", "/api/matriculas", {
    alunoId: aluno2.data.id, turmaId: turma.data.id,
  }, aluno2.cookie)).status, 201);
  assert.equal((await call("PUT", "/api/admin/turmas/" + turma.data.id + "/vagas", {
    capacidade: 1,
  }, adminCookie)).status, 400);
  const listTurmas = await call<Lista<Turma>>("GET", "/api/admin/turmas?busca=" + turma.data.id,
    undefined, adminCookie);
  assert.equal(listTurmas.status, 200);
  const ocupacao = listTurmas.data.items.find((t) => t.id === turma.data.id);
  assert.equal(ocupacao?.ocupadas, 2);
  assert.equal(ocupacao?.vagasDisponiveis, 0);

  assert.equal((await call("PUT", "/api/admin/turmas/" + turma.data.id + "/vagas", {
    capacidade: 3,
  }, aluno.cookie)).status, 401);
  assert.equal((await call("POST", "/api/admin/auth/logout", undefined, adminCookie)).status, 204);
  assert.equal((await call("GET", "/api/admin/auth/me", undefined, adminCookie)).status, 401);
  console.log("Admin smoke passed: profiles, course data, teachers, classes and seat limits.");
}

try {
  await run();
} finally {
  await new Promise<void>((resolve, reject) =>
    servidor.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
