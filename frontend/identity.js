// indentity.js — Seller identity verification workflow.
// Scoped per user account so data is separate across different logins.

(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const BASE_STORAGE_KEY = 'owl_identity_verification';

    // ── Template / Container Renderer ──────────────────────────────────────────
    function renderTemplate(templateId, fallbackHtmlGenerator) {
        const page = document.querySelector('.page') || document.body;
        const tpl = document.getElementById(templateId);
        if (tpl) {
            page.innerHTML = '';
            page.appendChild(tpl.content.cloneNode(true));
        } else if (typeof fallbackHtmlGenerator === 'function') {
            page.innerHTML = fallbackHtmlGenerator();
        }
        return page;
    }

    // ── User Session Helper ───────────────────────────────────────────────────
    async function getCurrentUser() {
        if (window.currentUser && window.currentUser.email) return window.currentUser;
        if (window.DemoSeller) {
            try {
                const user = await window.DemoSeller.ensureDemoSession();
                window.currentUser = user;
                return user;
            } catch (_) { }
        }
        try {
            const res = await fetch('/api/me', { credentials: 'same-origin' });
            if (res.ok) {
                const data = await res.json();
                window.currentUser = data.user || null;
                return window.currentUser;
            }
        } catch (_) { }
        return window.currentUser || null;
    }

    // Account-scoped storage key
    async function getStorageKey() {
        const user = await getCurrentUser();
        const email = user?.email ? user.email.trim().toLowerCase() : '';
        return email ? `${BASE_STORAGE_KEY}_${email}` : BASE_STORAGE_KEY;
    }

    // ── Storage helpers (Separated per user account) ───────────────────────────
    async function saveVerificationStatus(data) {
        const user = await getCurrentUser();
        const key = await getStorageKey();
        try {
            localStorage.setItem(key, JSON.stringify({
                status: 'waiting_approve',
                email: user?.email || '',
                userName: user?.name || '',
                submittedAt: new Date().toISOString(),
                ...data
            }));
        } catch (_) { }
    }

    async function getVerificationStatus() {
        const key = await getStorageKey();
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (_) {
            return null;
        }
    }

    async function clearVerificationStatus() {
        const key = await getStorageKey();
        try {
            localStorage.removeItem(key);
        } catch (_) { }
    }

    // ── 1. PROFILE DROPDOWN MENU INTEGRATION ───────────────────────────────────
    function setupVerifyIdentityMenu() {
        const menu = $('profile-dropdown-menu');
        if (!menu) return;

        let verifyBtn = $('menu-verify-identity');
        if (!verifyBtn) {
            verifyBtn = document.createElement('button');
            verifyBtn.type = 'button';
            verifyBtn.className = 'profile-menu-item';
            verifyBtn.id = 'menu-verify-identity';
            verifyBtn.setAttribute('role', 'menuitem');
            verifyBtn.innerHTML = `
                <span class="profile-menu-icon" aria-hidden="true">🪪</span>
                <span class="profile-menu-label">Verify identity</span>
            `;
            menu.appendChild(verifyBtn);
        }

        if (verifyBtn.dataset.bound === 'true') return;
        verifyBtn.dataset.bound = 'true';

        verifyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            menu.classList.remove('is-open');

            // Check if current user is already in waiting_approve
            const status = await getVerificationStatus();
            if (status && status.status === 'waiting_approve') {
                showWaitingApprovePage(status);
            } else {
                showVerifyIdentityPage();
            }
        });
    }

    // ── 2. VERIFY IDENTITY FOR SELL PAGE ───────────────────────────────────────
    function showVerifyIdentityPage() {
        const page = renderTemplate('tpl-verify-identity', () => `
            <div class="sf-page">
                <header class="sf-header">
                    <a class="logo" href="/" aria-label="Owl Pai Lei home">
                        <svg class="owl" viewBox="0 0 60 56" aria-hidden="true">
                            <path d="M6 4 L20 12 H40 L54 4 V34 Q54 52 30 52 Q6 52 6 34 Z" fill="#8a5a3c"/>
                            <circle cx="20" cy="30" r="10" fill="#f6ece0"/><circle cx="40" cy="30" r="10" fill="#f6ece0"/>
                            <circle cx="20" cy="30" r="5" fill="#8a5a3c"/><circle cx="40" cy="30" r="5" fill="#8a5a3c"/>
                            <path d="M26 38 H34 L30 45 Z" fill="#e9c9a0"/>
                        </svg>
                        <span class="logo-text"><span class="logo-name">owl pai lei</span></span>
                    </a>
                    <button id="vi-back" class="sf-cancel-btn">← Back</button>
                </header>

                <div class="sf-progress">
                    <span class="sf-progress-step sf-step-done">Profile</span>
                    <span class="sf-progress-arrow">›</span>
                    <span class="sf-progress-step sf-step-active">Verify identity for sell</span>
                    <span class="sf-progress-arrow">›</span>
                    <span class="sf-progress-step">Waiting approve</span>
                </div>

                <div class="sf-card vi-card">
                    <div class="vi-header-box">
                        <div class="vi-icon-bubble">🪪</div>
                        <h2 class="vi-title">Verify identity for sell</h2>
                        <p class="vi-subtitle">Please upload a picture of your ID card to verify your identity and unlock seller features.</p>
                    </div>

                    <form id="verify-identity-form" class="sf-form" novalidate>
                        <div class="sf-field">
                            <label class="sf-label" for="vi-idcard-input">User ID Card Picture <span class="vi-required">*</span></label>
                            <label class="sf-photo-drop vi-dropzone" for="vi-idcard-input" id="vi-dropzone">
                                <span class="sf-photo-drop-inner">
                                    <span class="sf-photo-icon">🪪</span>
                                    <span class="sf-photo-text">Upload ID card picture</span>
                                    <span class="sf-photo-sub">JPG · PNG · WebP · up to 5 MB</span>
                                </span>
                                <input id="vi-idcard-input" type="file" accept="image/jpeg,image/png,image/webp" required style="display:none;">
                            </label>
                            <div id="vi-preview-area" class="vi-preview-area" hidden></div>
                        </div>

                        <div class="vi-security-notice">
                            <span class="vi-lock-icon">🔒</span>
                            <span>Your identification data is encrypted and securely stored for seller verification only.</span>
                        </div>

                        <p id="vi-error" class="sf-error" role="alert" style="margin-top:10px;"></p>
                        <button type="submit" id="vi-submit" class="sf-submit-btn" style="margin-top:16px;">
                            Submit ID card for verification →
                        </button>
                    </form>
                </div>
            </div>
        `);

        // Back to home
        page.querySelector('#vi-back')?.addEventListener('click', () => {
            if (window.location.pathname !== '/' && window.location.pathname !== '') {
                window.location.href = '/';
            } else {
                window.location.reload();
            }
        });

        const fileInput = page.querySelector('#vi-idcard-input');
        const dropzone = page.querySelector('#vi-dropzone');
        const previewArea = page.querySelector('#vi-preview-area');
        const errorEl = page.querySelector('#vi-error');
        const submitBtn = page.querySelector('#vi-submit');
        const form = page.querySelector('#verify-identity-form');

        let currentImageData = null;
        let autoSubmitTimer = null;

        function clearError() {
            if (errorEl) errorEl.textContent = '';
        }

        function showError(msg) {
            if (errorEl) errorEl.textContent = msg;
        }

        // Read and validate image file
        function handleFile(file) {
            clearError();
            if (autoSubmitTimer) {
                clearTimeout(autoSubmitTimer);
                autoSubmitTimer = null;
            }

            if (!file) return;

            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                showError('Please select a JPG, PNG, or WebP ID card image.');
                if (fileInput) fileInput.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showError('The image must be smaller than 5 MB.');
                if (fileInput) fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                currentImageData = event.target.result;
                renderIdCardPreview(file.name, file.size, currentImageData);

                if (submitBtn) {
                    submitBtn.textContent = 'Submitting verification…';
                    submitBtn.disabled = true;
                }

                autoSubmitTimer = setTimeout(async () => {
                    await saveVerificationStatus({ fileName: file.name });
                    showWaitingApprovePage();
                }, 700);
            };

            reader.onerror = () => {
                showError('Could not read the selected image file. Please try another.');
            };

            reader.readAsDataURL(file);
        }

        function renderIdCardPreview(fileName, fileSize, src) {
            if (!previewArea) return;
            if (dropzone) dropzone.hidden = true;
            previewArea.hidden = false;

            const sizeKb = Math.round(fileSize / 1024);
            const sizeText = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

            previewArea.innerHTML = `
                <div class="vi-idcard-preview">
                    <img src="${src}" alt="ID card preview">
                    <button type="button" class="vi-idcard-remove" id="vi-remove-photo" aria-label="Remove ID card picture">×</button>
                    <div class="vi-idcard-info">
                        <span class="vi-idcard-name" title="${fileName}">🪪 ${fileName} (${sizeText})</span>
                        <span class="vi-idcard-badge">✓ Picture uploaded</span>
                    </div>
                </div>
            `;

            previewArea.querySelector('#vi-remove-photo')?.addEventListener('click', (e) => {
                e.preventDefault();
                if (autoSubmitTimer) {
                    clearTimeout(autoSubmitTimer);
                    autoSubmitTimer = null;
                }
                currentImageData = null;
                if (fileInput) fileInput.value = '';
                previewArea.hidden = true;
                previewArea.innerHTML = '';
                if (dropzone) dropzone.hidden = false;
                if (submitBtn) {
                    submitBtn.textContent = 'Submit ID card for verification →';
                    submitBtn.disabled = false;
                }
                clearError();
            });
        }

        // File input change
        fileInput?.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (file) handleFile(file);
        });

        // Drag and drop support
        if (dropzone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('dragover');
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('dragover');
                });
            });

            dropzone.addEventListener('drop', (e) => {
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (file) handleFile(file);
            });
        }

        // Form submit
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearError();

            if (!currentImageData) {
                showError('Please upload your ID card picture to continue.');
                return;
            }

            if (autoSubmitTimer) {
                clearTimeout(autoSubmitTimer);
                autoSubmitTimer = null;
            }

            await saveVerificationStatus({ hasPhoto: true });
            showWaitingApprovePage();
        });
    }

    // ── 3. WAITING APPROVE PAGE ────────────────────────────────────────────────
    function showWaitingApprovePage(savedStatus) {
        const page = renderTemplate('tpl-waiting-approve', () => `
            <div class="pa-page">
                <header class="sf-header">
                    <a class="logo" href="/" aria-label="Owl Pai Lei home">
                        <svg class="owl" viewBox="0 0 60 56" aria-hidden="true">
                            <path d="M6 4 L20 12 H40 L54 4 V34 Q54 52 30 52 Q6 52 6 34 Z" fill="#8a5a3c"/>
                            <circle cx="20" cy="30" r="10" fill="#f6ece0"/><circle cx="40" cy="30" r="10" fill="#f6ece0"/>
                            <circle cx="20" cy="30" r="5" fill="#8a5a3c"/><circle cx="40" cy="30" r="5" fill="#8a5a3c"/>
                            <path d="M26 38 H34 L30 45 Z" fill="#e9c9a0"/>
                        </svg>
                        <span class="logo-text"><span class="logo-name">owl pai lei</span></span>
                    </a>
                    <button id="vi-header-home" class="sf-cancel-btn">Back to home</button>
                </header>
                <div class="pa-center">
                    <div class="pa-card">
                        <div class="pa-owl-emoji">🦉</div>
                        <h2 class="pa-title">Waiting Approve</h2>
                        <span class="pa-badge">Pending Verification</span>
                        <p class="pa-sub" id="pa-sub-text">Your ID card picture has been received. Our team is verifying your identity for selling.</p>
                        <div class="pa-actions">
                            <button id="vi-waiting-home" class="pa-btn-primary">Back to home</button>
                            <button id="vi-reupload" class="pa-btn-outline" style="margin-top:4px;">Upload another ID card</button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // If saved status has account details, display it
        const subText = page.querySelector('#pa-sub-text');
        if (subText && savedStatus?.email) {
            subText.textContent = `ID card submitted for ${savedStatus.email}. Our team is verifying your seller account.`;
        }

        // Back to home action handlers
        function goHome() {
            if (window.location.pathname !== '/' && window.location.pathname !== '') {
                window.location.href = '/';
            } else {
                window.location.reload();
            }
        }

        page.querySelector('#vi-waiting-home')?.addEventListener('click', goHome);
        page.querySelector('#vi-header-home')?.addEventListener('click', goHome);

        // Allow user to re-upload ID card if desired
        page.querySelector('#vi-reupload')?.addEventListener('click', async () => {
            await clearVerificationStatus();
            showVerifyIdentityPage();
        });
    }

    // ── Initialization ─────────────────────────────────────────────────────────
    function init() {
        setupVerifyIdentityMenu();

        // Re-check if profile menu wrapper was modified or re-rendered
        const observer = new MutationObserver(() => {
            const menu = $('profile-dropdown-menu');
            const verifyBtn = $('menu-verify-identity');
            if (menu && (!verifyBtn || verifyBtn.dataset.bound !== 'true')) {
                setupVerifyIdentityMenu();
            }
        });

        const userDiv = document.querySelector('.user');
        if (userDiv) {
            observer.observe(userDiv, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.VerifyIdentity = {
        setupVerifyIdentityMenu,
        showVerifyIdentityPage,
        showWaitingApprovePage,
        getVerificationStatus,
        clearVerificationStatus
    };
    window.showVerifyIdentityPage = showVerifyIdentityPage;
    window.showWaitingApprovePage = showWaitingApprovePage;
})();
