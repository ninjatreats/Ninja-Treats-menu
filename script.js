(function(){
  "use strict";

  // ---------------------------------------------------------------------
  // Menu data, prices, categories, and operational config (phone number,
  // UPI ID, delivery settings) all live in menu.json — NOT in this file.
  // Edit menu.json to change anything about what's for sale; you should
  // never need to touch this script for a routine menu update.
  // These start empty/undefined and get filled in by init() at the
  // bottom of this file, once menu.json has loaded.
  // ---------------------------------------------------------------------
  let PHONE;
  let UPI_ID;
  let PAYEE_NAME;
  let FREE_DELIVERY_THRESHOLD;
  let DELIVERY_CHARGE_ENABLED;
  let DELIVERY_CHARGE;
  let MENU = [];

  // state: id -> qty (0 = unchecked)
  const state = {};

  function buildMenuHTML(){
    let html = "";
    MENU.forEach(cat=>{
      html += `<div class="cat">
        <div class="cat-head"><span class="cat-icon">${cat.icon}</span><span class="cat-title ${cat.colorClass}">${cat.title}</span></div>`;
      cat.items.forEach(it=>{
        html += renderItem(it);
      });
      html += `</div>`;
    });
    return html;
  }

  function renderItem(it){
    const isAvailable = it.available !== false; // menu.json can mark an item "available": false to 86 it
    const variantHtml = it.variants
      ? `<select class="variant-select" data-role="variant" data-id="${it.id}" ${isAvailable ? '' : 'disabled'}>
          ${it.variants.map(v => {
            const priceText = v.priceDelta ? ` (+₹${v.priceDelta})` : '';
            return `<option value="${v.id}">${v.label}${priceText}</option>`;
          }).join('')}
        </select>`
      : '';
    const soldOutBadge = isAvailable ? '' : '<span class="sold-out-badge">Sold Out</span>';
    return `<div class="item${isAvailable ? '' : ' unavailable'}" data-id="${it.id}">
      <div class="chk-wrap"><div class="chk" data-role="chk" data-id="${it.id}">✓</div></div>
      <div class="item-body">
        <div class="item-name">${it.name}${soldOutBadge}</div>
        <div class="item-desc">${it.desc}</div>
        <div class="item-price" data-role="unitPrice" data-id="${it.id}">₹${it.price}</div>
        ${variantHtml}
        <div class="qty-stepper">
          <button class="qty-btn" data-role="dec" data-id="${it.id}">−</button>
          <span class="qty-val" data-role="qty" data-id="${it.id}">1</span>
          <button class="qty-btn" data-role="inc" data-id="${it.id}">+</button>
        </div>
      </div>
    </div>`;
  }

  function getAllProducts(){
    const all = [];
    MENU.forEach(cat=>cat.items.forEach(i=>all.push(i)));
    return all;
  }
  let PRODUCTS_BY_ID = {};

  function getUnitPrice(it){
    if(it.variants){
      const chosen = it.variants.find(v => v.id === variantState[it.id]) || it.variants[0];
      return it.price + (chosen.priceDelta || 0);
    }
    return it.price;
  }

  const variantState = {}; // itemId -> selected variant id

  function toggleItem(id){
    const product = PRODUCTS_BY_ID[id];
    if(product && product.available === false) return; // Sold Out — can't be added
    if(state[id]){
      delete state[id];
      delete variantState[id];
    } else {
      state[id] = 1;
      if(product && product.variants){
        variantState[id] = product.variants[0].id;
      }
    }
    renderState();
  }

  function changeQty(id, delta){
    if(!state[id]) return;
    state[id] = Math.max(1, Math.min(5, state[id] + delta));
    renderState();
  }

  function setVariant(id, variantId){
    variantState[id] = variantId;
  }

  function renderState(){
    document.querySelectorAll('[data-role="chk"]').forEach(el=>{
      const id = el.getAttribute('data-id');
      const on = !!state[id];
      el.classList.toggle('on', on);
      const container = el.closest('.item') || el.closest('.addon-item');
      if(container) container.classList.toggle('checked', on);
      const stepper = container ? container.querySelector('.qty-stepper') : null;
      if(stepper) stepper.style.display = on ? 'flex' : 'none';
    });
    document.querySelectorAll('[data-role="qty"]').forEach(el=>{
      const id = el.getAttribute('data-id');
      const qty = state[id] || 1;
      el.textContent = qty;
      const stepperEl = el.closest('.qty-stepper');
      if(stepperEl){
        const incBtn = stepperEl.querySelector('[data-role="inc"]');
        const decBtn = stepperEl.querySelector('[data-role="dec"]');
        if(incBtn) incBtn.disabled = qty >= 5;
        if(decBtn) decBtn.disabled = qty <= 1;
      }
    });
    document.querySelectorAll('[data-role="variant"]').forEach(el=>{
      const id = el.getAttribute('data-id');
      if(variantState[id]) el.value = variantState[id];
    });
    document.querySelectorAll('[data-role="unitPrice"]').forEach(el=>{
      const id = el.getAttribute('data-id');
      const product = PRODUCTS_BY_ID[id];
      if(product) el.textContent = '₹' + getUnitPrice(product);
    });
    updateBar();
  }

  function getFieldValues(){
    return {
      address: document.getElementById('addressInput').value.trim(),
      maps: document.getElementById('mapsInput').value.trim(),
      phone: document.getElementById('phoneInput').value.trim(),
      cookingRequest: document.getElementById('cookingRequestInput').value.trim()
    };
  }

  function isPhoneValid(phone){
    return /^[6-9]\d{9}$/.test(phone);
  }

  // ---- Customer type: Previous customers skip address/phone entirely,
  // since the restaurant already has those details from earlier WhatsApp chats. ----
  let customerType = null; // 'new' | 'returning'

  function setCustomerType(type){
    customerType = type;
    const addressEl = document.getElementById('addressInput');
    const mapsEl = document.getElementById('mapsInput');
    const phoneEl = document.getElementById('phoneInput');
    const detailsFields = document.getElementById('detailsFields');
    const savedHint = document.getElementById('savedHint');
    const newBtn = document.getElementById('newCustomerBtn');
    const prevBtn = document.getElementById('prevCustomerBtn');

    newBtn.classList.toggle('active', type === 'new');
    prevBtn.classList.toggle('active', type === 'returning');

    if(type === 'new'){
      detailsFields.style.display = 'block';
      addressEl.disabled = false;
      mapsEl.disabled = false;
      phoneEl.disabled = false;
      savedHint.textContent = '';
      addressEl.focus();
    } else {
      detailsFields.style.display = 'none';
      addressEl.value = '';
      mapsEl.value = '';
      phoneEl.value = '';
      addressEl.disabled = true;
      mapsEl.disabled = true;
      phoneEl.disabled = true;
      savedHint.textContent = "No need to re-enter your details — we already have your address and number from your last order on WhatsApp.";
    }
    updateBar();
  }

  function getCartTotals(){
    let subtotal = 0;
    let count = 0;
    Object.keys(state).forEach(id=>{
      const qty = state[id];
      const p = PRODUCTS_BY_ID[id];
      if(p){ subtotal += getUnitPrice(p) * qty; count += qty; }
    });
    const delivery = !DELIVERY_CHARGE_ENABLED ? 0 : (subtotal === 0 ? 0 : (subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE));
    return { subtotal, delivery, total: subtotal + delivery, count };
  }

  // ---- UPI payment (QR-based) ----
  let qrCodeInstance = null;

  function buildUpiPayUrl(){
    const { total } = getCartTotals();
    const amount = total > 0 ? total.toFixed(2) : '1.00';
    const note = encodeURIComponent('Ninja Treats Order');
    return `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${amount}&cu=INR&tn=${note}`;
  }

  function generateQrCode(){
    const box = document.getElementById('qrcodeDiv');
    box.innerHTML = '';
    qrCodeInstance = new QRCode(box, {
      text: buildUpiPayUrl(),
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  function downloadQr(){
    const box = document.getElementById('qrcodeDiv');
    const canvas = box.querySelector('canvas');
    const img = box.querySelector('img');
    const dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
    if(!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'NinjaTreats-Payment-QR.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function copyUpiId(){
    const text = UPI_ID;
    const btn = document.getElementById('copyUpiBtn');
    function markCopied(){
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(()=>{ btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1600);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(markCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
    function fallbackCopy(){
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand('copy'); markCopied(); }catch(e){ /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  // ---- Sticky bottom bar: shared between Menu step and Details step ----
  function updateBar(){
    const { subtotal, delivery, total, count } = getCartTotals();

    const clearBtn = document.getElementById('clearCartBtn');
    if(clearBtn) clearBtn.style.display = count > 0 ? 'inline-block' : 'none';

    document.getElementById('subtotalVal').textContent = '₹' + subtotal;
    document.getElementById('deliveryVal').textContent = subtotal===0 ? '₹0' : (delivery===0 ? 'FREE' : '₹'+delivery);
    document.getElementById('totalVal').textContent = '₹' + total;

    const deliveryHint = document.getElementById('deliveryHint');
    if(subtotal === 0){
      deliveryHint.textContent = '';
      deliveryHint.className = 'delivery-hint';
    } else if(!DELIVERY_CHARGE_ENABLED){
      deliveryHint.textContent = `🎉 Free delivery on all orders!`;
      deliveryHint.className = 'delivery-hint unlocked';
    } else if(subtotal < FREE_DELIVERY_THRESHOLD){
      const remaining = FREE_DELIVERY_THRESHOLD - subtotal;
      deliveryHint.textContent = `🛵 Add ₹${remaining} more to get FREE delivery!`;
      deliveryHint.className = 'delivery-hint progress';
    } else {
      deliveryHint.textContent = `🎉 You've unlocked FREE delivery!`;
      deliveryHint.className = 'delivery-hint unlocked';
    }

    const bar = document.getElementById('cartBar');
    const actionBtn = document.getElementById('actionBtn');
    const emptyHint = document.getElementById('emptyHint');

    if(currentScreen === 'payment'){
      bar.style.display = 'none';
      document.getElementById('paymentAmount').textContent = '₹' + total;
      return;
    }
    bar.style.display = 'block';

    if(currentScreen === 'menu'){
      actionBtn.textContent = 'Continue';
      let missing = count === 0 ? 'Select at least one item to continue' : null;
      actionBtn.disabled = !!missing;
      emptyHint.textContent = missing || '';
      emptyHint.style.display = missing ? 'block' : 'none';
    } else if(currentScreen === 'details'){
      actionBtn.textContent = 'Continue to Payment';
      const { address, phone } = getFieldValues();
      let missing = null;
      if(!customerType) missing = 'Choose New Customer or Previous Customer';
      else if(customerType === 'new' && !address) missing = 'Enter your delivery address';
      else if(customerType === 'new' && !phone) missing = 'Enter your contact number';
      else if(customerType === 'new' && !isPhoneValid(phone)) missing = 'Enter a valid 10-digit mobile number';
      actionBtn.disabled = !!missing;
      emptyHint.textContent = missing || '';
      emptyHint.style.display = missing ? 'block' : 'none';

      document.getElementById('summarySubtotal').textContent = '₹' + subtotal;
      document.getElementById('summaryDelivery').textContent = delivery===0 ? 'FREE' : '₹'+delivery;
      document.getElementById('summaryTotal').textContent = '₹' + total;
    }
  }

  function buildOrderMessage(){
    let subtotal = 0;
    const lines = [];

    MENU.forEach(cat=>{
      cat.items.forEach(it=>{
        const qty = state[it.id];
        if(qty){
          const unitPrice = getUnitPrice(it);
          const lineTotal = unitPrice * qty;
          subtotal += lineTotal;
          let variantLabel = '';
          if(it.variants){
            const chosen = it.variants.find(v => v.id === variantState[it.id]) || it.variants[0];
            variantLabel = ` [${chosen.label}]`;
          }
          lines.push(`• ${it.name}${variantLabel} x${qty} — ₹${lineTotal}`);
        }
      });
    });

    const delivery = !DELIVERY_CHARGE_ENABLED ? 0 : (subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE);
    const total = subtotal + delivery;
    const { address, maps, phone, cookingRequest } = getFieldValues();

    let msg = `🥷 *Ninja Treats — New Order*\n\n`;
    msg += lines.join("\n");
    msg += `\n\nSubtotal: ₹${subtotal}`;
    msg += `\nDelivery: ${delivery===0 ? 'FREE' : '₹'+delivery}`;
    msg += `\n*Total: ₹${total}*`;

    if(cookingRequest){
      msg += `\n\n👨‍🍳 *Cooking Request:* ${cookingRequest}`;
    }

    if(customerType === 'returning'){
      msg += `\n\n🔁 *Returning customer* — please use my address & number from my last order.`;
    } else {
      msg += `\n\n📍 *Delivery Address:*\n${address}`;
      if(maps){
        msg += `\n\n🗺️ *Location Link:*\n${maps}`;
      }
      msg += `\n\n📞 *Contact Number:* ${phone}`;
    }

    msg += `\n\n💳 *Payment:* Paid via UPI to ${UPI_ID} (customer-confirmed)`;

    msg += `\n\nPlease confirm my order. Thank you! 🙏`;
    return msg;
  }

  function sendOrder(){
    const msg = buildOrderMessage();
    const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;
    const win = window.open(url, '_blank');
    if(!win){
      // popup blocked — fall back to an anchor click, which some
      // sandboxed/webview contexts allow even when window.open is blocked
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  // ---- Event delegation ----
  document.addEventListener('click', function(e){
    const inc = e.target.closest('[data-role="inc"]');
    if(inc){ changeQty(inc.getAttribute('data-id'), 1); return; }

    const dec = e.target.closest('[data-role="dec"]');
    if(dec){ changeQty(dec.getAttribute('data-id'), -1); return; }

    if(e.target.closest('.qty-stepper')) return;
    if(e.target.closest('.variant-select')) return;

    const row = e.target.closest('.item, .addon-item');
    if(row){ toggleItem(row.getAttribute('data-id')); return; }
  });

  document.addEventListener('change', function(e){
    const variant = e.target.closest('[data-role="variant"]');
    if(variant){
      setVariant(variant.getAttribute('data-id'), variant.value);
      renderState();
    }
  });

  document.getElementById('actionBtn').addEventListener('click', function(){
    if(this.disabled) return;
    if(currentScreen === 'menu'){
      goToDetails();
    } else if(currentScreen === 'details'){
      goToPayment();
    } else if(currentScreen === 'payment'){
      sendOrder();
    }
  });

  document.getElementById('downloadQrBtn').addEventListener('click', downloadQr);
  document.getElementById('copyUpiBtn').addEventListener('click', copyUpiId);

  let paymentConfirmed = false;
  document.getElementById('paidConfirmRow').addEventListener('click', function(){
    paymentConfirmed = !paymentConfirmed;
    document.getElementById('paidChk').classList.toggle('on', paymentConfirmed);
    document.getElementById('confirmPaidBtn').disabled = !paymentConfirmed;
  });

  document.getElementById('confirmPaidBtn').addEventListener('click', function(){
    if(this.disabled) return;
    document.getElementById('payQrStep').style.display = 'none';
    document.getElementById('paySuccessStep').style.display = 'block';
    setTimeout(sendOrder, 900);
  });

  document.getElementById('newCustomerBtn').addEventListener('click', function(){ setCustomerType('new'); });
  document.getElementById('prevCustomerBtn').addEventListener('click', function(){ setCustomerType('returning'); });

  ['addressInput','mapsInput','phoneInput'].forEach(function(id){
    document.getElementById(id).addEventListener('input', updateBar);
  });

  document.getElementById('phoneInput').addEventListener('input', function(){
    this.value = this.value.replace(/\D/g,'').slice(0,10);
  });

  // ---- Screen transition ----
  let currentScreen = 'menu'; // 'menu' | 'details'

  function openMenu(){
    document.getElementById('launchScreen').classList.add('hidden');
    document.getElementById('menuScreen').classList.add('active');
    currentScreen = 'menu';
    updateBar();
    window.scrollTo(0,0);
  }
  function backToLaunch(){
    document.getElementById('menuScreen').classList.remove('active');
    document.getElementById('launchScreen').classList.remove('hidden');
  }
  function goToDetails(){
    document.getElementById('menuScreen').classList.remove('active');
    document.getElementById('detailsScreen').classList.add('active');
    currentScreen = 'details';

    customerType = null;
    document.getElementById('newCustomerBtn').classList.remove('active');
    document.getElementById('prevCustomerBtn').classList.remove('active');
    document.getElementById('detailsFields').style.display = 'none';
    document.getElementById('addressInput').value = '';
    document.getElementById('mapsInput').value = '';
    document.getElementById('phoneInput').value = '';
    document.getElementById('cookingRequestInput').value = '';
    document.getElementById('savedHint').textContent = '';

    updateBar();
    window.scrollTo(0,0);
  }
  function backToMenu(){
    document.getElementById('detailsScreen').classList.remove('active');
    document.getElementById('menuScreen').classList.add('active');
    currentScreen = 'menu';
    updateBar();
    window.scrollTo(0,0);
  }
  function goToPayment(){
    document.getElementById('detailsScreen').classList.remove('active');
    document.getElementById('paymentScreen').classList.add('active');
    currentScreen = 'payment';

    document.getElementById('payQrStep').style.display = 'block';
    document.getElementById('paySuccessStep').style.display = 'none';
    paymentConfirmed = false;
    document.getElementById('paidChk').classList.remove('on');
    document.getElementById('confirmPaidBtn').disabled = true;
    generateQrCode();

    updateBar();
    window.scrollTo(0,0);
  }
  function backToDetails(){
    document.getElementById('paymentScreen').classList.remove('active');
    document.getElementById('detailsScreen').classList.add('active');
    currentScreen = 'details';
    updateBar();
    window.scrollTo(0,0);
  }

  document.getElementById('launchScreen').addEventListener('click', openMenu);
  document.getElementById('launchScreen').addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openMenu(); }
  });
  document.getElementById('backBtn').addEventListener('click', backToLaunch);

  function clearCart(){
    Object.keys(state).forEach(id => delete state[id]);
    Object.keys(variantState).forEach(id => delete variantState[id]);
    renderState();
  }

  (function initClearCartBtn(){
    const btn = document.getElementById('clearCartBtn');
    let confirming = false;
    let resetTimer = null;

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      if(!confirming){
        confirming = true;
        btn.textContent = 'Tap again to confirm';
        resetTimer = setTimeout(function(){
          confirming = false;
          btn.textContent = '🗑 Clear Cart';
        }, 3000);
      } else {
        clearTimeout(resetTimer);
        confirming = false;
        btn.textContent = '🗑 Clear Cart';
        clearCart();
      }
    });
  })();
  document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
  document.getElementById('backToDetailsBtn').addEventListener('click', backToDetails);

  // ---- Add to Home Screen ----
  (function initInstallPrompt(){
    const INSTALL_DISMISSED_KEY = 'ntInstallDismissed';
    const installBtn = document.getElementById('installBtn');
    const iosToast = document.getElementById('iosInstallToast');

    // Already installed (running standalone)? Never show the button.
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if(isStandalone) return;

    let dismissed = false;
    try{ dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'; }catch(e){ /* ignore */ }
    if(dismissed) return;

    // Build a manifest on the fly so this stays a single self-contained file.
    try{
      const manifest = {
        name: 'Ninja Treats',
        short_name: 'Ninja Treats',
        start_url: '.',
        display: 'standalone',
        background_color: '#0b0d0a',
        theme_color: '#0b0d0a',
        icons: [{
          src: document.querySelector('link[rel="icon"]').href,
          sizes: '256x256',
          type: 'image/png'
        }]
      };
      const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = URL.createObjectURL(blob);
      document.head.appendChild(link);
    }catch(e){ /* manifest injection best-effort only */ }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', function(e){
      e.preventDefault();
      deferredPrompt = e;
      installBtn.style.display = 'flex';
    });

    window.addEventListener('appinstalled', function(){
      installBtn.style.display = 'none';
      try{ localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); }catch(e){ /* ignore */ }
    });

    // iOS never fires beforeinstallprompt, so show the button immediately
    // with manual Share-sheet instructions instead.
    if(isIOS){
      installBtn.style.display = 'flex';
    }

    installBtn.addEventListener('click', function(e){
      e.stopPropagation();
      if(deferredPrompt){
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function(){
          deferredPrompt = null;
          installBtn.style.display = 'none';
        });
      } else if(isIOS){
        iosToast.style.display = iosToast.style.display === 'block' ? 'none' : 'block';
      }
    });

    document.addEventListener('click', function(e){
      if(iosToast.style.display === 'block' && !e.target.closest('#iosInstallToast') && !e.target.closest('#installBtn')){
        iosToast.style.display = 'none';
      }
    });

    iosToast.addEventListener('click', function(e){ e.stopPropagation(); });
  })();

  // ---- Load menu data and boot the app ----
  // Everything above this point only *defines* functions/listeners; nothing
  // runs against real data until menu.json has loaded. This is the one
  // function you'd touch if you ever rename menu.json or move it elsewhere.
  async function init(){
    const menuContentEl = document.getElementById('menuContent');
    try{
      const res = await fetch('menu.json', {cache:'no-store'});
      if(!res.ok) throw new Error('menu.json returned HTTP ' + res.status);
      const data = await res.json();

      // Populate config (falls back to safe defaults if a field is missing)
      const cfg = data.config || {};
      PHONE = cfg.phone || '';
      UPI_ID = cfg.upiId || '';
      PAYEE_NAME = cfg.payeeName || 'Ninja Treats';
      FREE_DELIVERY_THRESHOLD = cfg.freeDeliveryThreshold ?? 149;
      DELIVERY_CHARGE_ENABLED = !!cfg.deliveryChargeEnabled;
      DELIVERY_CHARGE = cfg.deliveryCharge ?? 29;

      // Populate menu
      MENU = data.categories || [];

      // Build the id -> product lookup used everywhere else in the app
      PRODUCTS_BY_ID = {};
      getAllProducts().forEach(p => PRODUCTS_BY_ID[p.id] = p);

      // Render and go
      menuContentEl.innerHTML = buildMenuHTML();
      updateBar();
    } catch(err){
      console.error('Failed to load menu.json:', err);
      menuContentEl.innerHTML = `<div class="menu-load-error">
        ⚠️ Couldn't load the menu right now.<br>
        Please check your connection and reload the page.
      </div>`;
    }
  }

  init();

})();
