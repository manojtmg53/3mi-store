/* ═══════════════════════════════════════════════════════════
   3mi Store v2 — admin.js
   Full admin: products, settings, social, hero, appearance
═══════════════════════════════════════════════════════════ */
'use strict';

const $ = id => document.getElementById(id);
const fmtRs = n => 'Rs. ' + Math.round(n).toLocaleString('en-IN');
const finalPrice = (p,d) => Math.round(p*(1-(d||0)/100));
const escHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const TYPE_COLORS = {New:'#2563eb',Sale:'#e63950',Hot:'#d97706',Featured:'#7c3aed',Limited:'#0891b2'};
const PLACEHOLDERS = ['🛍️','👟','📱','👗','💄','🎒','⌚','🧴','🎧','📦','🎁','🏷️'];
const ph = id => PLACEHOLDERS[Math.abs((id||'x').charCodeAt(0)+(id||'x').charCodeAt(1))%PLACEHOLDERS.length];

let FB, products=[], settings={}, socialLinks={}, heroSettings={}, statsRows=[], editingId=null;
let adminSearchQ='', adminCatFilter='', adminTypeFilter='';

function showToast(msg,type='info'){
  const c=$('toastContainer');if(!c)return;
  const t=document.createElement('div');t.className=`toast ${type}`;
  t.innerHTML=`<span class="toast-dot"></span>${escHtml(msg)}`;
  c.appendChild(t);
  setTimeout(()=>{t.classList.add('removing');setTimeout(()=>t.remove(),300);},2800);
}

/* ─── PANEL SWITCHING ─── */
function switchPanel(name){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const panel=$(`panel-${name}`);
  if(panel) panel.classList.add('active');
  const navBtn=document.querySelector(`.nav-item[data-panel="${name}"]`);
  if(navBtn) navBtn.classList.add('active');
  const title=$('topbarTitle');
  if(title) title.textContent={dashboard:'Dashboard',products:'Products',addProduct:'Add Product',
    storeSettings:'Store Settings',socialLinks:'Social Links',heroSettings:'Hero / Banner',
    appearance:'Appearance'}[name]||name;
  if(name==='products') renderProductTable();
  if(name==='dashboard') renderDashboard();
}
window.switchPanel=switchPanel;

/* ─── DASHBOARD ─── */
function renderDashboard(){
  const cats=new Set(products.map(p=>p.category).filter(Boolean));
  const $s=n=>document.getElementById(n);
  const sp=$s('statProducts');if(sp)sp.textContent=products.length;
  const sc=$s('statCategories');if(sc)sc.textContent=cats.size;
  const sd=$s('statDiscounted');if(sd)sd.textContent=products.filter(p=>(p.discount||0)>0).length;
  const sf=$s('statFeatured');if(sf)sf.textContent=products.filter(p=>p.featured).length;
  const rpl=$s('recentProductsList');if(rpl){
    rpl.innerHTML=products.slice(0,6).map(p=>{
      const img=(p.images&&p.images[0])?`<img src="${escHtml(p.images[0])}" alt="" onerror="this.style.display='none'">`:ph(p.id);
      return `<div class="mini-product-item">
        <div class="mini-img">${img}</div>
        <span class="mini-product-name">${escHtml(p.name)}</span>
        <span class="mini-product-price">${fmtRs(finalPrice(p.originalPrice,p.discount||0))}</span>
      </div>`;
    }).join('')||'<p style="color:var(--adm-muted);font-size:.85rem">No products yet.</p>';
  }
}

