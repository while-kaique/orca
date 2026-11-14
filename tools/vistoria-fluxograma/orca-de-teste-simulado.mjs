// Orca de teste de mentira (ORCA_DE_TESTE_SIMULADO=1): so dorme e responde /json/version na porta pedida.
// Serve para provar a trava da maquina sem abrir o Electron. O "renderizador" imita os processos filhos do Orca
// de verdade, que citam a pasta do perfil na linha de comando.
// Uso: node orca-de-teste-simulado.mjs PORTA PASTA_DO_PERFIL [filho]
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'

const [porta, perfil, papel] = process.argv.slice(2)
setInterval(() => {}, 60_000)

if (papel !== 'filho') {
  spawn(process.execPath, [import.meta.filename, porta, perfil, 'filho'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref()
  createServer((pedido, resposta) => {
    if (pedido.url === '/json/version') {
      resposta.setHeader('content-type', 'application/json')
      resposta.end(JSON.stringify({ Browser: 'Orca de teste SIMULADO', pid: process.pid }))
      return
    }
    resposta.statusCode = 404
    resposta.end()
  }).listen(Number(porta), '127.0.0.1')
}
