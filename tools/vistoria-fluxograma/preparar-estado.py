"""Monta o "mundo de teste" da vistoria da juncao: copia do estado guardado do Orca em uso, com as pastas
trocadas por pastas de teste. O Orca de teste nunca enxerga (nem escreve em) a pasta de verdade.

O que copia (sempre so leitura no Orca em uso): o banco de estado do perfil, o log da hierarquia, o indice de perfis, o
armazenamento local (posicoes arrastadas dos cards) e o ultimo estado dos agentes. O que troca: todo
caminho sob Desktop\\Projetos e sob orca\\workspaces vira um caminho dentro do mundo de teste, e cada
projeto que tem chat ganha ali um repositorio git vazio (mais as copias de trabalho dos chats) com a
copia do .hierarquia/estado.json de verdade.

Uso: python preparar-estado.py <pasta-do-mundo>
Saida: o mundo em <pasta-do-mundo>/perfil (dados do Orca de teste) e <pasta-do-mundo>/projetos.
"""

import glob
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys

PERFIL_EM_USO = os.path.join(os.environ["APPDATA"], "orca-fork")
RAIZES_REAIS = ("C:/Users/User/Desktop/Projetos", "C:/Users/User/orca/workspaces")
GIT = shutil.which("git") or r"C:\Program Files\Git\cmd\git.exe"


def barras(texto):
    return texto.replace("\\", "/")


def trocar_caminhos(texto, mundo):
    """Troca as raizes reais (com barra normal e com barra invertida escapada no JSON) pelas do mundo."""
    destinos = (mundo + "/projetos", mundo + "/workspaces")
    for real, novo in zip(RAIZES_REAIS, destinos):
        texto = texto.replace(real, novo)
        texto = texto.replace(real.replace("/", "\\\\"), novo.replace("/", "\\\\"))
    return texto


def git(pasta, *args):
    subprocess.run(
        [GIT, "-c", "user.name=vistoria", "-c", "user.email=vistoria@example.invalid", *args],
        cwd=pasta,
        check=True,
        capture_output=True,
    )


