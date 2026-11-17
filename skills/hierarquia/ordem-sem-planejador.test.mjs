import { test } from 'node:test'
import assert from 'node:assert/strict'
import { argumentosDoWorkerStart } from './orca-lancador.mjs'
import { comRegraDeProcesso, textoDaOrdem } from './pedido-da-ordem.mjs'

const BASE = {
  de: null,
  pedido: 'ORDEM o-001 (executor).',
  titulo: 'executor: x',
  pasta: 'path:C:/p',
  baseBranch: null,
  esperaMs: '180000'
}

test('o executor de verdade sai com --model sonnet --effort high; o de teste (haiku, que nao aceita esforco), sem --effort', () => {
  const executor = argumentosDoWorkerStart({ ...BASE, modelo: 'sonnet' }).join(' ')
  assert.match(executor, /--agent claude --model sonnet --effort high --timeout-ms 180000$/u)
  const teste = argumentosDoWorkerStart({ ...BASE, modelo: 'haiku' }).join(' ')
  assert.match(teste, /--agent claude --model haiku --timeout-ms 180000$/u)
})

test('toda ordem leva a regra de processo no fim dos limites, uma vez so', () => {
  const regra =
    'Nunca encerrar processo por nome nem por trecho de linha de comando: so pelo PID, e so de processo que voce mesmo abriu (anote o PID ao abrir).'
  const campos = { limites: 'Nao mexer no login' }
  assert.equal(comRegraDeProcesso(campos).limites, `Nao mexer no login\n${regra}`)
  assert.equal(
    comRegraDeProcesso(comRegraDeProcesso(campos)).limites,
    `Nao mexer no login\n${regra}`
  )
  const arquivo = textoDaOrdem('o-001', 'executor', {
    ...comRegraDeProcesso(campos),
    objetivo: 'a',
    porque: 'b',
    criterios: ['c'],
    territorio: 'd'
  })
  assert.ok(arquivo.includes(`## Limites\nNao mexer no login\n${regra}\n`))
})
