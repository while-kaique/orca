# Onde paramos — fork do Orca "PC como mesa"

**Atualizado:** 23/09/2026, fim do dia.

## Estado
- Fork `while-kaique/orca`, branch `feat/pc-como-mesa`, clonado em `Desktop\Projetos\orca`.
- Plano completo: `PLANO-PC-COMO-MESA.md` (fases 0 a 3).
- **Fase 0 (montar o app): feita.** Abrir com dois cliques em `dev-orca.bat`
  (perfil separado em `%APPDATA%\orca-fork`, não mexe no Orca instalado).
- **Fase 1 (barra lateral nova): escrita e commitada** (`19d2e023`), checagem de tipos e lint limpos.
  App aberto em 23/09 para teste; o Kaique ainda não testou.
- Aviso "opencode / SQLite database does not exist" no log é inofensivo (opencode não instalado).

## O que a fase 1 mudou
1. Clicar no nome do projeto abre a pasta dele (a setinha continua abrindo/fechando o grupo).
2. Todos os projetos aparecem sempre; worktree só aparece enquanto tiver chat aberto nela.
3. Em projeto com git, o **+** virou **⑂ N**: lista "Pasta do projeto", worktrees ativas e "Criar worktree nova…".

## Próximo passo (24/09)
1. Abrir `dev-orca.bat` e testar os 3 itens acima.
2. O Kaique tem **ajustes** para passar — ouvir e aplicar antes de seguir.
3. Depois: fase 2 (cada lado da tela dividida escolhe pasta/worktree, ~1 a 2 dias).

## 24/09 — barra lateral em 3 versões (aguardando escolha)
- Pedido: abrir em `Projetos`, restaurar o que ficou aberto, caixa de busca + clique nas pastas, botão de worktree por pasta.
- Protótipo clicável A/B/C: https://claude.ai/artifact/S1XgbSgDU4g14XFjK68WDU
  (A = seletor no topo · B = lista com busca fixa · C = paleta no meio da tela + cartões).
- Restaurar sessão: o Orca já salva abas e histórico (`src/main/ipc/session.ts`); o fork só precisa mostrar isso na barra.
- **Escolhida: A.** Implementada em 24/09 (commit "feat(sidebar): seletor de projetos no topo").
  - Caixa no topo da barra: mostra a pasta/worktree atual; clique abre busca + lista de `Desktop\Projetos`
    (Abertos agora / Mexidos por último / Todas). Pasta nova vira projeto no 1º clique, sem diálogo.
  - Botão ⑂ (ou seta →) lista as worktrees: pasta do projeto, com chat aberto, outras, criar nova.
  - A barra embaixo mostra só o que tem chat aberto (inclui o que volta aberto ao reabrir o Orca).
  - Código: `src/renderer/src/components/sidebar/pc-desk-switcher/` + IPC `repos:listPcDeskHomeFolders`.
  - Sem atalho de teclado ainda: Ctrl+P já é "abrir arquivo" no Orca.
- Próximo: Kaique testa (fechar e abrir `dev-orca.bat`, porque mudou o processo principal) e passa ajustes; depois fase 2.

## 24/09 (tarde) — 3 pedidos novos, commitados (912f6f6c, 4650c20e)
1. **Botão "+" fixo** no pé da lista de chats: busca instantânea em `Projetos`; nome que não existe vira
   "Criar projeto" (pasta com git, reusa `repos:create`) e já abre. `pc-desk-switcher/PcDeskNewProjectButton.tsx`.
2. **Bolinha verde**: cheia = terminou e você não viu; só contorno = já viu, esperando você.
   Regra de "visto" = a mesma das linhas em negrito (`acknowledgedAgentsByPaneKey`). Cor nova `--agent-done`.
3. **Sessão sobrevive a desligar o PC**: causa achada — o Orca só salvava o registro de retomada de chat
   *trabalhando*; chat parado voltava como terminal vazio. Agora salva também o parado, 2 s após cada
   mudança, e grava em disco quando o Windows avisa que vai desligar (`main/window/os-session-end-flush.ts`).
