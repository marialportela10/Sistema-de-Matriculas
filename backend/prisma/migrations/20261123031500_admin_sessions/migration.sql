CREATE TABLE "SessaoSecretaria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenHash" TEXT NOT NULL,
    "secretariaId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessaoSecretaria_secretariaId_fkey" FOREIGN KEY ("secretariaId")
      REFERENCES "UsuarioSecretaria" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SessaoSecretaria_tokenHash_key" ON "SessaoSecretaria"("tokenHash");
CREATE INDEX "SessaoSecretaria_secretariaId_idx" ON "SessaoSecretaria"("secretariaId");
CREATE INDEX "SessaoSecretaria_expiresAt_idx" ON "SessaoSecretaria"("expiresAt");
