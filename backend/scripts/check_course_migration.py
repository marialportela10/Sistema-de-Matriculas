"""Check the course/professor/status migration against old real-world data shapes.

Only uses an in-memory SQLite database; does not touch the user's dev.db.
"""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1] / "prisma/migrations"
ORDER = [
    "20261122041754_init",
    "20261122190000_class_string_ids",
    "20261122213000_student_sessions",
    "20261122234500_student_course_and_syllabus",
    "20261123010000_curriculum_history",
]
LATEST = "20261123023000_reconcile_student_and_professor_data"


def script(name: str) -> str:
    return (ROOT / name / "migration.sql").read_text(encoding="utf-8")


def check(populated: bool) -> None:
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    for old in ORDER:
        db.executescript(script(old))

    if populated:
        db.executescript("""
            INSERT INTO "Curso" ("codigo","nome","chObrigatorias","chPerfil","chLivre")
            VALUES ('SI','Sistemas de Informação',1800,600,180),
                   ('CC','Ciência da Computação',1950,480,180);
            INSERT INTO "Disciplina" ("id","codigo","nome","cargaHoraria")
            VALUES (1,'IP','Introdução à Programação',60),(2,'EDOO','Estruturas',60);
            INSERT INTO "Aluno" ("id","nome","email","numeroMatricula","curso")
            VALUES (1,'Aluno Pendente','pendente@example.com','A1',NULL),
                   (2,'Aluno SI','si@example.com','A2','Sistemas de Informação'),
                   (3,'Aluno CC','cc@example.com','A3','Ciência da Computação'),
                   (4,'Aluno Outro','outro@example.com','A4','Curso Externo');
            INSERT INTO "Turma" ("id","codigo","periodo","capacidade","professor","disciplinaId")
            VALUES ('IP0001','A','2026.2',30,NULL,1),
                   ('ED0001','C','2026.2',20,'Professora Maria',2);
            INSERT INTO "HorarioTurma" ("diaSemana","inicio","fim","turmaId")
            VALUES (1,'08:00','10:00','IP0001');
            INSERT INTO "Matricula" ("alunoId","turmaId") VALUES (2,'IP0001');
            INSERT INTO "ListaEspera" ("alunoId","turmaId") VALUES (3,'ED0001');
            INSERT INTO "Historico" ("alunoId","disciplinaId","periodo","situacao")
            VALUES (2,2,'2025.2','REPROVADA');
            INSERT INTO "Sessao" ("tokenHash","alunoId","expiresAt")
            VALUES ('legacy-token',2,'2099-01-01');
        """)

    db.executescript(script(LATEST))
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    if populated:
        registros = db.execute("""
            SELECT a.id, c.nome FROM Aluno a JOIN Curso c ON c.id = a.cursoId
            ORDER BY a.id
        """).fetchall()
        assert registros == [
            (1, "Curso não informado"), (2, "Sistemas de Informação"),
            (3, "Ciência da Computação"), (4, "Curso Externo"),
        ], registros
        assert db.execute('SELECT alunoId, turmaId, situacao FROM Matricula').fetchall() == [
            (2, "IP0001", "ATIVA")
        ]
        assert db.execute('SELECT alunoId, turmaId FROM ListaEspera').fetchall() == [
            (3, "ED0001")
        ]
        assert db.execute('SELECT alunoId FROM Sessao').fetchall() == [(2,)]
        assert db.execute('SELECT alunoId FROM Historico').fetchall() == [(2,)]
        turmas = db.execute("""
            SELECT t.id, p.nome FROM Turma t JOIN Professor p ON p.id=t.professorId
            ORDER BY t.id
        """).fetchall()
        assert turmas == [("ED0001", "Professora Maria"), ("IP0001", "Professor a definir")]
    db.close()


if __name__ == "__main__":
    check(False)
    check(True)
    print("Course, professor and enrollment-status migration preserves existing records.")
