import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createApi } from '../lib/api'
import { localToday, yesterday } from '../lib/dateOnly'
import { normalizeCandidates } from '../lib/normalize'
import { ApiError, type Ingredient, type SaveResult, type Snapshot } from '../lib/types'
import './app.css'

const ENDPOINT_KEY = 'magnus.endpoint'
const PASSCODE_KEY = 'magnus.passcode'
const SNAPSHOT_KEY = 'magnus.snapshot'
const DRAFT_KEY = 'magnus.draft'
const LIST_SORT_KEY = 'magnus.listSort'
const EMPTY: Snapshot = { summary: { totalIngredients: 0, goal: 100 }, ingredients: [] }

type Draft = { text: string; date: string }
type IngredientSort = 'name' | 'latest'

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}

function readDraft(): Draft {
  const saved = readJson<{ text?: unknown }>(DRAFT_KEY, {})
  return { text: typeof saved.text === 'string' ? saved.text : '', date: localToday() }
}

function readIngredientSort(): IngredientSort {
  return localStorage.getItem(LIST_SORT_KEY) === 'latest' ? 'latest' : 'name'
}

function sortIngredients(ingredients: Ingredient[], sort: IngredientSort): Ingredient[] {
  return [...ingredients].sort((a, b) => sort === 'latest'
    ? b.firstExposureDate.localeCompare(a.firstExposureDate) || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name))
}

export function App() {
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem(ENDPOINT_KEY) || '')
  const [passcode, setPasscode] = useState(() => localStorage.getItem(PASSCODE_KEY) || '')
  const [snapshot, setSnapshot] = useState(() => readJson(SNAPSHOT_KEY, EMPTY))
  const [draft, setDraft] = useState<Draft>(() => readDraft())
  const [result, setResult] = useState<SaveResult | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(!endpoint)
  const [showGuide, setShowGuide] = useState(false)
  const [query, setQuery] = useState('')
  const [ingredientSort, setIngredientSort] = useState<IngredientSort>(() => readIngredientSort())
  const api = useMemo(() => window.__MAGNUS_TEST_API__ || createApi(endpoint), [endpoint])
  const parsed = useMemo(() => normalizeCandidates(draft.text), [draft.text])
  const known = useMemo(() => new Map(snapshot.ingredients.map((ingredient) => [ingredient.key, ingredient])), [snapshot.ingredients])
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const matches = snapshot.ingredients.filter((ingredient) => ingredient.name.toLowerCase().includes(normalizedQuery))
    return sortIngredients(matches, ingredientSort)
  }, [ingredientSort, query, snapshot.ingredients])

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: draft.text })) }, [draft.text])
  useEffect(() => {
    if (passcode) localStorage.setItem(PASSCODE_KEY, passcode)
    else localStorage.removeItem(PASSCODE_KEY)
  }, [passcode])
  useEffect(() => { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)) }, [snapshot])
  useEffect(() => { localStorage.setItem(LIST_SORT_KEY, ingredientSort) }, [ingredientSort])
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => undefined)
  }, [])

  async function refresh() {
    setMessage('')
    try {
      const next = await api.snapshot(passcode)
      setSnapshot(next)
      setMessage('Ingredient list refreshed.')
    } catch (error) { setMessage(userMessage(error)) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setResult(null); setMessage('')
    if (!passcode) { setMessage('Enter the family passcode to save.'); return }
    if (!parsed.length) { setMessage('Add at least one ingredient first.'); return }
    setSaving(true)
    try {
      const saved = await api.saveIngredients(passcode, draft.date, parsed.map((item) => item.key))
      setResult(saved)
      const next = await api.snapshot(passcode)
      setSnapshot(next)
      setDraft({ text: '', date: localToday() })
      setMessage('Saved. The list is up to date.')
    } catch (error) { setMessage(userMessage(error)) } finally { setSaving(false) }
  }

  function saveSettings() {
    localStorage.setItem(ENDPOINT_KEY, endpoint.trim())
    setEndpoint(endpoint.trim())
    setShowSettings(false)
    setMessage('Endpoint saved on this device.')
  }

  return <main className="app-shell">
    <header><p className="eyebrow">Magnus's food adventure</p><h1>{snapshot.summary.totalIngredients} <span>of {snapshot.summary.goal}</span></h1><div className="progress" aria-label={`${snapshot.summary.totalIngredients} of ${snapshot.summary.goal} ingredients`}><span style={{ width: `${Math.min(100, snapshot.summary.totalIngredients)}%` }} /></div></header>
    <section className="card intake" aria-labelledby="entry-heading"><div className="section-heading"><h2 id="entry-heading">What did Magnus try?</h2></div>
      <form onSubmit={submit}>
        <label htmlFor="exposure-date">Date offered</label><input id="exposure-date" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required />
        <div className="date-actions" aria-label="Quick date choices"><button className="text-button" type="button" onClick={() => setDraft({ ...draft, date: localToday() })}>Today</button><button className="text-button" type="button" onClick={() => setDraft({ ...draft, date: yesterday() })}>Yesterday</button></div>
        <label htmlFor="ingredients">Foods</label><textarea id="ingredients" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="blended prawns, carrot, and corn" rows={4} />
        <Preview parsed={parsed} known={known} />
        <button className="primary" type="submit" disabled={saving || !parsed.length}>{saving ? 'Saving...' : 'Save ingredients'}</button>
      </form>
    </section>
    {message && <p className="notice" role="status">{message}</p>}
    {result && <Result result={result} />}
    <section className="card list" aria-labelledby="list-heading"><div className="section-heading"><h2 id="list-heading">Tracked ingredients</h2><button className="text-button" type="button" onClick={refresh}>Refresh</button></div><label className="sr-only" htmlFor="search">Search ingredients</label><input id="search" type="search" placeholder="Search ingredients" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="list-tools"><label htmlFor="sort-order">Sort by</label><select id="sort-order" value={ingredientSort} onChange={(event) => setIngredientSort(event.target.value === 'latest' ? 'latest' : 'name')}><option value="name">Name A-Z</option><option value="latest">Latest date offered</option></select></div>
      <p className="list-meta">{filtered.length ? `${filtered.length} tracked ingredient${filtered.length === 1 ? '' : 's'}. Scroll this panel without losing the settings below.` : 'No matching ingredients yet.'}</p>
      <ul className="ingredient-list" aria-label="Tracked ingredients list">{filtered.map((ingredient) => <IngredientRow key={ingredient.key} ingredient={ingredient} />)}{!filtered.length && <li className="empty">Your saved ingredients will appear here.</li>}</ul>
    </section>
    <section className="guide"><button className="text-button" type="button" onClick={() => setShowGuide(!showGuide)} aria-expanded={showGuide}>How it works</button>{showGuide && <div className="guide-panel"><h2>Quick guide</h2><ol><li>Enter one ingredient list, separated by commas, semicolons, new lines, or "and".</li><li>For a mixed dish, list its ingredients: <em>chicken, rice, carrot</em> - not "chicken porridge".</li><li>The app removes simple prep words and plurals, then saves only ingredients not already tracked.</li><li>Enter an older date again to correct a first-exposure date earlier. It will never move a date later.</li></ol><h3>Fix a typo</h3><p>Open the <strong>Ingredients</strong> table in Airtable. For an uncomplicated typo, edit both <strong>Name</strong> and its matching lowercase <strong>Key</strong>. If the corrected key already exists, keep the correct row and its earliest date, then remove the typo row.</p></div>}</section>
    <section className="settings"><button className="text-button" type="button" onClick={() => setShowSettings(!showSettings)} aria-expanded={showSettings}>Settings & diagnostics</button>{showSettings && <div className="settings-panel"><label htmlFor="endpoint">Apps Script /exec URL</label><input id="endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://script.google.com/macros/s/.../exec" autoCapitalize="none" /><label htmlFor="passcode">Family passcode</label><input id="passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" /><p>Saved on this device like the endpoint. Clear it if the device should stop remembering the passcode.</p><div className="settings-actions"><button className="secondary" type="button" onClick={saveSettings}>Save endpoint</button><button className="secondary subtle" type="button" onClick={() => setPasscode('')}>Forget passcode</button></div></div>}</section>
  </main>
}

