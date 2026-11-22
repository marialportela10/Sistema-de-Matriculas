-- Existing students keep their records, but must set a password using a controlled process.
-- New demo accounts can register through /api/auth/register.
ALTER TABLE "Aluno" ADD COLUMN "senhaHash" TEXT;

CREATE TABLE "Sessao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenHash" TEXT NOT NULL,
    "alunoId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sessao_alunoId_fkey" FOREIGN KEY ("alunoId")
        REFERENCES "Aluno" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");
CREATE INDEX "Sessao_alunoId_idx" ON "Sessao"("alunoId");
CREATE INDEX "Sessao_expiresAt_idx" ON "Sessao"("expiresAt");
