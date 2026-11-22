import { prisma } from "../src/database/prisma.js";

// Dados fictícios para demonstrar as cinco abas. Upsert preserva matrículas e registros existentes.
async function seed() {
  const disciplinas = [
    {
      codigo: "IP", nome: "Introdução à Programação", cargaHoraria: 60,
      ementa: "Fundamentos de programação, algoritmos, variáveis, estruturas de decisão, laços de repetição e funções.",
    },
    {
      codigo: "EDOO", nome: "Estruturas de Dados e Orientação a Objetos", cargaHoraria: 60,
      ementa: "Listas ligadas, pilhas, filas, estruturas de dados e conceitos de orientação a objetos.",
    },
    {
      codigo: "ACSO", nome: "Arquitetura de Computadores e Sistemas Operacionais", cargaHoraria: 60,
      ementa: "Processadores, memória, entrada e saída, processos, threads e políticas de escalonamento.",
    },
    {
      codigo: "MAT101", nome: "Cálculo Diferencial e Integral I", cargaHoraria: 90,
      ementa: "Limites, continuidade, derivadas, análise de gráficos e aplicações de cálculo diferencial.",
    },
    {
      codigo: "DS", nome: "Desenvolvimento de Software", cargaHoraria: 60,
      ementa: "Requisitos, histórias de usuário, prototipação, testes e desenvolvimento colaborativo.",
    },
    {
      codigo: "DES102", nome: "Introdução ao Design de Interfaces", cargaHoraria: 45,
      ementa: "Usabilidade, heurísticas, prototipação, acessibilidade e fundamentos visuais de interfaces.",
    },
  ];

  const ids = new Map<string, number>();
  for (const disciplina of disciplinas) {
    const criada = await prisma.disciplina.upsert({
      where: { codigo: disciplina.codigo },
      update: { ementa: disciplina.ementa },
      create: disciplina,
    });
    ids.set(disciplina.codigo, criada.id);
  }

  type Horario = { diaSemana: number; inicio: string; fim: string };
  type Oferta = {
    id: string; disciplinaCodigo: string; codigo: string; professor: string;
    capacidade: number; horarios: Horario[];
  };
  const ofertas: Oferta[] = [
    { id: "IP0001", disciplinaCodigo: "IP", codigo: "A", professor: "Renato Moura", capacidade: 30,
      horarios: [{ diaSemana: 1, inicio: "08:00", fim: "10:00" }, { diaSemana: 3, inicio: "08:00", fim: "10:00" }] },
    { id: "IP0002", disciplinaCodigo: "IP", codigo: "B", professor: "Lívia Barros", capacidade: 25,
      horarios: [{ diaSemana: 1, inicio: "10:00", fim: "12:00" }, { diaSemana: 3, inicio: "10:00", fim: "12:00" }] },
    { id: "ED0001", disciplinaCodigo: "EDOO", codigo: "C", professor: "Helena Costa", capacidade: 20,
      horarios: [{ diaSemana: 1, inicio: "08:00", fim: "10:00" }, { diaSemana: 4, inicio: "14:00", fim: "16:00" }] },
    { id: "ED0002", disciplinaCodigo: "EDOO", codigo: "D", professor: "Carlos Lima", capacidade: 24,
      horarios: [{ diaSemana: 2, inicio: "08:00", fim: "10:00" }, { diaSemana: 4, inicio: "08:00", fim: "10:00" }] },
    { id: "AC0001", disciplinaCodigo: "ACSO", codigo: "A", professor: "Clara Silva", capacidade: 18,
      horarios: [{ diaSemana: 5, inicio: "10:00", fim: "14:00" }] },
    { id: "AC0002", disciplinaCodigo: "ACSO", codigo: "B", professor: "Marcos Duarte", capacidade: 22,
      horarios: [{ diaSemana: 1, inicio: "10:00", fim: "12:00" }, { diaSemana: 3, inicio: "10:00", fim: "12:00" }] },
    { id: "CA0001", disciplinaCodigo: "MAT101", codigo: "A", professor: "Beatriz Freire", capacidade: 26,
      horarios: [{ diaSemana: 2, inicio: "10:00", fim: "13:00" }, { diaSemana: 4, inicio: "10:00", fim: "13:00" }] },
    { id: "DS0001", disciplinaCodigo: "DS", codigo: "A", professor: "Rafael Prado", capacidade: 24,
      horarios: [{ diaSemana: 5, inicio: "14:00", fim: "18:00" }] },
    { id: "DE0001", disciplinaCodigo: "DES102", codigo: "A", professor: "Marina Vasconcelos", capacidade: 20,
      horarios: [{ diaSemana: 1, inicio: "14:00", fim: "17:00" }] },
  ];

  for (const oferta of ofertas) {
    const disciplinaId = ids.get(oferta.disciplinaCodigo);
    if (!disciplinaId) throw new Error("Disciplina de exemplo não encontrada: " + oferta.disciplinaCodigo);

    // Não substitui horários, vagas ou professor das turmas que já existiam.
    await prisma.turma.upsert({
      where: { id: oferta.id },
      update: {},
      create: {
        id: oferta.id,
        disciplinaId,
        codigo: oferta.codigo,
        periodo: "2026.2",
        capacidade: oferta.capacidade,
        professor: oferta.professor,
        horarios: { create: oferta.horarios },
      },
    });
  }

  console.log("Dados fictícios disponíveis: 6 disciplinas e 9 ofertas de turma.");
}

seed()
  .catch((error: unknown) => {
    console.error("Erro ao carregar os dados de demonstração:", error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
