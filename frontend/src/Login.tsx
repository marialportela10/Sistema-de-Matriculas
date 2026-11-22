import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, type Aluno, type CursoOpcao, type Secretaria } from "./api";
import "./Login.css";

type Props = {
  onEntrar: (aluno: Aluno) => void;
  onEntrarSecretaria: (secretaria: Secretaria) => void;
};

export default function Login({ onEntrar, onEntrarSecretaria }: Props) {
  const [perfil, setPerfil] = useState<"aluno" | "secretaria">("aluno");
  const [cadastrando, setCadastrando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [curso, setCurso] = useState("");
  const [cursos, setCursos] = useState<CursoOpcao[]>([]);
  const [numeroMatricula, setNumeroMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let ativo = true;
    void api.cursos().then((dados) => { if (ativo) setCursos(dados); })
      .catch(() => { /* O erro também será mostrado se o aluno tentar cadastrar. */ });
    return () => { ativo = false; };
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      if (perfil === "secretaria") {
        const conta = await api.adminEntrar(numeroMatricula, senha);
        setSenha("");
        onEntrarSecretaria(conta);
      } else {
        const aluno = cadastrando
          ? await api.cadastrarConta({ nome, email, numeroMatricula, senha, curso })
          : await api.entrar(numeroMatricula, senha);
        setSenha("");
        onEntrar(aluno);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível acessar o sistema.");
    } finally {
      setCarregando(false);
    }
  }

  function trocarPerfil(proximo: "aluno" | "secretaria") {
    setPerfil(proximo);
    setCadastrando(false);
    setErro(null);
    setSenha("");
    setNumeroMatricula("");
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
          <span className="login-sobre">{perfil === "secretaria" ? "Secretaria de Graduação" : "Sistema de Matrícula"}</span>
          <h1>{perfil === "secretaria" ? "Gestão acadêmica organizada." : "Seu semestre começa aqui."}</h1>
          <p>{perfil === "secretaria" ? "Cadastre disciplinas e professores, abra turmas e acompanhe a ocupação das vagas." : "Acesse suas turmas, acompanhe as vagas e organize suas escolhas com tranquilidade."}</p>
        </div>
        <div className="login-nota">Ambiente de demonstração acadêmica</div>
      </div>

      <main className="login-coluna-formulario">
        <section className="login-card" aria-labelledby="login-titulo">
          <div className="login-simbolo" aria-hidden="true">M</div>
          <div className="login-perfis" role="group" aria-label="Tipo de acesso">
            <button type="button" aria-pressed={perfil === "aluno"}
              className={perfil === "aluno" ? "login-perfil-ativo" : ""}
              onClick={() => trocarPerfil("aluno")}>Aluno</button>
            <button type="button" aria-pressed={perfil === "secretaria"}
              className={perfil === "secretaria" ? "login-perfil-ativo" : ""}
              onClick={() => trocarPerfil("secretaria")}>Secretaria</button>
          </div>
          <h2 id="login-titulo">{perfil === "secretaria" ? "Acesso da Secretaria" : cadastrando ? "Criar conta de teste" : "Acessar minha conta"}</h2>
          <p className="login-descricao">
            {perfil === "secretaria"
              ? "Entre com o usuário e a senha cadastrados para a Secretaria."
              : cadastrando
                ? "Cadastre uma matrícula e uma senha para testar o sistema."
                : "Entre com seu número de matrícula e sua senha."}
          </p>

          {erro && <div className="login-erro" role="alert">{erro}</div>}

          <form className="login-form" onSubmit={(event) => void enviar(event)}>
            {perfil === "aluno" && cadastrando && (
              <>
                <label htmlFor="login-nome">Nome completo</label>
                <input id="login-nome" type="text" autoComplete="name" maxLength={120}
                  value={nome} onChange={(event) => setNome(event.target.value)}
                  placeholder="Seu nome" required />

                <label htmlFor="login-curso">Nome do curso</label>
                <input id="login-curso" type="text" list="login-cursos" autoComplete="off"
                  maxLength={120} value={curso} onChange={(event) => setCurso(event.target.value)}
                  placeholder="Ex.: Sistemas de Informação" required />
                <datalist id="login-cursos">
                  {cursos.map((item) => <option key={item.id} value={item.nome} />)}
                </datalist>
                <p className="login-ajuda">Digite ou selecione um curso já cadastrado no sistema.</p>

                <label htmlFor="login-email">E-mail</label>
                <input id="login-email" type="email" autoComplete="email" maxLength={254}
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  placeholder="seuemail@exemplo.com" required />
              </>
            )}

            <label htmlFor="login-matricula">{perfil === "secretaria" ? "Usuário da Secretaria" : "Número de matrícula"}</label>
            <input id="login-matricula" type="text" autoComplete="username"
              maxLength={32} value={numeroMatricula}
              onChange={(event) => setNumeroMatricula(event.target.value)}
              placeholder={perfil === "secretaria" ? "Digite seu usuário" : "Digite sua matrícula"} required />

            <label htmlFor="login-senha">Senha</label>
            <div className="login-campo-senha">
              <input id="login-senha" type={mostrarSenha ? "text" : "password"}
                autoComplete={perfil === "aluno" && cadastrando ? "new-password" : "current-password"}
                minLength={perfil === "aluno" && cadastrando ? 8 : undefined} maxLength={128}
                value={senha} onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite sua senha" required />
              <button className="login-mostrar" type="button" aria-pressed={mostrarSenha}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setMostrarSenha((valor) => !valor)}>
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {perfil === "aluno" && cadastrando && <p className="login-ajuda">Sua senha deve ter pelo menos 8 caracteres.</p>}

            <button type="submit" className="botao-primario login-entrar" disabled={carregando}>
              {carregando ? "Aguarde…" : perfil === "secretaria" ? "Entrar na Secretaria" : cadastrando ? "Criar conta e entrar" : "Entrar no sistema"}
            </button>
          </form>

          {perfil === "aluno" && <div className="login-alternar">
            <span>{cadastrando ? "Já tem uma conta?" : "Ainda não tem conta de teste?"}</span>
            <button className="link-button" type="button" onClick={alternarModo}>
              {cadastrando ? "Fazer login" : "Criar conta"}
            </button>
          </div>}
          <p className="login-aviso">{perfil === "secretaria" ? "Acesso restrito à gestão acadêmica. Use apenas as credenciais fictícias de demonstração." : "Use apenas dados fictícios. O cadastro aberto é exclusivo deste protótipo."}</p>
        </section>
      </main>
    </div>
  );
}
