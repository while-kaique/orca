// Comando do Orca de teste que anota cada chamada (HIERARQUIA_ORCA aponta para o .cmd que chama este arquivo): serve para
// guardar a linha de comando de cada `worker-start` e `terminal create` que o `hierarquia` faz (o-047).
// Variaveis: ORCA_REGISTRADO_ALVO (o comando de verdade) e ORCA_REGISTRADO_LOG (onde anotar).
import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const citarArg = (arg) =>
  /^".*"$/su.test(arg) || !/[\s&|<>^()"]/u.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`
const argumentos = process.argv.slice(2)
appendFileSync(
  process.env.ORCA_REGISTRADO_LOG,
  `${new Date().toISOString()} ${argumentos.join(' ').slice(0, 4000)}\n`
)
const resultado = spawnSync(process.env.ORCA_REGISTRADO_ALVO, argumentos.map(citarArg), {
  shell: true,
  stdio: 'inherit',
  windowsHide: true
})
process.exit(resultado.status ?? 1)
