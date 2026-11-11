"""Copia o estado real do Orca em uso para um arquivo que o print do fluxograma carrega.

Le (sem escrever) o banco de estado do perfil, o ultimo estado dos agentes, a hierarquia de cada
pasta e o tamanho do contexto de cada conversa. Grava em .cache/vistoria-fluxograma/estado.json,
que fica fora do git porque tem texto das conversas.

Uso: python tools/vistoria-fluxograma/capturar.py
"""

import glob
import json
import os
import sqlite3
import subprocess
import sys
import time

PERFIL = os.path.join(os.environ["APPDATA"], "orca-fork")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAIDA = os.path.join(RAIZ, ".cache", "vistoria-fluxograma", "estado.json")
CAUDA = 400_000
CAMPOS_DE_USO = (
    "input_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
    "output_tokens",
)


def documento(banco, dominio, padrao):
    linha = banco.execute(
        "select payload from profile_state_documents where domain=?", (dominio,)
    ).fetchone()
    return json.loads(linha[0]) if linha else padrao


def mesma_pasta(a, b):
    return os.path.normcase(os.path.normpath(a)) == os.path.normcase(os.path.normpath(b))


def tokens_de_contexto(caminho):
    """Mesma conta de src/shared/canvas-context-tokens.ts."""
    try:
        tamanho = os.path.getsize(caminho)
        with open(caminho, "rb") as arquivo:
            arquivo.seek(max(0, tamanho - CAUDA))
            linhas = arquivo.read().decode("utf-8", "replace").split("\n")
    except OSError:
        return None
    for linha in reversed(linhas):
        if not linha.startswith("{") or '"usage"' not in linha:
            continue
        try:
            registro = json.loads(linha)
        except ValueError:
            continue
        uso = (registro.get("message") or {}).get("usage")
        if registro.get("isSidechain") or not isinstance(uso, dict):
            continue
        if not isinstance(uso.get("input_tokens"), (int, float)):
            continue
        return sum(uso.get(campo) or 0 for campo in CAMPOS_DE_USO)
    return None


def pastas_que_o_orca_conhece():
    """A lista que a tela usa: pasta criada por fora do Orca fica de fora, como no app."""
    comando = os.path.join(PERFIL, "cli", "bin", "orca-dev.cmd")
    try:
        saida = subprocess.run(
            f'"{comando}" worktree list --json',
            shell=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=120,
        ).stdout
        util = "".join(l for l in saida.splitlines(keepends=True) if "_keepalive" not in l)
        return json.loads(util[util.index("{") :])["result"]["worktrees"]
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        return None


def chave(pasta_id):
    return os.path.normcase(pasta_id.replace("\\", "/"))


def pasta_do_orca(pasta_id, repo, dados):
    caminho = pasta_id.partition("::")[2]
    return {
        "id": pasta_id,
        "repoId": repo["id"],
        "path": caminho,
        "displayName": dados.get("displayName") or os.path.basename(caminho),
        "comment": "",
        "linkedIssue": None,
        "linkedPR": None,
        "linkedLinearIssue": None,
        "isArchived": bool(dados.get("isArchived")),
        "isUnread": False,
        "isPinned": False,
        "sortOrder": dados.get("sortOrder") or 0,
        "lastActivityAt": dados.get("lastActivityAt") or 0,
        "head": "",
        "branch": "",
        "isBare": False,
        "isMainWorktree": mesma_pasta(caminho, repo["path"]),
    }


def estado_do_agente(registro):
    carga = registro.get("payload") or {}
    entrada = {
        "paneKey": registro["paneKey"],
        "tabId": registro.get("tabId"),
        "worktreeId": registro.get("worktreeId"),
        "agentType": carga.get("agentType") or "claude",
        "state": carga["state"],
        "prompt": carga.get("prompt") or "",
        "updatedAt": registro.get("receivedAt") or 0,
        "stateStartedAt": registro.get("stateStartedAt") or 0,
        "stateHistory": [],
    }
    for campo in ("workingMode", "lastAssistantMessage", "mainAgent", "children", "model"):
        if carga.get(campo):
            entrada[campo] = carga[campo]
    for campo in ("turnStartedAt", "providerSession"):
        if registro.get(campo):
            entrada[campo] = registro[campo]
    return entrada