function Preview({ parsed, known }: { parsed: { key: string; name: string }[]; known: Map<string, Ingredient> }) {
  if (!parsed.length) return <p className="hint">Separate foods with commas, semicolons, new lines, or "and".</p>
  return <div className="preview" aria-live="polite"><p>Preview</p><ul>{parsed.map((item) => <li key={item.key}><span>{item.name}</span><small className={known.has(item.key) ? 'known' : 'new'}>{known.has(item.key) ? 'Already tracked' : 'New'}</small></li>)}</ul></div>
}

function Result({ result }: { result: SaveResult }) {
  return <section className="card result" aria-live="polite"><h2>Save complete</h2>{result.created.length > 0 && <p><strong>New:</strong> {result.created.map((item) => item.name).join(', ')}</p>}{result.alreadyKnown.length > 0 && <p><strong>Already tracked:</strong> {result.alreadyKnown.map((item) => item.name).join(', ')}</p>}{result.dateCorrected.length > 0 && <p><strong>Date corrected:</strong> {result.dateCorrected.map((item) => item.name).join(', ')} now has its earliest date.</p>}</section>
}

function IngredientRow({ ingredient }: { ingredient: Ingredient }) { return <li><span>{ingredient.name}</span><time dateTime={ingredient.firstExposureDate}>{ingredient.firstExposureDate}</time></li> }
function userMessage(error: unknown): string { return error instanceof ApiError ? error.message : 'Something went wrong. Your typed foods are still here; please retry.' }
