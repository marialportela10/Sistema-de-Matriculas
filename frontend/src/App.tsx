import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type Aluno, type Espera, type Matricula, type Turma } from "./api";
import Login from "./Login";
import "./App.css";

type Aba = "overview" | "enroll" | "wait" | "catalog" | "hours";
type Aviso = { tipo: "sucesso" | "erro" | "espera"; texto: string };
type Filtro = "todas" | "favoritas";
type DisciplinaGrupo = { id: number; nome: string; codigo: string; cargaHoraria: number; ementa: string | null; turmas: Turma[] };

const DIAS: Record<number, string> = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom" };
const ABAS: ReadonlyArray<{ id: Aba; label: string; icone: string }> = [
  { id: "overview", label: "Visão geral", icone: "▦" },
  { id: "enroll", label: "Fazer matrícula", icone: "+" },
  { id: "wait", label: "Lista de espera", icone: "◷" },
  { id: "catalog", label: "Disciplinas", icone: "▤" },
  { id: "hours", label: "Carga horária", icone: "◴" },
];
const POR_PAGINA = 4;

function horas(turma: Turma): string {
  if (!turma.horarios.length) return "Horário a definir";
  return [...turma.horarios]
    .sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio))
    .map((h) => (DIAS[h.diaSemana] ?? "Dia") + " " + h.inicio + "–" + h.fim)
    .join(" · ");
}

function impedimento(turma: Turma, outras: Turma[]): string | null {
  const duplicada = outras.find((o) => o.disciplinaId === turma.disciplinaId && o.id !== turma.id);
  if (duplicada) return "Você já escolheu " + duplicada.disciplina.nome + " — turma " + duplicada.codigo +
    ". Remova essa escolha antes de selecionar outra turma da mesma disciplina.";
  for (const outra of outras) {
    if (outra.id === turma.id) continue;
    for (const h of turma.horarios) {
      const choque = outra.horarios.find((o) => o.diaSemana === h.diaSemana && o.inicio < h.fim && h.inicio < o.fim);
      if (choque) {
        return "Não é possível selecionar a turma " + turma.codigo + " de " + turma.disciplina.nome +
          ": " + (DIAS[h.diaSemana] ?? "Dia") + ", " +
          (h.inicio > choque.inicio ? h.inicio : choque.inicio) + "–" +
          (h.fim < choque.fim ? h.fim : choque.fim) +
          " já está ocupado por " + outra.disciplina.nome + " — turma " + outra.codigo +
          ". Remova a escolha ou procure outro horário.";
      }
    }
  }
  return null;
}

