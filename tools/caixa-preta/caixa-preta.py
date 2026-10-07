"""Caixa-preta do Orca (fork "PC como mesa").

Por que existe: o serviço de terminais do Orca (daemon) some do nada, sem log de saída,
sem crash no Windows. Só o kernel sabe quem pediu o encerramento. Este vigia escuta o ETW
(rastreamento do próprio Windows) e, quando o daemon morre, grava um relatório com:
  - quem chamou TerminateProcess nele (processo, comando, pais até o Claude);
  - o código de saída (crash de verdade x encerramento forçado);
  - processos que nasceram no último minuto e meio;
  - comandos que os agentes do Claude Code rodaram em volta do horário.

Precisa rodar como administrador (tarefa agendada "Orca caixa-preta", ver instalar.ps1).
Relatórios em %APPDATA%\\orca-fork\\logs\\caixa-preta\\.
"""

import collections
import datetime
import glob
import json
import os
import subprocess
import sys
import threading
import time

import ctypes as ct

import etw
from etw import evntprov
from etw.etw import ProviderParameters
import psutil

SESSION = "OrcaCaixaPreta"
AUDIT = "{E02A841C-75A3-4FA7-AFC8-AE09CF9B7F23}"  # Microsoft-Windows-Kernel-Audit-API-Calls
KPROC = "{22FB2CD6-0E7B-422B-A0C7-2FAD1FD0E716}"  # Microsoft-Windows-Kernel-Process
JANELA_S = 90

LOGDIR = os.path.join(os.environ["APPDATA"], "orca-fork", "logs", "caixa-preta")
os.makedirs(LOGDIR, exist_ok=True)

SAIDAS = {
    0: "saiu normalmente",
    1: "encerrado à força (taskkill /F, Stop-Process ou TerminateProcess com código 1)",
    3: "abort() do C",
    0xC0000005: "CRASH: acesso inválido à memória",
    0xC0000409: "CRASH: abort rápido / estouro de buffer",
    0xC00000FD: "CRASH: estouro de pilha",
    0xC0000017: "CRASH: sem memória",
    0xC000013A: "console fechado / Ctrl+C",
    0x40010004: "encerrado pelo desligamento ou depurador",
    0x80000003: "CRASH: breakpoint",
}

SHELLS = ("bash.exe", "cmd.exe", "powershell.exe", "pwsh.exe", "conhost.exe", "sh.exe")

lock = threading.Lock()
cache = {}  # pid -> info
starts = collections.deque(maxlen=600)  # (t, info)
kills = collections.deque(maxlen=600)  # (t, killer_info, target_pid, target_info)


def agora():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def hora(t):
    return datetime.datetime.fromtimestamp(t).strftime("%H:%M:%S")


def log(arquivo, texto):
    with open(os.path.join(LOGDIR, arquivo), "a", encoding="utf-8") as f:
        f.write(texto + "\n")


def ler_processo(pid, nome_padrao=""):
    info = {"pid": pid, "nome": nome_padrao, "cmd": "", "ppid": None, "cwd": ""}
    try:
        p = psutil.Process(pid)
        info["nome"] = p.name()
        info["ppid"] = p.ppid()
        try:
            info["cmd"] = " ".join(p.cmdline())[:600]
        except Exception:
            pass
        if info["nome"].lower() == "claude.exe":
            try:
                info["cwd"] = p.cwd()
            except Exception:
                pass
    except Exception:
        pass
    return info


def info_de(pid):
    with lock:
        i = cache.get(pid)
    if i and i.get("cmd"):
        return i
    novo = ler_processo(pid, (i or {}).get("nome", ""))
    if novo["nome"]:
        with lock:
            base = cache.get(pid, {})
            base.update({k: v for k, v in novo.items() if v})
            cache[pid] = base
            return dict(base)
    return i or novo


def cadeia(pid, niveis=6):
    """Processo e pais até achar o claude.exe (ou acabar)."""
    linhas, vistos = [], set()
    while pid and pid not in vistos and len(linhas) < niveis:
        vistos.add(pid)
        i = info_de(pid)
        if not i.get("nome"):
            linhas.append(f"pid {pid} (já não existe)")
            break
        extra = f"  [pasta: {i['cwd']}]" if i.get("cwd") else ""
        linhas.append(f"pid {pid} {i['nome']}: {i.get('cmd', '')[:300]}{extra}")
        if i["nome"].lower() == "claude.exe":
            break
        pid = i.get("ppid")
    return linhas


def tipo_alvo(i):
    cmd = (i.get("cmd") or "").lower()
    nome = (i.get("nome") or "").lower()
    if "daemon-entry" in cmd and nome not in SHELLS:
        return "daemon"
    if nome == "electron.exe" and "projetos\\orca" in cmd and "--type=" not in cmd:
        return "orca-app"
    if nome == "claude.exe":
        return "claude"
    return None


