// buy.js — Buy workflow, queue-based listing selection, order placement (Pay or Cancel), and "My order" page.
// All HTML templates live in index.html, all styles live in styles.css.

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ICONS = { Shoes: 'icon-shoe', Clothing: 'icon-tee', Accessories: 'icon-bag' };
  const ORDERS_STORAGE_KEY = 'owl_buyer_orders';

  // ── Template Renderer ────────────────────────────────────────────────────────
  function renderTemplate(templateId) {
    const page = document.querySelector('.page') || document.body;
    const tpl = document.getElementById(templateId);
    if (!tpl) throw new Error(`Template #${templateId} not found`);
    page.innerHTML = '';
    page.appendChild(tpl.content.cloneNode(true));
    return page;
  }

  // ── Storage Helpers for Buyer Orders (Scoped per user) ───────────────────────
  function getOrdersStorageKey() {
    const email = window.currentUser?.email;
    return email ? `${ORDERS_STORAGE_KEY}_${email.trim().toLowerCase()}` : ORDERS_STORAGE_KEY;
  }

  function getLocalOrders() {
    try {
      const key = getOrdersStorageKey();
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  function saveLocalOrders(orders) {
    try {
      const key = getOrdersStorageKey();
      localStorage.setItem(key, JSON.stringify(orders));
    } catch (_) {}
  }

  function addLocalOrder(order) {
    const orders = getLocalOrders();
    // Prevent duplicate entries
    const existingIndex = orders.findIndex(o => String(o.order_id) === String(order.order_id));
    if (existingIndex >= 0) {
      orders[existingIndex] = { ...orders[existingIndex], ...order };
    } else {
      orders.unshift(order);
    }
    saveLocalOrders(orders);
    return order;
  }

  function updateLocalOrderStatus(orderId, newStatus, extra = {}) {
    const orders = getLocalOrders();
    const target = orders.find(o => String(o.order_id) === String(orderId));
    if (target) {
      target.status = newStatus;
      if (newStatus === 'paid') target.paid_at = new Date().toISOString();
      if (newStatus === 'cancelled') target.cancelled_at = new Date().toISOString();
      if (newStatus === 'cancellation_pending') target.cancellation_status = 'pending';
      Object.assign(target, extra);
      saveLocalOrders(orders);
    }
    return target;
  }

  // ── Visual Helpers ───────────────────────────────────────────────────────────
  function renderThumb(container, product) {
    if (!container) return;
    container.innerHTML = '';
    if (typeof product.image === 'string' && /^(data:image\/|https?:\/\/|\/)/.test(product.image)) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name || '';
      img.className = 'item-photo';
      container.append(img);
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'card-icon');
      const iconId = ICONS[product.category] || 'icon-bag';
      svg.setAttribute('viewBox', iconId === 'icon-shoe' ? '0 0 120 70' : '0 0 100 90');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + iconId);
      svg.append(use);
      container.append(svg);
    }
  }

  // ── Intercept Modal "Buy" Button ─────────────────────────────────────────────
  function setupModalBuyInterception() {
    document.addEventListener('click', (e) => {
      const buyBtn = e.target.closest('#modal-btn-buy');
      if (buyBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const overlay = $('action-modal-overlay');
        if (overlay) overlay.classList.remove('is-open');

        const product = window.currentModalProduct;
        if (product) {
          showBuyPage(product);
        } else {
          const title = $('modal-product-title')?.textContent;
          const brand = $('modal-product-brand')?.textContent;
          showBuyPage({
            product_id: 1,
            name: title || 'Product',
            brand_name: brand || 'Brand',
            category: 'Shoes',
          });
        }
      }
    }, true);

    document.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card && card.dataset.productId) {
        const id = Number(card.dataset.productId);
        const name = card.querySelector('.card-name')?.textContent;
        const brand = card.querySelector('.card-brand')?.textContent;
        const img = card.querySelector('.card-photo')?.src;
        window.currentModalProduct = {
          product_id: id,
          name: name || '',
          brand_name: brand || '',
          image: img || null,
        };
      }
    }, true);

    const origModal = window.showActionModal;
    if (typeof origModal === 'function') {
      window.showActionModal = async function (product) {
        window.currentModalProduct = product;
        await origModal.apply(this, arguments);
        const buyBtn = $('modal-btn-buy');
        if (buyBtn) {
          buyBtn.onclick = (e) => {
            e.preventDefault();
            const overlay = $('action-modal-overlay');
            if (overlay) overlay.classList.remove('is-open');
            showBuyPage(product);
          };
        }
      };
    }
  }

  // ── 1. Buy Page (Separated Queues by Size & Unrestricted Second-Hand) ─────────
  async function showBuyPage(product) {
    const page = renderTemplate('tpl-buy');

    page.querySelector('#bp-product-name').textContent = product.name;
    page.querySelector('#bp-product-brand').textContent = product.brand_name || '';
    renderThumb(page.querySelector('#bp-chip-thumb'), product);

    page.querySelector('#bp-cancel')?.addEventListener('click', () => window.location.reload());

    let selectedCondition = 'new';
    let selectedSize = '';

    const tabNew = page.querySelector('#tab-buy-new');
    const tabUsed = page.querySelector('#tab-buy-used');
    const container = page.querySelector('#bp-listings-container');
    const emptyBox = page.querySelector('#bp-listings-empty');
    const emptyTitle = page.querySelector('#bp-empty-title');
    const queueTitle = page.querySelector('#bp-queue-title');
    const queueHint = page.querySelector('#bp-queue-hint');
    const sizeSelect = page.querySelector('#bp-size-select');

    let allListings = [];
    let variants = [];

    // Load market listings and variants concurrently
    try {
      const [marketRes, variantRes] = await Promise.all([
        fetch(`/api/products/${product.product_id}/market`, { credentials: 'same-origin' }),
        fetch(`/api/products/${product.product_id}/variants`, { credentials: 'same-origin' }).catch(() => null)
      ]);

      if (marketRes && marketRes.ok) {
        const data = await marketRes.json();
        allListings = Array.isArray(data.listings) ? data.listings : [];
      }
      if (variantRes && variantRes.ok) {
        const vdata = await variantRes.json();
        variants = Array.isArray(vdata.variants) ? vdata.variants : [];
      }
    } catch (_) {}

    // Fallback listings if none in database for demo testing
    if (allListings.length === 0) {
      allListings = [
        {
          offer_id: 101,
          variant_id: 1,
          size: '8',
          color: 'Standard',
          condition: 'new',
          display_price: 1070.00,
          condition_notes: 'Brand new in original box (Size 8)',
        },
        {
          offer_id: 102,
          variant_id: 1,
          size: '8',
          color: 'Standard',
          condition: 'new',
          display_price: 1150.00,
          condition_notes: 'Brand new, sealed tags (Size 8)',
        },
        {
          offer_id: 103,
          variant_id: 2,
          size: '9',
          color: 'Standard',
          condition: 'new',
          display_price: 1200.00,
          condition_notes: 'First hand from authorized store (Size 9)',
        },
        {
          offer_id: 104,
          variant_id: 2,
          size: '9',
          color: 'Standard',
          condition: 'new',
          display_price: 1250.00,
          condition_notes: 'Brand new, double boxed (Size 9)',
        },
        {
          offer_id: 201,
          variant_id: 1,
          size: '8',
          color: 'Standard',
          condition: 'used',
          display_price: 749.00,
          defects: 'Light crease on toe box, worn twice with receipt',
        },
        {
          offer_id: 202,
          variant_id: 2,
          size: '9',
          color: 'Standard',
          condition: 'used',
          display_price: 680.00,
          defects: 'Small scuff mark on rear heel',
        },
        {
          offer_id: 203,
          variant_id: 2,
          size: '9',
          color: 'Standard',
          condition: 'used',
          display_price: 620.00,
          defects: 'Worn gently, original insoles included',
        }
      ];
    }

    // Populate Size Selector
    const sizeSet = new Set();
    variants.forEach(v => { if (v.size) sizeSet.add(v.size); });
    allListings.forEach(it => { if (it.size) sizeSet.add(it.size); });
    const availableSizes = Array.from(sizeSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (sizeSelect) {
      sizeSelect.innerHTML = '<option value="">All sizes</option>';
      availableSizes.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = `Size ${s}`;
        sizeSelect.appendChild(opt);
      });

      sizeSelect.addEventListener('change', () => {
        selectedSize = sizeSelect.value;
        renderListings();
      });
    }

    function renderListings() {
      container.innerHTML = '';

      // Filter by condition
      const conditionFiltered = allListings.filter(item => {
        const c = (item.condition || '').toLowerCase();
        return selectedCondition === 'new'
          ? (c === 'new' || c === 'one hand' || c === 'first hand')
          : (c === 'used' || c === 'second hand');
      });

      // Filter by size if selected
      const filtered = selectedSize
        ? conditionFiltered.filter(item => String(item.size) === String(selectedSize))
        : conditionFiltered;

      // Update header titles & hints
      if (selectedCondition === 'new') {
        if (queueTitle) queueTitle.textContent = 'First-Hand Listings (Queue per Size)';
        if (queueHint) queueHint.textContent = 'For each size, the first listed item is #1 in line and available to buy.';
      } else {
        if (queueTitle) queueTitle.textContent = 'Second-Hand Listings';
        if (queueHint) queueHint.textContent = 'Browse all curated second-hand finds. Select and buy any available piece in stock.';
      }

      if (filtered.length === 0) {
        if (emptyBox) {
          emptyBox.hidden = false;
          if (emptyTitle) {
            emptyTitle.textContent = selectedSize
              ? `No ${selectedCondition === 'new' ? 'One hand' : 'Second hand'} listings for Size ${selectedSize}`
              : `No ${selectedCondition === 'new' ? 'One hand' : 'Second hand'} listings yet`;
          }
        }
        return;
      }

      if (emptyBox) emptyBox.hidden = true;

      // ── SECOND-HAND RENDERING: No queue lock! Every item is selectable and buyable! ──
      if (selectedCondition === 'used') {
        filtered.sort((a, b) => Number(a.display_price || a.price || 0) - Number(b.display_price || b.price || 0));

        filtered.forEach((item, index) => {
          const card = document.createElement('div');
          card.className = 'bp-listing-item bp-listing-top';

          const priceDisplay = Number(item.display_price || item.price || 0).toFixed(2);

          card.innerHTML = `
            <div class="bp-item-header">
              <span class="bp-badge bp-badge-top">
                🔄 Second Hand · Size ${item.size || 'Standard'} · Available to Buy
              </span>
              <span class="bp-item-price">${priceDisplay} THB</span>
            </div>

            <div class="bp-item-details">
              <span><strong>Size:</strong> ${item.size || 'Standard'}</span>
              ${item.color ? `<span><strong>Color:</strong> ${item.color}</span>` : ''}
              ${item.defects ? `<span class="bp-defect">⚠ ${item.defects}</span>` : ''}
              ${item.condition_notes ? `<span>${item.condition_notes}</span>` : ''}
            </div>

            <button type="button" class="bp-btn-buy" id="btn-buy-used-${index}">
              Buy This Piece · ${priceDisplay} THB →
            </button>
          `;

          card.querySelector(`#btn-buy-used-${index}`)?.addEventListener('click', () => {
            handlePlaceOrder(product, item);
          });

          container.appendChild(card);
        });
        return;
      }

      // ── FIRST-HAND RENDERING: Separated queue per size! ──
      // Group items by size
      const sizeGroups = {};
      filtered.forEach(item => {
        const s = item.size || 'Standard';
        if (!sizeGroups[s]) sizeGroups[s] = [];
        sizeGroups[s].push(item);
      });

      const sortedSizes = Object.keys(sizeGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      sortedSizes.forEach(sizeName => {
        const itemsForSize = sizeGroups[sizeName];
        // Sort earliest listed on top within this size
        itemsForSize.sort((a, b) => Number(a.offer_id || 0) - Number(b.offer_id || 0));

        // Group header if multiple sizes are shown
        if (!selectedSize && sortedSizes.length > 1) {
          const groupHeader = document.createElement('div');
          groupHeader.className = 'bp-size-group-header';
          groupHeader.style.cssText = 'font-size: 13px; font-weight: 700; color: var(--brown); margin-top: 14px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1.5px solid var(--line); display: flex; justify-content: space-between;';
          groupHeader.innerHTML = `<span>Queue for Size ${sizeName}</span><span style="font-weight: 600; color: var(--muted);">${itemsForSize.length} in queue</span>`;
          container.appendChild(groupHeader);
        }

        itemsForSize.forEach((item, index) => {
          const isTopForSize = (index === 0);
          const card = document.createElement('div');
          card.className = `bp-listing-item ${isTopForSize ? 'bp-listing-top' : 'bp-listing-queued'}`;

          const priceDisplay = Number(item.display_price || item.price || 0).toFixed(2);

          card.innerHTML = `
            <div class="bp-item-header">
              <span class="bp-badge ${isTopForSize ? 'bp-badge-top' : 'bp-badge-queued'}">
                ${isTopForSize
                  ? `⭐ #1 First in line (Size ${sizeName}) · Available to Buy`
                  : `🔒 #${index + 1} In Queue (Size ${sizeName})`}
              </span>
              <span class="${isTopForSize ? 'bp-item-price' : 'bp-item-price-muted'}">${priceDisplay} THB</span>
            </div>

            <div class="bp-item-details">
              <span><strong>Size:</strong> ${item.size || 'Standard'}</span>
              ${item.color ? `<span><strong>Color:</strong> ${item.color}</span>` : ''}
              ${item.condition_notes ? `<span>${item.condition_notes}</span>` : ''}
            </div>

            ${isTopForSize ? `
              <button type="button" class="bp-btn-buy" id="btn-buy-new-${sizeName}-${index}">
                Buy Now (Size ${sizeName}) · ${priceDisplay} THB →
              </button>
            ` : `
              <div class="bp-queue-lock-notice">
                🔒 In queue for Size ${sizeName} — only the top listing for this size can be purchased
              </div>
            `}
          `;

          if (isTopForSize) {
            card.querySelector(`#btn-buy-new-${sizeName}-${index}`)?.addEventListener('click', () => {
              handlePlaceOrder(product, item);
            });
          }

          container.appendChild(card);
        });
      });
    }

    tabNew?.addEventListener('click', () => {
      selectedCondition = 'new';
      tabNew.classList.add('sf-tab-active');
      tabUsed?.classList.remove('sf-tab-active');
      renderListings();
    });

    tabUsed?.addEventListener('click', () => {
      selectedCondition = 'used';
      tabUsed.classList.add('sf-tab-active');
      tabNew?.classList.remove('sf-tab-active');
      renderListings();
    });

    renderListings();
  }

  // ── 2. Order Placement (Only Real DB Orders with Strict Checks) ───────────────
  async function handlePlaceOrder(product, listingItem) {
    const priceNum = Number(listingItem.display_price || listingItem.price || 0);

    // 1. Ensure user is logged in
    try {
      const meRes = await fetch('/api/me', { credentials: 'same-origin' });
      if (!meRes.ok) {
        alert('Please sign in to place an order.');
        return;
      }
      const meData = await meRes.json();
      if (!meData.user) {
        alert('Please sign in to place an order.');
        return;
      }
      window.currentUser = meData.user;
    } catch (_) {
      alert('Unable to verify login status. Please check your connection.');
      return;
    }

    // 2. Fetch or create shipping address
    let addressId = null;
    try {
      const addrRes = await fetch('/api/addresses', { credentials: 'same-origin' });
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        if (Array.isArray(addrData.addresses) && addrData.addresses[0]) {
          addressId = addrData.addresses[0].address_id;
        }
      }

      // If buyer has no address, attempt to create a default shipping address
      if (!addressId) {
        const newAddrRes = await fetch('/api/addresses', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: window.currentUser?.name || 'Customer',
            phone: '0812345678',
            addressLine: '123 Sukhumvit Road',
            district: 'Khlong Toei',
            province: 'Bangkok',
            postalCode: '10110'
          })
        });
        if (newAddrRes.ok) {
          const newAddrData = await newAddrRes.json();
          addressId = newAddrData.address?.address_id;
        }
      }
    } catch (e) {
      console.error('Address lookup error:', e);
    }

    // If still no address, abort immediately! Do not place fake order!
    if (!addressId) {
      alert('A shipping address is required before purchasing. Please add a shipping address.');
      return;
    }

    // 3. Post order to backend database
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: listingItem.variant_id || 1,
          condition: listingItem.condition === 'used' ? 'used' : 'new',
          addressId: addressId,
          expectedDisplayPrice: priceNum,
          offerId: listingItem.condition === 'used' ? listingItem.offer_id : null,
        })
      });

      // Strict failure check: Do NOT show success or save to localStorage if API rejects!
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to place order. The item may no longer be available.');
        return;
      }

      const data = await res.json();
      if (!data.order || !data.order.order_id) {
        alert('Server returned an invalid order response. Please verify in My Orders.');
        return;
      }

      // Real database order created successfully
      const realOrder = {
        order_id: data.order.order_id,
        product_id: product.product_id,
        product_name: product.name,
        brand_name: product.brand_name || '',
        category: product.category || 'Shoes',
        image: product.image || null,
        size: listingItem.size || 'Standard',
        condition: listingItem.condition || 'new',
        price: Number(data.order.total || priceNum),
        status: 'pending_payment',
        created_at: new Date().toISOString(),
      };

      addLocalOrder(realOrder);
      showOrderConfirmationPage(realOrder, product);

    } catch (networkError) {
      console.error('Order placement network error:', networkError);
      alert('Network error while placing order. Please try again.');
    }
  }

  // ── 3. Order Action Screen ("Pay or Cancel") ──────────────────────────────────
  function showOrderConfirmationPage(order, product) {
    const page = renderTemplate('tpl-order-confirmation');

    page.querySelector('#bp-order-number').textContent = `Order #${order.order_id}`;
    page.querySelector('#bp-order-product-name').textContent = order.product_name;
    page.querySelector('#bp-order-product-meta').textContent = `${order.brand_name || ''} · Size ${order.size}`;
    page.querySelector('#bp-order-condition').textContent = order.condition === 'new' ? '✨ One hand' : '🔄 Second hand';
    page.querySelector('#bp-order-price').textContent = `${Number(order.price).toFixed(2)} THB`;

    renderThumb(page.querySelector('#bp-order-thumb'), product || order);

    page.querySelector('#bp-order-back')?.addEventListener('click', () => window.location.reload());

    const statusBox = page.querySelector('#bp-status-box');
    const actionsBox = page.querySelector('#bp-actions');
    const postActionsBox = page.querySelector('#bp-post-actions');

    // ── Payment Handler (with strict response.ok check) ──
    page.querySelector('#btn-order-pay')?.addEventListener('click', async () => {
      const payBtn = page.querySelector('#btn-order-pay');
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = 'Processing payment…';
      }

      try {
        const payRes = await fetch(`/api/orders/${order.order_id}/demo-payment`, {
          method: 'POST',
          credentials: 'same-origin',
        });

        if (!payRes.ok) {
          const err = await payRes.json().catch(() => ({}));
          alert(err.error || 'Payment failed. Please try again.');
          if (payBtn) {
            payBtn.disabled = false;
            payBtn.textContent = '💳 Pay';
          }
          return;
        }

        // Successfully paid in DB
        updateLocalOrderStatus(order.order_id, 'paid');

        statusBox.innerHTML = `
          <span class="bp-status-badge bp-status-paid">✅ Paid</span>
          <p class="bp-order-success-msg">
            Payment confirmed! Your order is being prepared for shipment.
          </p>
        `;
        if (actionsBox) actionsBox.hidden = true;
        if (postActionsBox) postActionsBox.hidden = false;

      } catch (err) {
        alert('Network error while processing payment. Please check your connection.');
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = '💳 Pay';
        }
      }
    });

    // ── Cancellation Handler (Cancellation requests must wait for Admin review!) ──
    page.querySelector('#btn-order-cancel')?.addEventListener('click', async () => {
      const confirmCancel = confirm('Are you sure you want to request cancellation for this order?');
      if (!confirmCancel) return;

      const cancelBtn = page.querySelector('#btn-order-cancel');
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Submitting request…';
      }

      try {
        const cancelRes = await fetch(`/api/orders/${order.order_id}/cancel`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Buyer requested cancellation' })
        });

        if (!cancelRes.ok) {
          const err = await cancelRes.json().catch(() => ({}));
          alert(err.error || 'Cancellation request failed.');
          if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = '✕ Cancel';
          }
          return;
        }

        // Business rule: Cancellation must wait for Admin approval!
        updateLocalOrderStatus(order.order_id, 'cancellation_pending');

        statusBox.innerHTML = `
          <span class="bp-status-badge bp-status-pending">⏳ Cancellation Pending Admin Approval</span>
          <p class="bp-order-cancelled-msg" style="color: var(--brown);">
            Your cancellation request has been submitted and is awaiting Admin review.
          </p>
        `;
        if (actionsBox) actionsBox.hidden = true;
        if (postActionsBox) postActionsBox.hidden = false;

      } catch (err) {
        alert('Network error while requesting cancellation.');
        if (cancelBtn) {
          cancelBtn.disabled = false;
          cancelBtn.textContent = '✕ Cancel';
        }
      }
    });

    page.querySelector('#btn-go-my-orders')?.addEventListener('click', showBuyerOrdersPage);
    page.querySelector('#btn-go-home')?.addEventListener('click', () => window.location.reload());
  }

  // ── 4. "My Order" Page (Authoritative DB Status over LocalStorage) ────────────
  async function showBuyerOrdersPage() {
    const page = renderTemplate('tpl-buyer-orders');
    page.querySelector('#bo-back')?.addEventListener('click', () => window.location.reload());

    const list = page.querySelector('#bo-list');
    const emptyBox = page.querySelector('#bo-empty');
    if (!list) return;

    const localOrders = getLocalOrders();

    // Fetch authoritative orders from backend database
    let backendOrders = [];
    try {
      const res = await fetch('/api/orders', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        backendOrders = (data.orders || []).map(o => {
          // Accurate DB status mapping:
          // DB status: 'awaiting_payment', 'processing', 'completed', 'cancelled'
          // DB cancellation_status: null, 'pending', 'approved', 'rejected'
          let mappedStatus = 'pending_payment';

          if (o.status === 'cancelled' || o.cancellation_status === 'approved') {
            mappedStatus = 'cancelled';
          } else if (o.cancellation_status === 'pending') {
            mappedStatus = 'cancellation_pending';
          } else if (o.status === 'processing' || o.status === 'completed') {
            mappedStatus = 'paid';
          } else if (o.status === 'awaiting_payment') {
            mappedStatus = 'pending_payment';
          }

          return {
            order_id: o.order_id,
            product_name: o.product_name_snapshot || 'Product',
            brand_name: 'Owl Pai Lei',
            size: o.size_snapshot || 'Standard',
            condition: o.condition_snapshot || 'new',
            price: Number(o.total || o.item_subtotal || 0),
            status: mappedStatus,
            cancellation_status: o.cancellation_status || null,
            raw_status: o.status,
            created_at: o.created_at || new Date().toISOString(),
          };
        });
      }
    } catch (_) {}

    // Authoritative merge: DB data ALWAYS takes priority over local data!
    const orderMap = new Map();
    backendOrders.forEach(o => {
      orderMap.set(String(o.order_id), o);
    });

    // Only keep local orders if not yet fetched from DB
    localOrders.forEach(o => {
      if (!orderMap.has(String(o.order_id))) {
        orderMap.set(String(o.order_id), o);
      }
    });

    const orders = Array.from(orderMap.values());
    orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // Sync authoritative status back to local storage
    saveLocalOrders(orders);

    if (orders.length === 0) {
      list.innerHTML = '';
      if (emptyBox) emptyBox.hidden = false;
      page.querySelector('#bo-empty-explore')?.addEventListener('click', () => window.location.reload());
      return;
    }

    if (emptyBox) emptyBox.hidden = true;
    list.innerHTML = '';

    orders.forEach((order, index) => {
      const item = document.createElement('div');
      item.className = 'mo-item';

      const num = document.createElement('span');
      num.className = 'mo-num';
      num.textContent = index + 1;

      const thumb = document.createElement('div');
      thumb.className = 'mo-thumb';
      renderThumb(thumb, order);

      const info = document.createElement('div');
      info.className = 'mo-info';

      const name = document.createElement('span');
      name.className = 'mo-item-name';
      name.textContent = `Order #${order.order_id} · ${order.product_name || 'Product'}`;

      const cond = document.createElement('span');
      cond.className = 'mo-item-cond';
      const condLabel = order.condition === 'new' ? 'One hand' : 'Second hand';
      cond.textContent = `${condLabel} · ${Number(order.price).toFixed(2)} THB · Size ${order.size}`;

      const statusSpan = document.createElement('span');
      const s = order.status || 'pending_payment';

      if (s === 'paid') {
        statusSpan.className = 'bp-status-badge bp-status-paid';
        statusSpan.textContent = '✅ Paid';
      } else if (s === 'cancelled') {
        statusSpan.className = 'bp-status-badge bp-status-cancelled';
        statusSpan.textContent = '❌ Cancelled';
      } else if (s === 'cancellation_pending') {
        statusSpan.className = 'bp-status-badge bp-status-pending';
        statusSpan.textContent = '⏳ Cancellation Pending Admin Approval';
      } else {
        statusSpan.className = 'bp-status-badge bp-status-pending';
        statusSpan.textContent = '⏳ Pending payment';
      }

      info.append(name, cond, statusSpan);

      // Only show action buttons if awaiting payment
      if (s === 'pending_payment') {
        const actionRow = document.createElement('div');
        actionRow.className = 'bp-order-item-actions';

        const payBtn = document.createElement('button');
        payBtn.type = 'button';
        payBtn.className = 'bp-btn bp-btn-pay bp-btn-sm';
        payBtn.textContent = '💳 Pay';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'bp-btn bp-btn-cancel bp-btn-sm';
        cancelBtn.textContent = '✕ Cancel';

        payBtn.addEventListener('click', async () => {
          payBtn.disabled = true;
          payBtn.textContent = 'Paying…';
          try {
            const payRes = await fetch(`/api/orders/${order.order_id}/demo-payment`, {
              method: 'POST',
              credentials: 'same-origin',
            });
            if (!payRes.ok) {
              const err = await payRes.json().catch(() => ({}));
              alert(err.error || 'Payment failed.');
              payBtn.disabled = false;
              payBtn.textContent = '💳 Pay';
              return;
            }
            updateLocalOrderStatus(order.order_id, 'paid');
            showBuyerOrdersPage();
          } catch (_) {
            alert('Network error during payment.');
            payBtn.disabled = false;
            payBtn.textContent = '💳 Pay';
          }
        });

        cancelBtn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to request cancellation for this order?')) return;
          cancelBtn.disabled = true;
          cancelBtn.textContent = 'Cancelling…';
          try {
            const cancelRes = await fetch(`/api/orders/${order.order_id}/cancel`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: 'Buyer cancelled' })
            });
            if (!cancelRes.ok) {
              const err = await cancelRes.json().catch(() => ({}));
              alert(err.error || 'Cancellation request failed.');
              cancelBtn.disabled = false;
              cancelBtn.textContent = '✕ Cancel';
              return;
            }
            alert('Cancellation requested. Waiting for Admin approval.');
            updateLocalOrderStatus(order.order_id, 'cancellation_pending');
            showBuyerOrdersPage();
          } catch (_) {
            alert('Network error during cancellation.');
            cancelBtn.disabled = false;
            cancelBtn.textContent = '✕ Cancel';
          }
        });

        actionRow.append(payBtn, cancelBtn);
        info.append(actionRow);
      }

      item.append(num, thumb, info);
      list.append(item);
    });
  }

  // ── 5. Ensure "My Order" In Profile Hover Menu ────────────────────────────────
  function ensureMyOrderInProfileMenu() {
    const menu = document.getElementById('profile-dropdown-menu');
    if (!menu) return;

    if (!menu.querySelector('#menu-my-order')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-menu-item';
      btn.id = 'menu-my-order';
      btn.setAttribute('role', 'menuitem');
      btn.innerHTML = `
        <span class="profile-menu-icon" aria-hidden="true">📦</span>
        <span class="profile-menu-label">My order</span>
      `;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        menu.classList.remove('is-open');
        showBuyerOrdersPage();
      });
      menu.appendChild(btn);
    } else {
      const btn = menu.querySelector('#menu-my-order');
      btn.onclick = (e) => {
        e.preventDefault();
        menu.classList.remove('is-open');
        showBuyerOrdersPage();
      };
    }
  }

  // ── Initialization ───────────────────────────────────────────────────────────
  function init() {
    setupModalBuyInterception();
    ensureMyOrderInProfileMenu();

    const observer = new MutationObserver(() => {
      const menu = document.getElementById('profile-dropdown-menu');
      if (menu && !menu.querySelector('#menu-my-order')) {
        ensureMyOrderInProfileMenu();
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
  window.BuyWorkflow = {
    showBuyPage,
    showOrderConfirmationPage,
    showBuyerOrdersPage,
  };
  window.showBuyerOrdersPage = showBuyerOrdersPage;
})();