/* ─── PRODUCT TABLE ─── */
function renderProductTable(){
  const body=$('tableBody');if(!body)return;
  let list=products;
  if(adminSearchQ) list=list.filter(p=>(p.name||'').toLowerCase().includes(adminSearchQ)||
    (p.category||'').toLowerCase().includes(adminSearchQ));
  if(adminCatFilter) list=list.filter(p=>(p.category||'')=== adminCatFilter);
  if(adminTypeFilter) list=list.filter(p=>(p.type||'')=== adminTypeFilter);

  if(!list.length){
    body.innerHTML=`<div style="padding:30px;text-align:center;color:var(--adm-muted)">No products found.</div>`;
    return;
  }
  body.innerHTML=list.map(p=>{
    const fp=finalPrice(p.originalPrice,p.discount||0);
    const imgEl=(p.images&&p.images[0])?`<img src="${escHtml(p.images[0])}" alt="" onerror="this.style.display='none'">`:ph(p.id);
    const typeColor=TYPE_COLORS[p.type]||'#666';
    const stockTxt = p.inStock===false?'<span style="color:var(--accent)">Out</span>'
      :(p.stock?p.stock:'∞');
    const visIcon=p.visible===false?'🙈':'👁';
    return `<div class="table-row">
      <div class="table-img">${imgEl}</div>
      <div><div class="table-name">${escHtml(p.name)}</div>
        ${p.brand?`<div style="font-size:.74rem;color:var(--adm-muted)">${escHtml(p.brand)}</div>`:''}</div>
      <div class="table-cat">${escHtml(p.category||'-')}</div>
      <div><span class="table-type-badge" style="background:${typeColor};color:#fff">${p.type||'New'}</span></div>
      <div class="table-price">${fmtRs(fp)}${(p.discount&&p.discount>0)?`<br><small style="color:var(--adm-muted);font-weight:400;text-decoration:line-through">${fmtRs(p.originalPrice)}</small>`:''}</div>
      <div class="table-stock">${stockTxt}</div>
      <div class="table-actions">
        <button class="tbl-btn edit" title="Edit" onclick="startEdit('${p.id}')">✏️</button>
        <button class="tbl-btn toggle" title="Toggle visibility" onclick="toggleVisible('${p.id}',${p.visible!==false})">${visIcon}</button>
        <button class="tbl-btn del" title="Delete" onclick="confirmDelete('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');

  // Update category filter options
  const cf=$('adminCatFilter');
  if(cf){
    const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
    cf.innerHTML=`<option value="">All Categories</option>`+cats.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
    if(adminCatFilter) cf.value=adminCatFilter;
  }
}
window.startEdit=function(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  editingId=id;
  $('adminEditId').value=id;
  $('apName').value=p.name||'';
  $('apCategory').value=p.category||'';
  $('apBrand').value=p.brand||'';
  $('apType').value=p.type||'New';
  $('apShortDesc').value=p.shortDesc||'';
  $('apDesc').value=p.desc||'';
  $('apOriginalPrice').value=p.originalPrice||'';
  $('apDiscount').value=p.discount||0;
  $('apStock').value=p.stock||'';
  $('apSku').value=p.sku||'';
  $('apWeight').value=p.weight||'';
  $('apImage1').value=(p.images&&p.images[0])||p.image||'';
  $('apImage2').value=(p.images&&p.images[1])||'';
  $('apImage3').value=(p.images&&p.images[2])||'';
  $('apSizes').value=(p.sizes||[]).join(', ');
  $('apColors').value=(p.colors||[]).join(', ');
  $('apMaterial').value=p.material||'';
  $('apFeatured').checked=!!p.featured;
  $('apInStock').checked=p.inStock!==false;
  $('apVisible').checked=p.visible!==false;
  $('apFreeShipping').checked=!!p.freeShipping;
  $('apBadge').value=p.badge||'';
  $('apTags').value=(p.tags||[]).join(', ');
  updateCalcDisplay();
  // Rebuild spec rows
  const sr=$('specRows');if(sr){
    sr.innerHTML='';
    if(p.specs) Object.entries(p.specs).forEach(([k,v])=>addSpecRow(k,v));
  }
  updateImagePreviews();
  $('productPanelTitle').textContent='Edit Product';
  $('cancelEditBtnAdmin').style.display='inline-flex';
  $('apSubmitBtn').textContent='✓ Update Product';
  switchPanel('addProduct');
};
window.cancelEdit=function(){
  editingId=null;
  $('adminProductForm').reset();
  $('adminEditId').value='';
  $('productPanelTitle').textContent='Add New Product';
  $('cancelEditBtnAdmin').style.display='none';
  $('apSubmitBtn').textContent='✓ Save Product';
  $('specRows').innerHTML='';
  updateCalcDisplay();
  updateImagePreviews();
};
window.confirmDelete=async function(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  if(!confirm(`Delete "${p.name}"? This cannot be undone.`))return;
  try{
    await FB.deleteDoc(FB.doc(FB.db,'products',id));
    showToast(`"${p.name}" deleted`,'info');
  }catch(e){showToast('Delete failed','error');}
};
window.toggleVisible=async function(id,currentlyVisible){
  try{
    await FB.updateDoc(FB.doc(FB.db,'products',id),{visible:!currentlyVisible});
    showToast(currentlyVisible?'Product hidden':'Product visible','info');
  }catch(e){showToast('Update failed','error');}
};

function resetProductForm(){window.cancelEdit();}
window.resetProductForm=resetProductForm;

/* ─── PRODUCT FORM ─── */
function updateCalcDisplay(){
  const orig=parseFloat($('apOriginalPrice')?.value||0);
  const disc=parseFloat($('apDiscount')?.value||0);
  const el=$('apCalcDisplay');if(!el)return;
  if(orig>0){
    const fp=finalPrice(orig,disc);
    el.textContent=fmtRs(fp)+(disc>0?` (Save ${fmtRs(orig-fp)})`:'');
  }else el.textContent='Rs. —';
}
function updateImagePreviews(){
  const el=$('adminImgPreviews');if(!el)return;
  const urls=[$('apImage1')?.value,$('apImage2')?.value,$('apImage3')?.value].filter(Boolean);
  el.innerHTML=urls.map(u=>`<div class="img-preview-thumb"><img src="${escHtml(u)}" alt="" onerror="this.innerHTML='❌'"></div>`).join('')
    +(urls.length<3?`<div class="img-preview-thumb empty">+ More</div>`:'');
}
function updateCatSuggestions(){
  const dl=$('adminCatSuggestions');if(!dl)return;
  const cats=[...new Set(products.map(p=>p.category).filter(Boolean))];
  dl.innerHTML=cats.map(c=>`<option value="${escHtml(c)}">`).join('');
}
function addSpecRow(key='',val=''){
  const sr=$('specRows');if(!sr)return;
  const row=document.createElement('div');row.className='spec-row';
  row.innerHTML=`<input type="text" placeholder="Key (e.g. Material)" value="${escHtml(key)}">
    <input type="text" placeholder="Value (e.g. Cotton)" value="${escHtml(val)}">
    <button type="button" class="spec-remove" onclick="this.parentElement.remove()">✕</button>`;
  sr.appendChild(row);
}

$('apOriginalPrice')?.addEventListener('input',updateCalcDisplay);
$('apDiscount')?.addEventListener('input',updateCalcDisplay);
$('apImage1')?.addEventListener('input',updateImagePreviews);
$('apImage2')?.addEventListener('input',updateImagePreviews);
$('apImage3')?.addEventListener('input',updateImagePreviews);
$('addSpecBtn')?.addEventListener('click',()=>addSpecRow());

// Image file → base64
$('apImageFile')?.addEventListener('change',()=>{
  const file=$('apImageFile').files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const b64=e.target.result;
    // Put in image1 field if empty
    if(!$('apImage1').value) $('apImage1').value=b64;
    else if(!$('apImage2').value) $('apImage2').value=b64;
    updateImagePreviews();
    showToast('Image loaded','success');
  };
  reader.readAsDataURL(file);
});

$('adminProductForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('apName').value.trim();
  const cat=$('apCategory').value.trim();
  const orig=parseFloat($('apOriginalPrice').value);
  if(!name){showToast('Product name is required','error');$('apName').focus();return;}
  if(!cat){showToast('Category is required','error');$('apCategory').focus();return;}
  if(!orig||orig<=0){showToast('Enter a valid price','error');$('apOriginalPrice').focus();return;}

  const imgs=[$('apImage1').value.trim(),$('apImage2').value.trim(),$('apImage3').value.trim()].filter(Boolean);
  const specs={};
  document.querySelectorAll('#specRows .spec-row').forEach(row=>{
    const [kIn,vIn]=row.querySelectorAll('input');
    const k=kIn.value.trim(),v=vIn.value.trim();
    if(k&&v) specs[k]=v;
  });
  const productData={
    name, category:cat,
    brand:$('apBrand').value.trim()||null,
    type:$('apType').value,
    shortDesc:$('apShortDesc').value.trim()||null,
    desc:$('apDesc').value.trim()||null,
    originalPrice:Math.round(orig),
    discount:Math.min(100,Math.max(0,parseFloat($('apDiscount').value)||0)),
    stock:$('apStock').value?parseInt($('apStock').value):null,
    sku:$('apSku').value.trim()||null,
    weight:$('apWeight').value?parseFloat($('apWeight').value):null,
    images:imgs,
    image:imgs[0]||null,
    sizes:$('apSizes').value?$('apSizes').value.split(',').map(s=>s.trim()).filter(Boolean):[],
    colors:$('apColors').value?$('apColors').value.split(',').map(s=>s.trim()).filter(Boolean):[],
    material:$('apMaterial').value.trim()||null,
    specs:Object.keys(specs).length?specs:null,
    featured:$('apFeatured').checked,
    inStock:$('apInStock').checked,
    visible:$('apVisible').checked,
    freeShipping:$('apFreeShipping').checked,
    badge:$('apBadge').value.trim()||null,
    tags:$('apTags').value?$('apTags').value.split(',').map(t=>t.trim()).filter(Boolean):[],
    updatedAt:FB.serverTimestamp(),
  };

  try{
    if(editingId){
      await FB.updateDoc(FB.doc(FB.db,'products',editingId),productData);
      showToast(`"${name}" updated!`,'success');
    }else{
      productData.createdAt=FB.serverTimestamp();
      await FB.addDoc(FB.collection(FB.db,'products'),productData);
      showToast(`"${name}" added!`,'success');
    }
    cancelEdit();
    switchPanel('products');
  }catch(err){showToast('Save failed: '+err.message,'error');}
});

/* ─── SETTINGS ─── */
function loadSettingsIntoForm(s){
  $('sStoreName').value=s.storeName||'';
  $('sTagline').value=s.tagline||'';
  $('sLogoUrl').value=s.logoUrl||'';
  $('sCopyright').value=s.copyright||'';
  $('sWhatsapp').value=s.whatsapp||'';
  $('sPhone').value=s.phone||'';
  $('sEmail').value=s.email||'';
  $('sAddress').value=s.address||'';
  $('sAnnouncementEnabled').checked=!!s.announcementEnabled;
  $('sAnnouncementText').value=s.announcementText||'';
  $('sAnnouncementColor').value=s.announcementColor||'#e63950';
  $('sDeliveryAreas').value=s.deliveryAreas||'';
  $('sDeliveryTime').value=s.deliveryTime||'';
  $('sFreeDeliveryMin').value=s.freeDeliveryMin||'';
  $('sDeliveryCharge').value=s.deliveryCharge||'';
  // Hero
  $('hEyebrow').value=s.heroEyebrow||'';
  $('hTitle').value=s.heroTitle||'';
  $('hSubtitle').value=s.heroSubtitle||'';
  $('hBtnText').value=s.heroBtnText||'Shop Now';
  $('hBtn2Text').value=s.heroBtn2Text||'';
  $('hBtn2Link').value=s.heroBtn2Link||'';
  $('hBgColor').value=s.heroBgColor||'#0f0e0d';
  $('hAccentColor').value=s.accentColor||'#e63950';
  $('hShowStats').checked=!!s.showStats;
  // Appearance
  $('aAccent').value=s.accentColor||'#e63950';
  $('aFooterBg').value=s.footerBg||'#0f0e0d';
  // Stats
  buildStatsEditor(s.stats||[]);
}

async function saveSetting(partial){
  try{
    await FB.setDoc(FB.doc(FB.db,'config','settings'),{...settings,...partial},{merge:true});
    showToast('Saved!','success');
  }catch(e){showToast('Save failed','error');}
}

$('saveIdentityBtn')?.addEventListener('click',()=>saveSetting({
  storeName:$('sStoreName').value.trim(),tagline:$('sTagline').value.trim(),
  logoUrl:$('sLogoUrl').value.trim(),copyright:$('sCopyright').value.trim(),
}));
$('saveContactBtn')?.addEventListener('click',()=>saveSetting({
  whatsapp:$('sWhatsapp').value.trim().replace(/\D/g,''),
  phone:$('sPhone').value.trim(),email:$('sEmail').value.trim(),address:$('sAddress').value.trim(),
}));
$('saveAnnouncementBtn')?.addEventListener('click',()=>saveSetting({
  announcementEnabled:$('sAnnouncementEnabled').checked,
  announcementText:$('sAnnouncementText').value.trim(),
  announcementColor:$('sAnnouncementColor').value,
}));
$('saveShippingBtn')?.addEventListener('click',()=>saveSetting({
  deliveryAreas:$('sDeliveryAreas').value.trim(),deliveryTime:$('sDeliveryTime').value.trim(),
  freeDeliveryMin:$('sFreeDeliveryMin').value?parseFloat($('sFreeDeliveryMin').value):null,
  deliveryCharge:$('sDeliveryCharge').value?parseFloat($('sDeliveryCharge').value):null,
}));
$('saveHeroBtn')?.addEventListener('click',()=>saveSetting({
  heroEyebrow:$('hEyebrow').value.trim(),heroTitle:$('hTitle').value.trim(),
  heroSubtitle:$('hSubtitle').value.trim(),heroBtnText:$('hBtnText').value.trim(),
  heroBtn2Text:$('hBtn2Text').value.trim(),heroBtn2Link:$('hBtn2Link').value.trim(),
  heroBgColor:$('hBgColor').value,accentColor:$('hAccentColor').value,
}));
$('saveStatsBtn')?.addEventListener('click',()=>{
  const rows=document.querySelectorAll('#statsEditor .stat-editor-row');
  const stats=[...rows].map(r=>{const ins=[...r.querySelectorAll('input')];return{num:ins[0]?.value.trim()||'',label:ins[1]?.value.trim()||''};}).filter(s=>s.num||s.label);
  saveSetting({showStats:$('hShowStats').checked,stats});
});
$('addStatBtn')?.addEventListener('click',()=>addStatRow());
$('saveColorsBtn')?.addEventListener('click',()=>saveSetting({accentColor:$('aAccent').value,footerBg:$('aFooterBg').value}));
$('saveFontsBtn')?.addEventListener('click',()=>saveSetting({headingFont:$('aHeadingFont').value,bodyFont:$('aBodyFont').value}));
$('saveLayoutBtn')?.addEventListener('click',()=>saveSetting({cardStyle:$('aCardStyle').value,gridCols:$('aGridCols').value}));

function buildStatsEditor(stats){
  const el=$('statsEditor');if(!el)return;
  el.innerHTML='';
  (stats.length?stats:[{num:'',label:''}]).forEach(s=>addStatRow(s.num,s.label));
}
function addStatRow(num='',label=''){
  const el=$('statsEditor');if(!el)return;
  const row=document.createElement('div');row.className='stat-editor-row';
  row.innerHTML=`<input type="text" placeholder="e.g. 500+" value="${escHtml(num)}">
    <input type="text" placeholder="Label e.g. Products" value="${escHtml(label)}">
    <button type="button" class="spec-remove" onclick="this.parentElement.remove()">✕</button>`;
  el.appendChild(row);
}

/* ─── SOCIAL LINKS ─── */
function loadSocialIntoForm(data){
  document.querySelectorAll('.social-item-editor').forEach(item=>{
    const platform=item.dataset.platform;
    const d=data[platform]||{};
    const urlInput=item.querySelector('input[data-field="url"]');
    const enabledInput=item.querySelector('input[data-field="enabled"]');
    if(urlInput) urlInput.value=d.url||'';
    if(enabledInput) enabledInput.checked=!!d.enabled;
  });
  $('socialSectionLabel').value=data._label||'Find us on';
}
$('saveSocialBtn')?.addEventListener('click',async()=>{
  const data={_label:$('socialSectionLabel').value.trim()||'Find us on'};
  document.querySelectorAll('.social-item-editor').forEach(item=>{
    const platform=item.dataset.platform;
    const urlInput=item.querySelector('input[data-field="url"]');
    const enabledInput=item.querySelector('input[data-field="enabled"]');
    data[platform]={url:(urlInput?.value||'').trim(),enabled:!!(enabledInput?.checked)};
  });
  try{
    await FB.setDoc(FB.doc(FB.db,'config','social'),data);
    showToast('Social links saved!','success');
  }catch(e){showToast('Save failed','error');}
});

/* ─── SIDEBAR & PANEL NAV ─── */
document.querySelectorAll('.nav-item[data-panel]').forEach(btn=>{
  btn.addEventListener('click',()=>switchPanel(btn.dataset.panel));
});
$('sidebarToggle')?.addEventListener('click',()=>{
  const sb=$('adminSidebar'),main=document.querySelector('.admin-main');
  sb.classList.toggle('open');
  sb.classList.toggle('collapsed');
});

/* ─── SEARCH/FILTER ─── */
$('adminSearch')?.addEventListener('input',()=>{
  adminSearchQ=$('adminSearch').value.trim().toLowerCase();
  renderProductTable();
});
$('adminCatFilter')?.addEventListener('change',()=>{
  adminCatFilter=$('adminCatFilter').value;
  renderProductTable();
});
$('adminTypeFilter')?.addEventListener('change',()=>{
  adminTypeFilter=$('adminTypeFilter').value;
  renderProductTable();
});

/* ─── AUTH ─── */
function showAdmin(user){
  $('authGate').style.display='none';
  $('adminLayout').style.display='flex';
  const tu=$('topbarUser');if(tu)tu.textContent=user.email;
  const ls=$('loadingScreen');if(ls)ls.classList.add('done');
  switchPanel('dashboard');
}
function showAuthGate(){
  $('authGate').style.display='flex';
  $('adminLayout').style.display='none';
  const ls=$('loadingScreen');if(ls)ls.classList.add('done');
}

$('gateLoginBtn')?.addEventListener('click',async()=>{
  const email=$('gateEmail').value.trim(),pw=$('gatePassword').value;
  const err=$('gateError');
  if(!email||!pw){if(err)err.textContent='Enter email and password';return;}
  if(err)err.textContent='';
  try{
    await FB.signInWithEmailAndPassword(FB.auth,email,pw);
  }catch(e){
    if(err)err.textContent='Invalid email or password';
  }
});
$('gatePassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('gateLoginBtn').click();});
$('gatePwToggle')?.addEventListener('click',function(){
  const inp=$('gatePassword');if(!inp)return;
  inp.type=inp.type==='password'?'text':'password';
  this.textContent=inp.type==='password'?'👁':'🙈';
});
$('logoutBtn')?.addEventListener('click',async()=>{
  await FB.signOut(FB.auth);
  window.location.href='index.html';
});

/* ─── FIREBASE INIT ─── */
document.addEventListener('firebaseReady',()=>{
  FB=window.__firebase;
  const {auth,db,onAuthStateChanged,collection,doc,onSnapshot,query,orderBy,setDoc,addDoc,updateDoc,deleteDoc}=FB;

  onAuthStateChanged(auth,user=>{
    if(user) showAdmin(user);
    else showAuthGate();
  });

  // Real-time products
  const pQuery=query(collection(db,'products'),orderBy('createdAt','desc'));
  onSnapshot(pQuery,snap=>{
    products=snap.docs.map(d=>({id:d.id,...d.data()}));
    updateCatSuggestions();
    renderDashboard();
    if(document.querySelector('#panel-products.active')) renderProductTable();
  });

  // Settings real-time
  onSnapshot(doc(db,'config','settings'),snap=>{
    if(snap.exists()){settings=snap.data();loadSettingsIntoForm(settings);}
  });

  // Social real-time
  onSnapshot(doc(db,'config','social'),snap=>{
    if(snap.exists()){socialLinks=snap.data();loadSocialIntoForm(socialLinks);}
  });
});
