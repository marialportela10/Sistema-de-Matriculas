import { useEffect, useMemo, useState } from "react";
import { api, type Aluno, type Espera, type Matricula, type Turma } from "./api";
import Login from "./Login";
import "./App.css";

type Aba = "ofertas" | "matriculas" | "planejamento" | "progresso";
type Aviso = { tipo: "sucesso" | "erro" | "espera"; texto: string };
type Pedido = { turma: Turma; tipo: "matricula" | "espera" };

const DIAS: Record<number, string> = {
  1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom",
};
const PAGINA_TAMANHO = 6;

function horarios(turma: Turma): string {
  if (!turma.horarios.length) return "Horário a definir";
  return [...turma.horarios]
    .sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio))
    .map((h) => `${DIAS[h.diaSemana] ?? "Dia"} ${h.inicio}–${h.fim}`)
    .join(" · ");
}

function buscarParametro(nome: string): string {
  return new URLSearchParams(window.location.search).get(nome) ?? "";
}

function favoritosSalvos(): string[] {
  try {
    const dados: unknown = JSON.parse(localStorage.getItem("turmasFavoritas") ?? "[]");
    return Array.isArray(dados) ? dados.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function conflitosNoPlano(turmas: Turma[]): string[] {
  const conflitos: string[] = [];
  for (let i = 0; i < turmas.length; i++) {
    for (let j = i + 1; j < turmas.length; j++) {
      const a = turmas[i];
      const b = turmas[j];
      if (a.periodo !== b.periodo) continue;
      if (a.disciplinaId === b.disciplinaId) {
        conflitos.push(`${a.id} e ${b.id}: mesma disciplina`);
      } else if (a.horarios.some((x) =>
        b.horarios.some((y) =>
          x.diaSemana === y.diaSemana && x.inicio < y.fim && y.inicio < x.fim,
        )
      )) {
        conflitos.push(`${a.id} e ${b.id}: horários sobrepostos`);
      }
    }
  }
  return conflitos;
}

function App() {
  const [aba, setAba] = useState<Aba>("ofertas");
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [esperas, setEsperas] = useState<Espera[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [filtro, setFiltro] = useState(() => buscarParametro("busca"));
  const [pagina, setPagina] = useState(() => Math.max(1, Number(buscarParametro("pagina")) || 1));
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [favoritos, setFavoritos] = useState<string[]>(favoritosSalvos);
  const [plano, setPlano] = useState<string[]>([]);

  async function carregarTurmas() {
    setCarregando(true);
    try {
      setTurmas(await api.turmas());
    } catch (error) {
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro ao carregar turmas." });
    } finally {
      setCarregando(false);
    }
  }

  async function atualizarDadosAluno(id: number) {
    const [novasMatriculas, novasEsperas] = await Promise.all([
      api.matriculas(id), api.esperas(id),
    ]);
    setMatriculas(novasMatriculas);
    setEsperas(novasEsperas);
  }

  useEffect(() => {
    let ativo = true;
    void api.sessao().then((dados) => {
      if (ativo) setAluno(dados);
    }).catch(() => {
      // Sem sessão ativa: a tela de login será exibida.
    }).finally(() => {
      if (ativo) setVerificandoSessao(false);
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (!aluno) return;
    let ativo = true;
    void api.turmas().then((dados) => {
      if (ativo) setTurmas(dados);
    }).catch((error: unknown) => {
      if (ativo) setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro ao carregar turmas." });
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [aluno]);

  useEffect(() => {
    if (!aluno) return;
    let ativo = true;
    void Promise.all([api.matriculas(aluno.id), api.esperas(aluno.id)])
      .then(([novasMatriculas, novasEsperas]) => {
        if (ativo) {
          setMatriculas(novasMatriculas);
          setEsperas(novasEsperas);
        }
      }).catch((error: unknown) => {
        if (ativo) setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro ao buscar matrículas." });
      });
    return () => { ativo = false; };
  }, [aluno]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filtro) params.set("busca", filtro);
    else params.delete("busca");
    if (pagina > 1) params.set("pagina", String(pagina));
    else params.delete("pagina");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }, [filtro, pagina]);

  const filtradas = useMemo(() => turmas.filter((turma) => {
    const termo = filtro.trim().toLocaleLowerCase("pt-BR");
    const nomeTurma = `${turma.id} ${turma.disciplina.codigo} ${turma.disciplina.nome} ${turma.codigo}`;
    return nomeTurma.toLocaleLowerCase("pt-BR").includes(termo) &&
      (!soFavoritos || favoritos.includes(turma.id));
  }), [turmas, filtro, soFavoritos, favoritos]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGINA_TAMANHO));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const mostradas = filtradas.slice((paginaAtual - 1) * PAGINA_TAMANHO, paginaAtual * PAGINA_TAMANHO);
  const turmasPlanejadas = turmas.filter((t) => plano.includes(t.id));
  const conflitos = conflitosNoPlano(turmasPlanejadas);
  const cargaPlanejada = turmasPlanejadas.reduce((total, t) => total + t.disciplina.cargaHoraria, 0);
  const cargaMatriculada = matriculas.reduce((total, m) => total + m.turma.disciplina.cargaHoraria, 0);

  async function sair() {
    setOcupado(true);
    try {
      await api.sair();
      setAluno(null);
      setMatriculas([]);
      setEsperas([]);
      setPedido(null);
      setPlano([]);
      setTurmas([]);
      setAviso(null);
      setAba("ofertas");
    } catch (error) {
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Erro ao sair." });
    } finally {
      setOcupado(false);
    }
  }

  function favoritar(id: string) {
    const atualizados = favoritos.includes(id)
      ? favoritos.filter((item) => item !== id)
      : [...favoritos, id];
    setFavoritos(atualizados);
    localStorage.setItem("turmasFavoritas", JSON.stringify(atualizados));
  }

  function alternarPlano(id: string) {
    setPlano((lista) => lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]);
  }

  function iniciarPedido(turma: Turma, tipo: "matricula" | "espera") {
    if (!aluno) {
      setAviso({ tipo: "erro", texto: "Identifique o aluno antes de solicitar uma matrícula." });
      return;
    }
    setAviso(null);
    setPedido({ turma, tipo });
  }

  async function confirmarPedido() {
    if (!aluno || !pedido) return;
    setOcupado(true);
    try {
      if (pedido.tipo === "matricula") {
        await api.matricular(aluno.id, pedido.turma.id);
      } else {
        await api.entrarNaFila(aluno.id, pedido.turma.id);
      }
      setAviso(pedido.tipo === "matricula"
        ? { tipo: "sucesso", texto: `Matrícula na turma ${pedido.turma.id} confirmada.` }
        : { tipo: "espera", texto: `Você entrou na lista de espera da turma ${pedido.turma.id}.` });
      setPedido(null);
      setAba("matriculas");
      await Promise.all([carregarTurmas(), atualizarDadosAluno(aluno.id)]);
    } catch (error) {
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível continuar." });
    } finally {
      setOcupado(false);
    }
  }

  async function cancelar(id: number, tipo: "matricula" | "espera") {
    if (!aluno || !window.confirm(tipo === "matricula"
      ? "Deseja cancelar esta matrícula? Uma pessoa da lista de espera pode receber a vaga."
      : "Deseja sair da lista de espera?")) return;
    setOcupado(true);
    try {
      if (tipo === "matricula") await api.cancelar(id, aluno.id);
      else await api.sairDaFila(id, aluno.id);
      await Promise.all([carregarTurmas(), atualizarDadosAluno(aluno.id)]);
      setAviso({ tipo: "sucesso", texto: tipo === "matricula" ? "Matrícula cancelada." : "Saída da lista confirmada." });
    } catch (error) {
      setAviso({ tipo: "erro", texto: error instanceof Error ? error.message : "Não foi possível cancelar." });
    } finally {
      setOcupado(false);
    }
  }

  if (verificandoSessao) {
    return <div className="pagina-carregando" role="status">Verificando acesso ao sistema…</div>;
  }

  if (!aluno) {
    return <Login onEntrar={(conta) => { setAviso(null); setAluno(conta); }} />;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <span className="eyebrow">Portal acadêmico · demonstração</span>
          <h1>Sistema de Matrícula</h1>
          <p className="subtitle">Encontre turmas, confira horários e organize seu semestre.</p>
        </div>
        {aluno && (
          <div className="usuario">
            <span>Aluno: <strong>{aluno.nome}</strong></span>
            <button className="link-button" onClick={() => void sair()} type="button" disabled={ocupado}>Sair</button>
          </div>
        )}
      </header>

      <nav className="nav-principal" aria-label="Navegação principal">
        {([
          ["ofertas", "Ofertas"],
          ["matriculas", "Minhas matrículas"],
          ["planejamento", "Planejamento"],
          ["progresso", "Progresso"],
        ] as const).map(([chave, titulo]) => (
          <button key={chave} type="button" onClick={() => { setAba(chave); setPedido(null); }}
            className={aba === chave ? "nav-ativa" : ""} aria-current={aba === chave ? "page" : undefined}>
            {titulo}
          </button>
        ))}
      </nav>

      <main>
        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === "erro" ? "alert" : "status"}>
            <strong>{aviso.tipo === "erro" ? "Não foi possível concluir" : aviso.tipo === "espera" ? "Lista de espera" : "Tudo certo!"}</strong>
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">×</button>
          </div>
        )}

        {aba === "ofertas" && (
          <section aria-labelledby="titulo-ofertas">
            <div className="titulo-secao">
              <div><h2 id="titulo-ofertas">Ofertas de turmas</h2><p>Compare horários e vagas antes de confirmar.</p></div>
              <button className="botao-secundario" type="button" onClick={() => void carregarTurmas()} disabled={carregando}>Atualizar</button>
            </div>
            <div className="painel barra-filtros">
              <label className="campo-busca">Buscar disciplina ou turma
                <input type="search" placeholder="Ex.: programação, IP ou IP0001" value={filtro}
                  onChange={(e) => { setFiltro(e.target.value); setPagina(1); }} />
              </label>
              <label className="favoritos-filtro"><input type="checkbox" checked={soFavoritos}
                onChange={(e) => { setSoFavoritos(e.target.checked); setPagina(1); }} /> Mostrar só favoritos</label>
            </div>

            {pedido ? (
              <section className="painel revisao" aria-labelledby="titulo-revisao">
                <span className="eyebrow">Etapa 2 de 3 · Revisar pedido</span>
                <h3 id="titulo-revisao">Confira antes de confirmar</h3>
                <p><strong>{pedido.turma.disciplina.nome}</strong> — turma {pedido.turma.codigo} ({pedido.turma.id})</p>
                <p>{horarios(pedido.turma)} · {pedido.turma.periodo}</p>
                <p>{pedido.tipo === "matricula"
                  ? "Você está solicitando uma matrícula nesta turma."
                  : "Você está solicitando uma vaga na lista de espera."}</p>
                <div className="acoes-revisao">
                  <button type="button" className="botao-secundario" onClick={() => setPedido(null)} disabled={ocupado}>Voltar sem perder a escolha</button>
                  <button type="button" className="botao-primario" onClick={() => void confirmarPedido()} disabled={ocupado}>
                    {ocupado ? "Processando…" : pedido.tipo === "matricula" ? "Confirmar matrícula" : "Confirmar lista de espera"}
                  </button>
                </div>
              </section>
            ) : carregando ? (
              <p className="estado-vazio" role="status">Carregando turmas…</p>
            ) : filtradas.length === 0 ? (
              <div className="estado-vazio"><h3>Nenhuma turma encontrada</h3><p>Tente outra busca ou desmarque o filtro de favoritos.</p></div>
            ) : (
              <>
                <p className="resultado-contagem" aria-live="polite">{filtradas.length} turma(s) encontrada(s)</p>
                <div className="grid-turmas">
                  {mostradas.map((turma) => {
                    const cheia = turma.vagasDisponiveis <= 0;
                    const jaMatriculada = matriculas.some((m) => m.turmaId === turma.id);
                    const emEspera = esperas.some((e) => e.turmaId === turma.id);
                    return (
                      <article className="card-turma" key={turma.id}>
                        <div className="linha-card">
                          <span className="codigo-turma">{turma.id}</span>
                          <button type="button" className="botao-favorito" onClick={() => favoritar(turma.id)}
                            aria-pressed={favoritos.includes(turma.id)}
                            aria-label={favoritos.includes(turma.id) ? `Remover ${turma.id} dos favoritos` : `Favoritar ${turma.id}`}>
                            {favoritos.includes(turma.id) ? "★" : "☆"}
                          </button>
                        </div>
                        <h3>{turma.disciplina.nome}</h3>
                        <p className="linha-dados">Turma {turma.codigo} · {turma.periodo} · {turma.disciplina.cargaHoraria}h</p>
                        <p className="linha-dados"><strong>Horários:</strong> {horarios(turma)}</p>
                        <span className={`estado-vagas ${cheia ? "estado-lotada" : "estado-disponivel"}`}>
                          {cheia ? "Turma lotada" : `${turma.vagasDisponiveis} vaga(s) disponível(is)`}
                        </span>
                        <div className="acoes-card">
                          <button type="button" className="botao-primario" disabled={ocupado || jaMatriculada || emEspera}
                            onClick={() => iniciarPedido(turma, cheia ? "espera" : "matricula")}>
                            {jaMatriculada ? "Matriculado" : emEspera ? "Na lista de espera" : cheia ? "Entrar na lista" : "Solicitar matrícula"}
                          </button>
                          <button type="button" className="botao-secundario" aria-pressed={plano.includes(turma.id)}
                            onClick={() => alternarPlano(turma.id)}>
                            {plano.includes(turma.id) ? "Tirar do plano" : "Planejar"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="paginacao">
                  <button className="botao-secundario" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)}>Anterior</button>
                  <span>Página {paginaAtual} de {totalPaginas}</span>
                  <button className="botao-secundario" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>Próxima</button>
                </div>
              </>
            )}
          </section>
        )}

        {aba === "matriculas" && (
          <section aria-labelledby="titulo-minhas">
            <div className="titulo-secao"><div><h2 id="titulo-minhas">Minhas matrículas</h2><p>Acompanhe confirmações e listas de espera.</p></div></div>
            {!aluno ? <p className="estado-vazio">Identifique um aluno acima para consultar as matrículas.</p> : (
              <div className="lista-registros">
                {matriculas.length === 0 && esperas.length === 0 && <p className="estado-vazio">Nenhuma matrícula ou espera encontrada.</p>}
                {matriculas.map((m) => (
                  <article className="painel registro" key={`m-${m.id}`}>
                    <div><span className="estado-vagas estado-confirmada">Matrícula confirmada</span>
                      <h3>{m.turma.disciplina.nome} · {m.turma.id}</h3>
                      <p>{m.turma.periodo} · {m.turma.codigo}</p></div>
                    <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => void cancelar(m.id, "matricula")}>Cancelar matrícula</button>
                  </article>
                ))}
                {esperas.map((e) => (
                  <article className="painel registro" key={`e-${e.id}`}>
                    <div><span className="estado-vagas estado-espera">Na lista de espera</span>
                      <h3>{e.turma.disciplina.nome} · {e.turma.id}</h3>
                      <p>{e.turma.periodo} · {e.turma.codigo}</p></div>
                    <button type="button" className="botao-secundario" disabled={ocupado} onClick={() => void cancelar(e.id, "espera")}>Sair da lista</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {aba === "planejamento" && (
          <section aria-labelledby="titulo-plano">
            <div className="titulo-secao"><div><h2 id="titulo-plano">Simulador de planejamento</h2>
              <p>Experimente combinações antes de solicitar matrículas. O plano não reserva vagas.</p></div></div>
            <div className="painel resumo-plano">
              <div><strong>{turmasPlanejadas.length}</strong><span>Turmas selecionadas</span></div>
              <div><strong>{cargaPlanejada}h</strong><span>Carga horária planejada</span></div>
              <div><strong>{conflitos.length}</strong><span>Possíveis conflitos</span></div>
            </div>
            {conflitos.length > 0 && <div className="aviso aviso-erro" role="alert">
              <strong>Revise seu plano</strong>
              <ul>{conflitos.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>}
            {turmasPlanejadas.length === 0 ? <p className="estado-vazio">Na aba Ofertas, clique em “Planejar” nas turmas desejadas.</p> :
              <div className="lista-registros">{turmasPlanejadas.map((t) => (
                <div className="painel registro" key={t.id}><div><h3>{t.disciplina.nome} · {t.id}</h3>
                  <p>{horarios(t)}</p></div>
                  <button className="botao-secundario" type="button" onClick={() => alternarPlano(t.id)}>Remover</button></div>
              ))}</div>}
          </section>
        )}

        {aba === "progresso" && (
          <section aria-labelledby="titulo-progresso">
            <div className="titulo-secao"><div><h2 id="titulo-progresso">Progresso acadêmico</h2>
              <p>Resumo das turmas do semestre atual.</p></div></div>
            {!aluno ? <p className="estado-vazio">Identifique um aluno acima para ver seu resumo.</p> :
              <div className="painel resumo-plano">
                <div><strong>{matriculas.length}</strong><span>Matrículas ativas</span></div>
                <div><strong>{cargaMatriculada}h</strong><span>Carga horária matriculada</span></div>
                <div><strong>{esperas.length}</strong><span>Listas de espera</span></div>
              </div>}
            <p className="observacao">Este resumo mostra apenas matrículas do sistema de demonstração; ainda não calcula créditos concluídos nem percentual de integralização curricular.</p>
          </section>
        )}
      </main>
      <footer className="site-footer">Sistema de Matrícula · Protótipo acadêmico. Não utilize dados pessoais reais.</footer>
    </div>
  );
}

export default App;
