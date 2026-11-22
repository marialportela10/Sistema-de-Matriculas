import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  api, ApiError, type Secretaria, type AdminDisciplina, type AdminProfessor,
  type AdminTurma, type OpcoesAdmin, type PaginaAdmin, type NovaTurma,
} from "./api";
import "./Admin.css";

type Aba = "disciplinas" | "professores" | "turmas";
type Aviso = { tipo: "sucesso" | "erro"; texto: string };
type HorarioForm = { diaSemana: number; inicio: string; fim: string };
const DIAS = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const VAZIO = { items: [], pagina: 1, totalPaginas: 1, total: 0 };
const HORARIO_INICIAL = (): HorarioForm => ({ diaSemana: 1, inicio: "08:00", fim: "10:00" });

function VagasEditor({ turma, ocupado, onSalvar }: {
  turma: AdminTurma; ocupado: boolean; onSalvar: (valor: number) => void;
}) {
  const [valor, setValor] = useState(String(turma.capacidade));
  return (
    <form className="admin-vagas" onSubmit={(event) => { event.preventDefault(); onSalvar(Number(valor)); }}>
      <label className="sr-only" htmlFor={"vagas-" + turma.id}>Nova capacidade da turma {turma.id}</label>
      <input id={"vagas-" + turma.id} type="number" min={1} step={1} required
        value={valor} onChange={(event) => setValor(event.target.value)} />
      <button type="submit" className="botao-claro" disabled={ocupado || Number(valor) === turma.capacidade}>
        Salvar vagas
      </button>
    </form>
  );
}

