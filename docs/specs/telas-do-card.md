# Telas do card (o-052)

Cinco pedidos do Kaique de 18/11/2026. Sem Orca de teste (regra E): provado por teste automático e print de fixture; a prova no programa é ele reiniciando o Orca.

## 1. Prévia do card fechado

Mouse parado sobre o card mostra a última mensagem dele (até 180 caracteres, uma linha) e a última resposta do Claude (até 700 caracteres e 14 linhas, com negrito, código em linha, listas), com quebra normal e corte no fim com "…" (preferindo fim de frase; nunca deixa `**` ou crase aberta). A resposta recente fica embaixo. O texto vem de `chat.lines` (hook de estado, já no card): a prévia não lê terminal nem arquivo. Sem mensagem: "sem mensagens ainda". Regra: `canvas-chat-peek-messages.ts`.

## 2. Acordar chat dormindo (card aberto)

Três etapas: **Abrindo o terminal** (terminal respondeu: `provenPty` em `CanvasChatTerminal.tsx`), **Retomando a conversa** (o `SessionStart` do Claude chegou depois do começo do acordar: registro de estado do agente do chat), **Claude pronto** (caixa do Claude desenhada: `useChatRestoring` falso, a tela sai). Falha (`wake.gaveUp`): a etapa em que parou fica com a frase de problema. Regra: `canvas-chat-wake-steps.ts`. A barra lateral segue com o "Restaurando o chat…" antigo.

## 3. Chat livre nascendo

Mesma tela, etapas próprias: **Abrindo o terminal** (o chat tem terminal), **Iniciando o Claude** (terminal existe, Claude ainda não avisou), **Pronto para conversar** (o `SessionStart` chegou: todas as etapas acesas por 2,5 s, depois a tela sai). Falha: terminal fechou, ou 2 minutos sem o Claude avisar. Nada da hierarquia. Registro: `launch-pc-desk-chat.ts` (o registro do PO e o do chat livre usam o mesmo caminho). Regra: `freeChatMaskView` em `canvas-chat-launch-mask.ts`.

## 4. Modelo do card

A troca de modelo pelo seletor da tela de chat **não grava** "Set model to" na conversa. A conversa grava a linha `api-request` (`params.model`) quando o próximo pedido sai, antes da resposta. O card lê essa linha (`modelFromTranscriptTail`) e, na hora da escolha, usa a escolha do seletor (`noteCanvasChatModelChoice`) até a conversa nomear um modelo mais novo (`resolveCardModel`).

## 5. "Enviando…" na tela de chat

Com envio pendente e turno ainda não ativo, a linha de atividade do fim da conversa lê "Enviando…"; vira "Trabalhando" com o sinal de turno; some se o envio falha. Regra: `native-chat-sending-state.ts`; ligação mínima em `NativeChatResolvedView.tsx` (marcada `Fork:`).

## Limites conhecidos

Etapa 3 do acordar e "pronto" do chat livre dependem do gancho `SessionStart` do Claude; se ele não chegar, o acordar termina quando a caixa desenha e o chat livre mostra problema após 2 minutos. Nada disso foi visto no programa real.
