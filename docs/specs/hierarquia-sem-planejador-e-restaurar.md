# Hierarquia sem planejador, restaurar que herda o lugar, nunca matar por nome e fluxograma que não rola (o-047)

Pacote de 16/11/2026. Palavras do Kaique: "abandonamos o fable. então o PO é um Opus high, não usaremos mais
planejadores, apenas executores Sonnet High. Isso por economia de tokens" e "o limite de executores por PO é 4. Aí por
projeto, ficam até 5 chats abertos".

## 1. Comando sem planejador

- `regras.mjs`: `PAPEIS` = PO (`opus`, cria só `executor`), executor (`sonnet`, não cria). O planejador continua no mapa
  só para ler registros antigos (cria nada e ninguém o cria). `hierarquia ordem --para planejador` recusa com a
  mensagem "Não existe mais planejador".
- Teto: 4 executores trabalhando por projeto (um PO por projeto); o 5º entra em espera e sai quando abre vaga. O campo de
  planejadores saiu do teto e de `hierarquia estado` ("Teto: executores N de 4 trabalhando").
- Todo `worker-start` leva `--effort high` junto do `--model` (`argumentosDoWorkerStart`, em `orca-lancador.mjs`). O chat
  de teste continua em `haiku`, também com `--effort high`.
- Planejador de registro antigo em espera nunca sai dela (sem teto, sem vaga).

## 2. Restaurar herda o lugar

Problema (16/11, social-hub): chat que volta em aba nova era tratado como chat novo. Os filhos ficavam com pai morto, o
PO restaurado aparecia como Livre e um `chat_lancado` voltava ordem aprovada para "trabalhando".

- `hierarquia restaurar --chat <id da aba antiga> [--conversa <id>] [--pasta PASTA]`: acha a ordem (ou o papel de PO) do
  chat antigo, abre o terminal na mesma pasta com
  `claude --plugin-dir <orca-agent-view> --model <modelo do papel> --effort high --permission-mode auto --resume <conversa>`
  e grava **um** evento: `chat_restaurado {chatAnterior, chatId, handle, conversa, pasta}`.
- Conversa: a de `--conversa`; senão a que recebeu a ordem (o `dispatchId` está no começo dela); senão a maior das
  conversas recentes da pasta (mínimo 8 KB, até 7 dias).
- Pasta do plugin: a mais nova em `<dados do Orca>/claude-agent-view/*/orca-agent-view` (ou `HIERARQUIA_PLUGIN_DIR`).
- Quem pode: o PO atual (ou quem criou a ordem) restaura chat de ordem; o PO morto volta por qualquer chat do projeto
  enquanto o projeto estiver sem PO. Chat com terminal vivo não se restaura.
- `chat_restaurado` em `montarEstado` (`chat-restaurado.mjs`): o chat novo herda papel, modelo, pai, ordem e a situação da
  ordem; os filhos do antigo e as ordens criadas por ele passam ao novo; perguntas, avisos guardados e pedidos já
  avisados do antigo passam ao novo; se o antigo era o PO, o novo é o PO; o antigo fica inativo.
- Prova automática: `restaurar.test.mjs`, sobre o registro real do social-hub de 16/11 (sem os textos das ordens).

## 3. Nunca encerrar processo por nome

Em 16/11, às 13:20, um planejador rodou `Stop-Process` em todo processo cuja linha de comando tinha `headless`. O console
de todo chat do Orca é um `OpenConsole.exe --headless`: todos os chats de todos os projetos fecharam.

- `hierarquia ordem` acrescenta ao fim dos limites de toda ordem: "Nunca encerrar processo por nome nem por trecho de
  linha de comando: só pelo PID, e só de processo que você mesmo abriu (anote o PID ao abrir)." (`comRegraDeProcesso`,
  sem repetir se o PO já a escreveu.)
- A mesma regra está em `papeis/executor.md`, seção "O que você faz".

## 4. Fluxograma que rola sozinho

Ver o relato da causa e do conserto na seção da parte 4 de `.hierarquia/provas/o-047/ENTREGA.md` e no
`ONDE-PARAMOS.md`.

## 5. Terminar a o-043

Fica no `ONDE-PARAMOS.md` e em `.hierarquia/provas/o-043/ENTREGA.md`.
