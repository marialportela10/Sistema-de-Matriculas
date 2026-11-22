import { prisma } from "../src/database/prisma.js";
import { gerarHashSenha } from "../src/services/auth.js";

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
    { id: "IP0003", disciplinaCodigo: "IP", codigo: "C", professor: "Lívia Barros", capacidade: 1,
      horarios: [{ diaSemana: 2, inicio: "14:00", fim: "16:00" }, { diaSemana: 4, inicio: "14:00", fim: "16:00" }] },
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
    let docente = await prisma.professor.findFirst({ where: { nome: oferta.professor } });
    if (!docente) {
      docente = await prisma.professor.create({
        data: { nome: oferta.professor, email: "docente-" + oferta.id.toLowerCase() + "@example.test" },
      });
    }
    const turmaAtual = await prisma.turma.findUnique({
      where: { id: oferta.id }, include: { docente: true },
    });
    await prisma.turma.upsert({
      where: { id: oferta.id },
      // Corrigir apenas professor legado ausente; não substituir alterações da secretaria.
      update: turmaAtual?.docente.nome === "Professor a definir" ? { professorId: docente.id } : {},
      create: {
        id: oferta.id,
        disciplinaId,
        codigo: oferta.codigo,
        periodo: "2026.2",
        capacidade: oferta.capacidade,
        professorId: docente.id,
        horarios: { create: oferta.horarios },
      },
    });
  }


  // Dois cursos compartilham componentes, mas classificam algumas disciplinas de forma diferente.
  const cursos = [
    { codigo: "SI", nome: "Sistemas de Informação", chObrigatorias: 1800, chPerfil: 600, chLivre: 180 },
    { codigo: "CC", nome: "Ciência da Computação", chObrigatorias: 1950, chPerfil: 480, chLivre: 180 },
  ] as const;
  const cursoIds = new Map<string, number>();
  for (const curso of cursos) {
    const criado = await prisma.curso.upsert({
      where: { codigo: curso.codigo },
      update: { nome: curso.nome, chObrigatorias: curso.chObrigatorias, chPerfil: curso.chPerfil, chLivre: curso.chLivre },
      create: curso,
    });
    cursoIds.set(curso.codigo, criado.id);
    for (const d of disciplinas) {
      const tipo = (curso.codigo === "SI" && d.codigo === "DS") ||
        (curso.codigo === "CC" && d.codigo === "DES102") ? "eletiva-perfil" :
        ["IP", "EDOO", "ACSO", "MAT101"].includes(d.codigo) ? "obrigatoria" : null;
      if (!tipo) continue;
      const disciplinaId = ids.get(d.codigo);
      if (!disciplinaId) continue;
      await prisma.curriculoDisciplina.upsert({
        where: { cursoId_disciplinaId: { cursoId: criado.id, disciplinaId } },
        update: { tipo },
        create: { cursoId: criado.id, disciplinaId, tipo },
      });
    }
  }

  // Conta estritamente fictícia para demonstrar o currículo completo no protótipo local.
  const demo = await prisma.aluno.upsert({
    where: { numeroMatricula: "DEMO2026" },
    update: {},
    create: {
      nome: "Ana Carolina Ferreira",
      email: "ana.demo@example.test",
      numeroMatricula: "DEMO2026",
      cursoId: cursoIds.get("SI")!,
      senhaHash: await gerarHashSenha("Demo@12345"),
    },
  });
  for (const anterior of [
    { codigo: "IP", periodo: "2025.2", situacao: "APROVADA" },
    { codigo: "DS", periodo: "2025.2", situacao: "APROVADA" },
    { codigo: "EDOO", periodo: "2026.1", situacao: "REPROVADA" },
  ]) {
    const disciplinaId = ids.get(anterior.codigo);
    if (!disciplinaId) continue;
    await prisma.historico.upsert({
      where: { alunoId_disciplinaId_periodo: { alunoId: demo.id, disciplinaId, periodo: anterior.periodo } },
      update: {},
      create: { alunoId: demo.id, disciplinaId, periodo: anterior.periodo, situacao: anterior.situacao },
    });
  }

  // Uma oferta lotada para testar o fluxo de lista de espera sem alterar vagas antigas.
  const reserva = await prisma.aluno.upsert({
    where: { numeroMatricula: "RESERVA2026" },
    update: {},
    create: {
      nome: "Estudante Reserva",
      email: "reserva@example.test",
      numeroMatricula: "RESERVA2026",
      cursoId: cursoIds.get("CC")!,
      senhaHash: await gerarHashSenha("Demo@12345"),
    },
  });
  for (const anterior of [
    { codigo: "EDOO", periodo: "2025.2", situacao: "APROVADA" },
    { codigo: "DES102", periodo: "2025.2", situacao: "APROVADA" },
    { codigo: "ACSO", periodo: "2026.1", situacao: "REPROVADA" },
  ]) {
    const disciplinaId = ids.get(anterior.codigo);
    if (!disciplinaId) continue;
    await prisma.historico.upsert({
      where: { alunoId_disciplinaId_periodo: { alunoId: reserva.id, disciplinaId, periodo: anterior.periodo } },
      update: {},
      create: { alunoId: reserva.id, disciplinaId, periodo: anterior.periodo, situacao: anterior.situacao },
    });
  }

  const vagas = await prisma.matricula.count({ where: { turmaId: "IP0003", situacao: "ATIVA" } });
  if (vagas === 0) {
    await prisma.matricula.create({ data: { alunoId: reserva.id, turmaId: "IP0003" } });
  }

  await prisma.usuarioSecretaria.upsert({
    where: { usuario: "secretaria.demo" },
    update: {},
    create: {
      usuario: "secretaria.demo",
      email: "secretaria@example.test",
      senhaHash: await gerarHashSenha("Secretaria@12345"),
    },
  });

  console.log("Dados fictícios: dois cursos e seus históricos, professores, 10 turmas e usuário de secretaria.");
}

seed()
  .catch((error: unknown) => {
    console.error("Erro ao carregar os dados de demonstração:", error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
