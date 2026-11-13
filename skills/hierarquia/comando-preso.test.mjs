import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comandoAberto, comandoPreso } from './comando-preso.mjs'

// Caso real de 13/11: o planejador da o-042 abriu este comando as 17:14:12 e nada mais aconteceu ate 17:55.
const HEREDOC = JSON.stringify({
  type: 'assistant',
  timestamp: '2026-11-13T17:14:12.801Z',
  message: {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_01GspVTgnbdwuuGAJpeFqofR',
        name: 'Bash',
        input: {
          command: "python - <<'EOF'\nimport re\np='tools/vistoria-fluxograma/orca-de-teste.mjs'"
        }
      }
    ]
  }
})
const minutosDepois = (min) => Date.parse('2026-11-13T17:14:12.801Z') + min * 60000

test('o-042 (13/11): um comando de shell aberto ha 41 min sem nada novo e dado como preso', () => {
  const preso = comandoPreso(comandoAberto([HEREDOC]), minutosDepois(41))
  assert.equal(preso.minutos, 41)
  assert.equal(preso.ferramentaId, 'toolu_01GspVTgnbdwuuGAJpeFqofR')
  assert.equal(preso.comando, "python - <<'EOF'")
})

test('aos 14 min ainda nao e preso: o Bash do Claude tem teto de 10 min e a folga e de 5', () => {
  assert.equal(comandoPreso(comandoAberto([HEREDOC]), minutosDepois(14)), null)
  assert.notEqual(comandoPreso(comandoAberto([HEREDOC]), minutosDepois(15)), null)
})

test('comando que devolveu resultado, ou com novidade depois dele, nao e preso', () => {
  const resultado = JSON.stringify({
    type: 'user',
    timestamp: '2026-11-13T17:15:00.000Z',
    message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_01GspVTgnbdwuuGAJpeFqofR' }] }
  })
  assert.equal(comandoPreso(comandoAberto([HEREDOC, resultado]), minutosDepois(41)), null)
  const novidade = JSON.stringify({ type: 'attachment', timestamp: '2026-11-13T17:50:00.000Z' })
  assert.equal(comandoPreso(comandoAberto([HEREDOC, novidade]), minutosDepois(41)), null)
})

test('ferramenta que nao e shell (um subagente longo) nunca e dada como presa', () => {
  const agente = HEREDOC.replace('"name":"Bash"', '"name":"Agent"')
  assert.equal(comandoPreso(comandoAberto([agente]), minutosDepois(41)), null)
})
