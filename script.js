/* ═══════════════════════════════════════════════════════════
   3mi Store v2 — script.js (Storefront) — FIXED
   Fixes: login race condition, adminLoginBtn conflict,
          FB not ready when login clicked, addToCart inStock check
═══════════════════════════════════════════════════════════ */
'use strict';

/* ─── STATE ─── */
let products = [], settings = {}, cart = [], socialLinks = {};
let currentFilter = 'all', currentType = 'all', currentSort = 'default', searchQuery = '';
let selectedSizes = {}, selectedColors = {};
let FB = null;
let currentUser = null;

const PLACEHOLDERS = ['🛍️','👟','📱','👗','💄','🎒','⌚','🧴','🎧','📦','🎁','🏷️','👜','🕶️','👒'];
const SOCIAL_CLASSES = { whatsapp:'wa', facebook:'fb', instagram:'ig', tiktok:'tt', youtube:'yt', twitter:'tw', telegram:'tg', snapchat:'sc' };
const SOCIAL_NAMES   = { whatsapp:'WhatsApp', facebook:'Facebook', instagram:'Instagram', tiktok:'TikTok', youtube:'YouTube', twitter:'X (Twitter)', telegram:'Telegram', snapchat:'Snapchat' };

const $          = id => document.getElementById(id);
const getCurrency = () => window.__3mi_currency || 'Rs. ';
const fmtRs      = n  => getCurrency() + Math.round(n).toLocaleString('en-IN');
const finalPrice = (p, d) => Math.round(p * (1 - (d||0) / 100));
const saveAmt    = (p, d) => Math.round(p - finalPrice(p, d));
const escHtml    = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ph         = id => PLACEHOLDERS[Math.abs(((id||'x').charCodeAt(0)||0)+((id||'x').charCodeAt(1)||0)) % PLACEHOLDERS.length];

// Extract TikTok video ID and build embed URL
function getTikTokEmbedUrl(url) {
  if (!url) return null;
  // Match various TikTok URL formats
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,           // https://www.tiktok.com/@username/video/1234567890
    /tiktok\.com\/v\/(\d+)/,                          // https://www.tiktok.com/v/1234567890
    /vm\.tiktok\.com\/([A-Za-z0-9]+)/,                // https://vm.tiktok.com/xxxxx
    /tiktok\.com\/@[\w.-]+\/live\/(\d+)/,             // live videos
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return `https://www.tiktok.com/embed/v2/${videoId}`;
    }
  }
  return null;
}

// Extract Facebook video ID and build embed URL
function getFacebookEmbedUrl(url) {
  if (!url) return null;
  // Match various Facebook video URL formats
  const patterns = [
    /facebook\.com\/watch\?v=(\d+)/,                      // https://www.facebook.com/watch?v=1234567890
    /facebook\.com\/[\w.-]+\/videos\/(\d+)/,              // https://www.facebook.com/username/videos/1234567890
    /facebook\.com\/reel\/(\d+)/,                         // https://www.facebook.com/reel/1234567890
    /fb\.watch\/([A-Za-z0-9]+)/,                          // https://fb.watch/xxxxx
    /facebook\.com\/video\.php\?v=(\d+)/,                 // old format
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return `https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2F${videoId}&show_text=false&width=100%25`;
    }
  }
  // Try to extract from generic facebook.com URL with video ID
  const genericMatch = url.match(/facebook\.com.*[?&]v=(\d+)/);
  if (genericMatch) {
    const videoId = genericMatch[1];
    return `https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2F${videoId}&show_text=false&width=100%25`;
  }
  return null;
}

/* ─── TOAST ─── */
function showToast(msg, type = 'info') {
  const c = $('toastContainer'); if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-dot"></span>${escHtml(msg)}`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 2800);
}

/* ─── CART ─── */
function loadCart() { try { cart = JSON.parse(localStorage.getItem('3mi_cart_v2')||'[]'); } catch { cart=[]; } }
function saveCart() { localStorage.setItem('3mi_cart_v2', JSON.stringify(cart)); }
function updateCartBadge() { const t=$('cartBadge'); if(t) t.textContent = cart.reduce((s,i)=>s+i.qty,0); }

function addToCart(productId, size='', color='') {
  const p = products.find(x=>x.id===productId);
  if (!p) { showToast('Product not found','error'); return; }
  if (p.inStock === false) { showToast('Product is out of stock','error'); return; }
  const key = productId+(size?'-'+size:'')+(color?'-'+color:'');
  const ex  = cart.find(i=>i.key===key);
  if (ex) ex.qty++; else cart.push({key,id:productId,qty:1,size,color});
  saveCart(); updateCartBadge(); renderCartItems();
  showToast(`${p.name} added to cart! 🛒`, 'success');
}

