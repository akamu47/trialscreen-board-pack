/* TrialScreen board pack — shared client-side gate
 *
 * NOTE: This is a soft gate (obfuscation + friction), not real security.
 * The repo is public and static files (PDFs, JSON, PPTX) are fetchable by
 * direct URL for anyone who knows the path. For real access control,
 * host behind Cloudflare Access / Netlify Identity / a private host.
 */
(function (global) {
  const EXPECTED_HASH = '8b6d3fccd6a05ec4ea62fbc336bdeb856b96a9ce1591f5b111fda997aab1d429';
  const SALT = 'trialscreen-board-pack-2026';
  const ITERATIONS = 100000;
  const STORAGE_KEY = 'ts-bp-unlock';
  const STORAGE_VALUE = EXPECTED_HASH; // store the hash itself as the token

  async function hashPassword(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(SALT), iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === STORAGE_VALUE;
    } catch (_) { return false; }
  }

  function setUnlocked() {
    try { sessionStorage.setItem(STORAGE_KEY, STORAGE_VALUE); } catch (_) {}
  }

  async function verifyPassword(password) {
    const hash = await hashPassword(password);
    if (hash === EXPECTED_HASH) { setUnlocked(); return true; }
    return false;
  }

  /* Injects a full-screen gate overlay on sub-pages. Returns a promise that
   * resolves once the user unlocks (or immediately if already unlocked). */
  function requireAuth(options) {
    const opts = options || {};
    const backHref = opts.backHref || 'index.html';

    if (isUnlocked()) return Promise.resolve();

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Access password required');

      // ── Brand tokens (inline for portability — no external CSS dependency) ──
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9999',
        'background:linear-gradient(135deg,#773A96 0%,#954CF6 100%)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:24px',
        "font-family:'Inter','Space Grotesk',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif"
      ].join(';');

      overlay.innerHTML = `
        <div style="
          max-width:440px;width:100%;
          background:#FFFFFF;
          border:1px solid #E6E0EE;
          border-radius:24px;
          padding:40px 36px;
          box-shadow:0 16px 48px rgba(26,26,46,0.22);
        ">
          <div style="
            font-size:11px;font-weight:700;letter-spacing:0.16em;
            color:#773A96;text-transform:uppercase;
            margin-bottom:14px;
            font-family:'Inter',system-ui,sans-serif;
          ">TrialScreen · Board Pack</div>
          <h2 style="
            margin:0 0 10px;
            font-size:24px;font-weight:700;
            color:#1A1A2E;letter-spacing:-0.01em;
            font-family:'Space Grotesk','Inter',system-ui,sans-serif;
          ">Access required</h2>
          <p style="
            margin:0 0 22px;
            font-size:14px;line-height:1.6;
            color:#6B6880;
            font-family:'Inter',system-ui,sans-serif;
          ">Enter the access password to view this page. Confidential — do not distribute.</p>
          <form id="ts-gate-form" autocomplete="off">
            <input id="ts-gate-pwd" type="password" placeholder="Access password" autofocus
              style="
                width:100%;padding:12px 14px;
                font-size:15px;
                border:1.5px solid #E6E0EE;
                border-radius:8px;
                background:#F6F2FF;
                color:#1A1A2E;
                font-family:inherit;
                outline:none;
                transition:border-color 120ms;
              " />
            <div id="ts-gate-error" style="display:none;margin-top:10px;font-size:13px;color:#EA4F6A;font-family:inherit;"></div>
            <div style="display:flex;gap:12px;margin-top:20px;align-items:center;">
              <button type="submit" style="
                background:#C22299;color:#fff;
                border:none;
                border-radius:8px;
                padding:12px 24px;
                font-size:15px;font-weight:600;
                cursor:pointer;
                font-family:inherit;
                transition:background 120ms;
                flex-shrink:0;
              " onmouseover="this.style.background='#C43C96'" onmouseout="this.style.background='#C22299'">Unlock</button>
              <a href="${backHref}" style="font-size:13px;color:#6B6880;text-decoration:none;font-family:inherit;">← Back</a>
            </div>
          </form>
        </div>
      `;

      // Hide body content until unlocked (defensive — also prevents FOUC of sensitive data)
      const prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);

      // Focus the input
      const input = overlay.querySelector('#ts-gate-pwd');
      const err = overlay.querySelector('#ts-gate-error');

      // Dynamic focus border on input
      input.addEventListener('focus', () => { input.style.borderColor = '#773A96'; });
      input.addEventListener('blur', () => { input.style.borderColor = '#E6E0EE'; });

      const form = overlay.querySelector('#ts-gate-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.style.display = 'none';
        try {
          const ok = await verifyPassword(input.value);
          if (ok) {
            overlay.remove();
            document.body.style.overflow = prevBodyOverflow;
            resolve();
          } else {
            err.textContent = 'Incorrect password. Please try again.';
            err.style.display = 'block';
            input.value = '';
            input.focus();
          }
        } catch (_) {
          err.textContent = 'Browser unable to verify password. Please use a modern browser.';
          err.style.display = 'block';
        }
      });
    });
  }

  global.TrialScreenAuth = {
    hashPassword, isUnlocked, setUnlocked, verifyPassword, requireAuth,
    EXPECTED_HASH, SALT, ITERATIONS
  };
})(window);
