// login.js — Authentication logic (Sign in + Register).
// HTML lives in index.html, CSS lives in styles.css.
// Sign in  → POST /api/login    (session stored in PostgreSQL)
// Register → POST /api/register (no role asked yet; backend assigns default)

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function setError(panelId, msg) {
    const el = $(panelId);
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function setSuccess(panelId, msg) {
    const el = $(panelId);
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function setBusy(btnId, busy, idleLabel) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? 'Please wait…' : idleLabel;
  }

  // ── Overlay helpers ───────────────────────────────────────────────────────────

  function hideOverlay() {
    const overlay = $('login-overlay');
    if (!overlay) return;
    overlay.classList.add('is-hidden');
    setTimeout(() => overlay.remove(), 280);
  }

  // ── Sync header with real user data from DB ───────────────────────────────────

  function updateHeaderUser(user) {
    window.currentUser = user;
    const nameEl = $('demo-status');
    const avatarEl = document.querySelector('.avatar');

    if (nameEl && user.name) {
      // Name text
      nameEl.textContent = user.name;

      // Role badge chip — remove old one first if re-logging in
      const existing = document.getElementById('user-role-badge');
      if (existing) existing.remove();

      // If user has seller permissions (or plays both roles), Seller is displayed.
      // If user is not a seller, Buyer is displayed.
      const isSeller = Boolean(user.canSell || user.isSeller);

      const badge = document.createElement('span');
      badge.id = 'user-role-badge';
      badge.className = isSeller ? 'role-badge role-badge-seller' : 'role-badge role-badge-buyer';
      badge.textContent = isSeller ? 'Seller' : 'Buyer';
      nameEl.insertAdjacentElement('afterend', badge);
    } else if (nameEl) {
      nameEl.textContent = 'Signed in';
    }

    if (avatarEl && user.name) {
      avatarEl.textContent = user.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
  }

  function onLoginSuccess(user, successMessage = '') {
    window.currentUser = user;
    updateHeaderUser(user);
    if (successMessage) {
      setSuccess('register-success', successMessage);
      setTimeout(hideOverlay, 1000);
    } else {
      hideOverlay();
    }
    const filters = document.querySelector('.filters');
    if (filters) filters.removeAttribute('inert');
  }

  // ── Tab switcher ──────────────────────────────────────────────────────────────

  function initTabs() {
    const tabLogin = $('tab-login');
    const tabRegister = $('tab-register');
    const panelLogin = $('panel-login');
    const panelRegister = $('panel-register');
    if (!tabLogin || !tabRegister) return;

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('login-tab-active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabRegister.classList.remove('login-tab-active');
      tabRegister.setAttribute('aria-selected', 'false');
      panelLogin.hidden = false;
      panelRegister.hidden = true;
      setError('login-error', '');
      setError('register-error', '');
      setSuccess('register-success', '');
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('login-tab-active');
      tabRegister.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('login-tab-active');
      tabLogin.setAttribute('aria-selected', 'false');
      panelRegister.hidden = false;
      panelLogin.hidden = true;
      setError('login-error', '');
      setError('register-error', '');
      setSuccess('register-success', '');
    });
  }

  // ── Sign-in form ──────────────────────────────────────────────────────────────

  function initLoginForm() {
    const form = $('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('login-error', '');

      const email = ($('login-email') || {}).value?.trim() ?? '';
      const password = ($('login-password') || {}).value ?? '';

      if (!email || !password) {
        setError('login-error', 'Please enter your email and password.');
        return;
      }

      setBusy('login-submit', true, 'Sign in');
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError('login-error', data.error || 'Sign-in failed. Please try again.');
          return;
        }

        onLoginSuccess(data.user || {});
      } catch (_) {
        setError('login-error', 'Network error — check that the backend is running.');
      } finally {
        setBusy('login-submit', false, 'Sign in');
      }
    });
  }

  // ── Register form ─────────────────────────────────────────────────────────────

  function initRegisterForm() {
    const form = $('register-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('register-error', '');
      setSuccess('register-success', '');

      const fullName = ($('reg-name') || {}).value?.trim() ?? '';
      const email = ($('reg-email') || {}).value?.trim() ?? '';
      const password = ($('reg-password') || {}).value ?? '';
      const confirm = ($('reg-confirm') || {}).value ?? '';
      const phone = ($('reg-phone') || {}).value?.trim() ?? '';
      const addressLine = ($('reg-address-line') || {}).value?.trim() ?? '';
      const district = ($('reg-district') || {}).value?.trim() ?? '';
      const province = ($('reg-province') || {}).value?.trim() ?? '';
      const postalCode = ($('reg-postal-code') || {}).value?.trim() ?? '';

      // Client-side validation
      if (!fullName || !email || !password || !confirm) {
        setError('register-error', 'Please fill in all account fields.');
        return;
      }
      if (!phone || !addressLine || !district || !province || !postalCode) {
        setError('register-error', 'Home address is required (phone, address line, district, province, postal code).');
        return;
      }
      if (password.length < 8) {
        setError('register-error', 'Password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        setError('register-error', 'Passwords do not match.');
        return;
      }

      setBusy('register-submit', true, 'Create account');
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          // Role is not sent — backend assigns a default role
          body: JSON.stringify({
            full_name: fullName, email, password,
            address: { recipientName: fullName, phone, addressLine, district, province, postalCode }
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError('register-error', data.error || 'Registration failed. Please try again.');
          return;
        }

        // Auto-login after successful registration and briefly show confirmation.
        onLoginSuccess(data.user || {}, 'Account created successfully with home address. Signing you in…');
      } catch (_) {
        setError('register-error', 'Network error — check that the backend is running.');
      } finally {
        setBusy('register-submit', false, 'Create account');
      }
    });
  }

  // ── Check for an existing valid session ───────────────────────────────────────

  async function checkExistingSession() {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        const user = data.user || {};

        // Back/Home reloads keep every valid session, including the demo seller.
        updateHeaderUser(user);
        return true;
      }
    } catch (_) { /* network error — fall through to login */ }
    return false;
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────

  async function init() {
    initTabs();
    initLoginForm();
    initRegisterForm();

    const alreadyLoggedIn = await checkExistingSession();
    if (alreadyLoggedIn) {
      const overlay = $('login-overlay');
      if (overlay) overlay.remove();
      const filters = document.querySelector('.filters');
      if (filters) filters.removeAttribute('inert');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
