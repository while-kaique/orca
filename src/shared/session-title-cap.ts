export const SESSION_TITLE_MAX_WORDS = 3
export const SESSION_TITLE_MAX_CHARS = 23

// Connector words that make a generated title read like a sentence (pt + en).
const FILLER_WORDS = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'no',
  'na',
  'nos',
  'nas',
  'em',
  'um',
  'uma',
  'e',
  'para',
  'pra',
  'por',
  'com',
  'ao',
  'aos',
  'que',
  'the',
  'an',
  'of',
  'to',
  'for',
  'in',
  'on',
  'and',
  'with'
])

/** Shortens an auto-generated session name to at most 3 words / 23 chars, cut on word boundaries. */
export function capSessionTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) {
    return trimmed
  }
  const allWords = trimmed.replace(/(\.{3}|…)$/u, '').split(/\s+/u)
  const isFiller = (word: string): boolean =>
    FILLER_WORDS.has(word.toLowerCase().replace(/[^\p{L}]/gu, ''))
  const isCountable = (word: string): boolean => /[\p{L}\p{N}]/u.test(word)
  // Why: a title made only of filler words would vanish; keep the original words then.
  const source = allWords.some((word) => isCountable(word) && !isFiller(word))
    ? allWords.filter((word) => !isFiller(word))
    : allWords
  const words: string[] = []
  let counted = 0
  for (const word of source) {
    if (counted === SESSION_TITLE_MAX_WORDS) {
      break
    }
    words.push(word)
    // Separators like "|" ride along without using up a word.
    if (isCountable(word)) {
      counted += 1
    }
  }
  let result = ''
  for (const word of words) {
    const next = result ? `${result} ${word}` : word
    if (next.length > SESSION_TITLE_MAX_CHARS) {
      break
    }
    result = next
  }
  // A single word longer than the cap still needs to show something.
  return (result || words[0].slice(0, SESSION_TITLE_MAX_CHARS)).replace(/[\s,.;:–-]+$/u, '')
}
