import { useState } from 'react'
import './App.css'

// Auth API (Spring): VITE_API_URL in .env → e.g. http://localhost:8080
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
// Prediction API (FastAPI/Python): VITE_PREDICTION_API_URL in .env → e.g. http://localhost:8000
const PREDICTION_API_BASE = (import.meta.env.VITE_PREDICTION_API_URL || '').replace(/\/$/, '')

// Map cause-of-damage codes to numeric string for FastAPI (backend uses float(causeOfDamage))
const CAUSE_CODE_TO_NUMERIC = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '7': '7', '8': '8', '9': '9', 'A': '10', 'B': '11', 'C': '12', 'D': '13' }

const STORMS = [
  { id: 'helene', name: 'Hurricane Helene (2024)', region: 'Southeast' },
  { id: 'milton', name: 'Hurricane Milton (2024)', region: 'Florida' },
  { id: 'ian', name: 'Hurricane Ian (2022)', region: 'Florida' },
  { id: 'ida', name: 'Hurricane Ida (2021)', region: 'Gulf Coast' },
  { id: 'other', name: 'Other declared disaster', region: 'Varies' },
]

// Cause of damage: value : description (multiple can be selected).
// Codes 7 and 8 only if date of loss is prior to September 23, 1995.
const CAUSE_OF_DAMAGE_OPTIONS = [
  { value: '0', label: 'Other causes' },
  { value: '1', label: 'Tidal water overflow' },
  { value: '2', label: 'Stream, river, or lake overflow' },
  { value: '3', label: 'Alluvial fan overflow' },
  { value: '4', label: 'Accumulation of rainfall or snowmelt' },
  { value: '7', label: 'Erosion-demolition (loss before Sept 23, 1995 only)' },
  { value: '8', label: 'Erosion-removal (loss before Sept 23, 1995 only)' },
  { value: '9', label: 'Earth movement, landslide, land subsidence, sinkholes, etc.' },
  { value: 'A', label: 'Closed basin lake' },
  { value: 'B', label: 'Expedited claim handling process without site inspection' },
  { value: 'C', label: 'Expedited claim handling process follow-up site inspection' },
  { value: 'D', label: 'Expedited claim handling process by Adjusting Process Pilot Program (Remote Adjustment)' },
]

