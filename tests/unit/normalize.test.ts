import { describe, expect, it } from 'vitest'
import { normalizeCandidate, normalizeCandidates } from '../../src/lib/normalize'

describe('normalization contract', () => {
  it('parses the primary fixture', () => expect(normalizeCandidates('blended prawns, carrot, and corn').map((item) => item.key)).toEqual(['prawn', 'carrot', 'corn']))
  it('handles supported delimiters and duplicate input', () => expect(normalizeCandidates('corn; CORNS\ncarrot and corn').map((item) => item.key)).toEqual(['corn', 'carrot']))
  it('uses conservative plural rules and exceptions', () => {
    expect(normalizeCandidates('berries; tomatoes; potatoes').map((item) => item.key)).toEqual(['berry', 'tomato', 'potato'])
    expect(normalizeCandidates('bass, cress, asparagus').map((item) => item.key)).toEqual(['bass', 'cress', 'asparagus'])
  })
  it('strips preparation prefixes without merging distinct foods', () => {
    expect(normalizeCandidate(' roasted prawns ')).toMatchObject({ key: 'prawn', name: 'Prawn' })
    expect(normalizeCandidates('shrimp, prawn').map((item) => item.key)).toEqual(['shrimp', 'prawn'])
  })
  it('rejects empty or punctuation-only candidates', () => expect(normalizeCandidates(' , ;\n !!!')).toEqual([]))
})
