import assert from "node:assert/strict";
import test from "node:test";
import { validarCargaHoraria, validarProfessor, validarVagas } from "../src/services/validacoes-cadastro.js";

test("disciplines accept only multiples of 15 between 15 and 120 hours", () => {
  for (const n of [15, 30, 45, 60, 75, 90, 105, 120]) assert.equal(validarCargaHoraria(n), null);
  for (const n of [0, 14, 16, 70, 121, -15, 15.5, "60", null]) {
    assert.ok(validarCargaHoraria(n));
  }
});

test("a class needs at least one seat and cannot be reduced below active enrollments", () => {
  assert.equal(validarVagas(1, 0), null);
  assert.equal(validarVagas(4, 4), null);
  assert.ok(validarVagas(0, 0));
  assert.ok(validarVagas(3, 4));
  assert.ok(validarVagas(-1, 0));
  assert.ok(validarVagas(4.5, 0));
});

test("professor records require a valid email and a name", () => {
  assert.equal(validarProfessor("Professor Teste", "teste@example.com"), null);
  assert.ok(validarProfessor("", "teste@example.com"));
  assert.ok(validarProfessor("Professor Teste", "e-mail inválido"));
});