def hora_evento(out):
    """Hora real do evento (FILETIME do ETW), não a hora em que o vigia o leu."""
    try:
        return out["EventHeader"]["TimeStamp"] / 1e7 - 11644473600
    except Exception:
        return time.time()


def no_evento_processo(eid, out):
    pid = out.get("ProcessID") or out.get("ProcessId")
    try:
        pid = int(pid, 0) if isinstance(pid, str) else int(pid)
    except Exception:
        return
    t = hora_evento(out)
    if eid == 1:
        ppid = out.get("ParentProcessID") or out.get("ParentProcessId")
        try:
            ppid = int(ppid, 0) if isinstance(ppid, str) else int(ppid)
        except Exception:
            ppid = None
        imagem = os.path.basename(str(out.get("ImageName", "")))
        # Ler o comando custa caro e nascem ~25 processos/s; só os que podem virar alvo.
        if imagem.lower() in ("electron.exe", "orca.exe", "claude.exe", "python.exe"):
            i = ler_processo(pid, imagem)
            i["ppid"] = i["ppid"] or ppid
        else:
            i = {"pid": pid, "nome": imagem, "cmd": "", "ppid": ppid, "cwd": ""}
        with lock:
            cache[pid] = i
            starts.append((t, i))
    elif eid == 2:
        codigo = out.get("ExitCode")
        try:
            codigo = int(codigo, 0) if isinstance(codigo, str) else int(codigo)
        except Exception:
            codigo = None
        with lock:
            i = dict(cache.get(pid) or {"pid": pid, "nome": os.path.basename(str(out.get("ImageName", "")))})
        tipo = tipo_alvo(i)
        if tipo in ("daemon", "orca-app"):
            threading.Thread(target=relatorio, args=(t, tipo, i, codigo), daemon=True).start()
        elif tipo == "claude" and codigo not in (0, None):
            log("mortes.log", f"{agora()} claude.exe pid {pid} saiu com {fmt_codigo(codigo)}")
        with lock:
            mortos[pid] = t


def no_evento_auditoria(out):
    alvo = out.get("TargetProcessId")
    try:
        alvo = int(alvo, 0) if isinstance(alvo, str) else int(alvo)
    except Exception:
        return
    quem = out["EventHeader"]["ProcessId"]
    if alvo == quem or alvo in (0, 4):
        return
    t = hora_evento(out)
    with lock:
        alvo_info = dict(cache.get(alvo) or {})
    if not alvo_info.get("cmd"):
        alvo_info = info_de(alvo)
    quem_info = info_de(quem)
    quem_info["cadeia"] = cadeia(quem)  # já, antes que o processo e os pais sumam
    with lock:
        kills.append((t, quem_info, alvo, alvo_info))
    tipo = tipo_alvo(alvo_info)
    if tipo:
        log(
            "mortes.log",
            f"{agora()} {tipo} pid {alvo} encerrado por pid {quem} {quem_info.get('nome')}: "
            f"{quem_info.get('cmd', '')[:300]}",
        )


contagem = collections.Counter()
mortos = {}  # pid -> hora da morte; o cache guarda por 2 min para os relatórios


def limpar_cache():
    limite = time.time() - 120
    with lock:
        for pid in [p for p, t in mortos.items() if t < limite]:
            mortos.pop(pid, None)
            cache.pop(pid, None)


def callback(evento):
    eid, out = evento
    contagem[(out["EventHeader"]["ProviderId"][:9], eid)] += 1
    try:
        prov = out["EventHeader"]["ProviderId"].upper()
        if prov == KPROC and eid in (1, 2):
            no_evento_processo(eid, out)
        elif prov == AUDIT and eid == 2:
            no_evento_auditoria(out)
    except Exception as e:  # o vigia não pode morrer por um evento estranho
        log("erros.log", f"{agora()} callback: {e!r}")


def fmt_codigo(c):
    if c is None:
        return "código desconhecido"
    return f"código {c} (0x{c & 0xFFFFFFFF:08X}) = {SAIDAS.get(c & 0xFFFFFFFF, 'sem significado conhecido')}"


def chamadas_de_agentes(t0, t1):
    raiz = os.path.expanduser("~/.claude/projects")
    achados = []
    for f in glob.glob(os.path.join(raiz, "**", "*.jsonl"), recursive=True):
        try:
            if os.path.getmtime(f) < t0 - 900:
                continue
            for linha in open(f, encoding="utf-8", errors="ignore"):
                if '"tool_use"' not in linha:
                    continue
                d = json.loads(linha)
                ts = d.get("timestamp")
                if not ts:
                    continue
                t = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
                if not (t0 <= t <= t1):
                    continue
                for c in d.get("message", {}).get("content", []):
                    if c.get("type") == "tool_use":
                        projeto = os.path.basename(os.path.dirname(f)).replace("C--Users-User-Desktop-", "")
                        achados.append((t, projeto, c.get("name"), json.dumps(c.get("input"), ensure_ascii=False)[:350]))
        except Exception:
            continue
    return sorted(achados)


