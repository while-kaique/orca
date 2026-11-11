# Orca enxuto — o que foi desligado e como trazer de volta

Branch `feat/orca-enxuto` (worktree `Desktop\Projetos\orca-enxuto`), criada em 10/11/2026 a partir de
`feat/pc-como-mesa` (`847a40b0fd`). Nenhum arquivo do Orca foi apagado: cada item foi **desligado no
ponto onde liga**, para atualizar do oficial continuar fácil.

**Regra para trazer algo de volta:** quase tudo é um interruptor em
`src/main/orca-enxuto-switches.ts`. Trocar `false` por `true`, montar o Orca e reabrir. O comportamento
volta a ser igual ao do Orca oficial (`stablyai/orca`). Para conferir o original:
`git diff 847a40b0fd feat/orca-enxuto -- <arquivo>`.

## Desligado

| O quê                                                                             | Por quê                                                                                                                               | Onde foi desligado                                                                                                      | Como voltar                                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 25 agentes além do Claude (Codex, Gemini, Cursor, Copilot, OpenCode, Kimi, Grok…) | Cada agente ligado vira um teste de "está instalado?" e instalação de hooks ao abrir                                                  | `src/main/window/orca-enxuto-agents-preset.ts` (roda **uma vez** e desliga todos menos `claude` e `claude-agent-teams`) | Configurações > Agents: ligar o agente. A escolha fica salva (o preset não roda de novo)                 |
| Varreduras do Codex (histórico e migração de sessões)                             | Agente Codex desligado                                                                                                                | `startup/main-process-account-services.ts`                                                                              | `codexBackgroundScans: true`                                                                             |
| Orca Cloud (conta na nuvem do Orca)                                               | Não usado                                                                                                                             | `startup/main-process-runtime-launch.ts`                                                                                | `connectorCloud: true`                                                                                   |
| Ligação com o app do celular (Relay) + notificações no celular (Push)             | Não usado (último uso do celular: 28/09/2026)                                                                                         | `startup/main-process-runtime-launch.ts`                                                                                | `mobileRelay: true` e `mobilePush: true`; o botão do celular volta em Configurações (`showMobileButton`) |
| Emulador Android/iOS                                                              | Não usado                                                                                                                             | `startup/main-process-ready-runtime.ts` + menu em `renderer/src/lib/client-creation-action-policy.ts`                   | `emulator: true` e voltar a linha `'mobile-emulator': { state: 'enabled', provider: 'local-client' }`    |
| Pedido de estrela no GitHub                                                       | Não usado                                                                                                                             | `startup/main-process-ready-runtime.ts`                                                                                 | `starNag: true`                                                                                          |
| Relatório periódico de uso do WSL (telemetria)                                    | Não usado. O envio de telemetria em si já não acontece em build próprio (só o build oficial tem a chave), então ficou como no oficial | `startup/main-process-ready-runtime.ts`                                                                                 | `wslUsageReporter: true`                                                                                 |
| Teste do `glab` (GitLab) ao abrir                                                 | Abre um processo a cada checagem; GitLab não usado                                                                                    | `preflight/agent-detection.ts`                                                                                          | `gitLabCliProbe: true`                                                                                   |

## Otimizado (não é corte, é o mesmo resultado com menos git)

| O quê                                        | Antes                                                                                                           | Agora                                                                                                            | Onde                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Descobrir seu usuário do git em cada projeto | 5 comandos git por projeto a **cada** abertura (~110 no total)                                                  | Só em projeto sem usuário salvo                                                                                  | `workspaces/catalog/repo-git-username-enrichment.ts`                            |
| Ler a lista de worktrees                     | 3 leituras iguais por projeto ao abrir, cada uma com seu git                                                    | Leituras iguais dentro de 3 s usam o mesmo resultado; criar/mover/remover worktree limpa na hora                 | `git/worktrees/catalog/worktree-list-result-cache.ts` (teste ao lado)           |
| Card aberto no fluxograma                    | Recalculava o layout da tela inteira a cada linha que o chat escrevia (16% de um núcleo com 1 chat trabalhando) | Só recalcula quando o tamanho muda; escrita só reposiciona o cursor. Anel de luz em camada própria. Visual igual | `dashboard-popout/preview-terminal-box-fit.ts`, `canvas-chats/canvas-chats.css` |

## Não cortado (de propósito)

| O quê                                                                        | Por quê                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Jira, Linear, GitLab, Bitbucket, Gitea, Azure (telas)                        | Só rodam quando abertos. Não pesam nada parado; cortar só aumentaria a diferença para o oficial |
| Notebook                                                                     | Só carrega ao abrir um `.ipynb`                                                                 |
| Idiomas além de pt/en                                                        | Só o idioma em uso é carregado; cortar exigiria mexer em dezenas de tipos sem ganho             |
| Medidor de limite de uso dos outros agentes                                  | Sem credencial desses agentes ele não abre processo; mexer arriscaria o medidor do Claude       |
| Fluxograma, voz, navegador embutido, computer use, SSH/WSL, AI Vault, GitHub | Usados                                                                                          |

## Medição

|                                 | Antes (10/11 19:30)       | Depois    |
| ------------------------------- | ------------------------- | --------- |
| Comandos git nos primeiros 40 s | 185 (191 s de git somado) | _a medir_ |
| Memória do Orca                 | ~1,9 GB                   | _a medir_ |
| Processador parado              | 56% de 1 núcleo           | _a medir_ |
