# Spec: hierarquia sem vigia (ordem o-021, com o adendo 2)

Data: 12/11/2026. Dono: planejador da o-021. Território: `skills/hierarquia/**`.

## Por quê

Na rodada de 12/11 o PO rodou 233 comandos, 41 consultas de estado e 9 teclas Enter para destravar
chats. Pedido do Kaique: o PO lança, dorme, e só acorda quando **todos** terminaram. As causas que são
do comando: não há aviso de "todos terminaram", chat morto não é percebido, checagens pesadas rodam
juntas, e não há comando para responder pergunta.

## Como o Orca acorda um chat hoje (lido no código e no Orca em uso)

Cada `worker_done`, cada aviso do Orca ("Worker stopped without reporting", "Agent exited") e cada
`status` de preparação vai para a caixa de correio do criador. Quando chega correio e ninguém está
esperando por ele, o Orca escreve "You have N orchestration messages" no terminal do criador, e isso
acorda o chat. Quando há um `orca orchestration check --wait` ativo na mesma caixa, o Orca **não**
escreve nada no terminal: entrega a quem espera (`mailbox-pointer-eligibility.ts`).

## O que muda (decisões)

**(A + adendo 3) Vigia do criador e aviso por pedido.** Toda vez que um chat cria ordem (ou reprova
uma entrega), o comando garante um processo de fundo, um por chat criador (`hierarquia vigiar`, pid em
`.hierarquia/vigias/<chat>.json`, registro do que fez em `.hierarquia/vigias/<chat>.log`). Ele:

1. mantém `check --wait` na caixa do chat e na da Run que ele coordena (é para a Run que os filhos
   mandam `worker_done` e os avisos automáticos do Orca); o correio lido vai para
   `.hierarquia/caixa/<chat>.jsonl`;
2. repassa na hora, escrito no chat, o correio que não é rotina de filho: mensagem do criador dele,
   escalada escrita por um filho ("Blocked: ..."). Entrega, sinal de vida e aviso automático de filho
   ("Worker stopped", "Agent exited", "Setup ...") ficam com o vigia;
3. agrupa as ordens do criador por **pedido** (`hierarquia ordem --pedido NOME`; sem nome, a ordem é
   um pedido sozinha; ordem de baixo herda o pedido do criador dela). Quando todas as ordens de um
   pedido, com as de baixo, estão entregues ou paradas, escreve **uma** mensagem no chat do criador
   ("PEDIDO FECHADO: nome. Entregaram: ... Pararam: ...") e grava `pedido_fechado`. Pedidos não
   esperam um pelo outro. O vigia desliga quando todos os pedidos do criador fecharam;
4. lança as ordens do criador que esperam vaga (G) e destrava ordem que nasceu parada na caixa (C).

Pergunta não passa pelo vigia: `hierarquia perguntar` escreve a pergunta direto no chat de quem criou.

Nenhuma chamada de processo do comando abre janela (`windowsHide` em todas): o vigia roda solto, sem
console, e cada chamada ao `orca-dev` abria uma janela de cmd (visto pelo Kaique em 12/11).

**(B) Chat morto.** Uma ordem que ocupa vaga (`trabalhando`, `em_prova`, `devolvido`) passa a
`parou` sozinha (`parou_sem_entregar` com `automatico: true`) quando o chat dela não tem terminal
ligado (aba fechada, dormindo ou terminal caído) ou ficou **20 min sem nada na tela**, sem pergunta
aberta e sem ordem filha por terminar. Quem confere: `hierarquia estado` e o vigia (a cada 30 s).
Quem criou dá baixa com `hierarquia baixa --ordem ID --motivo "..."`. Ordem parada fecha o pedido.

**(C) Lançamento sem mão.** Três consertos: (1) o número da ordem nascia de "quantas ordens existem

- 1", e dois lançamentos juntos ganhariam o mesmo número; agora a criação é feita sob uma trava do
  projeto (`.hierarquia/trava-ordem`); (2) com o Orca lento (cada leitura de tela levou 33 a 56 s em
  12/11), uma leitura que falhava zerava a contagem de "4 s parada na caixa" e o envio nunca saía; agora
  leitura falha não zera e a espera final é de 60 s; (3) o vigia do criador volta a tentar (até 3 vezes)
  a ordem que ficou "não enviada". `perguntar` e `entregar` esperam até 2 min o registro do próprio chat.

