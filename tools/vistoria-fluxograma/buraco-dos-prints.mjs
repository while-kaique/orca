// O maior buraco (em cards de 340 x 230) de cada arrumacao medida no programa de verdade: le os cabecalhos das provas
// dos casos (casos/<caso>/{antigo,novo}/fatos.json) e mede com o mesmo calculo do encaixe. Sem selos, como no mundo de teste.
// Uso: node tools/vistoria-fluxograma/buraco-dos-prints.mjs PASTA_DOS_CASOS [SAIDA.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { buracosEm, carregarCalculo, CASOS, projetosDoCaso } from './casos-encaixe.mjs'

const pasta = process.argv[2]
const calculo = await carregarCalculo()
const palavra = { astra: 'astra', orca: 'orca', so: 'sistemas', social: 'social' }
const etapas = [
  ['antigo', 'antigo', '2-reorganizado-antigo'],
  ['mao', 'antigo', '3-a-mao'],
  ['novo', 'novo', '2-reorganizado-novo']
]
const saida = {}
for (const caso of CASOS) {
  saida[caso.id] = {}
  const projetos = projetosDoCaso(caso, { semSelos: true })
  for (const [rotulo, versao, etapa] of etapas) {
    const fatos = JSON.parse(readFileSync(`${pasta}/${caso.id}/${versao}/fatos.json`, 'utf8'))
      .etapas[etapa].fatos
    const cabecalhos = {}
    for (const projeto of caso.projetos) {
      const p = fatos.projetos.find((q) => q.nome?.toLowerCase().includes(palavra[projeto.id]))
      cabecalhos[projeto.id] = [
        (p.caixa.x - fatos.quadro.x) / fatos.escala,
        (p.caixa.y - fatos.quadro.y) / fatos.escala
      ]
    }
    saida[caso.id][rotulo] = buracosEm(calculo, projetos, cabecalhos)
    console.log(caso.id, rotulo, JSON.stringify(saida[caso.id][rotulo]))
  }
}
if (process.argv[3]) {
  writeFileSync(process.argv[3], JSON.stringify(saida, null, 2))
}