- Falta: Kaique testar reiniciando o PC com 2-3 chats parados abertos.

## 25/09 — 2 ajustes (d2056b21)
1. "+" agora fica logo abaixo do último projeto (a lista encolhe até o conteúdo no modo mesa); borda tracejada grossa, fundo mais claro, clareia no hover.
2. "New workspace" abre com o foco na busca de projeto (não no nome opcional) — só no modo mesa.
- Falta: Kaique ver na tela.

## 25/09 — nome da sessão
- Feito (0bb4e05e): nome automático cortado em 3 palavras / 23 caracteres, sem "de/do/para…" (`src/shared/session-title-cap.ts`). Nome renomeado à mão não corta.
- **Feito: nome inteligente** (modo mesa). Aba abre com o nome do projeto; na 1ª mensagem o Haiku já dá o nome do tema;
  depois, a cada 10 min com ≥3 mensagens novas, ele responde MANTER ou nome novo (troca no máximo 1x a cada 20 min).
  Só o chat mais antigo da aba conta. Renomear à mão vence sempre.
  - Agendador: `src/renderer/src/lib/pc-desk-session-namer.ts` (ligado em `main.tsx`).
  - Chamada: `src/main/ipc/repos/pc-desk-session-title-handlers.ts` → `claude -p --model haiku` SEM hooks, MCP,
    ferramentas nem sessão salva (senão cada renomeação viraria linha no Diário de Bordo).
  - Nome fica em `generatedTitle` (já persistido) e vence o título do Claude no modo mesa.
  - Falta: Kaique testar (fechar e abrir `dev-orca.bat`, mudou o processo principal).

## 25/09 — chat parado sumia ao reiniciar (corrigido, falta testar)
- Caso: 2 chats no Creative Studio; após reinício forçado só 1 voltou com a conversa. O outro não tinha registro
  de retomada, e na reabertura chat PARADO só voltava com registro (chat trabalhando já usava o último status).
- Correção: na reabertura, sem registro, usa o último status do painel que o processo principal salva em disco
  (`last-status.json`). Só vale na reabertura; chat encerrado de propósito continua fechado.
  `pty-connection/sleeping-record-access.ts` (`getColdRestoreRecordForPane`).
- Conversa perdida desse dia: `claude --resume d74a6471-0d66-4d92-b4be-328a4a3b6497` no Creative Studio.
- Lição: reiniciar o Orca por WMI abre sem o PATH do usuário (claude "não encontrado"); reiniciar via explorer.exe.