**(D) Vez para comando pesado.** `hierarquia vez -- <comando>`: um comando por vez na máquina inteira
(trava em `~/.hierarquia-vez/`, fora de qualquer projeto). Quem chega depois espera, por ordem de
chegada. A trava guarda o processo dono; se ele morre, quem espera vê em até 0,5 s e assume.

**(E) Resposta.** `hierarquia responder --pergunta p-NNN --texto "..."`: só quem recebeu responde;
grava `resposta` e escreve a resposta no chat que perguntou.

**(F, adendo 2) Teto.** Por projeto: no máximo **2 planejadores e 2 executores trabalhando** (somando
os executores de todos os criadores). Os números ficam em `TETO`, em `regras.mjs`. Ocupa vaga a ordem
`trabalhando`, `em_prova` ou `devolvido`; entrega esperando conferência solta a vaga (senão o criador,
dormindo até o pedido fechar, nunca soltaria a fila). Chat terminado só é fechado para dar lugar a
outro se foi criado pelo mesmo criador.

**(G, adendo 3) Fila de pedidos.** A ordem lançada com o teto cheio espera e sai sozinha (o vigia do
criador dela lança). Ordem de saída: primeiro as lançadas com `--na-frente`, depois por chegada.
`hierarquia estado` agrupa as ordens por pedido, com a situação do pedido (em andamento, esperando
vaga, esperando validar, entregue, parado), o teto e a posição de quem espera. `FILA.md` continua só
com o PO: ela tem "quem pediu" e "esperando resposta dele", que o registro não sabe.

**(Adendo 4) Chat da hierarquia nunca "Livre".** Causa: o fluxograma usava só o **primeiro**
`.hierarquia` que achava entre as pastas do projeto; o registro de teste que criei numa cópia de
trabalho ganhava do principal, e todo chat real virava "Livre". Conserto em
`canvas-chat-hierarchy.ts`: o fluxograma junta todos os registros do projeto. O comando: `criar-po`
recusa um chat que já tem papel em outro registro, salvo com `--teste`; toda aba lançada recebe o
título da ordem; ordem leve pode nascer na pasta do criador (`--na-pasta-do-criador`), sem cópia nova.
O projeto agora é a pasta cujo `.hierarquia/` tem `registro.jsonl`.

**(Adendo 5) Ver e fechar o que criou.** `hierarquia estado` diz, para cada chat: ligado (terminal
vivo), dormindo (a aba ou a sessão de agente existe sem terminal, como o fluxograma desenha) ou
fechado. Lê a sessão que o Orca grava em disco (`profile-state.db`, só leitura), sem mudar o Orca.
`hierarquia fechar --ordem ID | --pedido NOME | --terminados` fecha chats do próprio criador: ligado
pelo terminal; dormindo pela pasta própria do chat (`orca terminal close --worktree --all`, que tira
as abas e os registros de retomada daquela pasta), e só quando a pasta não tem outra aba. Não muda o
Orca: fechar uma aba dormindo que divide a pasta com outras pediria um método novo no Orca, que só
existe depois de reconstruir e reabrir (proibido nesta ordem).

## Quantos executores

Nenhum para o código: tudo mora em `skills/hierarquia` e as partes dependem das mesmas funções
(registro, estado, vigia). Os chats de teste dos critérios foram executores com ordem leve.

## Memória medida (adendo 2)

12/11/2026, 14:35 UTC, máquina de 31,7 GB com 8,9 GB livres. Método: PowerShell
`Get-CimInstance Win32_Process`, soma da memória em uso do `claude.exe` de cada chat e dos processos
filhos dele (servidores MCP, shells); chat identificado pela hora de criação do processo.

| Chat                                              | claude.exe | com os filhos |
| ------------------------------------------------- | ---------- | ------------- |
| Planejador (Opus, trabalhando)                    | 507 MB     | 1045 MB       |
| Executor (Sonnet, tarefa de código, sem checagem) | 464 MB     | 907 MB        |
| Executor de teste (Sonnet, ordem leve)            | 406 MB     | 841 MB        |

Cada chat ocupa 0,85 a 1,05 GB só por existir trabalhando; uma checagem pesada soma por cima (não
medido o pico de `pnpm tc` dentro de um chat). Saída em `.hierarquia/provas/o-021/memoria-por-chat.txt`.

## Fora do escopo

Teto por máquina (vários projetos); aviso ao Kaique quando tudo para.
