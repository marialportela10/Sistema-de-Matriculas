# Sistema de Matrícula

Sistema de matrícula acadêmica desenvolvido para o teste prático da Seleção nº 5/2026. O portal permite consultar ofertas, montar a grade semanal, efetuar matrículas e acompanhar a carga horária do curso.

## Portal do aluno

| Aba | O que é possível fazer |
| --- | --- |
| Visão geral | Conferir o resumo do semestre e as matrículas ativas. |
| Fazer matrícula | Consultar turmas, horários e vagas, visualizar as escolhas na grade semanal e revisar a seleção antes de confirmar. |
| Lista de espera | Entrar na fila de uma turma lotada, acompanhar a solicitação e sair da fila. |
| Disciplinas | Buscar disciplinas, ler ementas e salvar favoritas. |
| Carga horária | Conferir as horas exigidas, concluídas, em curso e restantes por categoria curricular. |

O cadastro solicita nome, curso, número de matrícula e senha. O curso é vinculado ao aluno e pode ser consultado a partir da matrícula acadêmica pela relação `Matricula → Aluno → Curso`.

### Regras de matrícula

- A API verifica vagas, duplicidade, choque de horários, matrícula em outra turma da mesma disciplina no período e aprovação anterior. Uma disciplina reprovada pode ser cursada novamente.
- O cancelamento libera a vaga. Se houver lista de espera, o sistema revalida a elegibilidade antes de efetivar a promoção.
- A carga horária concluída considera as aprovações do histórico. As disciplinas em andamento aparecem separadamente, e o excedente de eletivas de perfil pode contar como eletiva livre.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React, TypeScript e Vite |
| API | Node.js, Express e TypeScript |
| Banco de dados | SQLite e Prisma |
| Autenticação | Senhas com hash scrypt e sessões em cookies HttpOnly |

## Executar localmente

Use Node.js 24 LTS e npm. No PowerShell, use `npm.cmd` nos comandos se a política de execução bloquear `npm.ps1`.

```bash
git clone https://github.com/marialportela10/Sistema-de-Matriculas.git
cd Sistema-de-Matriculas
```

### 1. API e banco de dados

Na raiz do projeto, entre em `backend` e instale as dependências.

```bash
cd backend
npm ci
```

Na primeira execução, copie `.env.example` para `.env` dentro de `backend`. Use `cp .env.example .env` no Bash ou `Copy-Item .env.example .env` no PowerShell. O exemplo aponta para o SQLite local em `backend/prisma/dev.db`.

```bash
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```

A API roda em [localhost:3001](http://localhost:3001/api/health). Para atualizar um banco existente, pare a API, faça uma cópia do arquivo `.db` e execute `npx prisma migrate deploy` no diretório `backend`. Depois, gere o cliente e rode o seed novamente.

### 2. Interface

Em outro terminal, a partir da raiz do projeto:

```bash
cd frontend
npm ci
npm run dev
```

Abra [localhost:5173](http://localhost:5173). Mantenha a API em execução. Se alterar o endereço da API, configure `VITE_API_URL` no frontend.

### 3. Demonstração

Use a matrícula fictícia `DEMO2026` com a senha `Demo@12345`, ou clique em **Criar conta** e use um curso cadastrado pelo seed, como Sistemas de Informação ou Ciência da Computação.

A conta de demonstração tem histórico para explorar a carga horária e testar o bloqueio de uma disciplina já aprovada. A base também inclui uma turma lotada para testar a lista de espera. Cursos, históricos e metas curriculares são fictícios e destinados à execução local.

## API

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/health`, `/api/cursos` | Verificar a API e listar cursos para cadastro. |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Criar conta, iniciar ou encerrar sessão. |
| GET | `/api/auth/me` | Consultar a sessão. |
| GET | `/api/disciplinas`, `/api/turmas`, `/api/progresso` | Consultar catálogo, ofertas e progresso acadêmico. |
| GET, POST | `/api/matriculas`, `/api/lista-espera` | Consultar ou criar registros do aluno. |
| DELETE | `/api/matriculas/:id`, `/api/lista-espera/:id` | Cancelar matrícula ou sair da fila. |

As operações acadêmicas exigem sessão de aluno. Nas consultas de matrículas e lista de espera, passe `alunoId` na query. Para criar um registro, envie `alunoId` e `turmaId` no JSON, como `{"alunoId":1,"turmaId":"IP0001"}`. Para cancelar ou sair da fila, envie `alunoId` no corpo do DELETE. Use o ID do aluno autenticado.

## Secretaria

A branch [feat/admin-dashboard](https://github.com/marialportela10/Sistema-de-Matriculas/tree/feat/admin-dashboard) inclui uma área com login próprio, cadastro e edição de disciplinas, cadastro de professores, abertura de turmas e ajuste de vagas. As rotas administrativas ficam sob `/api/admin`.

Para testar esse fluxo, execute a instalação e o seed nessa branch e use a conta local `secretaria.demo` com a senha `Secretaria@12345`.

## Verificação

| Diretório | Comando | O que executa |
| --- | --- | --- |
| `backend/` | `npm test` | Testes automatizados das regras acadêmicas. |
| `backend/` | `npm run build` | Geração do cliente Prisma e compilação TypeScript. |
| `frontend/` | `npm run lint` | Verificação com ESLint. |
| `frontend/` | `npm run build` | Compilação TypeScript e build do Vite. |
