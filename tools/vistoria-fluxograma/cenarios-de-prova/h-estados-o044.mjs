// Pior caso dos estados da o-044 sobre o pior caso de texto (titulos compridos, modelo, medidor de 987k, selos):
// PO "precisa de voce" com comando em segundo plano, executor suspenso (hexagono), planejador trabalhando (anel novo),
// chat livre "terminou" (respiracao) e os outros projetos como vieram da copia (apagados quando nada roda neles).
import piorCasoDeTexto, { limpar as limparTexto } from './c-texto-pior-caso.mjs'
import { chavesPorPapel } from './ajudas.mjs'

export const limpar = limparTexto

export default async function (page, contexto) {
  await piorCasoDeTexto(page, contexto)
  const fatos = await contexto.lerTela()
  const [po] = chavesPorPapel(fatos, 'po')
  const [planejador] = chavesPorPapel(fatos, 'planejador')
  const executores = chavesPorPapel(fatos, 'executor')
  const [livre] = chavesPorPapel(fatos, 'free')
  const alvo = {
    po: po?.chave ?? null,
    planejador: planejador?.chave ?? null,
    suspenso: executores[0]?.chave ?? null,
    livre: livre?.chave ?? null
  }
  const feito = await page.evaluate((a) => {
    const loja = window.__store
    const agora = Date.now()
    loja.setState((estado) => {
      const status = { ...estado.agentStatusByPaneKey }
      const painel = (tab) => Object.keys(status).find((k) => k.startsWith(`${tab}:`))
      if (a.po && painel(a.po)) {
        const k = painel(a.po)
        status[k] = {
          ...status[k],
          state: 'working',
          workingMode: 'monitoring',
          mainAgent: { state: 'done', stateStartedAt: agora - 60_000 },
          lastAssistantMessage:
            'Plano de 5 versoes pronto, falta seu OK.\n\nAprova as 5 direcoes e o plano?',
          subagents: [],
          children: [
            {
              id: `${a.po}-cmd`,
              providerId: `shell-${a.po}`,
              kind: 'command',
              name: 'npm run dev',
              state: 'working',
              membership: 'live',
              firstObservedAt: agora - 300_000,
              observedAt: agora,
              stoppable: true,
              invocation: { invocationId: `spawn-${a.po}`, generation: 1 }
            }
          ]
        }
      }
      if (a.livre && painel(a.livre)) {
        const k = painel(a.livre)
        status[k] = { ...status[k], state: 'done', subagents: [], stateStartedAt: agora }
      }
      const ptyIdsByTabId = { ...estado.ptyIdsByTabId }
      const sono = { ...estado.sleepingAgentSessionsByPaneKey }
      if (a.suspenso) {
        const k = painel(a.suspenso) ?? `${a.suspenso}:00000000-0000-4000-8000-000000000002`
        delete status[k]
        ptyIdsByTabId[a.suspenso] = []
        const pasta = Object.entries(estado.tabsByWorktree).find(([, abas]) =>
          abas.some((aba) => aba.id === a.suspenso)
        )?.[0]
        sono[k] = {
          paneKey: k,
          tabId: a.suspenso,
          worktreeId: pasta,
          agent: 'claude',
          providerSession: { key: 'session_id', id: `prova-${a.suspenso}` },
          prompt: 'pedido de prova',
          state: 'done',
          capturedAt: agora,
          updatedAt: agora,
          origin: 'worktree-sleep'
        }
      }
      return { agentStatusByPaneKey: status, ptyIdsByTabId, sleepingAgentSessionsByPaneKey: sono }
    })
    return Object.fromEntries(
      Object.entries(a).map(([papel, tab]) => [
        papel,
        tab ? document.querySelector(`[data-chat-key="${tab}"]`)?.getAttribute('data-status') : null
      ])
    )
  }, alvo)
  await page.waitForTimeout(1500)
  const estados = await page.evaluate(
    (a) =>
      Object.fromEntries(
        Object.entries(a).map(([papel, tab]) => [
          papel,
          tab
            ? document.querySelector(`[data-chat-key="${tab}"]`)?.getAttribute('data-status')
            : null
        ])
      ),
    alvo
  )
  contexto.dizer(
    `estados da o-044 montados: ${JSON.stringify(estados)} (antes do desenho: ${JSON.stringify(feito)})`
  )
}
