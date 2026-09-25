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
- Planejado, aguardando OK: nome "inteligente" = nome do projeto no início; depois, a cada ~10 min com ≥3 mensagens novas,
  o Haiku (via `claude -p`, mesmo caminho da mensagem de commit em `src/main/text-generation/`) lê as últimas mensagens do
  chat mais antigo da aba e responde MANTER ou nome novo. Troca no máximo 1x a cada 20 min. Grava em `generatedTitle`,
  que passa a ter prioridade sobre o título do Claude no modo mesa.
