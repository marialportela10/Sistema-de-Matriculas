import { prisma } from "../src/database/prisma.js";

// Dados ficticios apenas para testar as consultas da API.
async function seed() {
  const ip = await prisma.disciplina.upsert({
    where: { codigo: "IP" },
    update: {},
    create: {
      codigo: "IP",
      nome: "Introdução à Programação",
      cargaHoraria: 60,
    },
  });

  const edoo = await prisma.disciplina.upsert({
    where: { codigo: "EDOO" },
    update: {},
    create: {
      codigo: "EDOO",
      nome: "Estruturas de Dados e Orientação a Objetos",
      cargaHoraria: 60,
    },
  });

  const turmas = [
    {
      disciplinaId: ip.id,
      codigo: "A",
      periodo: "2026.2",
      capacidade: 30,
      horarios: [
        { diaSemana: 1, inicio: "08:00", fim: "10:00" },
        { diaSemana: 3, inicio: "08:00", fim: "10:00" },
      ],
    },
    {
      disciplinaId: ip.id,
      codigo: "B",
      periodo: "2026.2",
      capacidade: 25,
      horarios: [
        { diaSemana: 1, inicio: "10:00", fim: "12:00" },
        { diaSemana: 3, inicio: "10:00", fim: "12:00" },
      ],
    },
    {
      disciplinaId: edoo.id,
      codigo: "C",
      periodo: "2026.2",
      capacidade: 20,
      horarios: [
        { diaSemana: 1, inicio: "08:00", fim: "10:00" },
        { diaSemana: 4, inicio: "14:00", fim: "16:00" },
      ],
    },
  ];

  for (const turma of turmas) {
    await prisma.turma.upsert({
      where: {
        disciplinaId_codigo_periodo: {
          disciplinaId: turma.disciplinaId,
          codigo: turma.codigo,
          periodo: turma.periodo,
        },
      },
      update: {},
      create: {
        disciplinaId: turma.disciplinaId,
        codigo: turma.codigo,
        periodo: turma.periodo,
        capacidade: turma.capacidade,
        horarios: { create: turma.horarios },
      },
    });
  }

  console.log("Dados de exemplo cadastrados: 2 disciplinas e 3 turmas.");
}

seed()
  .catch((error: unknown) => {
    console.error("Erro ao cadastrar os dados de exemplo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