def relatorio(t, tipo, alvo, codigo):
    time.sleep(3)  # deixa chegar evento de auditoria atrasado no buffer
    pid = alvo.get("pid")
    with lock:
        matadores = [k for k in kills if k[2] == pid]
        nascidos = [s for s in starts if t - JANELA_S <= s[0] <= t]
    nome = f"QUEDA-{datetime.datetime.fromtimestamp(t).strftime('%Y-%m-%d_%H-%M-%S')}-{tipo}-{pid}.txt"
    L = [
        f"Caixa-preta do Orca — {tipo} (pid {pid}) morreu às {hora(t)}",
        f"Saída: {fmt_codigo(codigo)}",
        f"Comando do processo morto: {alvo.get('cmd', '')[:300]}",
        "",
        "== QUEM ENCERROU ==",
    ]
    if matadores:
        for tk, quem, _, _ in matadores:
            L.append(f"{hora(tk)} chamou TerminateProcess:")
            L += ["   " + c for c in quem.get("cadeia") or cadeia(quem["pid"])]
    else:
        L.append("Ninguém de fora chamou TerminateProcess nele.")
        L.append("-> se a saída é CRASH, foi falha do próprio processo; se é código 1 sem culpado,")
        L.append("   provável fechamento de grupo de processos (job) junto com outro processo.")
    L += ["", f"== PROCESSOS QUE NASCERAM NOS {JANELA_S} s ANTES =="]
    for ts, i in nascidos:
        L.append(f"{hora(ts)} pid {i['pid']} {i.get('nome')} (pai {i.get('ppid')}): {i.get('cmd', '')[:250]}")
    with lock:
        outros = [k for k in kills if t - JANELA_S <= k[0] <= t + 5 and k[2] != pid]
    L += ["", "== OUTROS ENCERRAMENTOS FORÇADOS NA JANELA =="]
    for tk, quem, alvo_pid, ai in outros:
        L.append(f"{hora(tk)} {quem.get('nome')} (pid {quem['pid']}) -> {ai.get('nome')} (pid {alvo_pid})")
    L += ["", f"== COMANDOS DOS AGENTES CLAUDE (±{JANELA_S} s) =="]
    for ta, proj, ferr, entrada in chamadas_de_agentes(t - JANELA_S, t + 10):
        L.append(f"{hora(ta)} [{proj}] {ferr}: {entrada}")
    with open(os.path.join(LOGDIR, nome), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    resumo = matadores[0][1] if matadores else None
    culpado = f"{resumo.get('nome')} pid {resumo['pid']}" if resumo else "ninguém de fora"
    log("caixa-preta.log", f"{agora()} {tipo} pid {pid} morreu | {fmt_codigo(codigo)} | encerrado por: {culpado} | {nome}")


def semear_cache():
    for p in psutil.process_iter(["pid", "name", "ppid"]):
        i = ler_processo(p.info["pid"], p.info["name"] or "")
        cache[p.info["pid"]] = i


_vivos = []  # buffers que o Windows lê depois; não podem ser coletados pelo Python


def so_eventos(*ids):
    """Filtro no próprio ETW: sem ele o vigia recebia todo OpenProcess do PC (~50% de um núcleo)."""
    lista = evntprov.EVENT_FILTER_EVENT_ID(True, list(ids))
    desc = evntprov.EVENT_FILTER_DESCRIPTOR()
    desc.Ptr = ct.addressof(lista._buf)
    desc.Size = len(lista._buf)
    desc.Type = evntprov.EVENT_FILTER_TYPE_EVENT_ID
    params = ProviderParameters(0, [desc])
    _vivos.extend([lista, desc, params])
    return params.get()


def main():
    subprocess.run(["logman", "stop", SESSION, "-ets"], capture_output=True)  # sessão velha de um vigia que caiu
    semear_cache()
    provedores = [
        etw.ProviderInfo("Kernel-Process", etw.GUID(KPROC), any_keywords=0x10, params=so_eventos(1, 2)),
        etw.ProviderInfo("Kernel-Audit-API-Calls", etw.GUID(AUDIT), params=so_eventos(2)),
    ]
    job = etw.ETW(session_name=SESSION, providers=provedores, event_callback=callback, event_id_filters=[1, 2])
    job.start()
    log("caixa-preta.log", f"{agora()} vigia ligado (pid {os.getpid()}), {len(cache)} processos conhecidos")
    try:
        while True:
            time.sleep(60)
            limpar_cache()
            if os.path.exists(os.path.join(LOGDIR, "contar")):
                with lock:
                    nomes = collections.Counter(i.get("nome") for t, i in starts if t > time.time() - 60)
                log("contagem.log", f"{agora()} {dict(contagem)} threads={threading.active_count()} top={nomes.most_common(8)}")
            contagem.clear()
    finally:
        job.stop()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log("erros.log", f"{agora()} vigia caiu: {e!r}")
        sys.exit(1)
