# Sistema de Matrícula

Protótipo acadêmico em desenvolvimento, com **React + Vite + TypeScript** no frontend e **Express + Prisma 7 + SQLite** no backend.

## O que já funciona no código

- Consulta de disciplinas, turmas, horários e vagas. Curso de cada aluno obrigatório, ligado por chave estrangeira a uma estrutura curricular.
- Login com número de matrícula e senha (hash scrypt), sessões em cookie HttpOnly, logout e cadastro de contas fictícias.
- Consultas e operações de matrícula vinculadas ao aluno autenticado.
- Matrícula com validação de vagas, duplicidade, disciplina já cursada no mesmo período, conflito de horários e aprovação anterior (permite refazer disciplinas reprovadas).
- Cancelamento de matrícula por situação (`ATIVA`/`CANCELADA`), devolução da vaga e promoção de candidato elegível, inclusive com revalidação de aprovação anterior.
- Entrada, consulta e saída da lista de espera.
- Portal do aluno baseado no protótipo `prototipo-matricula-5-abas-perfil.html`, com **cinco abas**: **Visão geral**, **Fazer matrícula**, **Lista de espera**, **Disciplinas** e **Carga horária**.
- Grade semanal acima das ofertas: turmas selecionadas aparecem imediatamente e conflitos de horário ou disciplina são bloqueados; revisão antes de confirmar.
- Catálogo de disciplinas com ementas, favoritos por aluno e busca/paginação na URL.
- Cabeçalho com nome completo, curso e semestre do aluno. Cadastro fictício permite escolher curso.
- Estruturas curriculares diferentes para Sistemas de Informação e Ciência da Computação, com classificação por curso e cálculo de progresso por aprovações, eletivas de perfil excedentes e horas em curso.
- Professores como entidades próprias, com e-mail único, associados obrigatoriamente às turmas; conta de secretaria carregada pelo seed para a próxima etapa.
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

A API fica disponível em `http://localhost:3001`. Se o banco já existir, faça uma cópia de segurança antes de aplicar as migrações. A migração `20261122213000_student_sessions` cria sessões e preserva os alunos antigos sem atribuir senha padrão; a migração `20261122234500_student_course_and_syllabus` adiciona temporariamente o curso textual e ementas; `20261123010000_curriculum_history` introduz estruturas e históricos; `20261123023000_reconcile_student_and_professor_data` converte o curso textual em uma **chave estrangeira obrigatória**, converte professores em entidades relacionadas e adiciona a situação de matrícula; `20261123024500_secretary_account` prepara a conta da secretaria.

Os estudantes antigos com curso desconhecido são vinculados a um curso de pendência, sem atribuição silenciosa a outro curso. As migrações são verificadas sobre dados de teste anteriores para garantir que alunos, turmas, sessões, matrículas e históricos sejam preservados.

**Atualizar um banco existente:** pare o backend, faça backup de `backend/prisma/dev.db`, execute `npx.cmd prisma migrate deploy` dentro de `backend`, depois `npx.cmd prisma generate` e `npm.cmd run db:seed`. O seed é idempotente e adiciona 2 cursos, 6 disciplinas, professores, 10 ofertas fictícias (incluindo uma lotada), históricos de **alunos dos dois cursos** e uma conta de secretaria, sem remover turmas já cadastradas. Corrige apenas os docentes de exemplo que ainda estavam marcados como "Professor a definir".

**Para entrar pela primeira vez:** abra o frontend, clique em **Criar conta**, informe nome completo, **nome de um curso já cadastrado**, matrícula fictícia e senha de pelo menos 8 caracteres; depois use esses dados no formulário **Entrar no sistema**. Contas criadas antes desta mudança não têm senha e não podem usar o login até que recebam uma senha por um procedimento administrativo. Não foi atribuída nenhuma senha padrão a esses alunos.

**Conta pronta para comparar a interface com o protótipo (apenas ambiente local):** matrícula fictícia `DEMO2026`, senha `Demo@12345`. Essa conta representa Ana Carolina Ferreira (Sistemas de Informação) e contém aprovações/reprovação de exemplo para demonstrar as barras de carga horária e o bloqueio de disciplina já aprovada. Não use essas credenciais em uma instalação pública. A conta de secretaria `secretaria.demo` é preparada no banco com senha fictícia apenas para a futura interface administrativa; **o login administrativo ainda não está disponível**.

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
| GET | `/api/cursos` | Nomes de cursos disponíveis para cadastro fictício |
| POST | `/api/auth/register` | Criar conta fictícia com curso válido e senha |
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

Os cursos, metas e históricos fornecidos pelo seed são **fictícios para avaliação técnica**, não reproduzem necessariamente a matriz curricular oficial da UFPE. A área da Secretaria (autenticação própria, cadastro/edição de disciplinas, cadastro de professores, abertura de turmas e mudança de vagas) **continua pendente** e será feita na branch `feat/admin-dashboard`. O banco já contém `Professor` com e-mail único e um usuário fictício da secretaria. A função `validarCargaHoraria` impede valores fora de 15–120h ou que não sejam múltiplos de 15, e `validarVagas` impede redução abaixo das matrículas ativas; as rotas de administração ainda devem aplicar essas validações.

**Modelagem do vínculo:** `Matricula.alunoId → Aluno.id → Aluno.cursoId → Curso.id`. O curso não é copiado em cada matrícula, evitando divergências se o cadastro acadêmico mudar. Um aluno só pode ser cadastrado em um dos cursos existentes no banco.

## Próximas etapas

Recuperação de senha e identidade institucional, login e telas com permissões da secretaria, importação de currículos oficiais, testes de concorrência e revisão final de acessibilidade.