function Schedule({ confirmadas, escolhidas }: { confirmadas: Turma[]; escolhidas: Turma[] }) {
  const turmas = [...confirmadas, ...escolhidas.filter((t) => !confirmadas.some((c) => c.id === t.id))];
  const slots = [8, 10, 12, 14, 16, 18, 20];
  const dias = [1, 2, 3, 4, 5, 6];
  return (
    <div className="grade-scroll">
      <table className="grade" aria-label="Grade semanal com turmas matriculadas e selecionadas">
        <thead><tr><th scope="col">Hora</th>{dias.map((dia) => <th scope="col" key={dia}>{DIAS[dia]}</th>)}</tr></thead>
        <tbody>
          {slots.map((inicio) => (
            <tr key={inicio}>
              <th scope="row" className="grade-hora">{String(inicio).padStart(2, "0")}:00</th>
              {dias.map((dia) => {
                const naHora = turmas.filter((t) => t.horarios.some((h) =>
                  h.diaSemana === dia && h.inicio < String(inicio + 2).padStart(2, "0") + ":00" &&
                  h.fim > String(inicio).padStart(2, "0") + ":00",
                ));
                return (
                  <td key={dia}>
                    {naHora.map((turma) => (
                      <div key={turma.id} className={"grade-bloco " +
                        (confirmadas.some((c) => c.id === turma.id) ? "grade-confirmada" : "grade-selecionada")}>
                        <strong>{turma.disciplina.codigo} · {turma.codigo}</strong>
                        <small>{confirmadas.some((c) => c.id === turma.id) ? "Matriculada" : "Selecionada"}</small>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function favoritosIniciais(): number[] {
  return [];
}

function App() {
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [aba, setAba] = useState<Aba>("overview");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [esperas, setEsperas] = useState<Espera[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [revisando, setRevisando] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);
  const [busca, setBusca] = useState(() => new URLSearchParams(window.location.search).get("busca") ?? "");
  const [pagina, setPagina] = useState(() => Math.max(1, Number(new URLSearchParams(window.location.search).get("pagina")) || 1));
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [favoritos, setFavoritos] = useState<number[]>(favoritosIniciais);

  function falha(error: unknown, alternativa: string) {
    if (error instanceof ApiError && error.status === 401) {
      setAluno(null);
      setMatriculas([]);
      setEsperas([]);
      setTurmas([]);
      setSelecionadas([]);
      setAviso(null);
      return;
    }
    setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : alternativa });
  }

  useEffect(() => {
    let ativo = true;
    void api.sessao().then((conta) => {
      if (ativo) setAluno(conta);
    }).catch(() => {
      // Sem sessão: mostra a tela de login.
    }).finally(() => { if (ativo) setVerificando(false); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!aluno) return;
    let ativo = true;
    void Promise.all([api.turmas(), api.matriculas(aluno.id), api.esperas(aluno.id)])
      .then(([ofertas, inscritas, fila]) => {
        if (!ativo) return;
        setTurmas(ofertas);
        setMatriculas(inscritas);
        setEsperas(fila);
      }).catch((error: unknown) => { if (ativo) falha(error, "Não foi possível carregar seus dados."); })
      .finally(() => { if (ativo) setCarregando(false); });
    const chave = "favoritos-disciplina-" + aluno.numeroMatricula;
    try {
      const dados: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
      const ids = Array.isArray(dados) ? dados.filter((n): n is number => Number.isSafeInteger(n)) : [];
      queueMicrotask(() => { if (ativo) setFavoritos(ids); });
    } catch {
      queueMicrotask(() => { if (ativo) setFavoritos([]); });
    }
    return () => { ativo = false; };
  }, [aluno]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (busca) params.set("busca", busca); else params.delete("busca");
    if (pagina > 1) params.set("pagina", String(pagina)); else params.delete("pagina");
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }, [busca, pagina]);

  async function recarregar() {
    if (!aluno) return;
    setCarregando(true);
    try {
      const [ofertas, inscritas, fila] = await Promise.all([
        api.turmas(), api.matriculas(aluno.id), api.esperas(aluno.id),
      ]);
      setTurmas(ofertas); setMatriculas(inscritas); setEsperas(fila);
    } catch (error) {
      falha(error, "Falha ao atualizar os dados.");
    } finally { setCarregando(false); }
  }

  async function sair() {
    setOcupado(true);
    try {
      await api.sair();
      setAluno(null); setTurmas([]); setMatriculas([]); setEsperas([]);
      setSelecionadas([]); setAviso(null); setAba("overview");
    } catch (error) { falha(error, "Não foi possível sair."); }
    finally { setOcupado(false); }
  }

  const confirmadas = matriculas.map((m) => m.turma as Turma);
  const escolhidas = selecionadas.map((id) => turmas.find((t) => t.id === id)).filter((t): t is Turma => Boolean(t));
  const horasEmCurso = matriculas.reduce((total, m) => total + m.turma.disciplina.cargaHoraria, 0);
  const horasEscolhidas = escolhidas.reduce((total, t) => total + t.disciplina.cargaHoraria, 0);
  const grupos = useMemo(() => {
    const mapa = new Map<number, DisciplinaGrupo>();
    for (const turma of turmas) {
      const d = turma.disciplina;
      if (!mapa.has(d.id)) {
        mapa.set(d.id, { id: d.id, nome: d.nome, codigo: d.codigo, cargaHoraria: d.cargaHoraria, ementa: d.ementa, turmas: [] });
      }
      mapa.get(d.id)?.turmas.push(turma);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [turmas]);

  const filtrados = grupos.filter((g) =>
    (g.nome + " " + g.codigo).toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")) &&
    (filtro === "todas" || favoritos.includes(g.id)),
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const mostrados = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function navegar(nova: Aba) {
    setAba(nova);
    setBusca("");
    setPagina(1);
    setConflito(null);
    setAviso(null);
    setRevisando(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function escolher(turma: Turma) {
    const erro = impedimento(turma, [...confirmadas, ...escolhidas]);
    if (erro) { setConflito(erro); setRevisando(false); return; }
    setSelecionadas((lista) => [...lista, turma.id]);
    setConflito(null);
    setRevisando(false);
  }

  function removerEscolha(id: string) {
    setSelecionadas((lista) => lista.filter((x) => x !== id));
    setConflito(null);
    setRevisando(false);
  }

  async function confirmar() {
    if (!aluno || escolhidas.length === 0) return;
    setOcupado(true);
    let aprovadas = 0;
    let erro: string | null = null;
    for (const turma of escolhidas) {
      try {
        await api.matricular(aluno.id, turma.id);
        aprovadas++;
        setSelecionadas((lista) => lista.filter((x) => x !== turma.id));
      } catch (error) {
        erro = error instanceof Error ? error.message : "Falha ao registrar uma turma.";
        if (error instanceof ApiError && error.status === 401) { falha(error, "Sessão expirada."); break; }
        break;
      }
    }
    await recarregar();
    if (erro) {
      setAviso({ tipo: "erro", texto: (aprovadas ? String(aprovadas) + " matrícula(s) confirmada(s). " : "") +
        "A operação foi interrompida: " + erro + ". Revise as escolhas restantes." });
    } else {
      setAviso({ tipo: "sucesso", texto: String(aprovadas) + " matrícula(s) confirmada(s) com sucesso." });
      setRevisando(false);
      setAba("overview");
    }
    setOcupado(false);
  }

  async function entrarNaEspera(turma: Turma) {
    if (!aluno) return;
    setOcupado(true);
    try {
      await api.entrarNaFila(aluno.id, turma.id);
      setAviso({ tipo: "espera", texto: "Você entrou na lista de espera de " + turma.disciplina.nome + " — turma " + turma.codigo + "." });
      await recarregar();
    } catch (error) { falha(error, "Não foi possível entrar na lista."); }
    finally { setOcupado(false); }
  }

  async function cancelarRegistro(id: number, tipo: "matricula" | "espera") {
    if (!aluno || !window.confirm(tipo === "matricula"
      ? "Cancelar esta matrícula? Uma pessoa da lista de espera poderá receber a vaga."
      : "Deseja sair da lista de espera?")) return;
    setOcupado(true);
    try {
      if (tipo === "matricula") await api.cancelar(id, aluno.id);
      else await api.sairDaFila(id, aluno.id);
      setAviso({ tipo: "sucesso", texto: tipo === "matricula" ? "Matrícula cancelada." : "Você saiu da lista de espera." });
      await recarregar();
    } catch (error) { falha(error, "Não foi possível cancelar."); }
    finally { setOcupado(false); }
  }

  function favoritar(id: number) {
    if (!aluno) return;
    const nova = favoritos.includes(id) ? favoritos.filter((x) => x !== id) : [...favoritos, id];
    setFavoritos(nova);
    localStorage.setItem("favoritos-disciplina-" + aluno.numeroMatricula, JSON.stringify(nova));
  }

  function barraBusca() {
    return (
      <div className="barra-busca">
        <label className="campo">Buscar disciplina
          <input type="search" value={busca} placeholder="Ex.: Introdução à Programação ou IP"
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
        </label>
        {aba === "catalog" && <label className="filtro-favoritos">
          <input type="checkbox" checked={filtro === "favoritas"} onChange={(e) => { setFiltro(e.target.checked ? "favoritas" : "todas"); setPagina(1); }} />
          Apenas favoritas
        </label>}
      </div>
    );
  }

  function paginacao() {
    if (totalPaginas <= 1) return null;
    return <div className="paginacao">
      <button type="button" className="botao-claro" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button>
      <span>Página {paginaAtual} de {totalPaginas}</span>
      <button type="button" className="botao-claro" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button>
    </div>;
  }

  if (verificando) return <main className="carregando-tela" role="status">Verificando acesso ao portal…</main>;
  if (!aluno) return <Login onEntrar={(conta) => { setCarregando(true); setAviso(null); setAluno(conta); }} />;

  const periodo = turmas[0]?.periodo ?? "Semestre atual";
  const iniciais = aluno.nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase();

  return (
    <div className="portal">
      <a className="pular" href="#conteudo">Pular para o conteúdo</a>
      <header className="topo">
        <div className="topo-interno">
          <div className="marca"><span className="marca-icone" aria-hidden="true">▱</span> Matrícula Clara</div>
          <div className="topo-direita">
            <span className="semestre">{periodo}</span>
            <div className="perfil">
              <span className="avatar" aria-hidden="true">{iniciais}</span>
              <span className="perfil-texto"><strong>{aluno.nome}</strong><small>{aluno.curso || "Curso não informado"}</small></span>
            </div>
            <button type="button" className="sair" disabled={ocupado} onClick={() => void sair()}>Sair</button>
          </div>
        </div>
      </header>
      <nav className="navegacao" aria-label="Navegação principal">
        <div className="navegacao-interna">
          {ABAS.map((item) => (
            <button key={item.id} type="button" aria-current={aba === item.id ? "page" : undefined}
              className={aba === item.id ? "aba-ativa" : ""} onClick={() => navegar(item.id)}>
              <span aria-hidden="true">{item.icone}</span>{item.label}
              {item.id === "wait" && esperas.length > 0 && <span className="contador">{esperas.length}</span>}
            </button>
          ))}
        </div>
      </nav>

      <main id="conteudo" className="conteudo" tabIndex={-1}>
        {aviso && <div className={"aviso aviso-" + aviso.tipo} role={aviso.tipo === "erro" ? "alert" : "status"}>
          <strong>{aviso.tipo === "erro" ? "Atenção" : aviso.tipo === "espera" ? "Lista de espera" : "Tudo certo!"}</strong>
          <span>{aviso.texto}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">×</button>
        </div>}

        {aba === "overview" && <>
          <div className="cabecalho-pagina">
            <div><span className="sobretitulo">Página inicial</span><h1>Visão geral</h1><p>{aluno.curso || "Seu curso"} · {periodo}</p></div>
            <button className="botao-primario" type="button" onClick={() => navegar("enroll")}>+ Fazer matrícula</button>
          </div>
          <div className="estatisticas">
            <div className="estatistica"><div><p>Turmas matriculadas</p><strong>{matriculas.length}</strong></div><span className="estatistica-icone">▤</span></div>
            <div className="estatistica"><div><p>Carga horária em curso</p><strong>{horasEmCurso}h</strong></div><span className="estatistica-icone">◴</span></div>
            <div className="estatistica"><div><p>Listas de espera</p><strong>{esperas.length}</strong></div><span className="estatistica-icone">◷</span></div>
          </div>
          <div className="visao-colunas">
            <section className="painel">
              <div className="cabecalho-secao"><h2>Minhas turmas do semestre</h2><span className="etiqueta">Situação atual</span></div>
              {carregando ? <p role="status">Carregando turmas…</p> : matriculas.length ? matriculas.map((m) => (
                <div className="linha" key={m.id}><div><strong>{m.turma.disciplina.nome}</strong><p>Turma {m.turma.codigo} · {horas(m.turma as Turma)} · {m.turma.disciplina.cargaHoraria}h</p></div>
                  <span className="etiqueta etiqueta-ok">Ativa</span></div>
              )) : <div className="vazio"><h3>Nenhuma turma matriculada</h3><p>Monte sua grade na aba Fazer matrícula e confirme as escolhas.</p>
                <button type="button" className="botao-primario" onClick={() => navegar("enroll")}>Buscar turmas</button></div>}
            </section>
            <aside className="painel">
              <div className="cabecalho-secao"><h2>Seu curso</h2></div>
              <div className="atalho"><span>◴</span><div><strong>Progresso curricular</strong><small>Entenda as horas concluídas e as horas em curso.</small></div></div>
              <div className="atalho"><span>♡</span><div><strong>Disciplinas do curso</strong><small>Leia as ementas e salve favoritas.</small></div></div>
              <div className="acoes-linha">
                <button type="button" className="botao-contorno" onClick={() => navegar("hours")}>Ver carga horária</button>
                <button type="button" className="botao-claro" onClick={() => navegar("catalog")}>Ver disciplinas</button>
              </div>
            </aside>
          </div>
        </>}

        {aba === "enroll" && <>
          <div className="cabecalho-pagina"><div><span className="sobretitulo">Matrículas</span><h1>Fazer matrícula</h1>
            <p>Monte sua grade, escolha uma turma por disciplina e revise antes de confirmar.</p></div></div>
          <section className="painel painel-grade" aria-label="Planejamento de horários">
            <div className="cabecalho-secao"><div><h2>Sua grade de horários</h2><p>Os horários aparecem aqui assim que você seleciona uma turma.</p></div>
              <span className="etiqueta etiqueta-espera">{selecionadas.length} escolhida(s) · {horasEscolhidas}h</span></div>
            <Schedule confirmadas={confirmadas} escolhidas={escolhidas} />
            <div className="resumo-grade">
              <div className="escolhas">
                {escolhidas.length === 0 ? <p>Nenhuma turma selecionada. Escolha uma oferta abaixo.</p> : escolhidas.map((t) => (
                  <span className="escolha" key={t.id}>{t.disciplina.codigo} · {t.codigo}
                    <button type="button" aria-label={"Remover " + t.disciplina.nome} disabled={ocupado} onClick={() => removerEscolha(t.id)}>×</button>
                  </span>
                ))}
              </div>
              <button className="botao-primario" type="button" disabled={!escolhidas.length || ocupado}
                onClick={() => { setRevisando(true); setConflito(null); }}>Revisar matrícula</button>
            </div>
          </section>

          {conflito && <div className="aviso aviso-erro aviso-fluxo" role="alert"><strong>Horário indisponível</strong><span>{conflito}</span>
            <button type="button" aria-label="Fechar aviso" onClick={() => setConflito(null)}>×</button></div>}

          {revisando && escolhidas.length > 0 && <section className="painel revisao" aria-labelledby="titulo-revisao">
            <div className="cabecalho-secao"><h2 id="titulo-revisao">Revise suas escolhas</h2><span className="etiqueta">{horasEscolhidas}h selecionadas</span></div>
            {escolhidas.map((t) => <div className="linha" key={t.id}>
              <div><strong>{t.disciplina.nome} — Turma {t.codigo}</strong><p>{horas(t)} · {t.disciplina.cargaHoraria}h</p></div>
              <button className="botao-claro" disabled={ocupado} onClick={() => removerEscolha(t.id)}>Remover</button>
            </div>)}
            <div className="acoes-linha acoes-revisao"><button className="botao-claro" disabled={ocupado} onClick={() => setRevisando(false)}>Voltar às ofertas</button>
              <button className="botao-primario" disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? "Confirmando…" : "Confirmar matrícula"}</button></div>
            <p className="nota">As matrículas são registradas na sua conta. Em caso de erro, as turmas já confirmadas serão mantidas.</p>
          </section>}

          <div className="cabecalho-secao ofertas-titulo"><div><h2>Ofertas de turmas</h2><p>Selecione abaixo para preencher a grade. Turmas lotadas oferecem lista de espera.</p></div>
            <button type="button" className="botao-claro" disabled={carregando} onClick={() => void recarregar()}>Atualizar</button></div>
          {barraBusca()}
          {carregando ? <div className="vazio" role="status">Carregando ofertas…</div> :
            filtrados.length === 0 ? <div className="vazio"><h3>Nenhuma disciplina encontrada</h3><p>Tente buscar por outro nome ou código.</p></div> :
            <div className="grupos-ofertas">
              {mostrados.map((g) => <section className="grupo" key={g.id}>
                <div className="grupo-cabecalho"><div><h3>{g.nome}</h3><p>{g.codigo} · {g.cargaHoraria}h</p></div>
                  <span className="etiqueta">{g.turmas.length} turma(s)</span></div>
                <div className="grupo-turmas">
                  {g.turmas.map((t) => {
                    const confirmada = matriculas.some((m) => m.turmaId === t.id);
                    const marcada = selecionadas.includes(t.id);
                    const naFila = esperas.some((e) => e.turmaId === t.id);
                    const semVagas = t.vagasDisponiveis <= 0;
                    const problema = impedimento(t, [...confirmadas, ...escolhidas]);
                    return <div className="oferta" key={t.id}>
                      <div><strong>Turma {t.codigo}</strong><small>{t.professor || "Professor a definir"} · {t.id}</small></div>
                      <div><strong>{horas(t)}</strong><small>{g.cargaHoraria} horas</small></div>
                      <div>{confirmada ? <span className="etiqueta etiqueta-ok">Matriculada</span> :
                        marcada ? <span className="etiqueta etiqueta-espera">Selecionada</span> :
                        semVagas ? <span className="etiqueta etiqueta-lotada">Turma lotada</span> :
                        problema ? <span className="etiqueta etiqueta-erro">Conflito de horário</span> :
                        <span className="etiqueta etiqueta-ok">{t.vagasDisponiveis} vaga(s)</span>}</div>
                      <div className="oferta-acoes">
                        {confirmada ? <span className="etiqueta etiqueta-ok">Ativa</span> :
                          marcada ? <button type="button" className="botao-claro" disabled={ocupado} onClick={() => removerEscolha(t.id)}>Remover seleção</button> :
                          naFila ? <span className="etiqueta etiqueta-espera">Na espera</span> :
                          semVagas ? <button type="button" className="botao-contorno" disabled={ocupado} onClick={() => void entrarNaEspera(t)}>Entrar na espera</button> :
                          problema ? <button type="button" className="botao-conflito" onClick={() => { setConflito(problema); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Ver conflito</button> :
                          <button type="button" className="botao-primario" disabled={ocupado} onClick={() => escolher(t)}>Selecionar turma</button>}
                      </div>
                    </div>;
                  })}
                </div>
              </section>)}
              {paginacao()}
            </div>}
        </>}

        {aba === "wait" && <>
          <div className="cabecalho-pagina"><div><span className="sobretitulo">Matrículas</span><h1>Lista de espera</h1>
            <p>Acompanhe turmas lotadas nas quais você demonstrou interesse.</p></div></div>
          <div className="informativo"><strong>O que significa entrar na lista de espera?</strong>
            <p>Você manifesta interesse em uma turma sem vagas. Isso não garante a matrícula. Se uma vaga surgir, a ordem de espera e as regras acadêmicas serão verificadas.</p></div>
          {carregando ? <div className="vazio" role="status">Carregando lista…</div> : esperas.length === 0 ?
            <div className="vazio"><h3>Nenhuma turma na lista de espera</h3><p>Encontre uma turma lotada em Fazer matrícula e use “Entrar na espera”.</p>
              <button className="botao-primario" type="button" onClick={() => navegar("enroll")}>Ver ofertas</button></div> :
            <section className="painel">
              {esperas.map((e) => <div className="linha" key={e.id}>
                <div><strong>{e.turma.disciplina.nome} · Turma {e.turma.codigo}</strong>
                  <p>{horas(e.turma as Turma)} · {e.turma.disciplina.cargaHoraria}h</p><span className="etiqueta etiqueta-espera">Aguardando vaga</span></div>
                <button type="button" className="botao-claro" disabled={ocupado} onClick={() => void cancelarRegistro(e.id, "espera")}>Sair da lista</button>
              </div>)}
            </section>}
        </>}

        {aba === "catalog" && <>
          <div className="cabecalho-pagina"><div><span className="sobretitulo">Catálogo acadêmico</span><h1>Disciplinas</h1>
            <p>Veja o conteúdo de cada disciplina, consulte a carga horária e salve favoritas.</p></div></div>
          {barraBusca()}
          {carregando ? <div className="vazio" role="status">Carregando disciplinas…</div> : filtrados.length === 0 ?
            <div className="vazio"><h3>Nenhuma disciplina encontrada</h3><p>Experimente outro filtro ou nome.</p></div> :
            <><div className="catalogo">
              {mostrados.map((g) => <article className="disciplina" key={g.id}>
                <div className="disciplina-topo"><div><h3>{g.nome}</h3><p>{g.codigo}</p></div>
                  <button type="button" className={"favorito " + (favoritos.includes(g.id) ? "favoritado" : "")}
                    aria-pressed={favoritos.includes(g.id)} aria-label={(favoritos.includes(g.id) ? "Remover dos favoritos: " : "Favoritar disciplina: ") + g.nome}
                    onClick={() => favoritar(g.id)}>{favoritos.includes(g.id) ? "♥" : "♡"}</button></div>
                <div className="disciplina-etiquetas"><span className="etiqueta">{g.cargaHoraria} horas</span><span className="etiqueta">{g.turmas.length} turma(s) ofertada(s)</span></div>
                <details className="ementa"><summary>Ler ementa e conteúdo da disciplina</summary>
                  <p>{g.ementa || "Ementa ainda não cadastrada pela coordenação."}</p></details>
              </article>)}
            </div>{paginacao()}</>}
        </>}

        {aba === "hours" && <>
          <div className="cabecalho-pagina"><div><span className="sobretitulo">Ensino e estrutura curricular</span><h1>Carga horária</h1>
            <p>Entenda as horas necessárias em cada grupo para concluir o curso.</p></div></div>
          <div className="informativo"><strong>Como ler esta página</strong>
            <p>Carga horária concluída é diferente de carga horária matriculada. Escolher uma turma não significa que suas horas já foram concluídas.</p></div>
          <div className="categorias">
            {[
              ["Obrigatórias", "Disciplinas exigidas na estrutura curricular do seu curso."],
              ["Eletivas de perfil", "Disciplinas opcionais previstas no perfil do curso."],
              ["Eletivas livres", "Disciplinas de fora da estrutura curricular do curso."],
            ].map(([nome, descricao]) => <article className="categoria" key={nome}>
              <h3>{nome}</h3><p>{descricao}</p><strong>CH exigida: a definir</strong><small>Histórico e estrutura curricular ainda não cadastrados.</small>
            </article>)}
          </div>
          <section className="painel">
            <div className="cabecalho-secao"><h2>Seu acompanhamento acadêmico</h2><span className="etiqueta">Dados disponíveis</span></div>
            <div className="linha"><div><strong>Carga horária em curso</strong><p>Somente as turmas em que você está matriculado neste semestre.</p></div><strong>{horasEmCurso}h</strong></div>
            <div className="linha"><div><strong>Carga horária integralizada</strong><p>Depende das aprovações do seu histórico acadêmico.</p></div><strong>Não disponível</strong></div>
            <div className="linha"><div><strong>Carga horária restante</strong><p>Depende das exigências curriculares do curso.</p></div><strong>Não disponível</strong></div>
            <div className="explicacao">
              <h3>O que significa cada categoria?</h3>
              <details><summary>Disciplinas obrigatórias</summary><p>São previstas como obrigatórias na estrutura curricular do curso.</p></details>
              <details><summary>Eletivas de perfil</summary><p>São eletivas previstas na estrutura do curso; a carga excedente pode contar como eletiva livre conforme as regras curriculares.</p></details>
              <details><summary>Eletivas livres</summary><p>São disciplinas fora da estrutura curricular do seu curso.</p></details>
              <details><summary>O que conta como carga horária concluída?</summary><p>Apenas disciplinas aprovadas no histórico. Reprovações não contam e as turmas em curso devem aparecer separadamente.</p></details>
            </div>
            <p className="nota">Não exibimos percentuais ou metas fictícias como se fossem dados da sua matrícula. O cálculo completo será habilitado quando o histórico e a estrutura curricular estiverem disponíveis.</p>
          </section>
        </>}
      </main>
      <footer className="rodape">Sistema de Matrícula · Protótipo acadêmico · Dados de demonstração</footer>
    </div>
  );
}

export default App;
