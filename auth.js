// ── R Studio Admin — Shared Auth Module ───────────────────────────
// Manages API key login, session, and authenticated API calls.
// Include this script on every admin page.

(function () {
  const STORAGE_KEY = 'rstudio-admin-key';
  const SESSION_INFO_KEY = 'rstudio-admin-session';
  const DASHBOARD_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://web.rstudio.live';

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 300000; // 5 min

  // ── API Key Storage ─────────────────────────────────────────────

  function getApiKey() {
    return sessionStorage.getItem(STORAGE_KEY);
  }

  function setApiKey(key) {
    sessionStorage.setItem(STORAGE_KEY, key);
  }

  function clearApiKey() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_INFO_KEY);
  }

  function getSessionInfo() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_INFO_KEY) || '{}');
    } catch { return {}; }
  }

  function setSessionInfo(info) {
    sessionStorage.setItem(SESSION_INFO_KEY, JSON.stringify(info));
  }

  function getTier() {
    return getSessionInfo().tier || null;
  }

  function isSuperAdmin() {
    return getTier() === 'super_admin';
  }

  // ── Rate Limiting ───────────────────────────────────────────────

  function getAttemptState() {
    try {
      const s = JSON.parse(sessionStorage.getItem('rstudio-login-attempts') || '{}');
      if (s.lockUntil && Date.now() > s.lockUntil) return { count: 0, lockUntil: 0 };
      return s;
    } catch { return { count: 0, lockUntil: 0 }; }
  }

  function recordAttempt(failed) {
    const s = getAttemptState();
    s.count = failed ? (s.count || 0) + 1 : 0;
    if (s.count >= MAX_ATTEMPTS) { s.lockUntil = Date.now() + LOCKOUT_MS; s.count = 0; }
    sessionStorage.setItem('rstudio-login-attempts', JSON.stringify(s));
  }

  function resetAttempts() {
    sessionStorage.removeItem('rstudio-login-attempts');
  }

  // ── Language Helper ─────────────────────────────────────────────

  function isVi() {
    return localStorage.getItem('rstudio-lang') === 'vi';
  }

  // ── API Calls ───────────────────────────────────────────────────

  async function apiCall(method, path, body) {
    const key = getApiKey();
    if (!key) throw new Error('Not logged in');

    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${DASHBOARD_API}${path}`, opts);
    let data;
    try {
      data = await res.json();
    } catch {
      // Response is not JSON — extract error from status
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      throw new Error('Unexpected response from server');
    }
    if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
    return data;
  }

  // ── Login (API key + password) ──────────────────────────────────

  async function adminLogin(key, password) {
    const res = await fetch(`${DASHBOARD_API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
    return data; // { ok, keyId, keyName, tier, passwordChangeRequired }
  }

  // ── Validate Key ────────────────────────────────────────────────

  async function validateKey(key) {
    try {
      const res = await fetch(`${DASHBOARD_API}/api/admin/validate-key`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.valid ? data : null;
    } catch (err) {
      console.error('[auth] validateKey network error:', err);
      return null;
    }
  }

  // ── Auth Guard ──────────────────────────────────────────────────

  async function requireAuth() {
    const key = getApiKey();
    if (!key) {
      redirectToLogin();
      return false;
    }

    try {
      const info = await validateKey(key);
      if (!info) {
        clearApiKey();
        redirectToLogin();
        return false;
      }

      // Update session info with latest tier
      setSessionInfo({ keyName: info.keyName, tier: info.tier });
      return true;
    } catch (err) {
      console.error('[auth] requireAuth error:', err);
      // Network error — show error instead of redirecting
      const container = document.getElementById('mainContent');
      if (container) {
        container.innerHTML = `<div style="max-width:500px;margin:120px auto;padding:28px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;text-align:center;">
          <h2 style="margin-bottom:12px;">⚠️ Connection Error</h2>
          <p style="color:var(--text-muted);margin-bottom:16px;">Could not connect to the server. Please check your connection and try again.</p>
          <p style="font-size:12px;color:var(--text-muted);">${err.message}</p>
          <button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:var(--accent);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Retry</button>
        </div>`;
      }
      return false;
    }
  }

  function redirectToLogin() {
    const current = window.location.pathname.split('/').pop() || 'index.html';
    window.location.href = `login.html?redirect=${encodeURIComponent(current)}`;
  }

  // ── Logout ──────────────────────────────────────────────────────

  function logout() {
    clearApiKey();
    resetAttempts();
    window.location.href = 'login.html';
  }

  // ── Expose to global scope ──────────────────────────────────────

  window.RStudioAuth = {
    getApiKey,
    setApiKey,
    clearApiKey,
    getSessionInfo,
    setSessionInfo,
    getTier,
    isSuperAdmin,
    validateKey,
    adminLogin,
    apiCall,
    requireAuth,
    logout,
    isVi,
    getAttemptState,
    recordAttempt,
    resetAttempts,
    DASHBOARD_API,
    MAX_ATTEMPTS,
    LOCKOUT_MS,
  };
})();