export default function Admin({ secretaria, onSair, onExpirada }: {
  secretaria: Secretaria;
  onSair: () => void;
  onExpirada: () => void;
}) {
  const [aba, setAba] = useState<Aba>("disciplinas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [versao, setVersao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [disciplinas, setDisciplinas] = useState<PaginaAdmin<AdminDisciplina>>(VAZIO);
  const [professores, setProfessores] = useState<PaginaAdmin<AdminProfessor>>(VAZIO);
  const [turmas, setTurmas] = useState<PaginaAdmin<AdminTurma>>(VAZIO);
  const [opcoes, setOpcoes] = useState<OpcoesAdmin>({ disciplinas: [], professores: [] });
  const [editarId, setEditarId] = useState<number | null>(null);

  const [codigoD, setCodigoD] = useState("");
  const [nomeD, setNomeD] = useState("");
  const [cargaD, setCargaD] = useState("60");
  const [ementaD, setEmentaD] = useState("");
  const [nomeP, setNomeP] = useState("");
  const [emailP, setEmailP] = useState("");
  const [disciplinaT, setDisciplinaT] = useState("");
  const [professorT, setProfessorT] = useState("");
  const [codigoT, setCodigoT] = useState("A");
  const [capacidadeT, setCapacidadeT] = useState("30");
  const [horarios, setHorarios] = useState<HorarioForm[]>([HORARIO_INICIAL()]);

  useEffect(() => {
    let ativo = true;
    void api.adminOpcoes().then((dados) => { if (ativo) setOpcoes(dados); })
      .catch((error: unknown) => {
        if (!ativo) return;
        if (error instanceof ApiError && error.status === 401) onExpirada();
        else setAviso({ tipo: "erro", texto: "Não foi possível consultar disciplinas e professores." });
      });
    return () => { ativo = false; };
  }, [onExpirada]);

  useEffect(() => {
    let ativo = true;
    const chamada = aba === "disciplinas" ? api.adminDisciplinas(busca, pagina)
      : aba === "professores" ? api.adminProfessores(busca, pagina)
        : api.adminTurmas(busca, pagina);
    void chamada.then((dados) => {
      if (!ativo) return;
      if (aba === "disciplinas") setDisciplinas(dados as PaginaAdmin<AdminDisciplina>);
      if (aba === "professores") setProfessores(dados as PaginaAdmin<AdminProfessor>);
      if (aba === "turmas") setTurmas(dados as PaginaAdmin<AdminTurma>);
    }).catch((error: unknown) => {
      if (!ativo) return;
      if (error instanceof ApiError && error.status === 401) onExpirada();
      else setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Falha ao carregar a listagem." });
    }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [aba, busca, pagina, versao, onExpirada]);

  function mudarAba(proxima: Aba) {
    setAba(proxima); setBusca(""); setPagina(1); setCarregando(true); setAviso(null);
  }

  async function executar(acao: () => Promise<unknown>, mensagem: string, atualizarOpcoes = false) {
    setOcupado(true); setAviso(null);
    try {
      await acao();
      setAviso({ tipo: "sucesso", texto: mensagem });
      setPagina(1);
      setVersao((n) => n + 1);
      setCarregando(true);
      if (atualizarOpcoes) setOpcoes(await api.adminOpcoes());
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpirada();
      else setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível salvar." });
      return false;
    } finally { setOcupado(false); }
  }

  function limparDisciplina() {
    setEditarId(null); setCodigoD(""); setNomeD(""); setCargaD("60"); setEmentaD("");
  }
  function editarDisciplina(d: AdminDisciplina) {
    setEditarId(d.id); setCodigoD(d.codigo); setNomeD(d.nome);
    setCargaD(String(d.cargaHoraria)); setEmentaD(d.ementa ?? "");
    setAviso(null);
    document.getElementById("form-disciplina")?.scrollIntoView({ behavior: "smooth" });
  }

  async function salvarDisciplina(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados = { codigo: codigoD, nome: nomeD, cargaHoraria: Number(cargaD), ementa: ementaD };
    const sucesso = await executar(
      () => editarId === null ? api.adminCriarDisciplina(dados) : api.adminEditarDisciplina(editarId, dados),
      editarId === null ? "Disciplina cadastrada." : "Disciplina atualizada.", true,
    );
    if (sucesso) limparDisciplina();
  }

  async function salvarProfessor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sucesso = await executar(() => api.adminCriarProfessor({ nome: nomeP, email: emailP }),
      "Professor cadastrado.", true);
    if (sucesso) { setNomeP(""); setEmailP(""); }
  }

  async function salvarTurma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dados: NovaTurma = {
      disciplinaId: Number(disciplinaT), professorId: Number(professorT),
      codigo: codigoT, capacidade: Number(capacidadeT), horarios,
    };
    const sucesso = await executar(() => api.adminCriarTurma(dados), "Turma aberta com sucesso.");
    if (sucesso) { setCodigoT("A"); setCapacidadeT("30"); setHorarios([HORARIO_INICIAL()]); }
  }

  async function sair() {
    setOcupado(true);
    try { await api.adminSair(); onSair(); }
    catch (error) { setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível sair." }); }
    finally { setOcupado(false); }
  }

  const disciplinaSelecionada = opcoes.disciplinas.find((d) => d.id === Number(disciplinaT));
  const cargaHorariaInvalida = disciplinaSelecionada !== undefined &&
    (disciplinaSelecionada.cargaHoraria < 15 || disciplinaSelecionada.cargaHoraria > 120 ||
      disciplinaSelecionada.cargaHoraria % 15 !== 0);
  const resultado = aba === "disciplinas" ? disciplinas : aba === "professores" ? professores : turmas;
  const atualizar = () => { setCarregando(true); setVersao((n) => n + 1); };

  return (
    <div className="admin-shell">
      <a href="#admin-conteudo" className="pular">Pular para o conteúdo</a>
      <header className="admin-topo">
        <div className="admin-topo-interno">
          <div className="admin-identidade"><span className="admin-logo" aria-hidden="true">▱</span>
            <div><strong>Sistema de Matrícula</strong><small>Secretaria de Graduação</small></div></div>
          <div className="admin-usuario"><span>{secretaria.usuario}</span>
            <button className="admin-sair" disabled={ocupado} type="button" onClick={() => void sair()}>Sair</button></div>
        </div>
      </header>
      <nav className="admin-nav" aria-label="Área da Secretaria">
        <div className="admin-nav-interna">
          {([
            ["disciplinas", "Disciplinas"], ["professores", "Professores"], ["turmas", "Turmas"],
          ] as const).map(([key, titulo]) =>
            <button key={key} type="button" className={aba === key ? "selecionada" : ""}
              aria-current={aba === key ? "page" : undefined}
              onClick={() => mudarAba(key)}>{titulo}</button>)}
        </div>
      </nav>
      <main id="admin-conteudo" className="admin-conteudo">
        <div className="admin-cabecalho"><div><p className="admin-sobretitulo">Gestão acadêmica</p>
          <h1>{aba === "disciplinas" ? "Disciplinas" : aba === "professores" ? "Professores" : "Turmas"}</h1>
          <p>{aba === "disciplinas" ? "Cadastre e atualize as disciplinas disponíveis." :
            aba === "professores" ? "Mantenha o cadastro de docentes da graduação." :
              "Abra turmas, consulte a ocupação e altere a quantidade de vagas."}</p></div></div>
        {aviso && <div className={"admin-aviso admin-" + aviso.tipo} role={aviso.tipo === "erro" ? "alert" : "status"}>
          {aviso.texto}
          {aviso.tipo === "erro" && <button className="botao-claro" onClick={atualizar} type="button">Atualizar</button>}
          <button type="button" aria-label="Fechar mensagem" onClick={() => setAviso(null)}>×</button>
        </div>}

        <div className="admin-grid">
          <section className="admin-painel admin-listagem">
            <div className="admin-secao-topo"><h2>Registros cadastrados</h2><span>{resultado.total} registro(s)</span></div>
            <div className="admin-filtros">
              <label htmlFor="admin-busca">Buscar
                <input type="search" id="admin-busca" value={busca}
                  placeholder={aba === "disciplinas" ? "Nome ou código" : aba === "professores" ? "Nome ou e-mail" : "Turma, disciplina ou professor"}
                  onChange={(event) => { setBusca(event.target.value); setPagina(1); setCarregando(true); }} />
              </label>
              <button className="botao-claro" type="button" disabled={carregando} onClick={atualizar}>Atualizar</button>
            </div>
            {carregando ? <p className="admin-estado" role="status">Carregando registros…</p> :
              resultado.items.length === 0 ? <div className="admin-estado">
                <strong>Nenhum registro encontrado</strong>
                <p>{busca ? "Experimente outro termo de busca." : "Cadastre o primeiro registro pelo formulário."}</p>
              </div> :
              <div className="admin-tabela-scroll">
                {aba === "disciplinas" && <table className="admin-tabela">
                  <thead><tr><th>Código</th><th>Disciplina</th><th>CH</th><th>Turmas</th><th>Ações</th></tr></thead>
                  <tbody>{disciplinas.items.map((d) =>
                    <tr key={d.id}><td><strong>{d.codigo}</strong></td><td>{d.nome}</td>
                      <td>{d.cargaHoraria}h</td><td>{d._count?.turmas ?? "—"}</td>
                      <td><button type="button" className="admin-link" onClick={() => editarDisciplina(d)}>Editar</button></td></tr>)}</tbody>
                </table>}
                {aba === "professores" && <table className="admin-tabela">
                  <thead><tr><th>Professor</th><th>E-mail</th><th>Turmas</th></tr></thead>
                  <tbody>{professores.items.map((p) =>
                    <tr key={p.id}><td><strong>{p.nome}</strong></td><td>{p.email}</td>
                      <td>{p._count?.turmas ?? "—"}</td></tr>)}</tbody>
                </table>}
                {aba === "turmas" && <table className="admin-tabela">
                  <thead><tr><th>Turma</th><th>Disciplina e professor</th><th>Ocupação</th><th>Alterar vagas</th></tr></thead>
                  <tbody>{turmas.items.map((t) =>
                    <tr key={t.id}>
                      <td><strong>{t.id}</strong><small>Turma {t.codigo} · {t.periodo}</small></td>
                      <td><strong>{t.disciplina.nome}</strong><small>{t.docente.nome}</small>
                        <small>{t.horarios.map((h) => DIAS[h.diaSemana] + " " + h.inicio + "–" + h.fim).join(" · ")}</small></td>
                      <td><span className="admin-ocupacao">{t.ocupadas}/{t.capacidade}</span>
                        <small>{t.vagasDisponiveis} vaga(s) livre(s)</small></td>
                      <td><VagasEditor key={t.id + "-" + t.capacidade} turma={t} ocupado={ocupado}
                        onSalvar={(capacidade) => void executar(
                          () => api.adminAlterarVagas(t.id, capacidade), "Quantidade de vagas atualizada.",
                        )}/></td>
                    </tr>)}</tbody>
                </table>}
              </div>}
            <div className="admin-paginacao">
              <button className="botao-claro" disabled={pagina <= 1 || carregando}
                onClick={() => { setPagina(pagina - 1); setCarregando(true); }}>Anterior</button>
              <span>Página {resultado.pagina} de {resultado.totalPaginas}</span>
              <button className="botao-claro" disabled={pagina >= resultado.totalPaginas || carregando}
                onClick={() => { setPagina(pagina + 1); setCarregando(true); }}>Próxima</button>
            </div>
          </section>

          <aside className="admin-painel admin-formulario">
            {aba === "disciplinas" && <form id="form-disciplina" onSubmit={(event) => void salvarDisciplina(event)}>
              <h2>{editarId === null ? "Cadastrar disciplina" : "Editar disciplina"}</h2>
              <p>O código deve ser único; a carga horária deve ser múltipla de 15, entre 15h e 120h.</p>
              <label htmlFor="disc-codigo">Código</label>
              <input id="disc-codigo" value={codigoD} maxLength={16} required
                onChange={(e) => setCodigoD(e.target.value)} placeholder="Ex.: IF668" />
              <label htmlFor="disc-nome">Nome da disciplina</label>
              <input id="disc-nome" value={nomeD} maxLength={160} required
                onChange={(e) => setNomeD(e.target.value)} placeholder="Nome completo" />
              <label htmlFor="disc-ch">Carga horária (h)</label>
              <input id="disc-ch" type="number" min={15} max={120} step={15} required
                value={cargaD} onChange={(e) => setCargaD(e.target.value)} />
              <label htmlFor="disc-ementa">Ementa (opcional)</label>
              <textarea id="disc-ementa" maxLength={5000} rows={4} value={ementaD}
                onChange={(e) => setEmentaD(e.target.value)} placeholder="Conteúdo da disciplina" />
              <div className="admin-form-acoes"><button type="submit" className="botao-primario" disabled={ocupado}>
                {ocupado ? "Salvando…" : editarId === null ? "Cadastrar disciplina" : "Salvar alterações"}
              </button>{editarId !== null && <button className="botao-claro" type="button" onClick={limparDisciplina}>Cancelar edição</button>}</div>
            </form>}
            {aba === "professores" && <form onSubmit={(event) => void salvarProfessor(event)}>
              <h2>Cadastrar professor</h2>
              <p>O e-mail deve ser único no sistema.</p>
              <label htmlFor="prof-nome">Nome completo</label>
              <input id="prof-nome" value={nomeP} maxLength={120} required
                onChange={(e) => setNomeP(e.target.value)} placeholder="Nome do professor" />
              <label htmlFor="prof-email">E-mail</label>
              <input id="prof-email" type="email" value={emailP} maxLength={254} required
                onChange={(e) => setEmailP(e.target.value)} placeholder="professor@exemplo.com" />
              <button type="submit" className="botao-primario" disabled={ocupado}>
                {ocupado ? "Salvando…" : "Cadastrar professor"}
              </button>
            </form>}
            {aba === "turmas" && <form onSubmit={(event) => void salvarTurma(event)}>
              <h2>Abrir turma</h2>
              <p>Selecione a disciplina, o professor e os horários desta oferta.</p>
              <label htmlFor="turma-disciplina">Disciplina</label>
              <select id="turma-disciplina" value={disciplinaT} required onChange={(e) => setDisciplinaT(e.target.value)}>
                <option value="">Selecione a disciplina</option>
                {opcoes.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.codigo} — {d.nome}</option>)}
              </select>
              <label htmlFor="turma-carga-horaria">Carga horária da disciplina</label>
              <input id="turma-carga-horaria" className="admin-somente-leitura" type="text" readOnly
                aria-describedby="turma-carga-ajuda"
                value={disciplinaSelecionada ? disciplinaSelecionada.cargaHoraria + " h" : ""}
                placeholder="Selecione a disciplina acima" />
              <small id="turma-carga-ajuda" className={cargaHorariaInvalida ? "admin-campo-erro" : "admin-campo-ajuda"}>
                {cargaHorariaInvalida
                  ? "Carga horária inválida. Corrija a disciplina antes de abrir a turma."
                  : "Definida no cadastro da disciplina: múltiplos de 15, entre 15h e 120h."}
              </small>
              <label htmlFor="turma-professor">Professor</label>
              <select id="turma-professor" value={professorT} required onChange={(e) => setProfessorT(e.target.value)}>
                <option value="">Selecione o professor</option>
                {opcoes.professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <div className="admin-duas-colunas">
                <div><label htmlFor="turma-secao">Turma (letra e até 2 números)</label>
                  <input id="turma-secao" required maxLength={3} pattern="[A-Za-z][0-9]{0,2}"
                    title="Use uma letra e, opcionalmente, um ou dois números: A, A1 ou A12."
                    aria-describedby="turma-formato" value={codigoT}
                    onChange={(e) => setCodigoT(e.target.value.toUpperCase())} placeholder="Ex.: A12" />
                  <small id="turma-formato" className="admin-campo-ajuda">Ex.: A, A1 ou A12</small></div>
                <div><label htmlFor="turma-vagas">Total de vagas</label>
                  <input id="turma-vagas" type="number" min={1} step={1} required value={capacidadeT}
                    onChange={(e) => setCapacidadeT(e.target.value)} /></div>
              </div>
              <fieldset className="admin-horarios"><legend>Horários semanais</legend>
                {horarios.map((h, i) => <div className="admin-horario" key={i}>
                  <label>Dia
                    <select value={h.diaSemana} aria-label={"Dia do horário " + (i + 1)}
                      onChange={(e) => setHorarios((lista) => lista.map((item, n) => n === i ? { ...item, diaSemana: Number(e.target.value) } : item))}>
                      {DIAS.slice(1).map((dia, n) => <option key={dia} value={n + 1}>{dia}</option>)}
                    </select></label>
                  <label>Início<input type="time" required aria-label={"Início do horário " + (i + 1)}
                    value={h.inicio} onChange={(e) => setHorarios((lista) => lista.map((item, n) => n === i ? { ...item, inicio: e.target.value } : item))} /></label>
                  <label>Fim<input type="time" required aria-label={"Fim do horário " + (i + 1)}
                    value={h.fim} onChange={(e) => setHorarios((lista) => lista.map((item, n) => n === i ? { ...item, fim: e.target.value } : item))} /></label>
                  {horarios.length > 1 && <button className="admin-remove" type="button" aria-label={"Remover horário " + (i + 1)}
                    onClick={() => setHorarios((lista) => lista.filter((_, n) => n !== i))}>×</button>}
                </div>)}
                <button type="button" className="botao-claro" disabled={horarios.length >= 10}
                  onClick={() => setHorarios((lista) => [...lista, HORARIO_INICIAL()])}>+ Adicionar horário</button>
              </fieldset>
              <button className="botao-primario" type="submit" disabled={ocupado || cargaHorariaInvalida || !opcoes.disciplinas.length || !opcoes.professores.length}>
                {ocupado ? "Salvando…" : "Abrir turma"}
              </button>
              {(!opcoes.disciplinas.length || !opcoes.professores.length) &&
                <p className="admin-dica">Cadastre uma disciplina e um professor antes de abrir uma turma.</p>}
            </form>}
          </aside>
        </div>
      </main>
      <footer className="admin-rodape">Sistema de Matrícula · Secretaria de Graduação · Ambiente de demonstração</footer>
    </div>
  );
}