function App() {
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [storm, setStorm] = useState('')
  const [waterDepth, setWaterDepth] = useState('')
  const [floodWaterDuration, setFloodWaterDuration] = useState('')
  const [causeOfDamage, setCauseOfDamage] = useState([])
  const [event, setEvent] = useState('')
  const [estimatedLoss, setEstimatedLoss] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [predictionInference, setPredictionInference] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionError, setPredictionError] = useState(null)

  const estimatedLossNum = parseFloat(estimatedLoss) || 0
  const hasRequired =
    storm &&
    waterDepth.trim() &&
    floodWaterDuration.trim() &&
    causeOfDamage.length > 0 &&
    event.trim()
  const hasInput = hasRequired && estimatedLossNum > 0

  // Simplified illustrative estimate (replace with real data integration)
  const lowEstimate = Math.round(estimatedLossNum * 0.15)
  const highEstimate = Math.round(estimatedLossNum * 0.45)
  const formattedLow = lowEstimate.toLocaleString()
  const formattedHigh = highEstimate.toLocaleString()

  function toggleCauseOfDamage(value) {
    setCauseOfDamage((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!hasRequired) return
    setPredictionError(null)

    if (!PREDICTION_API_BASE) {
      setPredictionError('Prediction API URL is not set. Add VITE_PREDICTION_API_URL to your .env (e.g. http://localhost:8000).')
      return
    }

    setPredictionLoading(true)
    try {
      const causeStr = causeOfDamage.length > 0
        ? (CAUSE_CODE_TO_NUMERIC[causeOfDamage[0]] ?? causeOfDamage[0])
        : '0'
      const res = await fetch(`${PREDICTION_API_BASE}/prediction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waterDepth: waterDepth.trim(),
          floodWaterDuration: floodWaterDuration.trim(),
          causeOfDamage: causeStr,
          floodEvent: event.trim(),
        }),
      })
      const text = await res.text()
      if (!res.ok) {
        throw new Error(text || `Prediction API error: ${res.status}`)
      }
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('Invalid JSON from prediction API.')
      }
      if (data && typeof data.inference !== 'undefined') {
        setPredictionInference(data.inference)
        setSubmitted(true)
      } else {
        setPredictionError('Prediction API did not return an inference.')
      }
    } catch (err) {
      setPredictionError(err.message || 'Prediction request failed.')
    } finally {
      setPredictionLoading(false)
    }
  }

  function handleReset() {
    setSubmitted(false)
    setPredictionInference(null)
    setPredictionError(null)
    setStorm('')
    setWaterDepth('')
    setFloodWaterDuration('')
    setCauseOfDamage([])
    setEvent('')
    setEstimatedLoss('')
  }

  async function handleAuthSubmit(e) {
    e.preventDefault()
    setAuthError('')
    const u = username.trim()
    const p = password
    if (!u || !p) {
      setAuthError('Please enter username and password.')
      return
    }
    if (authMode === 'signup') {
      if (p !== repeatPassword) {
        setAuthError('Passwords do not match.')
        return
      }
      if (p.length < 6) {
        setAuthError('Password should be at least 6 characters.')
        return
      }
    }

    if (!API_BASE) {
      setAuthError('Auth API URL is not set. Add VITE_API_URL to your .env (e.g. http://localhost:8080).')
      return
    }

    setAuthLoading(true)
    try {
      const url = authMode === 'signup'
        ? `${API_BASE}/makenewuser`
        : `${API_BASE}/validatelogin`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      const text = await res.text()
      let success = false
      try {
        const data = JSON.parse(text)
        success = data === true
      } catch {
        success = res.ok && text.trim() === 'true'
      }
      if (success) {
        setUser({ username: u })
        setUsername('')
        setPassword('')
        setRepeatPassword('')
        return
      }
      if (authMode === 'signup') {
        setAuthError('Username may already be taken or signup failed. Please try again.')
      } else {
        setAuthError('Invalid username or password.')
      }
    } catch (err) {
      setAuthError(err.message || 'Unable to reach the server. Please check your connection and try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    setUser(null)
    setAuthMode('login')
    setAuthError('')
  }

  // Auth gate: show login/signup until user is set
  if (!user) {
    return (
      <div className="app app-auth">
        <header className="header header-auth">
          <div className="header-inner">
            <a href="/" className="logo">
              <span className="logo-icon" aria-hidden>◇</span>
              <span>Relief Estimate</span>
            </a>
          </div>
        </header>
        <main className="auth-main">
          <div className="auth-card">
            <h1 className="auth-title">Sign in</h1>
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === 'login' ? 'auth-tab-active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
              >
                Existing user
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'signup' ? 'auth-tab-active' : ''}`}
                onClick={() => { setAuthMode('signup'); setAuthError(''); }}
              >
                New user
              </button>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <label className="field">
                <span className="field-label">Username</span>
                <input
                  type="text"
                  autoComplete={authMode === 'signup' ? 'username' : 'username'}
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="field-input"
                />
              </label>
              <label className="field">
                <span className="field-label">Password</span>
                <input
                  type="password"
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                />
              </label>
              {authMode === 'signup' && (
                <label className="field">
                  <span className="field-label">Repeat password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    className="field-input"
                  />
                </label>
              )}
              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading
                  ? (authMode === 'login' ? 'Signing in…' : 'Creating account…')
                  : (authMode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <a href="/" className="logo">
            <span className="logo-icon" aria-hidden>◇</span>
            <span>Relief Estimate</span>
          </a>
          <nav className="nav">
            <a href="#estimate">Get estimate</a>
            <a href="#how">How it works</a>
            <span className="nav-user">
              <span className="nav-username">{user.username}</span>
              <button type="button" className="nav-logout" onClick={handleLogout}>
                Log out
              </button>
            </span>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-bg" aria-hidden />
          <div className="hero-content">
            <p className="hero-badge">Powered by public disaster data</p>
            <h1 id="hero-title" className="hero-title">
              Know your rights.<br />
              <span className="hero-title-accent">Estimate your relief.</span>
            </h1>
            <p className="hero-desc">
              Use publicly available hurricane and flood data to see a realistic range of
              compensation for your losses. Free, private, and based on declared disasters.
            </p>
            <a href="#estimate" className="hero-cta">
              Get your estimate
            </a>
          </div>
          <div className="hero-visual">
            <div className="hero-card hero-card-1" />
            <div className="hero-card hero-card-2" />
            <div className="hero-card hero-card-3" />
          </div>
        </section>

        <section id="estimate" className="section estimate-section">
          <div className="section-inner">
            <h2 className="section-title">Compensation estimate</h2>
            <p className="section-desc">
              Select your disaster and loss details. Estimates are indicative and based on
              historical payouts for similar declared events.
            </p>

            <form className="estimate-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="field">
                  <span className="field-label">Declared disaster</span>
                  <select
                    value={storm}
                    onChange={(e) => setStorm(e.target.value)}
                    className="field-input"
                    required
                  >
                    <option value="">Select storm or event</option>
                    {STORMS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.region}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field-label">Water depth (feet)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 2.5"
                    value={waterDepth}
                    onChange={(e) => setWaterDepth(e.target.value)}
                    className="field-input"
                    required
                  />
                </label>

                <label className="field">
                  <span className="field-label">Flood water duration (days)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 3"
                    value={floodWaterDuration}
                    onChange={(e) => setFloodWaterDuration(e.target.value)}
                    className="field-input"
                    required
                  />
                </label>

                <div className="field field-full">
                  <span className="field-label">Cause of damage</span>
                  <p className="field-hint">
                    How the property and contents were damaged. Select all that apply.
                    Codes 7 and 8 apply only if date of loss is before September 23, 1995.
                  </p>
                  <div className="cause-checkboxes" role="group" aria-label="Cause of damage">
                    {CAUSE_OF_DAMAGE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="cause-checkbox">
                        <input
                          type="checkbox"
                          checked={causeOfDamage.includes(opt.value)}
                          onChange={() => toggleCauseOfDamage(opt.value)}
                        />
                        <span className="cause-checkbox-label">
                          <strong>{opt.value}</strong> — {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {causeOfDamage.length > 0 && (
                    <p className="field-selected">
                      Selected: {causeOfDamage.join(', ')}
                    </p>
                  )}
                </div>

                <label className="field field-full">
                  <span className="field-label">Describe the event</span>
                  <textarea
                    placeholder="Describe the flooding or disaster event, when it occurred, and any relevant details..."
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="field-input field-textarea"
                    rows={4}
                    required
                  />
                </label>

                <label className="field field-full">
                  <span className="field-label">Estimated total loss (USD, optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 50000 — for compensation range only"
                    value={estimatedLoss}
                    onChange={(e) => setEstimatedLoss(e.target.value)}
                    className="field-input"
                  />
                </label>
              </div>

              {predictionError && !submitted && (
                <p className="auth-error" role="alert">{predictionError}</p>
              )}
              {submitted && hasRequired ? (
                <div className="result-card" role="status">
                  <div className="result-header">
                    <span className="result-label">
                      {predictionInference != null ? 'Model prediction' : estimatedLossNum > 0 ? 'Estimated compensation range' : 'Details submitted'}
                    </span>
                    <button type="button" className="result-reset" onClick={handleReset}>
                      Edit inputs
                    </button>
                  </div>
                  {predictionInference != null && (
                    <p className="result-range result-inference">
                      {typeof predictionInference === 'number'
                        ? `$${Number(predictionInference).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : Array.isArray(predictionInference)
                          ? `$${Number(predictionInference[0]).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : String(predictionInference)}
                    </p>
                  )}
                  {estimatedLossNum > 0 && (
                    <p className="result-range">
                      <strong>${formattedLow}</strong> – <strong>${formattedHigh}</strong>
                      <span className="result-range-label"> (illustrative range)</span>
                    </p>
                  )}
                  <p className="result-note">
                    {predictionInference != null
                      ? 'Model prediction is based on your water depth, duration, cause of damage, and event. Actual relief depends on program rules and eligibility.'
                      : estimatedLossNum > 0
                        ? 'Actual relief depends on program rules, documentation, and eligibility.'
                        : 'Add an estimated total loss and click “Edit inputs” then “Calculate estimate” to see an illustrative range.'}
                  </p>
                </div>
              ) : (
                <button type="submit" className="submit-btn" disabled={!hasRequired || predictionLoading}>
                  {predictionLoading ? 'Calculating…' : 'Calculate estimate'}
                </button>
              )}
            </form>
          </div>
        </section>

        <section id="how" className="section how-section">
          <div className="section-inner">
            <h2 className="section-title">How it works</h2>
            <div className="how-grid">
              <article className="how-card">
                <div className="how-num">1</div>
                <h3>Public data</h3>
                <p>
                  We use FEMA declarations, NOAA storm data, and published relief
                  statistics—all publicly available.
                </p>
              </article>
              <article className="how-card">
                <div className="how-num">2</div>
                <h3>Your inputs</h3>
                <p>
                  You provide disaster, water depth, duration, cause of damage, and event
                  description. Nothing is stored or shared until you submit.
                </p>
              </article>
              <article className="how-card">
                <div className="how-num">3</div>
                <h3>Estimate range</h3>
                <p>
                  We show a plausible compensation range based on historical payout patterns
                  for similar cases.
                </p>
              </article>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-inner">
            <p className="footer-brand">Relief Estimate</p>
            <p className="footer-disclaimer">
              Estimates are for informational purposes only. They do not guarantee
              eligibility or payment. Always consult official sources and apply through
              authorized programs.
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default App
