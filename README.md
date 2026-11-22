# Sistema de Matrícula

Protótipo acadêmico em desenvolvimento, com **React + Vite + TypeScript** no frontend e **Express + Prisma 7 + SQLite** no backend.

## O que já funciona no código

- Consulta de disciplinas, turmas, horários e vagas.
- Login com número de matrícula e senha (hash scrypt), sessões em cookie HttpOnly, logout e cadastro de contas fictícias.
- Consultas e operações de matrícula vinculadas ao aluno autenticado.
- Matrícula com validação de vagas, duplicidade, disciplina já cursada no mesmo período, conflito de horários e aprovação anterior (permite refazer disciplinas reprovadas).
- Cancelamento de matrícula com tentativa de promoção da lista de espera.
- Entrada, consulta e saída da lista de espera.
- Portal do aluno baseado no protótipo `prototipo-matricula-5-abas-perfil.html`, com **cinco abas**: **Visão geral**, **Fazer matrícula**, **Lista de espera**, **Disciplinas** e **Carga horária**.
- Grade semanal acima das ofertas: turmas selecionadas aparecem imediatamente e conflitos de horário ou disciplina são bloqueados; revisão antes de confirmar.
- Catálogo de disciplinas com ementas, favoritos por aluno e busca/paginação na URL.
- Cabeçalho com nome completo, curso e semestre do aluno. Cadastro fictício permite escolher curso.
- Estruturas curriculares diferentes para Sistemas de Informação e Ciência da Computação, com classificação por curso e cálculo de progresso por aprovações, eletivas de perfil excedentes e horas em curso.
- Testes unitários para IDs de turmas, conflitos de horário e regras acadêmicas.

> **Importante:** esta autenticação é adequada apenas para testar o protótipo local. Ainda faltam recuperação de senha, integração com identidade institucional, controles operacionais mais fortes e auditoria para uso real. Não utilize dados pessoais reais.

## Identificadores de turmas

As turmas usam dois caracteres maiúsculos seguidos de quatro números: `IP0001`, `IP0002`, `ED0001`. O campo `codigo` continua identificando a seção (A, B, C). IDs de alunos permanecem numéricos.

A migração `20261122190000_class_string_ids` converte os antigos IDs numéricos e atualiza os vínculos de horários, matrículas e lista de espera. **Antes de migrar um banco existente, pare a API e faça um backup do arquivo `.db`.** Nunca use `prisma migrate reset` para essa atualização.

## Executar localmente (Windows / PowerShell)

Requer Node.js 24 LTS ou compatível.

### API

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env  # apenas na primeira execução
npx.cmd prisma migrate dev
npx.cmd prisma generate
npm.cmd run db:seed
npm.cmd run dev
```

A API fica disponível em `http://localhost:3001`. Se o banco já existir, faça uma cópia de segurança antes de aplicar as migrações. A migração `20261122213000_student_sessions` cria sessões e preserva os alunos antigos sem atribuir senha padrão; a migração `20261122234500_student_course_and_syllabus` adiciona curso opcional aos alunos e ementa às disciplinas; a migração `20261123010000_curriculum_history` adiciona estruturas curriculares e histórico de aprovações/reprovações. Nenhuma dessas migrações apaga registros.

**Atualizar um banco existente:** pare o backend, faça backup de `backend/prisma/dev.db`, execute `npx.cmd prisma migrate deploy` dentro de `backend`, depois `npx.cmd prisma generate` e `npm.cmd run db:seed`. O seed é idempotente e adiciona 2 cursos, 6 disciplinas, 10 ofertas fictícias (incluindo uma lotada) e históricos de demonstração, sem remover turmas já cadastradas.

**Para entrar pela primeira vez:** abra o frontend, clique em **Criar conta**, informe nome completo, curso, matrícula fictícia e senha de pelo menos 8 caracteres; depois use esses dados no formulário **Entrar no sistema**. Contas criadas antes desta mudança não têm senha e não podem usar o login até que recebam uma senha por um procedimento administrativo. Não foi atribuída nenhuma senha padrão a esses alunos.

**Conta pronta para comparar a interface com o protótipo (apenas ambiente local):** matrícula fictícia `DEMO2026`, senha `Demo@12345`. Essa conta representa Ana Carolina Ferreira (Sistemas de Informação) e contém aprovações/reprovação de exemplo para demonstrar as barras de carga horária e o bloqueio de disciplina já aprovada. Não use essas credenciais em uma instalação pública.

Para validar o backend:

```powershell
npm.cmd run build
npm.cmd test
```

### Interface

Em outro terminal, na raiz do repositório:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:5173`. A API deve estar em execução. Para usar outro servidor, configure `VITE_API_URL` no ambiente do frontend.

### Rotas principais

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/health` | Estado da API |
| POST | `/api/auth/register` | Criar conta fictícia com senha |
| POST | `/api/auth/login` | Entrar com número de matrícula e senha |
| GET | `/api/auth/me` | Verificar sessão |
| POST | `/api/auth/logout` | Encerrar sessão |
| GET | `/api/disciplinas` | Disciplinas |
| GET | `/api/turmas` | Turmas, vagas, categoria por curso e disciplina já aprovada |
| GET | `/api/progresso` | Carga horária exigida, concluída, em curso e restante por grupo |
| GET | `/api/alunos/:id` | Consulta de aluno de teste |
| GET | `/api/matriculas?alunoId=1` | Matrículas do aluno |
| POST | `/api/matriculas` | Criar matrícula |
| DELETE | `/api/matriculas/:id` | Cancelar matrícula |
| GET | `/api/lista-espera?alunoId=1` | Esperas do aluno |
| POST | `/api/lista-espera` | Entrar na lista |
| DELETE | `/api/lista-espera/:id` | Sair da lista |

Exceto saúde e autenticação, as rotas exigem a sessão do aluno. Para criar uma matrícula ou entrar na lista de espera, envie um JSON como:

```json
{ "alunoId": 1, "turmaId": "IP0001" }
```

Para cancelar uma matrícula ou sair da lista, envie `{ "alunoId": 1 }` no corpo da requisição DELETE.

## Organização do Git

- `main`: versão principal.
- `feat/enrollment-system`: desenvolvimento das funcionalidades de matrícula.
- Commits em inglês, com prefixos `setup:`, `feat:`, `fix:` e `docs:`.

Esta branch de desenvolvimento está sendo atualizada no GitHub. O GitLab da UFPE não recebe automaticamente esses commits; faça o sincronismo depois de revisar e testar.

## Requisito adicional e progresso acadêmico

Foi escolhida a **verificação de choque de horários**, pois ela evita matrículas impossíveis e melhora a seleção visual na grade semanal. Turmas cujos horários se sobrepõem não podem ser selecionadas juntas, e o backend também recusa a operação.

A aba **Carga horária** usa as metas da estrutura curricular cadastrada para o curso do aluno. Conta apenas disciplinas **aprovadas** no histórico como integralizadas, ignora reprovações e mostra as matrículas atuais separadamente. Horas de eletivas de perfil aprovadas acima da meta podem ser aproveitadas como eletivas livres. Os percentuais são limitados a 100% e as horas restantes nunca são negativas.

Os cursos, metas e históricos fornecidos pelo seed são **fictícios para avaliação técnica**, não reproduzem necessariamente a matriz curricular oficial da UFPE. A área da Secretaria (cadastro de professores, alteração de vagas e gestão de turmas) continua pendente.

## Próximas etapas

Recuperação de senha e identidade institucional, telas e permissões da secretaria, importação de currículos oficiais, testes de concorrência e revisão final de acessibilidade.