def criar_repositorio(pasta):
    os.makedirs(pasta, exist_ok=True)
    git(pasta, "init", "-q")
    with open(os.path.join(pasta, "LEIAME.txt"), "w", encoding="utf-8") as arquivo:
        arquivo.write("pasta de teste da vistoria do fluxograma\n")
    git(pasta, "add", "LEIAME.txt")
    git(pasta, "commit", "-q", "-m", "teste")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    mundo = barras(os.path.abspath(sys.argv[1]))
    perfil = os.path.join(mundo, "perfil")
    shutil.rmtree(mundo, ignore_errors=True)
    os.makedirs(os.path.join(perfil, "profiles", "local-default"))

    origem_perfil = os.path.join(PERFIL_EM_USO, "profiles", "local-default")
    origem_banco = os.path.join(origem_perfil, "profile-state.db")
    leitura = sqlite3.connect("file:" + barras(origem_banco) + "?mode=ro", uri=True)
    documentos = {
        dominio: carga for dominio, carga in leitura.execute("select domain, payload from profile_state_documents")
    }
    leitura.close()
    sessao = json.loads(documentos["workspaceSession"])
    repos = json.loads(documentos["repos"])
    abas = {pasta: lista for pasta, lista in (sessao.get("tabsByWorktree") or {}).items() if lista}
    repos_com_chat = {pasta.partition("::")[0] for pasta in abas}
    # Projetos que um caso de prova pede mesmo sem chat aberto hoje (nomes separados por virgula).
    manter = [n.strip().lower() for n in os.environ.get("VISTORIA_MANTER_REPOS", "").split(",") if n.strip()]
    repos_com_chat |= {r["id"] for r in repos if (r.get("displayName") or "").lower() in manter}

    # So os projetos que tem chat entram: o resto da lista nao muda o desenho do fluxograma.
    documentos["repos"] = json.dumps([r for r in repos if r["id"] in repos_com_chat])

    # Copia o banco inteiro (tabelas e controle) e reescreve so o conteudo e o hash de cada documento.
    destino_banco = os.path.join(perfil, "profiles", "local-default", "profile-state.db")
    leitura = sqlite3.connect("file:" + barras(origem_banco) + "?mode=ro", uri=True)
    banco_novo = sqlite3.connect(destino_banco)
    leitura.backup(banco_novo)
    leitura.close()
    for dominio, carga in documentos.items():
        nova = trocar_caminhos(carga, mundo)
        banco_novo.execute(
            "update profile_state_documents set payload=?, content_hash=? where domain=?",
            (nova, hashlib.sha256(nova.encode("utf-8")).hexdigest(), dominio),
        )
    banco_novo.commit()
    banco_novo.execute("pragma wal_checkpoint(truncate)")
    banco_novo.close()

    for nome in ("profile-state.db.authority", "active-view.json"):
        if os.path.exists(os.path.join(origem_perfil, nome)):
            shutil.copy(os.path.join(origem_perfil, nome), os.path.join(perfil, "profiles", "local-default", nome))
    shutil.copy(os.path.join(PERFIL_EM_USO, "orca-profile-index.json"), perfil)

    # Posicoes arrastadas dos cards (armazenamento local do Orca em uso), como estavam.
    origem_local = os.path.join(PERFIL_EM_USO, "Local Storage")
    if os.path.isdir(origem_local):
        shutil.copytree(
            origem_local,
            os.path.join(perfil, "Local Storage"),
            ignore=shutil.ignore_patterns("LOCK"),
            dirs_exist_ok=True,
        )

    # Ultimo estado dos agentes, para os cards nascerem com o estado de agora.
    for arquivo in glob.glob(os.path.join(PERFIL_EM_USO, "agent-hooks", "*", "last-status.json")):
        destino = os.path.join(perfil, "agent-hooks", os.path.basename(os.path.dirname(arquivo)))
        os.makedirs(destino, exist_ok=True)
        shutil.copy(arquivo, destino)

    # Pastas de teste: um repositorio git vazio por projeto com chat e uma copia de trabalho por pasta de chat.
    for repo in repos:
        if repo["id"] not in repos_com_chat:
            continue
        pasta = trocar_caminhos(barras(repo["path"]), mundo)
        criar_repositorio(pasta)
        estado_real = os.path.join(repo["path"], ".hierarquia", "estado.json")
        if os.path.exists(estado_real):
            os.makedirs(os.path.join(pasta, ".hierarquia"), exist_ok=True)
            with open(estado_real, encoding="utf-8") as arquivo:
                conteudo = arquivo.read()
            with open(os.path.join(pasta, ".hierarquia", "estado.json"), "w", encoding="utf-8") as arquivo:
                arquivo.write(trocar_caminhos(conteudo, mundo))
        # O comando `hierarquia` refaz o estado a partir do log: sem ele, abrir um PO de teste apagaria os chats antigos.
        for nome in ("registro.jsonl", "config.json"):
            origem_arquivo = os.path.join(repo["path"], ".hierarquia", nome)
            if os.path.exists(origem_arquivo):
                with open(origem_arquivo, encoding="utf-8") as arquivo:
                    conteudo = arquivo.read()
                with open(os.path.join(pasta, ".hierarquia", nome), "w", encoding="utf-8") as arquivo:
                    arquivo.write(trocar_caminhos(conteudo, mundo))
        for pasta_id in abas:
            if pasta_id.partition("::")[0] != repo["id"]:
                continue
            caminho = trocar_caminhos(barras(pasta_id.partition("::")[2]), mundo)
            if os.path.normcase(os.path.normpath(caminho)) != os.path.normcase(os.path.normpath(pasta)):
                os.makedirs(os.path.dirname(caminho), exist_ok=True)
                git(pasta, "worktree", "add", "--detach", "-q", caminho)
    print(mundo)


if __name__ == "__main__":
    main()
