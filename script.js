/* ═══════════════════════════════════════════════════════════
   3mi Store v2 — script.js (Storefront)
   Firebase-powered | Real-time products, cart, settings
═══════════════════════════════════════════════════════════ */
'use strict';

/* ─── STATE ─── */
let products = [], settings = {}, cart = [], socialLinks = {};
let currentFilter = 'all', currentType = 'all', currentSort = 'default', searchQuery = '';
let selectedSizes = {}, selectedColors = {};
let FB; // Firebase references

/* ─── PLACEHOLDER EMOJIS ─── */
const PLACEHOLDERS = ['🛍️','👟','📱','👗','💄','🎒','⌚','🧴','🎧','📦','🎁','🏷️','👜','🕶️','👒'];
const TYPE_COLORS = { New:'#2563eb', Sale:'#e63950', Hot:'#d97706', Featured:'#7c3aed', Limited:'#0891b2' };
const SOCIAL_CLASSES = { whatsapp:'wa', facebook:'fb', instagram:'ig', tiktok:'tt', youtube:'yt', twitter:'tw', telegram:'tg', snapchat:'sc' };
const SOCIAL_NAMES = { whatsapp:'WhatsApp', facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube', twitter:'X (Twitter)', telegram:'Telegram', snapchat:'Snapchat' };

/* ─── HELPERS ─── */
const $ = id => document.getElementById(id);
const fmtRs = n => 'Rs. ' + Math.round(n).toLocaleString('en-IN');
const finalPrice = (p, d) => Math.round(p * (1 - d / 100));
const saveAmt = (p, d) => Math.round(p - finalPrice(p, d));
const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ph = id => PLACEHOLDERS[Math.abs((id||'x').charCodeAt(0)+(id||'x').charCodeAt(1))%PLACEHOLDERS.length];

function showToast(msg, type='info') {
  const c = $('toastContainer'); if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-dot"></span>${escHtml(msg)}`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 2800);
}

/* ─── CART (localStorage) ─── */
function loadCart() { try { cart = JSON.parse(localStorage.getItem('3mi_cart_v2')||'[]'); } catch { cart=[]; } }
function saveCart() { localStorage.setItem('3mi_cart_v2', JSON.stringify(cart)); }
function updateCartBadge() { const t=$('cartBadge'); if(t) t.textContent = cart.reduce((s,i)=>s+i.qty,0); }

function addToCart(productId, size='', color='') {
  const p = products.find(x=>x.id===productId);
  if (!p || !p.visible || !p.inStock) return;
  const key = productId + (size?'-'+size:'') + (color?'-'+color:'');
  const ex = cart.find(i=>i.key===key);
  if (ex) ex.qty++;
  else cart.push({ key, id: productId, qty:1, size, color });
  saveCart(); updateCartBadge(); renderCartItems();
  showToast(`${p.name} added to cart! 🛒`, 'success');
}

function changeQty(key, delta) {
  const item = cart.find(i=>i.key===key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i=>i.key!==key);
  saveCart(); updateCartBadge(); renderCartItems();
}

function removeFromCart(key) {
  cart = cart.filter(i=>i.key!==key);
  saveCart(); updateCartBadge(); renderCartItems();
  showToast('Removed from cart','info');
}

function renderCartItems() {
  const body = $('cartBody'), total = $('cartTotalPrice');
  if (!body) return;
  if (!cart.length) {
    body.innerHTML = `<div class="cart-empty"><div class="empty-icon">🛒</div><p>Your cart is empty.<br>Add some products!</p></div>`;
    if (total) total.textContent = 'Rs. 0';
    return;
  }
  let sum = 0;
  body.innerHTML = cart.map(item => {
    const p = products.find(x=>x.id===item.id);
    if (!p) return '';
    const fp = finalPrice(p.originalPrice, p.discount||0);
    sum += fp * item.qty;
    const img = (p.images&&p.images[0]) ? `<img src="${escHtml(p.images[0])}" alt="" onerror="this.style.display='none'">` : ph(p.id);
    const variantInfo = [item.size, item.color].filter(Boolean).join(', ');
    return `<div class="cart-item">
      <div class="cart-item-img">${img}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(p.name)}${variantInfo?`<br><small style="color:var(--text-light)">${escHtml(variantInfo)}</small>`:''}</div>
        <div class="cart-item-price">${fmtRs(fp)}</div>
        <div class="cart-qty">
          <button class="qty-btn" onclick="changeQty('${item.key}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.key}',1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.key}')">✕</button>
    </div>`;
  }).join('');
  if (total) total.textContent = fmtRs(sum);
}

/* ─── PRODUCT GRID ─── */
function getFiltered() {
  let list = products.filter(p => p.visible !== false);
  if (currentFilter !== 'all') list = list.filter(p => (p.category||'').toLowerCase() === currentFilter.toLowerCase());
  if (currentType !== 'all') list = list.filter(p => p.type === currentType);
  if (searchQuery) list = list.filter(p =>
    (p.name||'').toLowerCase().includes(searchQuery) ||
    (p.category||'').toLowerCase().includes(searchQuery) ||
    (p.shortDesc||p.desc||'').toLowerCase().includes(searchQuery) ||
    (p.tags||[]).some(t=>t.toLowerCase().includes(searchQuery))
  );
  if (currentSort==='price-asc') list.sort((a,b)=>finalPrice(a.originalPrice,a.discount||0)-finalPrice(b.originalPrice,b.discount||0));
  else if (currentSort==='price-desc') list.sort((a,b)=>finalPrice(b.originalPrice,b.discount||0)-finalPrice(a.originalPrice,a.discount||0));
  else if (currentSort==='discount') list.sort((a,b)=>(b.discount||0)-(a.discount||0));
  else if (currentSort==='newest') list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  return list;
}

function renderProducts() {
  const grid=$('productsGrid'), empty=$('emptyState'), title=$('sectionTitle'), count=$('productsCount');
  const filtered = getFiltered();
  if (title) title.textContent = currentFilter==='all' ? 'All Products' : currentFilter;
  if (count) count.textContent = `${filtered.length} item${filtered.length!==1?'s':''}`;
  if (!filtered.length) { if(grid) grid.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if (empty) empty.style.display='none';
  if (!grid) return;
  grid.innerHTML = filtered.map((p, i) => buildCard(p, i)).join('');
}

function buildCard(p, i) {
  const disc = p.discount||0;
  const fp = finalPrice(p.originalPrice, disc);
  const save = saveAmt(p.originalPrice, disc);
  const img = (p.images&&p.images[0]) ? `<img class="card-img" src="${escHtml(p.images[0])}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
  const placeholder = `<div class="card-img-placeholder" style="${(p.images&&p.images[0])?'display:none':''}">
    ${p.emoji||ph(p.id)}</div>`;
  const outOfStock = p.inStock===false;
  const stockLow = !outOfStock && p.stock > 0 && p.stock <= 5;
  const freeShip = p.freeShipping ? `<span class="card-tag">🚚 Free Shipping</span>` : '';
  const tagHtml = (p.tags||[]).slice(0,3).map(t=>`<span class="card-tag">${escHtml(t)}</span>`).join('');
  return `<div class="product-card" style="animation-delay:${i*0.05}s" onclick="openProductDetail('${p.id}')">
    <div class="card-img-wrap">
      ${img}${placeholder}
      <span class="card-type-badge type-${p.type||'New'}">${p.type||'New'}</span>
      ${disc>0?`<span class="card-discount-badge">-${disc}%</span>`:''}
      ${p.badge?`<span class="card-custom-badge">${escHtml(p.badge)}</span>`:''}
    </div>
    <div class="card-body">
      <div class="card-category">${escHtml(p.category||'')}</div>
      <div class="card-name">${escHtml(p.name)}</div>
      ${p.brand?`<div class="card-brand">by ${escHtml(p.brand)}</div>`:''}
      ${(p.shortDesc||p.desc)?`<div class="card-desc">${escHtml(p.shortDesc||p.desc)}</div>`:''}
      <div class="card-pricing">
        <div class="price-row">
          <span class="price-final">${fmtRs(fp)}</span>
          ${disc>0?`<span class="price-original">${fmtRs(p.originalPrice)}</span><span class="price-save">Save ${fmtRs(save)}</span>`:''}
        </div>
      </div>
      ${(tagHtml||freeShip)?`<div class="card-tags">${tagHtml}${freeShip}</div>`:''}
      ${stockLow?`<div class="card-stock stock-low">⚠ Only ${p.stock} left!</div>`:''}
      ${outOfStock?`<div class="card-stock stock-out">Out of Stock</div>`:''}
      <button class="card-add-btn" ${outOfStock?'disabled':''} onclick="event.stopPropagation();addToCartFromCard('${p.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 22c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm11 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        ${outOfStock?'Out of Stock':'Add to Cart'}
      </button>
    </div>
  </div>`;
}

function addToCartFromCard(id) {
  const p = products.find(x=>x.id===id);
  if (!p) return;
  // If has sizes/colors, open detail. Else add directly.
  if ((p.sizes&&p.sizes.length)||(p.colors&&p.colors.length)) openProductDetail(id);
  else addToCart(id);
}

/* ─── CATEGORY CHIPS ─── */
function renderCategoryChips() {
  const el = $('categoryChips'); if (!el) return;
  const cats = ['all', ...new Set(products.filter(p=>p.visible!==false).map(p=>p.category).filter(Boolean))];
  el.innerHTML = cats.map(c =>
    `<button class="chip ${c===currentFilter?'active':''}" data-filter="${escHtml(c)}">${c==='all'?'All':escHtml(c)}</button>`
  ).join('');
}

/* ─── PRODUCT DETAIL MODAL ─── */
function openProductDetail(id) {
  const p = products.find(x=>x.id===id); if (!p) return;
  const modal=$('productDetailModal'), overlay=$('productDetailOverlay'), inner=$('productDetailInner');
  if (!modal||!inner) return;
  selectedSizes[id]=''; selectedColors[id]='';
  const fp = finalPrice(p.originalPrice, p.discount||0);
  const save = saveAmt(p.originalPrice, p.discount||0);
  const imgs = (p.images||[]).filter(Boolean);
  const mainImg = imgs[0]||(p.image||'');

  let imagesHtml = `<div class="pd-images">
    <div class="pd-main-img">
      ${mainImg?`<img id="pdMainImg" src="${escHtml(mainImg)}" alt="${escHtml(p.name)}">`:
        `<div class="card-img-placeholder" style="height:100%">${p.emoji||ph(p.id)}</div>`}
    </div>
    ${imgs.length>1?`<div class="pd-thumbs">${imgs.map((img,i)=>
      `<div class="pd-thumb ${i===0?'active':''}" onclick="switchPdImg(this,'${escHtml(img)}')"><img src="${escHtml(img)}" alt=""></div>`
    ).join('')}</div>`:''}</div>`;

  const sizesHtml = (p.sizes&&p.sizes.length) ? `<div class="pd-options">
    <div class="pd-option-label">Size</div>
    <div class="pd-option-btns">${p.sizes.map(s=>
      `<button class="pd-option-btn" onclick="selectPdOption(this,'size','${id}','${escHtml(s)}')">${escHtml(s)}</button>`
    ).join('')}</div></div>` : '';

  const colorsHtml = (p.colors&&p.colors.length) ? `<div class="pd-options">
    <div class="pd-option-label">Color</div>
    <div class="pd-option-btns">${p.colors.map(c=>
      `<button class="pd-option-btn" onclick="selectPdOption(this,'color','${id}','${escHtml(c)}')">${escHtml(c)}</button>`
    ).join('')}</div></div>` : '';

  const specRows = [];
  if (p.material) specRows.push(['Material', p.material]);
  if (p.weight) specRows.push(['Weight', p.weight+'g']);
  if (p.sku) specRows.push(['SKU', p.sku]);
  if (p.freeShipping) specRows.push(['Shipping', '🚚 Free Shipping']);
  if (p.deliveryTime) specRows.push(['Delivery', p.deliveryTime]);
  if (p.specs) Object.entries(p.specs).forEach(([k,v])=>specRows.push([k,v]));
  const specsHtml = specRows.length ? `<div class="pd-specs">${specRows.map(([k,v])=>
    `<div class="pd-spec-row"><span class="pd-spec-key">${escHtml(k)}</span><span class="pd-spec-val">${escHtml(v)}</span></div>`
  ).join('')}</div>` : '';

  inner.innerHTML = `${imagesHtml}
    <div class="pd-category">${escHtml(p.category||'')}</div>
    <h2 class="pd-name">${escHtml(p.name)}</h2>
    ${p.brand?`<div class="pd-brand">Brand: <strong>${escHtml(p.brand)}</strong></div>`:''}
    <div class="pd-pricing">
      <span class="pd-price-final">${fmtRs(fp)}</span>
      ${(p.discount&&p.discount>0)?`<span class="pd-price-old">${fmtRs(p.originalPrice)}</span>
        <span class="pd-price-save">Save ${fmtRs(save)} (${p.discount}% OFF)</span>`:''}</div>
    ${(p.desc||p.shortDesc)?`<p class="pd-desc">${escHtml(p.desc||p.shortDesc)}</p>`:''}
    ${sizesHtml}${colorsHtml}
    ${specsHtml}
    <div class="pd-actions">
      <button class="pd-add-cart-btn" ${p.inStock===false?'disabled':''} onclick="addToCartFromDetail('${id}')">
        ${p.inStock===false?'Out of Stock':'🛒 Add to Cart'}
      </button>
      <button class="pd-wa-btn" onclick="orderSingleWa('${id}')">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Order via WhatsApp
      </button>
    </div>`;

  modal.classList.add('open');
  $('productDetailOverlay').classList.add('open');
}

window.switchPdImg = (thumb, src) => {
  const img = $('pdMainImg'); if(img) img.src=src;
  document.querySelectorAll('.pd-thumb').forEach(t=>t.classList.remove('active'));
  thumb.classList.add('active');
};
window.selectPdOption = (btn, type, id, val) => {
  const group = btn.closest('.pd-option-btns');
  group.querySelectorAll('.pd-option-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (type==='size') selectedSizes[id]=val;
  else selectedColors[id]=val;
};
window.addToCartFromDetail = (id) => addToCart(id, selectedSizes[id]||'', selectedColors[id]||'');
window.orderSingleWa = (id) => {
  const p=products.find(x=>x.id===id); if(!p) return;
  const fp=finalPrice(p.originalPrice,p.discount||0);
  const wa=(settings.whatsapp||'').replace(/\D/g,'');
  if (!wa) { showToast('WhatsApp not configured','error'); return; }
  const msg=encodeURIComponent(`🛍️ *Order from ${settings.storeName||'3mi Store'}*\n\n• ${p.name} × 1 = ${fmtRs(fp)}\n\nPlease confirm. Thank you!`);
  window.open(`https://wa.me/${wa}?text=${msg}`,'_blank');
};
window.openProductDetail = openProductDetail;
window.addToCartFromCard = addToCartFromCard;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;

/* ─── WHATSAPP CHECKOUT ─── */
function waCheckout() {
  if (!cart.length) { showToast('Cart is empty!','error'); return; }
  const wa=(settings.whatsapp||'').replace(/\D/g,'');
  if (!wa) { showToast('WhatsApp number not set','error'); return; }
  const lines = cart.map(item=>{
    const p=products.find(x=>x.id===item.id); if(!p) return '';
    const fp=finalPrice(p.originalPrice,p.discount||0);
    const variant=[item.size,item.color].filter(Boolean).join(', ');
    return `• ${p.name}${variant?' ('+variant+')':''} × ${item.qty} = ${fmtRs(fp*item.qty)}`;
  }).filter(Boolean);
  const total=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return p?s+finalPrice(p.originalPrice,p.discount||0)*i.qty:s;},0);
  const msg=`🛍️ *New Order — ${settings.storeName||'3mi Store'}*\n\n${lines.join('\n')}\n\n━━━━━━━━━━━━\n*Total: ${fmtRs(total)}*\n\nPlease confirm my order. Thank you! 🙏`;
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`,'_blank');
}

/* ─── APPLY SETTINGS TO STOREFRONT ─── */
function applySettings(s) {
  settings = s || {};
  // Store name
  const name = s.storeName || '3mi Store';
  document.title = name;
  const hn=$('headerLogoName'); if(hn) hn.textContent=name.replace(/^3/,'');
  const ha=$('headerLogoAccent'); if(ha&&name.startsWith('3')) ha.textContent='3'; else if(ha) ha.textContent='';
  const ht=$('headerLogoTag'); if(ht) ht.textContent='Store';
  const fl=$('footerLogoName'); if(fl) fl.textContent=name;
  const fa=$('footerLogoAccent'); if(fa) fa.textContent='';
  const ft=$('footerTagline'); if(ft) ft.textContent=s.tagline||'Quality products, delivered.';
  const fc=$('footerCopyright'); if(fc) fc.textContent=s.copyright||`© 2025 ${name}. All rights reserved.`;

  // Contact footer
  const fcc=$('footerContact'); if(fcc){
    const links=[];
    if(s.phone) links.push(`<a href="tel:${s.phone}">📞 ${escHtml(s.phone)}</a>`);
    if(s.email) links.push(`<a href="mailto:${s.email}">✉️ ${escHtml(s.email)}</a>`);
    if(s.address) links.push(`<span>📍 ${escHtml(s.address)}</span>`);
    fcc.innerHTML=links.join('');
  }

  // Announcement bar
  const ab=$('announcementBar'), at=$('announcementText');
  if(ab&&at){
    if(s.announcementEnabled&&s.announcementText){
      at.textContent=s.announcementText;
      ab.style.display='block';
      ab.style.background=s.announcementColor||'#e63950';
    } else ab.style.display='none';
  }

  // Hero
  const he=$('heroEyebrow'); if(he) he.textContent=s.heroEyebrow||'Welcome to';
  const ht2=$('heroTitle'); const hta=$('heroTitleAccent');
  if(ht2&&hta){ hta.textContent=s.heroTitleAccent||(name.split(' ')[0]); ht2.innerHTML=ht2.innerHTML; }
  if(hta) hta.textContent=name.split(' ')[0];
  const hs=$('heroSubtitle'); if(hs) hs.textContent=s.heroSubtitle||'Discover curated products at unbeatable prices.';
  const hb2=$('heroSecondaryBtn');
  if(hb2){
    if(s.heroBtn2Text&&s.heroBtn2Link){hb2.textContent=s.heroBtn2Text;hb2.href=s.heroBtn2Link;hb2.style.display='inline-flex';}
    else hb2.style.display='none';
  }
  const hero=$('heroSection'); if(hero&&s.heroBgColor) hero.style.background=s.heroBgColor;

  // Hero stats
  const hstats=$('heroStats'); if(hstats){
    if(s.showStats&&s.stats&&s.stats.length){
      hstats.innerHTML=s.stats.map(st=>`<div class="hero-stat"><div class="hero-stat-num">${escHtml(st.num||'')}</div><div class="hero-stat-label">${escHtml(st.label||'')}</div></div>`).join('');
    } else hstats.innerHTML='';
  }

  // Accent color
  if(s.accentColor) document.documentElement.style.setProperty('--accent',s.accentColor);
  if(s.footerBg){ const f=$('siteFooter'); if(f) f.style.background=s.footerBg; }

  // Footer social
  renderFooterSocial();
}

function renderSocialSection() {
  const sec=$('socialSection'), linksEl=$('socialLinks'), label=$('socialLabel');
  if(!sec||!linksEl) return;
  const active=Object.entries(socialLinks).filter(([,v])=>v.enabled&&v.url);
  if(!active.length){sec.style.display='none';return;}
  sec.style.display='block';
  if(label&&settings.socialLabel) label.textContent=settings.socialLabel;
  linksEl.innerHTML=active.map(([platform,data])=>{
    const cls=SOCIAL_CLASSES[platform]||'';
    const nm=SOCIAL_NAMES[platform]||platform;
    const href=platform==='whatsapp'?`https://wa.me/${data.url.replace(/\D/g,'')}`:data.url;
    return `<a class="social-link ${cls}" href="${escHtml(href)}" target="_blank" rel="noopener">${getSocialSvg(platform)}<span>${nm}</span></a>`;
  }).join('');
}

