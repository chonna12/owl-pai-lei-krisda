// buy.js — Buy workflow, queue-based listing selection, order placement (Pay or Cancel), and "My order" page.
// All HTML templates live in index.html, all styles live in styles.css.

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const ICONS = { Shoes: 'icon-shoe', Clothing: 'icon-tee', Accessories: 'icon-bag' };
  const ORDERS_STORAGE_KEY = 'owl_buyer_orders';
  // Clean old seed labels for display without rewriting historical order snapshots.
  const displayText = value => String(value ?? '').replace(/\bdemo\b/gi, '').replace(/\s{2,}/g, ' ').trim();

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

  // ── 1. Buy Page (Size Grid with First Seller Cost per Size) ─────────
  async function showBuyPage(product) {
    const page = renderTemplate('tpl-buy');
    page.querySelector('#bp-product-name').textContent = product.name;
    renderThumb(page.querySelector('#bp-chip-thumb'), product);
    page.querySelector('#bp-cancel').addEventListener('click', () => window.location.reload());
    const grid = page.querySelector('#bp-size-grid');
    const list = page.querySelector('#bp-listings-container');
    const panel = page.querySelector('#bp-selection-panel');
    const empty = page.querySelector('#bp-listings-empty');
    const emptyTitle = page.querySelector('#bp-empty-title');
    const tabNew = page.querySelector('#tab-buy-new');
    const tabUsed = page.querySelector('#tab-buy-used');
    const title = page.querySelector('#bp-queue-title');
    const hint = page.querySelector('#bp-queue-hint');
    let condition = 'new';
    let variants = [];
    let listings = [];
    const money = value => Number(value).toLocaleString('en-US', {
      minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
      maximumFractionDigits: 2
    });
    const cleanSize = size => String(size).replace(/^US\s*/i, '').trim();
    grid.textContent = 'Loading sizes and prices…';
    tabNew.disabled = tabUsed.disabled = true;
    try {
      const [marketResponse, variantResponse] = await Promise.all([
        fetch(`/api/products/${product.product_id}/market`, { credentials: 'same-origin' }),
        fetch(`/api/products/${product.product_id}/variants`, { credentials: 'same-origin' })
      ]);
      if (!marketResponse.ok || !variantResponse.ok) throw new Error('Could not load available items. Please go back and try again.');
      const market = await marketResponse.json();
      const catalog = await variantResponse.json();
      variants = Array.isArray(catalog.variants) ? catalog.variants : [];
      const validIds = new Set(variants.map(v => String(v.variant_id)));
      // Only actual, active catalog variants and approved market offers are buyable.
      listings = (Array.isArray(market.listings) ? market.listings : []).filter(item =>
        validIds.has(String(item.variant_id)) && Number(item.display_price) > 0);
    } catch (error) {
      grid.replaceChildren();
      empty.hidden = false;
      emptyTitle.textContent = error.message;
      empty.querySelector('.bp-empty-sub').textContent = 'No sample listings are shown when the database cannot be loaded.';
      return;
    }
    page.querySelector('#bp-product-brand').textContent = [product.brand_name, variants[0]?.sku].filter(Boolean).join(' • ');
    const isShoe = String(product.category).toLowerCase() === 'shoes';
    const isClothing = String(product.category).toLowerCase() === 'clothing';
    const standardSizes = isShoe
      ? ['3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5']
      : isClothing ? ['S', 'M', 'L', 'XL'] : [];
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const sizes = [...new Set([...standardSizes, ...variants.map(v => cleanSize(v.size))])].sort((a, b) => {
      const ai = sizeOrder.indexOf(a.toUpperCase()), bi = sizeOrder.indexOf(b.toUpperCase());
      if (ai >= 0 && bi >= 0) return ai - bi;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    function selectOffer(offer, button) {
      grid.querySelectorAll('.bp-size-card').forEach(card => {
        card.classList.toggle('is-selected', card === button);
        card.setAttribute('aria-pressed', String(card === button));
      });
      const variant = variants.find(v => String(v.variant_id) === String(offer.variant_id));
      const label = `Size ${cleanSize(variant.size)}${variant.color && variant.color !== 'Standard' ? ' · ' + variant.color : ''}`;
      page.querySelector('#bp-sel-size').textContent = label;
      page.querySelector('#bp-sel-price').textContent = `฿${money(offer.display_price)}`;
      page.querySelector('#bp-sel-badge').textContent = 'Current offer in queue';
      page.querySelector('#bp-sel-notes').textContent = displayText(offer.condition_notes) || 'Price includes the platform fee. Shipping is shown at checkout.';
      const buy = page.querySelector('#bp-btn-confirm-buy');
      buy.textContent = `Buy ${label} · ฿${money(offer.display_price)} →`;
      buy.onclick = () => handlePlaceOrder(product, offer);
      panel.hidden = false;
    }
    function renderFirstHand() {
      // The API already selects the current queue head per variant. Never sort by offer_id.
      for (const size of sizes) {
        const matches = variants.filter(v => cleanSize(v.size) === size);
        const offers = listings.filter(item => item.condition === 'new' &&
          matches.some(v => String(v.variant_id) === String(item.variant_id)));
        const choices = offers.length ? offers : [null];
        for (const offer of choices) {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'bp-size-card';
          card.disabled = !offer;
          card.setAttribute('aria-pressed', 'false');
          const label = document.createElement('span');
          label.className = 'bp-size-card-label';
          label.textContent = size;
          card.appendChild(label);
          if (offer) {
            if (offers.length > 1) {
              const color = document.createElement('span');
              color.className = 'bp-size-card-color';
              color.textContent = offer.color;
              card.appendChild(color);
            }
            const price = document.createElement('span');
            price.className = 'bp-size-card-price';
            price.textContent = `฿${money(offer.display_price)}`;
            card.appendChild(price);
            card.addEventListener('click', () => selectOffer(offer, card));
          } else {
            card.classList.add('is-disabled');
            card.setAttribute('aria-label', `Size ${size} unavailable`);
            const unavailable = document.createElement('span');
            unavailable.className = 'bp-size-card-unavail';
            unavailable.textContent = 'Unavailable';
            card.appendChild(unavailable);
          }
          grid.appendChild(card);
        }
      }
    }
    function renderUsed() {
      // Keep every used offer, including several pieces of the same size.
      const used = listings.filter(item => item.condition === 'used');
      for (const offer of used) {
        const card = document.createElement('article');
        card.className = 'bp-used-item';
        card.dataset.offerId = offer.offer_id;
        const heading = document.createElement('h3');
        heading.textContent = `Size ${cleanSize(offer.size)} · ${offer.color || 'Standard'}`;
        const id = document.createElement('p');
        id.className = 'bp-used-reference';
        id.textContent = `Item #${offer.offer_id}`;
        const price = document.createElement('p');
        price.className = 'bp-size-card-price';
        price.textContent = `฿${money(offer.display_price)}`;
        const defects = document.createElement('p');
        defects.className = 'bp-used-defects';
        defects.textContent = `Defects: ${offer.defects || 'Not provided'}`;
        card.append(heading, id, price, defects);
        if (offer.condition_notes) {
          const notes = document.createElement('p');
          notes.textContent = displayText(offer.condition_notes);
          card.appendChild(notes);
        }
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'bp-btn-buy';
        buy.textContent = `Buy this item · ฿${money(offer.display_price)} →`;
        buy.addEventListener('click', () => handlePlaceOrder(product, offer));
        card.appendChild(buy);
        list.appendChild(card);
      }
    }
    function render() {
      grid.replaceChildren();
      list.replaceChildren();
      panel.hidden = true;
      grid.hidden = condition !== 'new';
      list.hidden = condition !== 'used';
      tabNew.classList.toggle('sf-tab-active', condition === 'new');
      tabUsed.classList.toggle('sf-tab-active', condition === 'used');
      tabNew.setAttribute('aria-pressed', String(condition === 'new'));
      tabUsed.setAttribute('aria-pressed', String(condition === 'used'));
      title.textContent = condition === 'new' ? 'Select Size' : 'All second-hand items';
      hint.textContent = condition === 'new' ? 'Price shown is for the current seller in queue' : 'Every item has its own defects. No queue selection.';
      const available = listings.some(item => item.condition === condition);
      empty.hidden = available;
      emptyTitle.textContent = `No ${condition === 'new' ? 'first-hand' : 'second-hand'} items available`;
      if (condition === 'new') renderFirstHand();
      else renderUsed();
    }
    tabNew.disabled = tabUsed.disabled = false;
    tabNew.addEventListener('click', () => { condition = 'new'; render(); });
    tabUsed.addEventListener('click', () => { condition = 'used'; render(); });
    render();
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
    page.querySelector('#bp-order-product-name').textContent = displayText(order.product_name);
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
            product_name: displayText(o.product_name_snapshot) || 'Product',
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
      name.textContent = `Order #${order.order_id} · ${displayText(order.product_name) || 'Product'}`;

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
