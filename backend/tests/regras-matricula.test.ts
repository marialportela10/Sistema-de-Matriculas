import assert from "node:assert/strict";
import test from "node:test";
import { impedimentoAcademico, impedimentoDeMatricula } from "../src/services/regras-matricula.js";

const turma = {
  id: "IP0001",
  disciplinaId: 1,
  capacidade: 2,
  horarios: [{ diaSemana: 1, inicio: "08:00", fim: "10:00" }],
};

test("accepts enrollment when there is capacity and no conflicts", () => {
  assert.equal(impedimentoDeMatricula(turma, [], 0), null);
});

test("rejects duplicate enrollment", () => {
  assert.equal(
    impedimentoAcademico(turma, [{
      turmaId: "IP0001",
      turma: { disciplinaId: 1, horarios: turma.horarios },
    }]),
    "Aluno ja matriculado nesta turma.",
  );
});

test("rejects a second class of the same course", () => {
  assert.equal(
    impedimentoAcademico(turma, [{
      turmaId: "IP0002",
      turma: { disciplinaId: 1, horarios: [] },
    }]),
    "Aluno ja matriculado nesta disciplina.",
  );
});

test("rejects schedule overlaps", () => {
  assert.equal(
    impedimentoAcademico(turma, [{
      turmaId: "ED0001",
      turma: { disciplinaId: 2, horarios: [{ diaSemana: 1, inicio: "09:00", fim: "11:00" }] },
    }]),
    "Conflito de horario com outra turma.",
  );
});

test("rejects full classes", () => {
  assert.equal(impedimentoDeMatricula(turma, [], 2), "Turma sem vagas disponiveis.");
});
