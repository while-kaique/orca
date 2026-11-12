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

**(A) Vigia do criador e aviso único.** Toda vez que um chat cria ordem, o comando garante um processo
de fundo, um por chat criador (`hierarquia vigiar`, pid em `.hierarquia/vigias/<chat>.json`). Ele:

1. mantém um `check --wait` na caixa do criador, para o Orca não escrever no chat dele; o correio
   lido vai para `.hierarquia/caixa/<chat>.jsonl`;
2. correio que **não** veio de um chat filho (o PO escrevendo ao planejador, por exemplo) é repassado
   na hora ao chat, escrito no terminal dele;
3. quando todas as ordens da árvore do criador (as dele e as criadas abaixo delas) estão entregues ou
   paradas, escreve **uma** mensagem no chat do criador listando cada ordem e como terminou, e sai.

Pergunta não passa por ele: `hierarquia perguntar` escreve a pergunta direto no chat de quem criou
(acorda na hora). O Kaique escrevendo acorda o chat como sempre.

**(B) Chat morto.** Uma ordem que ocupa vaga (`trabalhando`, `em_prova`, `devolvido`) passa a
`parou` sozinha, com o evento `parou_sem_entregar` e `automatico: true`, quando o chat dela:

- não tem mais aba no Orca (fechado), ou o terminal está desconectado (caiu); ou
- ficou **20 min sem nenhuma saída na tela**, sem pergunta aberta e sem ordem filha ainda trabalhando.

Quem confere: `hierarquia estado` e o vigia (a cada 30 s). Quem criou dá baixa com
`hierarquia baixa --ordem ID --motivo "..."`. Chat parado conta como terminado para o aviso único.

**(C) Lançamento sem mão.** O vigia do início do turno (`inicio-do-turno.mjs`) já envia a ordem
parada na caixa. Conserto: o número da ordem nascia de "quantas ordens existem + 1", então dois
lançamentos juntos ganhavam o mesmo número. Agora a criação da ordem é feita sob uma trava do projeto
(`.hierarquia/trava-ordem`). A prova é no Orca real (critério 3).

**(D) Vez para comando pesado.** `hierarquia vez -- <comando>`: um comando por vez na máquina inteira
(trava em `~/.hierarquia/vez/`, fora de qualquer projeto). Quem chega depois espera na fila, por ordem
de chegada. A trava guarda o processo dono; se ele morrer, quem espera vê em até 1 s e assume.

**(E) Resposta.** `hierarquia responder --pergunta p-NNN --texto "..."`: só quem recebeu a pergunta
responde; grava `resposta` no registro e escreve a resposta no chat que perguntou.

**(F) Teto (adendo 2).** Por projeto: no máximo **2 planejadores e 2 executores ao todo** (somando os
executores de todos os criadores). Os números ficam em `TETO`, em `regras.mjs`. Vaga ocupada =
ordem `trabalhando`, `em_prova` ou `devolvido`; entrega esperando conferência libera a vaga (senão o
criador, dormindo até todos terminarem, nunca soltaria a fila). A ordem em espera sai sozinha: o vigia
do criador dela lança quando abre vaga. `hierarquia estado` mostra "trabalhando X de Y" e a fila.

## Quantos executores

Nenhum para o código: tudo mora em `skills/hierarquia` e as cinco partes dependem das mesmas funções
(registro, estado, vigia). Os chats de teste dos critérios são executores com ordem leve.

## Memória medida (adendo 2)

Preenchido na entrega, com data e método.

## Fora do escopo

Teto por máquina (vários projetos); aviso ao Kaique quando tudo para; mudar o Orca (`src/`).
