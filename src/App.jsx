import { useState } from 'react'
import './App.css'

// Auth API (Spring). Default: Railway production; set VITE_API_URL in .env to override (e.g. http://localhost:8080 for local).
const AUTH_API_DEFAULT = 'https://floodreliefbackend-production.up.railway.app'
const API_BASE = (import.meta.env.VITE_API_URL || AUTH_API_DEFAULT).replace(/\/$/, '')
// Prediction API (FastAPI/Python). Default: Railway production; set VITE_PREDICTION_API_URL to override (e.g. http://localhost:8000 for local).
const PREDICTION_API_DEFAULT = 'https://floodreliefprediction-production.up.railway.app'
const PREDICTION_API_BASE = (import.meta.env.VITE_PREDICTION_API_URL || PREDICTION_API_DEFAULT).replace(/\/$/, '')

// Map cause-of-damage codes to numeric string for FastAPI (backend uses float(causeOfDamage))
const CAUSE_CODE_TO_NUMERIC = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '7': '7', '8': '8', '9': '9', 'A': '10', 'B': '11', 'C': '12', 'D': '13' }

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

// Flood events (keys from backend dictionary). Value "None" maps to Python None.
const FLOOD_EVENT_OPTIONS = [
  { value: 'None', label: 'Not specified' },
  '2021 Mid-Spring Severe Storms',
  '2025 July NYC Metro Area Flooding',
  "April 2007 Nor'easter",
  'Blizzard of 1993',
  'California Atmospheric River',
  'Central U.S. April Flooding',
  "December Nor'easter",
  "December Storm - Nor'easter",
  'Early summer severe storms',
  'Early summer storms',
  'Early winter storms',
  'February Kentucky Flooding',
  'Flooding',
  'Heavy rains',
  'Hurricane Alicia',
  'Hurricane Allen',
  'Hurricane Andrew',
  'Hurricane Bertha',
  'Hurricane Bob',
  'Hurricane Bonnie',
  'Hurricane Beryl',
  'Hurricane Cindy',
  'Hurricane Debby',
  'Hurricane Dennis',
  'Hurricane Elena',
  'Hurricane Elsa',
  'Hurricane Frances',
  'Hurricane Francine',
  'Hurricane Fran',
  'Hurricane Frederic',
  'Hurricane Floyd',
  'Hurricane Georges',
  'Hurricane Georges (Keys)',
  'Hurricane Gloria',
  'Hurricane Gustav',
  'Hurricane Harvey',
  'Hurricane Helene',
  'Hurricane Hermine',
  'Hurricane Hugo',
  'Hurricane Ian',
  'Hurricane Ida',
  'Hurricane Ike',
  'Hurricane Irene',
  'Hurricane Isaac',
  'Hurricane Isaias',
  'Hurricane Isabel',
  'Hurricane Ivan',
  'Hurricane Jeanne',
  'Hurricane Josephine',
  'Hurricane Juan',
  'Hurricane Katrina',
  'Hurricane Matthew',
  'Hurricane Milton',
  'Hurricane Nicole',
  'Hurricane Opal',
  'Hurricane Rita',
  'Hurricane Sally',
  'Hurricane Sandy',
  'Hurricane Wilma',
  'Hurricane Zeta',
  'Hurricane Irma',
  'June South Florida Flooding',
  'Late spring storms',
  'Late summer storms',
  'Late winter severe storms',
  "March 2010 Nor'easter",
  'March storm',
  'Mid-Winter California Flooding',
  'Midwest Flooding',
  'Mid-summer severe storms',
  'Not a named storm',
  'October severe storms',
  'Pineapple Express - Southern',
  'Spring severe storms',
  'Spring storm',
  'Storm',
  'The "Halloween" Storm',
  'Thunderstorms',
  'Torrential rain',
  'Tropical Storm Allison',
  'Tropical Storm Barry',
  'Tropical Storm Claudette',
  'Tropical Storm Debby',
  'Tropical Storm Erin',
  'Tropical Storm Ernesto',
  'Tropical Storm Fay',
  'Tropical Storm Imelda',
  'Tropical Storm Isidore',
  'Tropical Storm Ivan',
  'Tropical Storm Lee',
  'Tropical Storm Paul',
  'Winter storm',
  'Winter Storm Jonas',
]