function renderFooterSocial() {
  const el=$('footerSocial'); if(!el) return;
  const active=Object.entries(socialLinks).filter(([,v])=>v.enabled&&v.url);
  el.innerHTML=active.map(([platform,data])=>{
    const href=platform==='whatsapp'?`https://wa.me/${data.url.replace(/\D/g,'')}`:data.url;
    return `<a class="footer-social-link" href="${escHtml(href)}" target="_blank" title="${SOCIAL_NAMES[platform]||platform}">${getSocialSvg(platform)}</a>`;
  }).join('');
}

function getSocialSvg(p) {
  const svgs={
    whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    tiktok:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z"/></svg>',
    youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>',
    twitter:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    telegram:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 2L11 13M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    snapchat:'<svg viewBox="0 0 24 24" fill="currentColor" width="20"><circle cx="12" cy="12" r="10"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12">👻</text></svg>',
  };
  return svgs[p]||`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}

/* ─── ADMIN LOGIN (storefront) ─── */
function openLoginModal() {
  $('loginModal').classList.add('open');
  $('loginOverlay').classList.add('open');
  $('loginEmail').focus();
}
function closeLoginModal() {
  $('loginModal').classList.remove('open');
  $('loginOverlay').classList.remove('open');
}
function togglePw(inputId, btn) {
  const input=document.getElementById(inputId);
  if(!input) return;
  input.type=input.type==='password'?'text':'password';
  btn.textContent=input.type==='password'?'👁':'🙈';
}

/* ─── THEME ─── */
function initTheme(){
  const saved=localStorage.getItem('3mi_theme')||'light';
  document.documentElement.setAttribute('data-theme',saved);
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='light'?'dark':'light';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('3mi_theme',next);
}

/* ─── FIREBASE INIT ─── */
document.addEventListener('firebaseReady', () => {
  FB = window.__firebase;
  const { auth, db, onAuthStateChanged, collection, doc, getDoc, onSnapshot, query, orderBy } = FB;

  // Auth state
  onAuthStateChanged(auth, user => {
    const btn=$('adminLoginBtn');
    if(btn) btn.title = user ? 'Go to Admin' : 'Admin Login';
    if(btn) btn.onclick = user ? ()=>window.location.href='admin.html' : openLoginModal;
  });

  // Real-time products
  const pQuery = query(collection(db,'products'), orderBy('createdAt','desc'));
  onSnapshot(pQuery, snap => {
    products = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderCategoryChips();
    renderProducts();
    updateCartBadge();
  }, () => { /* offline fallback — products stay empty */ });

  // Settings
  const settingsRef = doc(db,'config','settings');
  onSnapshot(settingsRef, snap => {
    if(snap.exists()) applySettings(snap.data());
  });

  // Social links
  const socialRef = doc(db,'config','social');
  onSnapshot(socialRef, snap => {
    if(snap.exists()){ socialLinks=snap.data(); renderSocialSection(); renderFooterSocial(); }
  });
});

/* ─── EVENTS ─── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadCart();
  updateCartBadge();

  // Theme
  $('themeToggle')?.addEventListener('click', toggleTheme);

  // Cart
  $('cartToggleBtn')?.addEventListener('click', ()=>{
    $('cartDrawer').classList.add('open');
    $('cartOverlay').classList.add('open');
    renderCartItems();
  });
  $('cartCloseBtn')?.addEventListener('click', ()=>{
    $('cartDrawer').classList.remove('open');
    $('cartOverlay').classList.remove('open');
  });
  $('cartOverlay')?.addEventListener('click', ()=>{
    $('cartDrawer').classList.remove('open');
    $('cartOverlay').classList.remove('open');
  });
  $('waCheckoutBtn')?.addEventListener('click', waCheckout);

  // Product detail modal
  $('productDetailClose')?.addEventListener('click', ()=>{
    $('productDetailModal').classList.remove('open');
    $('productDetailOverlay').classList.remove('open');
  });
  $('productDetailOverlay')?.addEventListener('click', ()=>{
    $('productDetailModal').classList.remove('open');
    $('productDetailOverlay').classList.remove('open');
  });

  // Login modal
  $('adminLoginBtn')?.addEventListener('click', openLoginModal);
  $('loginCancelBtn')?.addEventListener('click', closeLoginModal);
  $('loginOverlay')?.addEventListener('click', closeLoginModal);
  $('pwToggle')?.addEventListener('click', function(){ togglePw('loginPassword', this); });

  $('loginBtn')?.addEventListener('click', async () => {
    if(!FB) return;
    const email=$('loginEmail').value.trim(), pw=$('loginPassword').value;
    const err=$('loginError');
    if(!email||!pw){if(err)err.textContent='Enter email and password';return;}
    try{
      await FB.signInWithEmailAndPassword(FB.auth,email,pw);
      closeLoginModal();
      window.location.href='admin.html';
    }catch(e){
      if(err)err.textContent='Invalid email or password';
    }
  });
  $('loginPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click();});

  // Search
  $('searchInput')?.addEventListener('input', ()=>{
    searchQuery=$('searchInput').value.trim().toLowerCase();
    renderProducts();
  });

  // Filters
  $('categoryChips')?.addEventListener('click', e=>{
    const btn=e.target.closest('.chip'); if(!btn) return;
    currentFilter=btn.dataset.filter;
    document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
  });
  document.getElementById('typeChips')?.addEventListener('click', e=>{
    const btn=e.target.closest('.type-chip'); if(!btn) return;
    currentType=btn.dataset.type;
    document.querySelectorAll('.type-chip').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
  });
  $('sortSelect')?.addEventListener('change', ()=>{ currentSort=$('sortSelect').value; renderProducts(); });

  // Escape key
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      $('cartDrawer')?.classList.remove('open');
      $('cartOverlay')?.classList.remove('open');
      $('productDetailModal')?.classList.remove('open');
      $('productDetailOverlay')?.classList.remove('open');
      closeLoginModal();
    }
  });

  // Header scroll shadow
  window.addEventListener('scroll', ()=>{
    const h=$('siteHeader'); if(!h) return;
    h.style.boxShadow=window.scrollY>10?'0 4px 20px rgba(0,0,0,.12)':'none';
  },{passive:true});

  // Loading screen
  setTimeout(()=>{ const ls=$('loadingScreen'); if(ls) ls.classList.add('done'); }, 1300);
});
