import { useState, type FormEvent } from 'react'
import { household } from '../appState'
import { API_URL } from '../config'
import { isValidHouseholdName, isValidPasscode, passcodeRules } from '../domain/household'

type Mode = 'join' | 'create'

/** Shown until this device has joined or created a household. */
export function HouseholdScreen({ initialError }: { initialError?: string | null }) {
  const [mode, setMode] = useState<Mode>('join')
  const [name, setName] = useState('')
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  const creating = mode === 'create'
  // Joining accepts whatever was set; only creation enforces the rules client-side.
  const valid = isValidHouseholdName(name) && (creating ? isValidPasscode(passcode) : passcode !== '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await (creating ? household.create(name, passcode) : household.join(name, passcode))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <section className="screen">
      <header className="nav-bar large">
        <h1>Grocery List</h1>
      </header>
      <form className="scroll" onSubmit={submit}>
        <div className="segmented" role="tablist" aria-label="Household">
          {(['join', 'create'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'active' : ''}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
            >
              {m === 'join' ? 'Join household' : 'Create household'}
            </button>
          ))}
        </div>

        <div className="group">
          <div className="field">
            <input
              aria-label="Household name"
              placeholder="Household name"
              value={name}
              maxLength={40}
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <input
              type="password"
              aria-label="Passcode"
              placeholder="Passcode"
              value={passcode}
              maxLength={128}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete={creating ? 'new-password' : 'current-password'}
              spellCheck={false}
              onChange={(e) => setPasscode(e.target.value)}
            />
          </div>
        </div>

        {creating ? (
          <ul className="rules" aria-label="Passcode requirements">
            {passcodeRules(passcode).map((r) => (
              <li key={r.label} className={r.met ? 'met' : ''}>
                {r.met ? '✓' : '○'} {r.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="section-footer">Ask a family member for the household name and passcode.</p>
        )}

        {API_URL === '' && <p className="error">This build has no server configured (VITE_API_URL).</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="group">
          <button className="field action" type="submit" disabled={!valid || busy || API_URL === ''}>
            {busy ? <div className="spinner spinning" /> : <span>{creating ? 'Create household' : 'Join household'}</span>}
          </button>
        </div>
      </form>
    </section>
  )
}
