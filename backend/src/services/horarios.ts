// Horarios no formato HH:mm. Intervalos que apenas se tocam nao conflitam.
type Horario = {
  diaSemana: number;
  inicio: string;
  fim: string;
};

export function horariosConflitam(
  primeiraTurma: Horario[],
  segundaTurma: Horario[],
): boolean {
  return primeiraTurma.some((a) =>
    segundaTurma.some(
      (b) =>
        a.diaSemana === b.diaSemana &&
        a.inicio < b.fim &&
        b.inicio < a.fim,
    ),
  );
}
