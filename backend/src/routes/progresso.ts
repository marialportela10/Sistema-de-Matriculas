import { Router } from "express";
import { prisma } from "../database/prisma.js";

export const progressoRouter = Router();

type Grupo = "obrigatoria" | "eletiva-perfil" | "eletiva-livre";
const NOME: Record<Grupo, string> = {
  obrigatoria: "Obrigatórias",
  "eletiva-perfil": "Eletivas de perfil",
  "eletiva-livre": "Eletivas livres",
};

progressoRouter.get("/", async (_req, res, next) => {
  try {
    const alunoId = res.locals.alunoId as number;
    const aluno = await prisma.aluno.findUnique({
      where: { id: alunoId },
      select: { cursoId: true },
    });
    const curso = aluno
      ? await prisma.curso.findUnique({ where: { id: aluno.cursoId } })
      : null;
    if (!curso) {
      res.status(404).json({ error: "O aluno ainda não possui estrutura curricular cadastrada." });
      return;
    }

    const [estrutura, historico, matriculas] = await Promise.all([
      prisma.curriculoDisciplina.findMany({ where: { cursoId: curso.id } }),
      prisma.historico.findMany({
        where: { alunoId, situacao: "APROVADA" },
        include: { disciplina: true },
      }),
      prisma.matricula.findMany({
        where: { alunoId, situacao: "ATIVA" },
        include: { turma: { include: { disciplina: true } } },
      }),
    ]);

    const tipos = new Map(estrutura.map((item) => [item.disciplinaId, item.tipo]));
    const classificar = (disciplinaId: number): Grupo => {
      const tipo = tipos.get(disciplinaId);
      if (tipo === "obrigatoria" || tipo === "eletiva-perfil") return tipo;
      return "eletiva-livre";
    };

    // Matérias aprovadas em mais de um período contam somente uma vez.
    const aprovadas = new Map<number, { id: number; cargaHoraria: number }>();
    for (const registro of historico) {
      aprovadas.set(registro.disciplinaId, registro.disciplina);
    }

    const totais: Record<Grupo, { concluida: number; emCurso: number }> = {
      obrigatoria: { concluida: 0, emCurso: 0 },
      "eletiva-perfil": { concluida: 0, emCurso: 0 },
      "eletiva-livre": { concluida: 0, emCurso: 0 },
    };
    for (const disciplina of aprovadas.values()) {
      totais[classificar(disciplina.id)].concluida += disciplina.cargaHoraria;
    }
    for (const matricula of matriculas) {
      const disciplina = matricula.turma.disciplina;
      if (!aprovadas.has(disciplina.id)) {
        totais[classificar(disciplina.id)].emCurso += disciplina.cargaHoraria;
      }
    }

    // Horas de perfil que ultrapassam a exigência podem contar como livres.
    const sobraPerfil = Math.max(0, totais["eletiva-perfil"].concluida - curso.chPerfil);
    totais["eletiva-perfil"].concluida -= sobraPerfil;
    totais["eletiva-livre"].concluida += sobraPerfil;

    const exigencias: Record<Grupo, number> = {
      obrigatoria: curso.chObrigatorias,
      "eletiva-perfil": curso.chPerfil,
      "eletiva-livre": curso.chLivre,
    };

    const grupos = (Object.keys(exigencias) as Grupo[]).map((tipo) => {
      const exigida = exigencias[tipo];
      const integralizada = Math.min(exigida, totais[tipo].concluida);
      return {
        tipo, nome: NOME[tipo], exigida, integralizada,
        emCurso: totais[tipo].emCurso,
        falta: Math.max(0, exigida - integralizada),
        percentual: exigida > 0 ? Math.min(100, Math.round(100 * integralizada / exigida)) : 100,
      };
    });
    res.json({ curso: curso.nome, grupos });
  } catch (error) {
    next(error);
  }
});
