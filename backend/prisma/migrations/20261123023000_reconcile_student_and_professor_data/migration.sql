-- Reconcile existing test data with mandatory course and professor relations.
-- All students, class IDs, enrollment records, waitlists, histories and sessions remain intact.
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

INSERT OR IGNORE INTO "Curso" ("codigo","nome","chObrigatorias","chPerfil","chLivre")
VALUES ('SI','Sistemas de Informação',1800,600,180);
INSERT OR IGNORE INTO "Curso" ("codigo","nome","chObrigatorias","chPerfil","chLivre")
VALUES ('CC','Ciência da Computação',1950,480,180);
INSERT OR IGNORE INTO "Curso" ("codigo","nome","chObrigatorias","chPerfil","chLivre")
VALUES ('PENDENTE','Curso não informado',0,0,0);

-- Legacy custom course names are retained as distinct placeholder courses, not silently changed to SI.
INSERT OR IGNORE INTO "Curso" ("codigo","nome","chObrigatorias","chPerfil","chLivre")
SELECT 'LEGADO-' || MIN(a."id"), TRIM(a."curso"), 0, 0, 0
FROM "Aluno" a
WHERE a."curso" IS NOT NULL AND TRIM(a."curso") <> ''
  AND NOT EXISTS (SELECT 1 FROM "Curso" c WHERE c."nome" = TRIM(a."curso"))
GROUP BY TRIM(a."curso");

CREATE TABLE "new_Aluno" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "numeroMatricula" TEXT NOT NULL,
  "senhaHash" TEXT,
  "cursoId" INTEGER NOT NULL,
  CONSTRAINT "Aluno_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Aluno" ("id","nome","email","numeroMatricula","senhaHash","cursoId")
SELECT a."id",a."nome",a."email",a."numeroMatricula",a."senhaHash",
  COALESCE((SELECT c."id" FROM "Curso" c WHERE c."nome"=NULLIF(TRIM(a."curso"),'')),
           (SELECT c."id" FROM "Curso" c WHERE c."codigo"='PENDENTE'))
FROM "Aluno" a;
DROP TABLE "Aluno";
ALTER TABLE "new_Aluno" RENAME TO "Aluno";
CREATE UNIQUE INDEX "Aluno_email_key" ON "Aluno"("email");
CREATE UNIQUE INDEX "Aluno_numeroMatricula_key" ON "Aluno"("numeroMatricula");

CREATE TABLE "Professor" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL
);
CREATE UNIQUE INDEX "Professor_email_key" ON "Professor"("email");
INSERT INTO "Professor" ("nome","email")
SELECT professores."nome",
       'professor-' || PRINTF('%04d', ROW_NUMBER() OVER (ORDER BY professores."nome")) || '@example.test'
FROM (
 SELECT DISTINCT COALESCE(NULLIF(TRIM("professor"),''),'Professor a definir') AS "nome"
 FROM "Turma"
) professores;

CREATE TABLE "new_Turma" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codigo" TEXT NOT NULL,
  "periodo" TEXT NOT NULL,
  "capacidade" INTEGER NOT NULL,
  "disciplinaId" INTEGER NOT NULL,
  "professorId" INTEGER NOT NULL,
  CONSTRAINT "Turma_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Turma_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Turma" ("id","codigo","periodo","capacidade","disciplinaId","professorId")
SELECT t."id", t."codigo", t."periodo", t."capacidade", t."disciplinaId",
  (SELECT p."id" FROM "Professor" p
   WHERE p."nome"=COALESCE(NULLIF(TRIM(t."professor"),''),'Professor a definir'))
FROM "Turma" t;
DROP TABLE "Turma";
ALTER TABLE "new_Turma" RENAME TO "Turma";
CREATE UNIQUE INDEX "Turma_disciplinaId_codigo_periodo_key" ON "Turma"("disciplinaId","codigo","periodo");
CREATE INDEX "Turma_professorId_idx" ON "Turma"("professorId");

ALTER TABLE "Matricula" ADD COLUMN "situacao" TEXT NOT NULL DEFAULT 'ATIVA';
ALTER TABLE "Matricula" ADD COLUMN "canceladaEm" DATETIME;

COMMIT;
PRAGMA foreign_keys=ON;