## 25/09 10:30 — testado no app
- Nome inteligente: chat novo no diario-local abriu como "diario-local" e 10 s após a 1ª mensagem virou "Contar arquivos MD".
- Reinício: os 7 chats abertos voltaram com o Claude rodando e a conversa anterior na tela (Creative Studio x2, radar, jarvis, diario x2, este).
- Pegadinha de teste: no CDP, caminho com `\` virou pasta inexistente; usar barras normais. Dev CLI: `pnpm run build:cli` e usar `orca-dev.cmd`.

## 25/09 — nome da aba vira o nome da sessão entre chats
- Antes: chats se viam como `creative-studio-c5`, `whelk-b5` (nome derivado da pasta pelo Claude Code).
- Agora: hook `~/.claude/hooks/orca-nome-da-aba.js` (SessionStart + UserPromptSubmit, fora do repo) lê
  o nome da aba em `profiles/*/orca-data.json` pelo `ORCA_TAB_ID` e devolve `sessionTitle`. Nome manual vence;
  nome provisório (= nome do projeto) é ignorado. Sem mudança no código do app.
- Atraso: o nome novo entra na mensagem SEGUINTE do chat (hook só roda quando você manda mensagem ou reabre).
- Backup do settings: `~/.claude/settings.json.bak-nome-aba`.

## 25/09 18h — app "trava, pisca e volta" sem ninguém mexer (investigando)
- Causa vista no log: o **serviço de terminais (daemon) morre calado** e o app sobe outro; todos os chats remontam.
  Em 25/09: 12:54, 14:16, 16:07, 17:59 (horário de Brasília). Nenhuma linha de erro, nenhum crash no Windows.
- Monitoramento novo (vale depois de fechar e abrir `dev-orca.bat`), tudo em `%APPDATA%\orca-fork\logs`:
  1. `daemon.log` → `heartbeat` a cada 30 s (memória, atraso do laço) + `process-exit`. Batimento parando sem `process-exit` = morte nativa ou kill externo; atraso alto antes = travou.
  2. `daemon-watch.log` → `daemon-respawn`: motivo, pid antigo e se ainda estava vivo.
  3. `main-console.log` → saída do processo principal (antes ia pro nada). Sessão anterior em `main-console.anterior.log`.
- Código: `src/main/daemon/pc-desk-daemon-watch.ts` (dentro do daemon) e `pc-desk-daemon-respawn-log.ts` (no app).
- Próximo: na próxima queda, cruzar os 3 arquivos pelo horário.
- **Atalho "Orca (meu)" agora abre no modo montado** (`abrir-orca-fork.vbs` → `abrir-orca-montado.bat`): monta em ~10 s
  e roda sem recarregar quando o código muda. Se montar/abrir falhar, cai sozinho no `dev-orca.bat`.
  Para editar o Orca com recarga automática, abrir `dev-orca.bat` direto. Ainda não testado ao vivo (o app estava aberto).

## 28/09 — botão "+ Adicionar Chat" + grupo desfeito
- Botão **+ Adicionar Chat** logo abaixo do seletor de projeto (modo mesa): abre uma aba nova com o agente padrão
  (Claude) no projeto/worktree ativo — processo novo, então a conversa tem memória própria.
  `pc-desk-switcher/PcDeskAddChatButton.tsx`. Falta: Kaique ver na tela.
- Grupo "Projetos group" (criado sem querer) desfeito pela RPC `projectGroup.delete` — só desagrupa, a pasta
  Projetos e os chats ficaram. Backup: `%APPDATA%\orca-fork\profiles\local-default\orca-data.json.antes-desfazer-grupo`.

## 28/09 (tarde) — cada chat vira uma linha própria na barra
- Pedido: "+" → "Projetos" → Enter não fazia nada; "Adicionar Chat" só abria aba no mesmo espaço; "social hub" não abria.
- Causas: (1) a barra mostrava 1 linha por pasta, e escolher a pasta já aberta só a reativava;
  (2) a busca não tratava espaço como `-`/`_`, então "social hub" só oferecia "Criar projeto".
- Agora (modo mesa):
  1. Cada chat (aba de terminal) é uma linha debaixo do projeto, com nome, bolinha e X próprios; clicar abre aquele chat.
     `pc-desk-switcher/pc-desk-chat-rows.ts` (divide as linhas) + `PcDeskChatCardScope.tsx` (contexto do chat no card).
  2. "+" lá embaixo: escolher uma pasta abre um **chat novo** nela (nova linha), mesmo se ela já estiver aberta.
     "Criar projeto" também já abre com um chat. `launch-pc-desk-chat.ts` (usado também pelo "Adicionar Chat").
  3. Busca: espaço casa com `-`, `_` e `.` ("social hub" → social-hub-gogroup; também acha socialhub-profiles).
- Limite: as abas no topo continuam mostrando todos os chats da mesma pasta.
- Testes da barra: 186 falhas já existiam antes desta mudança (mesmo número com `git stash`).
- Falta: Kaique fechar e abrir o "Orca (meu)" (remonta sozinho) e testar.

## 29/09 — "+" no cabeçalho do projeto
- Pedido: "+" no card da pasta (ex.: Projetos), antes da setinha, que abre um chat novo.
- Feito: `pc-desk-switcher/PcDeskHeaderNewChatButton.tsx` (em `SectionHeader.tsx`, só no modo mesa). Aparece ao
  passar o mouse no cabeçalho, como os outros botões; o chat nasce como linha nova debaixo do projeto.
- Mesmo caminho do "+" de baixo: `openPcDeskChatInRepo` em `launch-pc-desk-chat.ts`.
- Falta: Kaique reabrir o "Orca (meu)" (remonta sozinho) e testar.