function App() {
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [waterDepth, setWaterDepth] = useState('')
  const [floodWaterDuration, setFloodWaterDuration] = useState('')
  const [causeOfDamage, setCauseOfDamage] = useState('')
  const [floodEvent, setFloodEvent] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [predictionInference, setPredictionInference] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionError, setPredictionError] = useState(null)

  const hasRequired =
    waterDepth.trim() &&
    floodWaterDuration.trim() &&
    causeOfDamage &&
    floodEvent.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!hasRequired) return
    setPredictionError(null)

    setPredictionLoading(true)
    try {
      const waterDepthNum = parseFloat(waterDepth.trim())
      const floodWaterDurationNum = parseFloat(floodWaterDuration.trim())
      const causeNum = causeOfDamage
        ? parseFloat(CAUSE_CODE_TO_NUMERIC[causeOfDamage] ?? causeOfDamage)
        : 0
      if (Number.isNaN(waterDepthNum) || Number.isNaN(floodWaterDurationNum) || Number.isNaN(causeNum)) {
        setPredictionError('Please enter valid numbers for water depth and flood water duration.')
        setPredictionLoading(false)
        return
      }
      const res = await fetch(`${PREDICTION_API_BASE}/prediction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waterDepth: waterDepthNum,
          floodWaterDuration: floodWaterDurationNum,
          causeOfDamage: causeNum,
          floodEvent: floodEvent.trim(),
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
      const msg = err?.message || ''
      const isNetworkError = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')
      setPredictionError(
        isNetworkError
          ? 'Could not reach the prediction API. Check your connection or set VITE_PREDICTION_API_URL for local dev.'
          : (msg || 'Prediction request failed.')
      )
    } finally {
      setPredictionLoading(false)
    }
  }

  function handleReset() {
    setSubmitted(false)
    setPredictionInference(null)
    setPredictionError(null)
    setWaterDepth('')
    setFloodWaterDuration('')
    setCauseOfDamage('')
    setFloodEvent('')
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
      const msg = err?.message || ''
      const isNetworkError = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')
      const apiHint = ` (${authMode === 'signup' ? 'makenewuser' : 'validatelogin'} → ${API_BASE})`
      setAuthError(
        isNetworkError
          ? `Could not reach the auth server.${apiHint} If the backend is up, this is usually CORS: your Spring app must allow your frontend origin (e.g. your Vercel URL). Check the browser Console for "CORS" errors.`
          : (msg || 'Unable to reach the server. Please check your connection and try again.')
      )
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
                    How the property and contents were damaged. Select one.
                    Codes 7 and 8 apply only if date of loss is before September 23, 1995.
                  </p>
                  <div className="cause-checkboxes" role="radiogroup" aria-label="Cause of damage">
                    {CAUSE_OF_DAMAGE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="cause-checkbox">
                        <input
                          type="radio"
                          name="causeOfDamage"
                          value={opt.value}
                          checked={causeOfDamage === opt.value}
                          onChange={() => setCauseOfDamage(opt.value)}
                        />
                        <span className="cause-checkbox-label">
                          <strong>{opt.value}</strong> — {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {causeOfDamage && (
                    <p className="field-selected">
                      Selected: {causeOfDamage}
                    </p>
                  )}
                </div>

                <label className="field field-full">
                  <span className="field-label">Flood event</span>
                  <select
                    value={floodEvent}
                    onChange={(e) => setFloodEvent(e.target.value)}
                    className="field-input field-select-scroll"
                    size={8}
                    required
                    aria-label="Flood event"
                  >
                    <option value="">Select flood event</option>
                    {FLOOD_EVENT_OPTIONS.map((opt) => {
                      const value = typeof opt === 'string' ? opt : opt.value
                      const label = typeof opt === 'string' ? opt : opt.label
                      return (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </label>
              </div>

              {predictionError && !submitted && (
                <p className="auth-error" role="alert">{predictionError}</p>
              )}
              {submitted && hasRequired ? (
                <div className="result-card" role="status">
                  <div className="result-header">
                    <span className="result-label">Model prediction</span>
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
                  <p className="result-note">
                    Based on your water depth, duration, cause of damage, and flood event. Actual relief depends on program rules and eligibility.
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
                  You provide water depth, flood water duration, cause of damage, and flood event. Nothing is stored or shared until you submit.
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
