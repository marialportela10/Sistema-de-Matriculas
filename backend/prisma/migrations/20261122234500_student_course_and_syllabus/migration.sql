-- Preserve existing student, discipline and enrollment records.
ALTER TABLE "Aluno" ADD COLUMN "curso" TEXT;
ALTER TABLE "Disciplina" ADD COLUMN "ementa" TEXT;