function changeQty(key, delta) {
  const item = cart.find(i=>i.key===key); if(!item) return;
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
  const body=$('cartBody'), total=$('cartTotalPrice'); if(!body) return;
  if (!cart.length) {
    body.innerHTML=`<div class="cart-empty"><div class="empty-icon">🛒</div><p>Your cart is empty.<br>Add some products!</p></div>`;
    if(total) total.textContent='Rs. 0'; return;
  }
  let sum=0;
  body.innerHTML=cart.map(item=>{
    const p=products.find(x=>x.id===item.id); if(!p) return '';
    const fp=finalPrice(p.originalPrice,p.discount||0); sum+=fp*item.qty;
    const img=(p.images&&p.images[0])?`<img src="${escHtml(p.images[0])}" alt="" onerror="this.style.display='none'">`:ph(p.id);
    const variant=[item.size,item.color].filter(Boolean).join(', ');
    return `<div class="cart-item">
      <div class="cart-item-img">${img}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(p.name)}${variant?`<br><small style="color:var(--text-light)">${escHtml(variant)}</small>`:''}</div>
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
  if(total) total.textContent=fmtRs(sum);
}

/* ─── PRODUCTS ─── */
function getFiltered() {
  let list=products.filter(p=>p.visible!==false);
  if(currentFilter!=='all') list=list.filter(p=>(p.category||'').toLowerCase()===currentFilter.toLowerCase());
  if(currentType!=='all')   list=list.filter(p=>p.type===currentType);
  if(searchQuery)           list=list.filter(p=>
    (p.name||'').toLowerCase().includes(searchQuery)||
    (p.category||'').toLowerCase().includes(searchQuery)||
    (p.shortDesc||p.desc||'').toLowerCase().includes(searchQuery)||
    (p.tags||[]).some(t=>t.toLowerCase().includes(searchQuery)));
  if(currentSort==='price-asc')  list.sort((a,b)=>finalPrice(a.originalPrice,a.discount||0)-finalPrice(b.originalPrice,b.discount||0));
  if(currentSort==='price-desc') list.sort((a,b)=>finalPrice(b.originalPrice,b.discount||0)-finalPrice(a.originalPrice,a.discount||0));
  if(currentSort==='discount')   list.sort((a,b)=>(b.discount||0)-(a.discount||0));
  if(currentSort==='newest')     list.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  return list;
}

function renderProducts() {
  const grid=$('productsGrid'),empty=$('emptyState'),title=$('sectionTitle'),count=$('productsCount');
  const filtered=getFiltered();
  if(title) title.textContent=currentFilter==='all'?'All Products':currentFilter;
  if(count) count.textContent=`${filtered.length} item${filtered.length!==1?'s':''}`;
  if(!filtered.length){if(grid)grid.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty) empty.style.display='none';
  if(!grid) return;
  grid.innerHTML=filtered.map((p,i)=>buildCard(p,i)).join('');
}

function buildCard(p,i){
  const disc=p.discount||0,fp=finalPrice(p.originalPrice,disc),save=saveAmt(p.originalPrice,disc);
  const img=(p.images&&p.images[0])?`<img class="card-img" src="${escHtml(p.images[0])}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:'' ;
  const placeholder=`<div class="card-img-placeholder" style="${(p.images&&p.images[0])?'display:none':''}">${p.emoji||ph(p.id)}</div>`;
  const outOfStock=p.inStock===false,stockLow=!outOfStock&&p.stock>0&&p.stock<=5;
  const freeShip=p.freeShipping?`<span class="card-tag">🚚 Free Shipping</span>`:'';
  const tagHtml=(p.tags||[]).slice(0,3).map(t=>`<span class="card-tag">${escHtml(t)}</span>`).join('');
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
      ${(p.shortDesc||p.desc)?`<div class="card-desc">${escHtml(p.shortDesc||p.desc).replace(/\n/g,'<br>')}</div>`:''}
      <div class="card-pricing"><div class="price-row">
        <span class="price-final">${fmtRs(fp)}</span>
        ${disc>0?`<span class="price-original">${fmtRs(p.originalPrice)}</span><span class="price-save">Save ${fmtRs(save)}</span>`:''}
      </div></div>
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

function addToCartFromCard(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  if((p.sizes&&p.sizes.length)||(p.colors&&p.colors.length)) openProductDetail(id);
  else addToCart(id);
}

function renderCategoryChips(){
  const el=$('categoryChips'); if(!el) return;
  const cats=['all',...new Set(products.filter(p=>p.visible!==false).map(p=>p.category).filter(Boolean))];
  el.innerHTML=cats.map(c=>`<button class="chip ${c===currentFilter?'active':''}" data-filter="${escHtml(c)}">${c==='all'?'All':escHtml(c)}</button>`).join('');
}

/* ─── PRODUCT DETAIL ─── */
function openProductDetail(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  history.pushState(
    null,
    "",
    `?product=${encodeURIComponent(id)}`
  );
  const modal=$('productDetailModal'),overlay=$('productDetailOverlay'),inner=$('productDetailInner');
  if(!modal||!inner) return;
  selectedSizes[id]=''; selectedColors[id]='';
  const fp=finalPrice(p.originalPrice,p.discount||0),save=saveAmt(p.originalPrice,p.discount||0);
  const imgs=(p.images||[]).filter(Boolean);

  // Build video embed if TikTok or Facebook URL exists
  let videoHtml = '';
  if (p.tikTokUrl) {
    const tikTokEmbedUrl = getTikTokEmbedUrl(p.tikTokUrl);
    if (tikTokEmbedUrl) {
      videoHtml = `<div class="pd-video pd-video-tiktok" data-type="tiktok">
        <iframe src="${escHtml(tikTokEmbedUrl)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        <div class="pd-video-link"><a href="${escHtml(p.tikTokUrl)}" target="_blank" rel="noopener noreferrer">🎵 Watch on TikTok ↗</a></div>
      </div>`;
    }
  } else if (p.facebookUrl) {
    const fbEmbedUrl = getFacebookEmbedUrl(p.facebookUrl);
    if (fbEmbedUrl) {
      videoHtml = `<div class="pd-video pd-video-facebook" data-type="facebook">
        <iframe src="${escHtml(fbEmbedUrl)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        <div class="pd-video-link"><a href="${escHtml(p.facebookUrl)}" target="_blank" rel="noopener noreferrer">📘 Watch on Facebook ↗</a></div>
      </div>`;
    }
  }

  // Determine what to show as main content - video takes priority if no images
  const hasVideo = videoHtml !== '';
  const hasImages = imgs.length > 0;

  let imagesHtml = `<div class="pd-images">${videoHtml}`;

  if (hasImages) {
    imagesHtml += `<div class="pd-main-img">${imgs[0]?`<img id="pdMainImg" src="${escHtml(imgs[0])}" alt="${escHtml(p.name)}">`:
      `<div class="card-img-placeholder" style="height:100%">${p.emoji||ph(p.id)}</div>`}</div>
    ${imgs.length>1?`<div class="pd-thumbs">${imgs.map((img,i)=>
      `<div class="pd-thumb ${i===0?'active':''}" onclick="switchPdImg(this,'${escHtml(img)}')"><img src="${escHtml(img)}" alt=""></div>`
    ).join('')}</div>`:''}`;
  } else if (hasVideo) {
    // Video only - no images
    imagesHtml += `<div class="pd-main-img" style="display:none;"></div>`;
  } else {
    // No images, no video - show placeholder
    imagesHtml += `<div class="pd-main-img"><div class="card-img-placeholder" style="height:100%">${p.emoji||ph(p.id)}</div></div>`;
  }

  imagesHtml += `</div>`;
  const sizesHtml=(p.sizes&&p.sizes.length)?`<div class="pd-options"><div class="pd-option-label">Size</div>
    <div class="pd-option-btns">${p.sizes.map(s=>`<button class="pd-option-btn" onclick="selectPdOption(this,'size','${id}','${escHtml(s)}')">${escHtml(s)}</button>`).join('')}</div></div>`:'';
  const colorsHtml=(p.colors&&p.colors.length)?`<div class="pd-options"><div class="pd-option-label">Color</div>
    <div class="pd-option-btns">${p.colors.map(c=>`<button class="pd-option-btn" onclick="selectPdOption(this,'color','${id}','${escHtml(c)}')">${escHtml(c)}</button>`).join('')}</div></div>`:'';
  const specRows=[];
  if(p.material) specRows.push(['Material',p.material]);
  if(p.weight)   specRows.push(['Weight',p.weight+'g']);
  if(p.sku)      specRows.push(['SKU',p.sku]);
  if(p.freeShipping) specRows.push(['Shipping','🚚 Free Shipping']);
  if(p.specs)    Object.entries(p.specs).forEach(([k,v])=>specRows.push([k,v]));
  const specsHtml=specRows.length?`<div class="pd-specs">${specRows.map(([k,v])=>
    `<div class="pd-spec-row"><span class="pd-spec-key">${escHtml(k)}</span><span class="pd-spec-val">${escHtml(v)}</span></div>`).join('')}</div>`:'';
  inner.innerHTML=`${imagesHtml}
    <div class="pd-category">${escHtml(p.category||'')}</div>
    <h2 class="pd-name">${escHtml(p.name)}</h2>
    ${p.brand?`<div class="pd-brand">Brand: <strong>${escHtml(p.brand)}</strong></div>`:''}
    <div class="pd-pricing">
      <span class="pd-price-final">${fmtRs(fp)}</span>
      ${(p.discount&&p.discount>0)?`<span class="pd-price-old">${fmtRs(p.originalPrice)}</span>
        <span class="pd-price-save">Save ${fmtRs(save)} (${p.discount}% OFF)</span>`:''}
    </div>
    ${(p.desc||p.shortDesc)?`<p class="pd-desc">${escHtml(p.desc||p.shortDesc).replace(/\n/g,'<br>')}</p>`:''}
    ${sizesHtml}${colorsHtml}${specsHtml}
    <div class="pd-actions">
      <button class="pd-add-cart-btn" ${p.inStock===false?'disabled':''} onclick="addToCartFromDetail('${id}')">
        ${p.inStock===false?'Out of Stock':'🛒 Add to Cart'}
      </button>
      ${p.inStock===false?'':`
        <button class="pd-wa-btn" onclick="orderSingleWa('${id}')">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Order via WhatsApp
        </button>
        <button class="pd-enquire-btn" onclick="enquireProduct('${id}')">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Enquire
        </button>
      `}
      <button onclick="shareProduct('${p.id}')">
      🔗 Share Product
      </button>
    </div>`;
  modal.classList.add('open'); overlay.classList.add('open');
}

window.openProductDetail=openProductDetail;
window.addToCartFromCard=addToCartFromCard;
window.addToCart=addToCart;
window.changeQty=changeQty;
window.removeFromCart=removeFromCart;
window.switchPdImg=(thumb,src)=>{const img=$('pdMainImg');if(img)img.src=src;document.querySelectorAll('.pd-thumb').forEach(t=>t.classList.remove('active'));thumb.classList.add('active');};
window.selectPdOption=(btn,type,id,val)=>{btn.closest('.pd-option-btns').querySelectorAll('.pd-option-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if(type==='size')selectedSizes[id]=val;else selectedColors[id]=val;};
window.addToCartFromDetail=(id)=>addToCart(id,selectedSizes[id]||'',selectedColors[id]||'');
window.orderSingleWa=(id)=>{
  const p=products.find(x=>x.id===id);if(!p)return;
  const fp=finalPrice(p.originalPrice,p.discount||0);
  const wa=(settings.whatsapp||'').replace(/\D/g,'');
  if(!wa){showToast('WhatsApp not configured','error');return;}
  const delivery=calcDelivery(fp);
  const total=fp+delivery;
  let deliveryLine='';
  let deliveryNote='';
  if(delivery>0) {
    deliveryLine=`\n🚚 Delivery: ${fmtRs(delivery)}`;
  } else if(settings.freeDeliveryMin && fp >= parseFloat(settings.freeDeliveryMin)) {
    deliveryLine=`\n🚚 Delivery: FREE (min ${fmtRs(settings.freeDeliveryMin)})`;
  } else {
    deliveryLine=`\n🚚 Delivery: ${fmtRs(delivery)}`;
    // No fixed delivery charge set - add note
    deliveryNote=`\n\n⚠️ Delivery charge not included. Final charge may vary based on location.`;
  }
  const msg=encodeURIComponent(`🛍️ *New Order — ${settings.storeName||'3mi Store'}*

📦 ${p.name} x1 - ${fmtRs(fp)}${deliveryLine}${deliveryNote}

━━━━━━━━━━━━
*Total: ${fmtRs(total)}*

Please confirm my order. Thank you!`);

  window.open(`https://wa.me/${wa}?text=${msg}`,'_blank');
};

/* ─── ENQUIRE ABOUT PRODUCT ─── */
window.enquireProduct=(id)=>{
  const p=products.find(x=>x.id===id);if(!p)return;
  const wa=(settings.whatsapp||'').replace(/\D/g,'');
  if(!wa){showToast('WhatsApp not configured','error');return;}
  const fp=finalPrice(p.originalPrice,p.discount||0);
  const variant=(selectedSizes[id]||'')+(selectedColors[id]||'');
  const msg=encodeURIComponent(`👋 Hi ${settings.storeName||'3mi Store'},

I'd like to enquire about this product:

📦 *${p.name}*
💰 Price: ${fmtRs(fp)}${variant?`\n🎨 Variant: ${variant}`:''}

Could you please share more details? Thank you!`);

  window.open(`https://wa.me/${wa}?text=${msg}`,'_blank');
};
function calcDelivery(subtotal){
  const charge = parseFloat(settings.deliveryCharge)||0;
  const min = parseFloat(settings.freeDeliveryMin)||0;
  if(!charge) return 0;
  if(min && subtotal >= min) return 0;
  return charge;
}

/* ─── WHATSAPP CHECKOUT ─── */
function waCheckout(){
  if(!cart.length){showToast('Cart is empty!','error');return;}
  const wa=(settings.whatsapp||'').replace(/\D/g,'');
  if(!wa){showToast('WhatsApp number not set','error');return;}
  const lines=cart.map(item=>{
    const p=products.find(x=>x.id===item.id);if(!p)return'';
    const fp=finalPrice(p.originalPrice,p.discount||0);
    const variant=[item.size,item.color].filter(Boolean).join(', ');
    return `• ${p.name}${variant?' ('+variant+')':''} × ${item.qty} = ${fmtRs(fp*item.qty)}`;
  }).filter(Boolean);
  const subtotal=cart.reduce((s,i)=>{const p=products.find(x=>x.id===i.id);return p?s+finalPrice(p.originalPrice,p.discount||0)*i.qty:s;},0);
  const delivery=calcDelivery(subtotal);
  const total=subtotal+delivery;
  let deliveryLine='';
  let deliveryNote='';
  if(delivery>0) {
    deliveryLine=`\n🚚 Delivery: ${fmtRs(delivery)}`;
  } else if(settings.freeDeliveryMin && subtotal >= parseFloat(settings.freeDeliveryMin)) {
    deliveryLine=`\n🚚 Delivery: FREE (min ${fmtRs(settings.freeDeliveryMin)})`;
  } else {
    deliveryLine=`\n🚚 Delivery: ${fmtRs(delivery)}`;
    // No fixed delivery charge set - add note
    deliveryNote=`\n\n⚠️ Delivery charge not included. Final charge may vary based on location.`;
  }
  const msg=encodeURIComponent(`🛍️ *New Order — ${settings.storeName||'3mi Store'}*\n\n${lines.join('\n')}${deliveryLine}${deliveryNote}\n\n━━━━━━━━━━━━\n*Total: ${fmtRs(total)}*\n\nPlease confirm my order. Thank you! 🙏`);
  window.open(`https://wa.me/${wa}?text=${msg}`,'_blank');
}

/* ─── APPLY SETTINGS ─── */
function applySettings(s){
  settings=s||{};
  const name=s.storeName||'3mi Store';
  const currency=s.currency||'Rs. ';
  const currencyCode=s.currencyCode||'NPR';

  // ── Meta / SEO ──
  document.title = s.metaTitle||name;
  updateMetaTag('description', s.metaDescription||'');
  updateMetaTag('og:title', s.metaTitle||name);
  updateMetaTag('og:description', s.metaDescription||'');
  updateMetaTag('og:type', 'website');
  updateMetaTag('og:site_name', name);
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', s.metaTitle||name);
  updateMetaTag('twitter:description', s.metaDescription||'');

  // ── Header / Logo (quick-update for live preview) ──
  const headerLogo=$('headerLogoName');
  const headerAccent=$('headerLogoAccent');
  const headerTag=$('headerLogoTag');
  // Display full store name without forced "Store" suffix
  if(headerLogo) headerLogo.textContent=name;
  if(headerAccent) headerAccent.textContent='';
  if(headerTag) headerTag.textContent='';

  // Loading screen logo
  const loadLogo=$('loadingLogo');
  if(loadLogo) loadLogo.textContent=name;

  // Custom head HTML
  if(s.customHead){
    const existing=document.getElementById('custom-head-injected');
    if(existing) existing.remove();
    const div=document.createElement('div');
    div.id='custom-head-injected';
    div.innerHTML=s.customHead;
    document.head.appendChild(div);
  }

  // ── Favicon ──
  if(s.faviconUrl){
    let link=document.querySelector('link[rel="icon"]');
    if(!link){ link=document.createElement('link'); link.rel='icon'; document.head.appendChild(link); }
    link.href=s.faviconUrl;
  }

  // ── Footer ──
  const fl=$('footerLogoName'); if(fl) fl.textContent=name;
  const ft=$('footerTagline'); if(ft) ft.textContent=s.tagline||'Quality products, delivered.';
  // Copyright always dynamic based on store name (ignores custom copyright field)
  const fc2=$('footerCopyright'); if(fc2) fc2.textContent=`© ${new Date().getFullYear()} ${name}. All rights reserved.`;
  // Footer credit (FIXED - always shows Manoj Tamang | Info Manoj regardless of store name)
  const fCredit=$('footerCredit');
  if(fCredit) {
    fCredit.innerHTML=`Made by <a href="https://www.manojtamang53.com.np" target="_blank" rel="noopener noreferrer">Manoj Tamang</a> <span class="credit-separator">|</span> <a href="https://www.manojtamang53.com.np" target="_blank" rel="noopener noreferrer">Info Manoj</a>`;
  }

  // Footer contact
  const fc=$('footerContact');
  if(fc){
    const links=[];
    if(s.phone) links.push(`<a href="tel:${s.phone.replace(/\s/g,'')}">📞 ${escHtml(s.phone)}</a>`);
    if(s.email) links.push(`<a href="mailto:${s.email}">✉️ ${escHtml(s.email)}</a>`);
    if(s.supportEmail) links.push(`<a href="mailto:${s.supportEmail}">🎧 ${escHtml(s.supportEmail)}</a>`);
    if(s.address) links.push(`<span>📍 ${escHtml(s.address.replace(/\n/g,'<br>'))}</span>`);
    if(s.businessHours) links.push(`<span>🕐 ${escHtml(s.businessHours.replace(/\n/g,'<br>'))}</span>`);
    fc.innerHTML=links.join('<br>');
  }

  // ── Announcement Bar ──
  const ab=$('announcementBar'), at=$('announcementText');
  if(ab && at){
    if(s.announcementEnabled && s.announcementText){
      at.textContent=s.announcementText;
      at.style.color=s.announcementTextColor||'#ffffff';
      ab.style.display='block';
      ab.style.background=s.announcementColor||'#e63950';
      if(s.announcementLink){
        at.style.cursor='pointer';
        at.onclick=()=>window.location.href=s.announcementLink;
      }else{
        at.style.cursor='default';
        at.onclick=null;
      }
    }else{
      ab.style.display='none';
    }
  }

  // ── Hero ──
  const he=$('heroEyebrow'); if(he) he.textContent=s.heroEyebrow||'Welcome to';
  const hs=$('heroSubtitle'); if(hs) hs.textContent=s.heroSubtitle||'Discover curated products at unbeatable prices.';
  const hta=$('heroTitleAccent'); if(hta) hta.textContent=name; // Use full store name
  const hero=$('heroSection'); if(hero && s.heroBgColor) hero.style.background=s.heroBgColor;
  const hb2=$('heroSecondaryBtn');
  if(hb2){
    if(s.heroBtn2Text && s.heroBtn2Link){
      hb2.textContent=s.heroBtn2Text;
      hb2.href=s.heroBtn2Link;
      hb2.style.display='inline-flex';
    }else hb2.style.display='none';
  }
  const hstats=$('heroStats');
  if(hstats){
    hstats.innerHTML=(s.showStats && s.stats && s.stats.length)
      ? s.stats.map(st=>`<div class="hero-stat"><div class="hero-stat-num">${escHtml(st.num||'')}</div><div class="hero-stat-label">${escHtml(st.label||'')}</div></div>`).join('')
      : '';
  }

  // ── Accent / Colors ──
  if(s.accentColor) document.documentElement.style.setProperty('--accent',s.accentColor);
  if(s.footerBg){ const f=$('siteFooter'); if(f) f.style.background=s.footerBg; }

  // ── Social ──
  renderFooterSocial();

  // ── Maintenance Mode ──
  if(s.maintenanceMode && s.maintenanceMessage){
    showMaintenanceOverlay(s.maintenanceMessage);
  }else{
    hideMaintenanceOverlay();
  }

  // ── Currency formatting (global) ──
  window.__3mi_currency = currency;
  window.__3mi_currencyCode = currencyCode;

  // Store default sort for product rendering
  if(s.defaultSort) window.__3mi_defaultSort = s.defaultSort;
  if(s.productsPerPage) window.__3mi_productsPerPage = parseInt(s.productsPerPage);

  // Store showStockCount for product cards
  window.__3mi_showStockCount = !!s.showStockCount;
}

function updateMetaTag(name, content){
  let meta=document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  if(!meta){
    meta=document.createElement('meta');
    if(name.startsWith('og:') || name.startsWith('twitter:')) meta.setAttribute('property', name);
    else meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

// Maintenance overlay
function showMaintenanceOverlay(msg){
  let overlay=document.getElementById('maintenanceOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='maintenanceOverlay';
    overlay.style.cssText=`position:fixed;inset:0;background:var(--bg);color:var(--text);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;text-align:center;font-family:'Outfit',sans-serif`;
    overlay.innerHTML=`<div><div style="font-family:'Syne',sans-serif;font-size:3rem;font-weight:800;margin-bottom:16px">🔧</div><h1 style="font-size:2rem;margin-bottom:12px">Under Maintenance</h1><p style="max-width:400px;color:var(--text-muted)">${escHtml(msg)}</p></div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display='flex';
}
function hideMaintenanceOverlay(){
  const overlay=document.getElementById('maintenanceOverlay');
  if(overlay) overlay.style.display='none';
}

function renderSocialSection(){
  const sec=$('socialSection'),linksEl=$('socialLinks'),label=$('socialLabel');
  if(!sec||!linksEl)return;
  const active=Object.entries(socialLinks).filter(([k,v])=>k!=='_label'&&v.enabled&&v.url);
  if(!active.length){sec.style.display='none';return;}
  sec.style.display='block';
  if(label)label.textContent=socialLinks._label||'Find us on';
  linksEl.innerHTML=active.map(([platform,data])=>{
    const cls=SOCIAL_CLASSES[platform]||'',nm=SOCIAL_NAMES[platform]||platform;
    const href=platform==='whatsapp'?`https://wa.me/${data.url.replace(/\D/g,'')}`:data.url;
    return `<a class="social-link ${cls}" href="${escHtml(href)}" target="_blank" rel="noopener">${getSocialSvg(platform)}<span>${nm}</span></a>`;
  }).join('');
}

function renderFooterSocial(){
  const el=$('footerSocial');if(!el)return;
  const active=Object.entries(socialLinks).filter(([k,v])=>k!=='_label'&&v.enabled&&v.url);
  el.innerHTML=active.map(([platform,data])=>{
    const href=platform==='whatsapp'?`https://wa.me/${data.url.replace(/\D/g,'')}`:data.url;
    return `<a class="footer-social-link" href="${escHtml(href)}" target="_blank" title="${SOCIAL_NAMES[platform]||platform}">${getSocialSvg(platform)}</a>`;
  }).join('');
}

function getSocialSvg(p){
  const svgs={
    whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
    facebook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    tiktok:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z"/></svg>',
    youtube:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>',
    twitter:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    telegram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    snapchat:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.166 2c.93 0 4.369.26 5.963 3.607.49 1.044.373 2.808.28 4.085l-.01.145c-.006.08.04.196.107.232.242.13.777.026 1.082-.052.15-.039.326-.058.49-.058.472 0 .892.23.967.535.1.41-.27.83-.965 1.078l-.326.107c-.56.179-1.329.424-1.536 1.013-.067.188-.046.397.063.619.677 1.37 1.93 2.27 2.94 2.41.282.04.482.3.428.573-.29 1.48-2.434 1.98-3.27 2.1-.08.01-.158.07-.195.163-.063.155-.082.374-.1.622-.022.268-.05.606-.174.888-.09.2-.28.312-.5.312a1.09 1.09 0 0 1-.348-.06c-.544-.185-1.023-.28-1.47-.28-.26 0-.508.034-.737.095-.517.14-1.033.454-1.573.784-.86.52-1.748 1.058-2.87 1.058-.1 0-.2-.005-.304-.016-1.102-.117-1.978-.651-2.826-1.17-.53-.32-1.037-.625-1.544-.762-.227-.06-.473-.093-.73-.093-.45 0-.93.098-1.474.286a1.07 1.07 0 0 1-.35.062c-.216 0-.408-.112-.498-.3-.127-.285-.154-.627-.176-.9-.019-.248-.037-.468-.1-.625-.036-.09-.115-.15-.194-.162C3.07 18.17.927 17.67.637 16.19c-.054-.273.146-.534.427-.573 1.01-.14 2.264-1.04 2.94-2.41.11-.222.13-.43.063-.619-.207-.59-.976-.834-1.536-1.013a4.88 4.88 0 0 1-.326-.107C1.51 11.22 1.14 10.8 1.24 10.39c.075-.306.494-.535.966-.535.164 0 .34.02.49.058.305.078.84.18 1.082.052.066-.036.113-.152.107-.232l-.01-.145c-.093-1.277-.21-3.04.28-4.085C5.748 2.26 9.235 2 12.166 2z"/></svg>',
  };
  return svgs[p]||`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}

/* ─── THEME ─── */
function initTheme(){const saved=localStorage.getItem('3mi_theme')||'light';document.documentElement.setAttribute('data-theme',saved);}
function toggleTheme(){const cur=document.documentElement.getAttribute('data-theme'),next=cur==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',next);localStorage.setItem('3mi_theme',next);}

/* ─── LOGIN MODAL ─── */
function openLoginModal(){
  $('loginModal')?.classList.add('open');
  $('loginOverlay')?.classList.add('open');
  const errEl=$('loginError');if(errEl)errEl.textContent='';
  setTimeout(()=>$('loginEmail')?.focus(),80);
}
function closeLoginModal(){$('loginModal')?.classList.remove('open');$('loginOverlay')?.classList.remove('open');}

/* KEY FIX: doLogin is a standalone function called by both button click and Enter key */
async function doLogin(){
if(!FB){
  showToast('Connecting... please wait 1-2 seconds','info');
  return;
}

  const { auth, signInWithEmailAndPassword } = FB;

  const email = ($('loginEmail')?.value || '').trim();
  const pw = $('loginPassword')?.value || '';
  const errEl = $('loginError');
  const btn = $('loginBtn');

  if(!email || !pw){
    if(errEl) errEl.textContent = 'Please enter email and password.';
    return;
  }

  if(errEl) errEl.textContent = '';
  if(btn){ btn.disabled = true; btn.textContent = 'Signing in…'; }

  try{
    await signInWithEmailAndPassword(auth, email, pw);

    closeLoginModal();
    showToast('Login successful! Redirecting…','success');
    setTimeout(()=>window.location.href='admin.html',700);

  }catch(e){
    let msg='Login failed. Check your credentials.';
    if(e.code==='auth/invalid-email') msg='Invalid email format.';
    if(e.code==='auth/user-not-found') msg='No account with this email.';
    if(e.code==='auth/wrong-password') msg='Incorrect password.';
    if(e.code==='auth/invalid-credential') msg='Incorrect email or password.';
    if(e.code==='auth/too-many-requests') msg='Too many attempts. Try later.';
    if(e.code==='auth/network-request-failed') msg='Network error. Check connection.';
    if(errEl) errEl.textContent = msg;

  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Sign In'; }
  }
}


/* ─── FIREBASE READY ─── */
document.addEventListener('firebaseReady',()=>{
  FB=window.__firebase;
  const {auth,db,onAuthStateChanged,collection,doc,onSnapshot,query,orderBy}=FB;

  /* Auth state — update admin button */
  onAuthStateChanged(auth,user=>{
    currentUser=user;
    const btn=$('adminLoginBtn');
    if(!btn)return;
    /* Remove old listener by cloning, then set new one */
    const newBtn=btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn,btn);
    if(user){
      newBtn.style.display='inline-flex'; // Show for logged-in admin
      newBtn.title='Go to Admin Dashboard';
      newBtn.addEventListener('click',()=>window.location.href='admin.html');
    }else{
      newBtn.style.display='none'; // Hide from regular users
    }
  });

  /* Real-time products */
  try{
    const pQuery=query(collection(db,'products'),orderBy('createdAt','desc'));
    onSnapshot(pQuery,snap=>{
      products=snap.docs.map(d=>({id:d.id,...d.data()}));
      renderCategoryChips(); renderProducts(); updateCartBadge();
    },err=>console.warn('Products error:',err.message));
  }catch(err){console.warn('Firestore error:',err.message);}

  /* Settings */
  try{onSnapshot(doc(db,'config','settings'),snap=>{if(snap.exists())applySettings(snap.data());});}catch{}

  /* Social */
  try{onSnapshot(doc(db,'config','social'),snap=>{if(snap.exists()){socialLinks=snap.data();renderSocialSection();renderFooterSocial();}});}catch{}
});

/* ─── DOM READY ─── */
document.addEventListener('DOMContentLoaded',()=>{
  // Handle hero live preview from admin
  const params=new URLSearchParams(window.location.search);
  if(params.get('preview')==='hero'){
    const preview=JSON.parse(localStorage.getItem('heroPreview')||'{}');
    if(preview.eyebrow) $('heroEyebrow').textContent=preview.eyebrow;
    if(preview.title) $('heroTitleAccent').textContent=preview.title;
    if(preview.subtitle) $('heroSubtitle').textContent=preview.subtitle;
    if(preview.bgColor) $('heroSection').style.background=preview.bgColor;
    if(preview.accentColor) document.documentElement.style.setProperty('--accent',preview.accentColor);
    if(preview.btnText){
      const btn=$('heroSection .btn-primary');
      if(btn) btn.textContent=preview.btnText+' ↓';
    }
    if(preview.showStats && preview.stats){
      const hstats=$('heroStats');
      if(hstats){
        hstats.innerHTML=preview.stats.map(st=>`<div class="hero-stat"><div class="hero-stat-num">${escHtml(st.num||'')}</div><div class="hero-stat-label">${escHtml(st.label||'')}</div></div>`).join('');
      }
    }
    showToast('👁 Hero preview active (admin only)','info');
  }

  initTheme(); loadCart(); updateCartBadge(); renderProducts();

  $('themeToggle')?.addEventListener('click',toggleTheme);

  /* Cart */
  $('cartToggleBtn')?.addEventListener('click',()=>{$('cartDrawer')?.classList.add('open');$('cartOverlay')?.classList.add('open');renderCartItems();});
  $('cartCloseBtn')?.addEventListener('click',()=>{$('cartDrawer')?.classList.remove('open');$('cartOverlay')?.classList.remove('open');});
  $('cartOverlay')?.addEventListener('click',()=>{$('cartDrawer')?.classList.remove('open');$('cartOverlay')?.classList.remove('open');});
  $('waCheckoutBtn')?.addEventListener('click',waCheckout);

  /* Product detail */
  $('productDetailClose')?.addEventListener('click',()=>{
    $('productDetailModal')?.classList.remove('open');
    $('productDetailOverlay')?.classList.remove('open');

    history.pushState(
      null,
      "",
      window.location.pathname
    );
  });
  $('productDetailOverlay')?.addEventListener('click',()=>{
    $('productDetailModal')?.classList.remove('open');
    $('productDetailOverlay')?.classList.remove('open');

    history.pushState(
      null,
      "",
      window.location.pathname
    );
  });

  /* Login — default handler before Firebase loads */
  $('adminLoginBtn')?.addEventListener('click',openLoginModal);
  $('loginCancelBtn')?.addEventListener('click',closeLoginModal);
  $('loginOverlay')?.addEventListener('click',closeLoginModal);

  /* Password toggle */
  $('pwToggle')?.addEventListener('click',function(){
    const inp=$('loginPassword');if(!inp)return;
    inp.type=inp.type==='password'?'text':'password';
    this.textContent=inp.type==='password'?'👁':'🙈';
  });

  /* LOGIN BUTTON — calls doLogin() which checks FB inside */
  $('loginBtn')?.addEventListener('click', doLogin);
  $('loginPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  $('loginEmail')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('loginPassword')?.focus();});

  /* Search */
  $('searchInput')?.addEventListener('input',()=>{searchQuery=$('searchInput').value.trim().toLowerCase();renderProducts();});

  /* Filters */
  $('categoryChips')?.addEventListener('click',e=>{const btn=e.target.closest('.chip');if(!btn)return;currentFilter=btn.dataset.filter;document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));btn.classList.add('active');renderProducts();});
  document.getElementById('typeChips')?.addEventListener('click',e=>{const btn=e.target.closest('.type-chip');if(!btn)return;currentType=btn.dataset.type;document.querySelectorAll('.type-chip').forEach(c=>c.classList.remove('active'));btn.classList.add('active');renderProducts();});
  $('sortSelect')?.addEventListener('change',()=>{currentSort=$('sortSelect').value;renderProducts();});

  /* Escape */
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('cartDrawer')?.classList.remove('open');$('cartOverlay')?.classList.remove('open');$('productDetailModal')?.classList.remove('open');$('productDetailOverlay')?.classList.remove('open');closeLoginModal();}});

  /* Scroll shadow */
  window.addEventListener('scroll',()=>{const h=$('siteHeader');if(h)h.style.boxShadow=window.scrollY>10?'0 4px 20px rgba(0,0,0,.12)':'none';},{passive:true});

  /* Loading screen */
  setTimeout(()=>$('loadingScreen')?.classList.add('done'),1200);
});

/* Auto-open product from shared link */
window.addEventListener('load',()=>{

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');

  if(!productId) return;

  const waitForProduct = setInterval(()=>{

    const product = products.find(
      p => String(p.id) === String(productId)
    );

    if(product){
      clearInterval(waitForProduct);
      openProductDetail(productId);
    }

  },300);

});

window.shareProduct=(id)=>{

  const url =
    `${window.location.origin}${window.location.pathname}?product=${encodeURIComponent(id)}`;

  navigator.clipboard.writeText(url);

  showToast('Product link copied!');
};
