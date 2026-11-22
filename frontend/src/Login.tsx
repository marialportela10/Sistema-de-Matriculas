import { useState } from "react";
import type { FormEvent } from "react";
import { api, type Aluno } from "./api";
import "./Login.css";

type Props = { onEntrar: (aluno: Aluno) => void };

export default function Login({ onEntrar }: Props) {
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [curso, setCurso] = useState("Sistemas de Informação");
  const [numeroMatricula, setNumeroMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const aluno = cadastrando
        ? await api.cadastrarConta({ nome, email, numeroMatricula, senha, curso })
        : await api.entrar(numeroMatricula, senha);
      setSenha("");
      onEntrar(aluno);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível acessar o sistema.");
    } finally {
      setCarregando(false);
    }
  }

  function alternarModo() {
    setCadastrando((atual) => !atual);
    setErro(null);
    setSenha("");
    setMostrarSenha(false);
  }

  return (
    <div className="pagina-login">
      <div className="login-coluna-apresentacao">
        <span className="login-marca">Sistema de Matrícula</span>
        <div className="login-texto">
          <span className="login-sobre">Sistema de Matrícula</span>
          <h1>Seu semestre começa aqui.</h1>
          <p>Acesse suas turmas, acompanhe as vagas e organize suas escolhas com tranquilidade.</p>
        </div>
        <div className="login-nota">Ambiente de demonstração acadêmica</div>
      </div>

      <main className="login-coluna-formulario">
        <section className="login-card" aria-labelledby="login-titulo">
          <div className="login-simbolo" aria-hidden="true">M</div>
          <h2 id="login-titulo">{cadastrando ? "Criar conta de teste" : "Acessar minha conta"}</h2>
          <p className="login-descricao">
            {cadastrando
              ? "Cadastre uma matrícula e uma senha para testar o sistema."
              : "Entre com seu número de matrícula e sua senha."}
          </p>

          {erro && <div className="login-erro" role="alert">{erro}</div>}

          <form className="login-form" onSubmit={(event) => void enviar(event)}>
            {cadastrando && (
              <>
                <label htmlFor="login-nome">Nome completo</label>
                <input id="login-nome" type="text" autoComplete="name" maxLength={120}
                  value={nome} onChange={(event) => setNome(event.target.value)}
                  placeholder="Seu nome" required />

                <label htmlFor="login-curso">Curso</label>
                <select id="login-curso" value={curso} onChange={(event) => setCurso(event.target.value)} required>
                  <option value="Sistemas de Informação">Sistemas de Informação</option>
                  <option value="Ciência da Computação">Ciência da Computação</option>
                </select>

                <label htmlFor="login-email">E-mail</label>
                <input id="login-email" type="email" autoComplete="email" maxLength={254}
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  placeholder="seuemail@exemplo.com" required />
              </>
            )}

            <label htmlFor="login-matricula">Número de matrícula</label>
            <input id="login-matricula" type="text" autoComplete="username"
              maxLength={32} value={numeroMatricula}
              onChange={(event) => setNumeroMatricula(event.target.value)}
              placeholder="Digite sua matrícula" required />

            <label htmlFor="login-senha">Senha</label>
            <div className="login-campo-senha">
              <input id="login-senha" type={mostrarSenha ? "text" : "password"}
                autoComplete={cadastrando ? "new-password" : "current-password"}
                minLength={cadastrando ? 8 : undefined} maxLength={128}
                value={senha} onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite sua senha" required />
              <button className="login-mostrar" type="button" aria-pressed={mostrarSenha}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setMostrarSenha((valor) => !valor)}>
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {cadastrando && <p className="login-ajuda">Sua senha deve ter pelo menos 8 caracteres.</p>}

            <button type="submit" className="botao-primario login-entrar" disabled={carregando}>
              {carregando ? "Aguarde…" : cadastrando ? "Criar conta e entrar" : "Entrar no sistema"}
            </button>
          </form>

          <div className="login-alternar">
            <span>{cadastrando ? "Já tem uma conta?" : "Ainda não tem conta de teste?"}</span>
            <button className="link-button" type="button" onClick={alternarModo}>
              {cadastrando ? "Fazer login" : "Criar conta"}
            </button>
          </div>
          <p className="login-aviso">Use apenas dados fictícios. O cadastro aberto é exclusivo deste protótipo.</p>
        </section>
      </main>
    </div>
  );
}
