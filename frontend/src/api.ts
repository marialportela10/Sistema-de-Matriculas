const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type CursoOpcao = { id: number; codigo: string; nome: string };

export type Aluno = {
  id: number;
  nome: string;
  email: string;
  numeroMatricula: string;
  curso: string | null;
};

export type Disciplina = {
  id: number;
  codigo: string;
  nome: string;
  cargaHoraria: number;
  ementa: string | null;
};

export type Horario = {
  id: number;
  diaSemana: number;
  inicio: string;
  fim: string;
  turmaId: string;
};

export type Turma = {
  id: string;
  codigo: string;
  periodo: string;
  capacidade: number;
  professor: string | null;
  disciplinaId: number;
  disciplina: Disciplina;
  horarios: Horario[];
  vagasDisponiveis: number;
  classificacao: "obrigatoria" | "eletiva-perfil" | "eletiva-livre" | null;
  jaAprovada: boolean;
  _count: { matriculas: number; listaEspera: number };
};

export type Matricula = {
  id: number;
  alunoId: number;
  turmaId: string;
  criadaEm: string;
  turma: Omit<Turma, "vagasDisponiveis" | "_count">;
};

export type Espera = {
  id: number;
  alunoId: number;
  turmaId: string;
  criadaEm: string;
  turma: Omit<Turma, "vagasDisponiveis" | "_count">;
};

export type GrupoProgresso = {
  tipo: "obrigatoria" | "eletiva-perfil" | "eletiva-livre";
  nome: string;
  exigida: number;
  integralizada: number;
  emCurso: number;
  falta: number;
  percentual: number;
};
export type Progresso = { curso: string; grupos: GrupoProgresso[] };

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(0, "Não foi possível acessar o servidor. Confira se o backend está ligado.");
  }

  if (resposta.status === 204) return undefined as T;

  const dados: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = dados && typeof dados === "object" && "error" in dados
      ? String(dados.error)
      : "Não foi possível concluir a operação.";
    throw new ApiError(resposta.status, erro);
  }
  return dados as T;
}

export const api = {
  cursos: () => request<CursoOpcao[]>("/api/cursos"),
  turmas: () => request<Turma[]>("/api/turmas"),
  progresso: () => request<Progresso>("/api/progresso"),
  sessao: () => request<Aluno>("/api/auth/me"),
  entrar: (numeroMatricula: string, senha: string) =>
    request<Aluno>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ numeroMatricula, senha }),
    }),
  cadastrarConta: (data: Omit<Aluno, "id"> & { senha: string }) =>
    request<Aluno>("/api/auth/register", {
      method: "POST", body: JSON.stringify(data),
    }),
  sair: () => request<void>("/api/auth/logout", { method: "POST" }),
  matriculas: (alunoId: number) =>
    request<Matricula[]>(`/api/matriculas?alunoId=${alunoId}`),
  esperas: (alunoId: number) =>
    request<Espera[]>(`/api/lista-espera?alunoId=${alunoId}`),
  matricular: (alunoId: number, turmaId: string) =>
    request<Matricula>("/api/matriculas", {
      method: "POST",
      body: JSON.stringify({ alunoId, turmaId }),
    }),
  entrarNaFila: (alunoId: number, turmaId: string) =>
    request<Espera>("/api/lista-espera", {
      method: "POST",
      body: JSON.stringify({ alunoId, turmaId }),
    }),
  cancelar: (id: number, alunoId: number) =>
    request<{ cancelada: Matricula; promovido: { alunoId: number; matriculaId: number } | null }>(
      `/api/matriculas/${id}`,
      { method: "DELETE", body: JSON.stringify({ alunoId }) },
    ),
  sairDaFila: (id: number, alunoId: number) =>
    request<void>(`/api/lista-espera/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ alunoId }),
    }),
};
