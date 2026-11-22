import assert from "node:assert/strict";
import test from "node:test";
import { idTurmaValido } from "../src/services/ids.js";

test("accepts a class id with two uppercase letters and four numbers", () => {
  assert.equal(idTurmaValido("IP0001"), true);
  assert.equal(idTurmaValido("ED0123"), true);
});

test("rejects invalid class ids", () => {
  for (const id of ["A0001", "IP001", "IP00001", "ip0001", "I10001", "IP00A1", 1, null, ""]) {
    assert.equal(idTurmaValido(id), false);
  }
});
