-- Independent secretary identity; no student session can access it.
CREATE TABLE "UsuarioSecretaria" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "usuario" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senhaHash" TEXT NOT NULL
);
CREATE UNIQUE INDEX "UsuarioSecretaria_usuario_key" ON "UsuarioSecretaria"("usuario");
CREATE UNIQUE INDEX "UsuarioSecretaria_email_key" ON "UsuarioSecretaria"("email");
