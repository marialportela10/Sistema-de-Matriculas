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

## Requisito adicional escolhido — choque de horários

Escolhi impedir choques de horários para que o aluno consiga montar uma grade que possa frequentar. A grade semanal mostra as turmas selecionadas, e a interface indica qual escolha causa o conflito antes da confirmação.

Dois horários entram em conflito quando ocorrem no mesmo dia e seus intervalos se sobrepõem. Uma aula pode começar no horário em que outra termina. O portal compara as escolhas com as turmas já matriculadas e com as demais seleções. Na confirmação, a API valida novamente os horários das matrículas ativas do semestre. A lista de espera é outra funcionalidade implementada.

## Principais decisões

- **Monorepo.** A interface fica em `frontend/` e a API em `backend/`, para que os dois componentes sejam versionados juntos e possam ser executados em terminais separados.
- **SQLite e Prisma.** Um banco em arquivo reduz a configuração para a avaliação local. As migrações versionam a estrutura, e o seed permite reproduzir os cenários de demonstração.
- **Curso, currículo e histórico separados.** O vínculo ao curso fica no cadastro do aluno. A estrutura curricular classifica a mesma disciplina de modo diferente entre cursos, e o histórico permite calcular a carga integralizada independentemente das matrículas ativas.
- **Validação na API.** A interface sinaliza problemas antes do envio. O servidor aplica as regras de negócio e verifica se a matrícula pertence ao aluno autenticado.

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
| GET | `/api/alunos/:id` | Consultar o cadastro do aluno autenticado. |
| GET | `/api/disciplinas`, `/api/turmas`, `/api/progresso` | Consultar catálogo, ofertas e progresso acadêmico. |
| GET, POST | `/api/matriculas`, `/api/lista-espera` | Consultar ou criar registros do aluno. |
| DELETE | `/api/matriculas/:id`, `/api/lista-espera/:id` | Cancelar matrícula ou sair da fila. |

As operações acadêmicas exigem sessão de aluno. Nas consultas de matrículas e lista de espera, passe `alunoId` na query. Para criar um registro, envie `alunoId` e `turmaId` no JSON, como `{"alunoId":1,"turmaId":"IP0001"}`. Para cancelar ou sair da fila, envie `alunoId` no corpo do DELETE. Use o ID do aluno autenticado.

## Secretaria

A branch [feat/admin-dashboard](https://github.com/marialportela10/Sistema-de-Matriculas/tree/feat/admin-dashboard) inclui uma área com login próprio, cadastro e edição de disciplinas, cadastro de professores, abertura de turmas e ajuste de vagas. As rotas administrativas ficam sob `/api/admin`.

Para testar a Secretaria, execute `git switch feat/admin-dashboard` na raiz do repositório logo após clonar. Siga os passos de instalação, migrações e seed acima. Na tela de login, entre como Secretaria com o usuário local `secretaria.demo` e a senha `Secretaria@12345`.

### Abrir uma turma

1. Selecione a disciplina e o professor. O formulário mostra a carga horária total definida no cadastro da disciplina. Ela deve ser um múltiplo de 15 entre 15 h e 120 h. Corrija o cadastro da disciplina se o valor estiver fora dessa faixa ou não for múltiplo de 15.
2. Informe o código da turma com uma letra e até dois algarismos, como `A`, `A1` ou `A12`, e defina pelo menos uma vaga. O código é único por disciplina e semestre. A API usa um identificador interno gerado para a turma, como `IP0001`.
3. Cadastre os horários em que as aulas serão ministradas. Para cada encontro semanal, indique dia da semana, hora de início e hora de fim. A programação semanal e a carga horária total da disciplina são campos distintos.

A listagem mostra as vagas ocupadas e o total de vagas. Ao editar o total, o novo valor precisa cobrir todas as matrículas ativas da turma.

### Rotas administrativas

| Método | Rota | Uso |
| --- | --- | --- |
| POST | `/api/admin/auth/login`, `/api/admin/auth/logout` | Iniciar ou encerrar a sessão da secretaria. |
| GET | `/api/admin/auth/me` | Consultar a sessão administrativa. |
| GET | `/api/admin/opcoes` | Buscar opções para os formulários administrativos. |
| GET, POST | `/api/admin/disciplinas` | Listar ou cadastrar disciplinas. |
| PUT | `/api/admin/disciplinas/:id` | Editar uma disciplina. |
| GET, POST | `/api/admin/professores` | Listar ou cadastrar professores. |
| GET, POST | `/api/admin/turmas` | Listar ou abrir turmas. |
| PUT | `/api/admin/turmas/:id/vagas` | Alterar a quantidade de vagas. |

As listagens administrativas aceitam `busca` e `pagina`. As operações administrativas exigem a sessão da secretaria.

## Verificação

| Diretório | Comando | O que executa |
| --- | --- | --- |
| `backend/` | `npm test` | Testes automatizados das regras acadêmicas. |
| `backend/` | `npm run build` | Geração do cliente Prisma e compilação TypeScript. |
| `frontend/` | `npm run lint` | Verificação com ESLint. |
| `frontend/` | `npm run build` | Compilação TypeScript e build do Vite. |

## O que faria com mais tempo

- Ampliaria os testes de fluxo completo para cobrir login, expiração da sessão e o isolamento entre os perfis de aluno e secretaria.
- Testaria solicitações simultâneas para a última vaga e a promoção da lista de espera após um cancelamento.
- Revisaria o fluxo do aluno em telas de 360 px, com navegação por teclado e leitor de tela.

A Secretaria está na branch indicada acima, com a integração à versão principal pendente.