def ler_hierarquia(pasta):
    try:
        with open(os.path.join(pasta, ".hierarquia", "estado.json"), encoding="utf-8") as arquivo:
            foto = json.load(arquivo)
    except (OSError, ValueError):
        return None
    return {
        "folder": pasta,
        "chats": foto.get("chats") or {},
        "ordens": foto.get("ordens") or {},
        "fila": foto.get("fila") or [],
    }


def main():
    caminho_do_banco = os.path.join(PERFIL, "profiles", "local-default", "profile-state.db")
    banco = sqlite3.connect("file:" + caminho_do_banco.replace("\\", "/") + "?mode=ro", uri=True)
    repos = documento(banco, "repos", [])
    sessao = documento(banco, "workspaceSession", {})
    meta = documento(banco, "worktreeMeta", {})
    abas = {k: v for k, v in (sessao.get("tabsByWorktree") or {}).items() if v}
    dormindo = sessao.get("sleepingAgentSessionsByPaneKey") or {}

    repo_por_id = {repo["id"]: repo for repo in repos}
    pastas_por_repo = {}
    conhecidas = pastas_que_o_orca_conhece()
    if conhecidas is None:
        print("AVISO: o Orca nao respondeu; usando as pastas das abas (menos fiel).")
        for pasta_id in abas:
            repo = repo_por_id.get(pasta_id.partition("::")[0])
            if repo:
                pastas_por_repo.setdefault(repo["id"], []).append(
                    pasta_do_orca(pasta_id, repo, meta.get(pasta_id) or {})
                )
    else:
        id_real = {chave(pasta["id"]): pasta["id"] for pasta in conhecidas}
        abas = {id_real[chave(k)]: v for k, v in abas.items() if chave(k) in id_real}
        com_chat = {pasta_id.partition("::")[0] for pasta_id in abas}
        for pasta in conhecidas:
            if pasta["repoId"] in com_chat:
                pastas_por_repo.setdefault(pasta["repoId"], []).append(pasta)
        # Projeto que e so uma pasta (sem git) nao entra na lista de copias: a pasta dele e a propria raiz.
        for pasta_id, lista in (sessao.get("tabsByWorktree") or {}).items():
            repo = repo_por_id.get(pasta_id.partition("::")[0])
            if lista and repo and repo.get("kind") != "git" and repo["id"] not in pastas_por_repo:
                abas[pasta_id] = lista
                pastas_por_repo[repo["id"]] = [pasta_do_orca(pasta_id, repo, meta.get(pasta_id) or {})]

    agentes = {}
    arquivos = glob.glob(os.path.join(PERFIL, "agent-hooks", "*", "last-status.json"))
    if arquivos:
        with open(max(arquivos, key=os.path.getmtime), encoding="utf-8") as arquivo:
            entradas = json.load(arquivo).get("entries") or {}
            for registro in entradas.values() if isinstance(entradas, dict) else entradas:
                if registro.get("paneKey") and (registro.get("payload") or {}).get("state"):
                    agentes[registro["paneKey"]] = estado_do_agente(registro)

    pastas = [p["path"] for lista in pastas_por_repo.values() for p in lista]
    pastas += [repo["path"] for repo in repos if repo["id"] in pastas_por_repo]
    hierarquia = [h for h in map(ler_hierarquia, dict.fromkeys(pastas)) if h]

    contexto = {}
    for registro in list(agentes.values()) + list(dormindo.values()):
        caminho = (registro.get("providerSession") or {}).get("transcriptPath")
        tokens = tokens_de_contexto(caminho) if caminho else None
        if tokens is not None:
            contexto[caminho] = tokens

    estado = {
        "capturadoEm": int(time.time() * 1000),
        "store": {
            "repos": [repo for repo in repos if repo["id"] in pastas_por_repo],
            "worktreesByRepo": pastas_por_repo,
            "tabsByWorktree": abas,
            "agentStatusByPaneKey": agentes,
            "sleepingAgentSessionsByPaneKey": dormindo,
        },
        "hierarchy": hierarquia,
        "contextTokens": contexto,
    }
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as arquivo:
        json.dump(estado, arquivo, ensure_ascii=False)
    chats = sum(len(lista) for lista in abas.values())
    print(
        f"{len(estado['store']['repos'])} projetos, {chats} chats, {len(agentes)} estados, "
        f"{len(dormindo)} dormindo, {len(hierarquia)} hierarquias, {len(contexto)} contextos"
    )
    print(SAIDA)


if __name__ == "__main__":
    sys.exit(main())
