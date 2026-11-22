-- Existing students, classes, enrollments and sessions are not modified.
CREATE TABLE "Curso" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "chObrigatorias" INTEGER NOT NULL,
  "chPerfil" INTEGER NOT NULL,
  "chLivre" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "Curso_codigo_key" ON "Curso"("codigo");
CREATE UNIQUE INDEX "Curso_nome_key" ON "Curso"("nome");

CREATE TABLE "CurriculoDisciplina" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "cursoId" INTEGER NOT NULL,
  "disciplinaId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  CONSTRAINT "CurriculoDisciplina_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CurriculoDisciplina_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CurriculoDisciplina_cursoId_disciplinaId_key" ON "CurriculoDisciplina"("cursoId", "disciplinaId");
CREATE INDEX "CurriculoDisciplina_disciplinaId_idx" ON "CurriculoDisciplina"("disciplinaId");

CREATE TABLE "Historico" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "alunoId" INTEGER NOT NULL,
  "disciplinaId" INTEGER NOT NULL,
  "periodo" TEXT NOT NULL,
  "situacao" TEXT NOT NULL,
  CONSTRAINT "Historico_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Historico_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Historico_alunoId_disciplinaId_periodo_key" ON "Historico"("alunoId","disciplinaId","periodo");
CREATE INDEX "Historico_alunoId_situacao_idx" ON "Historico"("alunoId","situacao");
