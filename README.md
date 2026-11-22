# Sistema de Matrícula

Protótipo acadêmico em desenvolvimento, com **React + Vite + TypeScript** no frontend e **Express + Prisma 7 + SQLite** no backend.

## O que já funciona no código

- Consulta de disciplinas, turmas, horários e vagas.
- Cadastro e consulta de alunos de teste.
- Matrícula com validação de vagas, duplicidade, disciplina já cursada no mesmo período e conflito de horários.
- Cancelamento de matrícula com tentativa de promoção da lista de espera.
- Entrada, consulta e saída da lista de espera.
- Interface de ofertas, favoritos, busca/paginação na URL, revisão antes de confirmar, planejamento e resumo das matrículas.
- Testes unitários para IDs de turmas, conflitos de horário e regras acadêmicas.

> **Importante:** autenticação real, permissões de secretaria, histórico de disciplinas concluídas e cálculo de integralização curricular ainda não estão implementados. Não utilize dados pessoais reais.

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

A API fica disponível em `http://localhost:3001`. Se o banco já existir, faça uma cópia de segurança antes de aplicar a migração.

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
| GET | `/api/disciplinas` | Disciplinas |
| GET | `/api/turmas` | Turmas e vagas disponíveis |
| POST | `/api/alunos` | Cadastro de aluno de teste |
| GET | `/api/alunos/:id` | Consulta de aluno de teste |
| GET | `/api/matriculas?alunoId=1` | Matrículas do aluno |
| POST | `/api/matriculas` | Criar matrícula |
| DELETE | `/api/matriculas/:id` | Cancelar matrícula |
| GET | `/api/lista-espera?alunoId=1` | Esperas do aluno |
| POST | `/api/lista-espera` | Entrar na lista |
| DELETE | `/api/lista-espera/:id` | Sair da lista |

Para criar uma matrícula ou entrar na lista de espera, envie um JSON como:

```json
{ "alunoId": 1, "turmaId": "IP0001" }
```

Para cancelar uma matrícula ou sair da lista, envie `{ "alunoId": 1 }` no corpo da requisição DELETE.

## Organização do Git

- `main`: versão principal.
- `feat/enrollment-system`: desenvolvimento das funcionalidades de matrícula.
- Commits em inglês, com prefixos `setup:`, `feat:`, `fix:` e `docs:`.

Esta branch de desenvolvimento está sendo atualizada no GitHub. O GitLab da UFPE não recebe automaticamente esses commits; faça o sincronismo depois de revisar e testar.

## Próximas etapas

Autenticação e autorização reais, telas da secretaria, progresso curricular completo, testes de integração/concorrência e revisão final de acessibilidade.
