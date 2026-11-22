-- Preserve classes and related records while converting numeric IDs to AA0000 codes.
-- Codes use the first two letters of the discipline code, numbered by old class ID.
PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE "_TurmaIdMap" (
  "oldId" INTEGER NOT NULL PRIMARY KEY,
  "newId" TEXT NOT NULL UNIQUE
);

INSERT INTO "_TurmaIdMap" ("oldId", "newId")
SELECT
  t."id",
  SUBSTR(UPPER(d."codigo"), 1, 2) || PRINTF('%04d',
    ROW_NUMBER() OVER (
      PARTITION BY SUBSTR(UPPER(d."codigo"), 1, 2)
      ORDER BY t."id"
    )
  )
FROM "Turma" t
JOIN "Disciplina" d ON d."id" = t."disciplinaId";

CREATE TABLE "new_Turma" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codigo" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "capacidade" INTEGER NOT NULL,
  "professor" TEXT,
  "disciplinaId" INTEGER NOT NULL,
  CONSTRAINT "Turma_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Turma" ("id", "codigo", "periodo", "capacidade", "professor", "disciplinaId")
SELECT m."newId", t."codigo", t."periodo", t."capacidade", t."professor", t."disciplinaId"
FROM "Turma" t JOIN "_TurmaIdMap" m ON m."oldId" = t."id";

CREATE TABLE "new_HorarioTurma" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "diaSemana" INTEGER NOT NULL,
  "inicio" TEXT NOT NULL,
  "fim" TEXT NOT NULL,
  "turmaId" TEXT NOT NULL,
  CONSTRAINT "HorarioTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_HorarioTurma" ("id", "diaSemana", "inicio", "fim", "turmaId")
SELECT h."id", h."diaSemana", h."inicio", h."fim", m."newId"
FROM "HorarioTurma" h JOIN "_TurmaIdMap" m ON m."oldId" = h."turmaId";

CREATE TABLE "new_Matricula" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "alunoId" INTEGER NOT NULL,
  "turmaId" TEXT NOT NULL,
  "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Matricula_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Matricula_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Matricula" ("id", "alunoId", "turmaId", "criadaEm")
SELECT e."id", e."alunoId", m."newId", e."criadaEm"
FROM "Matricula" e JOIN "_TurmaIdMap" m ON m."oldId" = e."turmaId";

CREATE TABLE "new_ListaEspera" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "alunoId" INTEGER NOT NULL,
  "turmaId" TEXT NOT NULL,
  "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListaEspera_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ListaEspera_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ListaEspera" ("id", "alunoId", "turmaId", "criadaEm")
SELECT e."id", e."alunoId", m."newId", e."criadaEm"
FROM "ListaEspera" e JOIN "_TurmaIdMap" m ON m."oldId" = e."turmaId";

DROP TABLE "HorarioTurma";
DROP TABLE "Matricula";
DROP TABLE "ListaEspera";
DROP TABLE "Turma";

ALTER TABLE "new_Turma" RENAME TO "Turma";
ALTER TABLE "new_HorarioTurma" RENAME TO "HorarioTurma";
ALTER TABLE "new_Matricula" RENAME TO "Matricula";
ALTER TABLE "new_ListaEspera" RENAME TO "ListaEspera";

CREATE UNIQUE INDEX "Turma_disciplinaId_codigo_periodo_key" ON "Turma"("disciplinaId", "codigo", "periodo");
CREATE UNIQUE INDEX "Matricula_alunoId_turmaId_key" ON "Matricula"("alunoId", "turmaId");
CREATE UNIQUE INDEX "ListaEspera_alunoId_turmaId_key" ON "ListaEspera"("alunoId", "turmaId");

DROP TABLE "_TurmaIdMap";

COMMIT;
PRAGMA foreign_keys=ON;
