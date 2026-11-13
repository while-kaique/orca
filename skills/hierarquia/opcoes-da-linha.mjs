// Lê os argumentos da linha de comando do `hierarquia`: `--prova` pode repetir; as chaves da lista não têm valor.
export function opcoes(argv) {
  const saida = { _: [], prova: [] }
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i]
    if (!item.startsWith('--')) {
      saida._.push(item)
    } else if (
      [
        '--aprovar',
        '--reprovar',
        '--na-frente',
        '--na-pasta-do-criador',
        '--teste',
        '--terminados',
        '--json',
        '--help'
      ].includes(item)
    ) {
      saida[item.slice(2)] = true
    } else if (item === '--prova') {
      saida.prova.push(argv[++i])
    } else {
      saida[item.slice(2)] = argv[++i]
    }
  }
  return saida
}
