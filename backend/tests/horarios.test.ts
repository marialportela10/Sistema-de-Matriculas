import assert from "node:assert/strict";
import test from "node:test";
import { horariosConflitam } from "../src/services/horarios.js";

test("rejects overlapping classes on the same day", () => {
  assert.equal(
    horariosConflitam(
      [{ diaSemana: 1, inicio: "08:00", fim: "10:00" }],
      [{ diaSemana: 1, inicio: "09:00", fim: "11:00" }],
    ),
    true,
  );
});

test("allows classes back to back", () => {
  assert.equal(
    horariosConflitam(
      [{ diaSemana: 1, inicio: "08:00", fim: "10:00" }],
      [{ diaSemana: 1, inicio: "10:00", fim: "12:00" }],
    ),
    false,
  );
});

test("allows the same time on different days", () => {
  assert.equal(
    horariosConflitam(
      [{ diaSemana: 1, inicio: "08:00", fim: "10:00" }],
      [{ diaSemana: 2, inicio: "08:00", fim: "10:00" }],
    ),
    false,
  );
});
