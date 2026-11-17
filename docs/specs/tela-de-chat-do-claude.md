# Tela de chat do Claude: fluxograma, barra lateral e chat novo (o-048)

A tela de chat que veio do Orca oficial (`components/native-chat`) passa a abrir sozinha onde o Kaique clica. Não foi construída outra: só foi ligada.

## O que muda para quem usa

- **Fluxograma:** o card aberto de um chat do Claude mostra a tela de chat (mensagens e caixa de digitar) no lugar da cópia do terminal. Botão no topo do card: "Ver o terminal" / "Ver a tela de chat".
- **Barra lateral e chat novo:** aba com o Claude abre na tela de chat. Se o Kaique trocar a aba para o terminal, ela fica no terminal. Terminal comum (shell) e outros agentes não mudam.
- O Claude de verdade continua rodando por trás; tudo o que a tela envia vai para o terminal dele.

## Regra (uma função só)

`src/shared/native-chat/native-chat-default-view-mode.ts`: a escolha guardada da aba (`viewMode` = `terminal` ou `chat`) vale sempre; sem escolha guardada, aba com agente Claude e chat disponível abre em `chat`.

- `viewMode` vazio = ninguém escolheu. Só é gravado quando alguém escolhe (botão, atalho Ctrl+Shift+F11, ou o efeito de abrir em chat). Vai para o disco (`workspace-layout-disk-fields.ts`), então a escolha sobrevive a reabrir o Orca.
- Ressalva: quando o Claude encerra, a saída automática do chat grava `terminal` (`applyNativeChatLeafRoute`), e isso passa a valer como escolha.

## Onde está ligado

- Painel/aba: `terminal-pane/use-native-chat-default-view-mode.ts` (efeito que grava `chat` uma vez), chamado em `use-terminal-pane-controller.ts`.
- Card do fluxograma: `canvas-chats/CanvasChatTerminal.tsx` + `canvas-chat-screen-choice.ts` (decide) + `CanvasChatScreen.tsx` (monta `NativeChatView`).
- O card só troca o terminal pela tela depois que o terminal de verdade respondeu (prova de que o terminal por trás existe). Chat dormindo depois de reiniciar continua em "Restaurando o chat…". Sem sessão legível ou agente que não é suportado: terminal, como antes.
- O botão do card grava a mesma escolha por aba (`setTabViewMode`).

## Peso

- Card fechado nunca monta a tela: `CanvasChatsNodes.tsx` só renderiza `CanvasChatTerminal` com `open`.
- O leitor da conversa só liga com a tela visível: `NativeChatResolvedView.tsx` passa `enabled: isVisible` a `useNativeChatRetainedSession`, que repassa a `use-native-chat-live-session.ts` (`if (!enabled) return`). A tela no painel de aba escondida fica montada sem ler a conversa.
- Quando a tela do card está aberta, a cópia do terminal (`AgentTerminalPreview`) é desmontada: sai a leitura do terminal inteiro por cima.

## Chat lento (item 5)

Mensagem enviada aparece na hora com marca de espera; a marca só sai quando a linha da conversa chega (`prunePendingSends`). Terminal que demora mais de 20 s não faz a marca sumir (os 20 s só marcam `unconfirmed`), nem reenvia. O que faltava: o limite de 8 marcas derrubava da tela a mais antiga com o terminal travado; subiu para 32 (`NATIVE_CHAT_PENDING_SEND_LIMIT`).
