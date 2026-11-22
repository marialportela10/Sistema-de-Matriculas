"""Verify that the class-ID migration preserves existing SQLite relationships.

Run with: python scripts/check_migration.py
Uses only the Python standard library.
"""
from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[1]
BASE = (ROOT / "prisma/migrations/20261122041754_init/migration.sql").read_text(encoding="utf-8")
MIGRATION = (ROOT / "prisma/migrations/20261122190000_class_string_ids/migration.sql").read_text(encoding="utf-8")


def check(populated: bool) -> None:
    database = sqlite3.connect(":memory:")
    database.execute("PRAGMA foreign_keys=ON")
    database.executescript(BASE)

    if populated:
        database.executescript(
            """
            INSERT INTO "Disciplina" ("id","codigo","nome","cargaHoraria")
            VALUES (1,'IP','Introducao a Programacao',60),(2,'EDOO','Estruturas',60);
            INSERT INTO "Aluno" ("id","nome","email","numeroMatricula")
            VALUES (1,'Teste','teste@example.com','TESTE0001');
            INSERT INTO "Turma" ("id","codigo","periodo","capacidade","disciplinaId")
            VALUES (1,'A','2026.2',30,1),(2,'B','2026.2',25,1),(3,'C','2026.2',20,2);
            INSERT INTO "HorarioTurma" ("diaSemana","inicio","fim","turmaId")
            VALUES (1,'08:00','10:00',1),(1,'10:00','12:00',2),(4,'14:00','16:00',3);
            INSERT INTO "Matricula" ("alunoId","turmaId") VALUES (1,1);
            INSERT INTO "ListaEspera" ("alunoId","turmaId") VALUES (1,3);
            """
        )

    database.executescript(MIGRATION)

    assert database.execute("PRAGMA foreign_key_check").fetchall() == []
    if populated:
        assert database.execute("SELECT id FROM Turma ORDER BY id").fetchall() == [
            ("ED0001",), ("IP0001",), ("IP0002",)
        ]
        assert database.execute("SELECT alunoId, turmaId FROM Matricula").fetchall() == [
            (1, "IP0001")
        ]
        assert database.execute("SELECT alunoId, turmaId FROM ListaEspera").fetchall() == [
            (1, "ED0001")
        ]
        assert database.execute("SELECT turmaId FROM HorarioTurma ORDER BY id").fetchall() == [
            ("IP0001",), ("IP0002",), ("ED0001",)
        ]
    else:
        assert database.execute("SELECT COUNT(*) FROM Turma").fetchone() == (0,)
    database.close()


if __name__ == "__main__":
    check(populated=False)
    check(populated=True)
    print("Class ID migration passed on empty and populated databases.")
