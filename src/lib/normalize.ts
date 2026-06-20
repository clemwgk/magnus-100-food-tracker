export type NormalizedIngredient = { key: string; name: string }

const PREPARATION_PREFIX = /^(?:blended|pureed|puree|mashed|steamed|boiled|roasted|cooked|raw)\s+/i
const EXCEPTIONS = new Set(['bass', 'cress', 'asparagus'])

export function normalizeCandidate(value: string): NormalizedIngredient | null {
  let key = value.trim().toLowerCase().replace(PREPARATION_PREFIX, '')
  key = key.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/\s+/g, ' ')
  if (!key || key.length > 80 || !/[\p{L}\p{N}]/u.test(key)) return null
  key = singularize(key)
  return { key, name: titleCase(key) }
}

export function normalizeCandidates(input: string | string[]): NormalizedIngredient[] {
  const candidates = Array.isArray(input) ? input : input.split(/[,;\n]|\band\b/iu)
  const seen = new Set<string>()
  return candidates.flatMap((candidate) => {
    const normalized = normalizeCandidate(candidate)
    if (!normalized || seen.has(normalized.key)) return []
    seen.add(normalized.key)
    return [normalized]
  })
}

export function singularize(key: string): string {
  if (key.length < 4 || EXCEPTIONS.has(key) || /(ss|us|is)$/u.test(key)) return key
  if (key.endsWith('ies')) return `${key.slice(0, -3)}y`
  if ((key === 'tomatoes' || key === 'potatoes') && key.endsWith('oes')) return `${key.slice(0, -2)}`
  return key.endsWith('s') && key.length > 3 ? key.slice(0, -1) : key
}

export function titleCase(value: string): string {
  return value.replace(/\b[\p{L}\p{N}]/gu, (letter) => letter.toUpperCase())
}
