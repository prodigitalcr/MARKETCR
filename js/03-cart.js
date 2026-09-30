/* ---------- carrito (clave = id del producto, o "id::idVariante" si el producto tiene variantes) ---------- */
function cartKey(id, variantId){ return variantId ? (id + '::' + variantId) : id; }
function cartLineInfo(key){
  const parts = key.split('::');
  const p = products.find(x=>x.id===parts[0]);
  if(!p) return null;
  const variant = parts[1] ? (p.variants||[]).find(v=>v.id===parts[1]) : null;
  if(parts[1] && !variant) return null;
  const unitPrice = variant ? variant.price : p.price;
  const unitStock = p.unlimited ? Infinity : (variant ? variant.stock : p.stock);
  const label = p.name + (variant ? ' (' + variant.name + ')' : '');
  return { p, variant, unitPrice, unitStock, label };
}
function addToCart(id, variantId, qty){
  qty = Math.max(1, Math.round(qty||1));
  const key = cartKey(id, variantId);
  const info = cartLineInfo(key);
  if(!info) return;
  const cur = cart[key]||0;
  const next = cur + qty;
  if(info.unitStock !== Infinity && next > info.unitStock){
    toast('Solo hay ' + info.unitStock + ' unidades disponibles de ' + info.label, 'err');
    cart[key] = info.unitStock;
    updateCartUI();
    return;
  }
  cart[key] = next;
  updateCartUI();
  toast((qty>1 ? qty + '× ' : '') + info.label + ' agregado al pedido', 'ok');
}
function setQty(key, qty){
  const info = cartLineInfo(key);
  if(qty <= 0){ delete cart[key]; }
  else {
    if(info && info.unitStock !== Infinity && qty > info.unitStock){ toast('Stock máximo: ' + info.unitStock, 'err'); qty = info.unitStock; }
    cart[key] = qty;
  }
  updateCartUI();
}
function clearCart(){ cart = {}; updateCartUI(); }

function cartTotals(){
  let sub = 0, count = 0;
  for(const key in cart){
    const info = cartLineInfo(key);
    if(!info) continue;
    sub += info.unitPrice * cart[key]; count += cart[key];
  }
  const discountPercent = Math.max(0, Math.min(100, settings.globalDiscountPercent || 0));
  const discountAmt = Math.round(sub * discountPercent / 100);
  const discountedSub = sub - discountAmt;
  const iva = Math.round(discountedSub * (settings.iva||0) / 100);
  return { sub, discountAmt, discountPercent, discountedSub, iva, total: discountedSub + iva, count };
}

function updateCartUI(){
  const t = cartTotals();
  const badge = document.getElementById('cartBadge');
  badge.style.display = t.count ? 'flex' : 'none';
  badge.textContent = t.count;
  document.getElementById('cartSub').textContent = fmt(t.sub);
  var ivaPctLbl = document.getElementById('cartIvaLabel');
  if(ivaPctLbl) ivaPctLbl.textContent = 'IVA (' + (settings.iva||0) + '%)';
  document.getElementById('cartIva').textContent = fmt(t.iva);
  document.getElementById('cartTotal').textContent = fmt(t.total);
  document.getElementById('checkoutBtn').disabled = !t.count;

  const box = document.getElementById('cartItems');
  if(!t.count){
    box.innerHTML = '<div class="cart-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/></svg><br>' + 'Tu canasta está vacía.' + '<br>' + 'Agregá productos para empezar.' + '</div>';
    return;
  }
  box.innerHTML = Object.keys(cart).map(key => {
    const info = cartLineInfo(key);
    if(!info) return '';
    const p = info.p;
    const g = gradFor(p.id);
    const pimg = firstThumb(p) || (p.images && p.images[0]) || '';
    const thumb = pimg
      ? '<div class="ci-thumb ci-thumb-img" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')"><img src="' + esc(pimg) + '" alt="' + esc(info.label) + '" loading="lazy"></div>'
      : '<div class="ci-thumb" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + svgIcon(p.icon,30) + '</div>';
    return '<div class="ci">' +
      thumb +
      '<div class="ci-info"><div class="ci-name">' + esc(info.label) + '</div><div class="ci-price">' + fmt(info.unitPrice) + ' c/u</div></div>' +
      '<div class="ci-right">' +
        '<div class="qty-ctl"><button onclick="setQty(\'' + key + '\',' + (cart[key]-1) + ')">−</button><span>' + cart[key] + '</span><button onclick="setQty(\'' + key + '\',' + (cart[key]+1) + ')">+</button></div>' +
        '<div class="ci-total">' + fmt(info.unitPrice * cart[key]) + '</div>' +
        '<button class="ci-remove" onclick="setQty(\'' + key + '\',0)">quitar</button>' +
      '</div></div>';
  }).join('');
  renderCartRelated();
  if(typeof refreshCheckoutCardBtn === 'function') refreshCheckoutCardBtn();
}
function renderCartRelated(){
  const box = document.getElementById('cartRelatedWrap');
  const cartIds = Object.keys(cart).map(k=>k.split('::')[0]);
  if(!cartIds.length){ box.innerHTML = ''; return; }
  const cartCats = new Set(cartIds.map(id => { const p = products.find(x=>x.id===id); return p ? p.cat : null; }).filter(Boolean));
  let pool = products.filter(p => p.active!==false && !cartIds.includes(p.id) && cartCats.has(p.cat) && stockInfo(p).can);
  if(pool.length < 3) pool = products.filter(p => p.active!==false && !cartIds.includes(p.id) && stockInfo(p).can);
  const list = pool.slice(0,4);
  if(!list.length){ box.innerHTML = ''; return; }
  box.innerHTML = '<div class="cart-related"><h5>Completá tu pedido</h5><div class="related-strip">' +
    list.map(p => {
      const img = firstThumb(p);
      const g = gradFor(p.id);
      const media = img ? '<img src="' + esc(img) + '" alt="">' : svgIcon(p.icon, 34);
      return '<div class="rel-card" onclick="toggleCart(false);openProductView(\'' + p.id + '\')"><div class="ri" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + media + '</div>' +
        '<div class="rb"><div class="rn">' + esc(p.name) + '</div><div class="rp">' + displayPrice(p) + '</div></div></div>';
    }).join('') + '</div></div>';
}

function toggleCart(open){
  document.getElementById('cartDrawer').classList.toggle('open', open);
  document.getElementById('cartOverlay').classList.toggle('show', open);
}

/* ---------- checkout ---------- */
function selDelivery(input){
  document.getElementById('rcRetiro').classList.toggle('sel', input.value==='Retiro en tienda');
  document.getElementById('rcEnvio').classList.toggle('sel', input.value!=='Retiro en tienda');
}
function openCheckout(){
  if(!cartTotals().count) return;
  toggleCart(false);
  const t = cartTotals();
  document.getElementById('coSummary').innerHTML =
    Object.keys(cart).map(key => {
      const info = cartLineInfo(key);
      if(!info) return '';
      const pimg = firstThumb(info.p) || (info.p.images && info.p.images[0]) || '';
      const im = pimg ? '<img class="co-sum-img" src="' + esc(pimg) + '" alt="' + esc(info.label) + '" loading="lazy">' : '';
      return '<div class="sum-line sum-line-item"><span class="sum-left">' + im + '<span>' + cart[key] + ' × ' + esc(info.label) + '</span></span><b>' + fmt(info.unitPrice*cart[key]) + '</b></div>';
    }).join('') +
    '<div class="sum-line"><span>Subtotal</span><b>' + fmt(t.sub) + '</b></div>' +
    (t.discountAmt ? '<div class="sum-line" style="color:#B45309"><span>Descuento global (' + t.discountPercent + '%)</span><b>−' + fmt(t.discountAmt) + '</b></div>' : '') +
    '<div class="sum-line"><span>IVA (' + settings.iva + '%)</span><b>' + fmt(t.iva) + '</b></div>' +
    '<div class="sum-line grand"><span>Total a pagar</span><span>' + fmt(t.total) + '</span></div>';
  document.getElementById('coTitle').textContent = 'Datos para tu pedido';
  document.getElementById('coStep1').style.display = 'block';
  document.getElementById('coStep2').style.display = 'none';
  document.getElementById('checkoutModal').classList.add('show');
}
function closeCheckout(){
  document.getElementById('checkoutModal').classList.remove('show');
}

let lastOrder = null;
/* Pasos del rastreo estilo Uber Flash */
const UBER_STEPS = [
  {key:'recibido',   lbl:'Pedido recibido',   sub:'Tu factura fue generada'},
  {key:'confirmado', lbl:'Pago confirmado',   sub:'Verificamos tu comprobante SINPE'},
  {key:'preparando', lbl:'Preparando pedido', sub:'Estamos alistando tus plantas'},
  {key:'en_camino',  lbl:'En camino',         sub:'Tu pedido va hacia vos'},
  {key:'entregado',  lbl:'Entregado',         sub:'¡Disfrutá tus plantas!'}
];

/* Comprobante de pago local (obligatorio para pago SINPE) */
let checkoutProofDataUrl = '';
function onCheckoutProofChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  compressImageFile(file, 900, 0.75).then(dataUrl => {
    checkoutProofDataUrl = dataUrl;
    document.getElementById('checkoutProofPreview').innerHTML = '<img src="' + dataUrl + '" alt="Comprobante">';
    toast('Comprobante cargado ✓', 'ok');
  }).catch(()=> toast('No se pudo procesar la imagen', 'err'));
  input.value = '';
}
function clearCheckoutProof(){
  checkoutProofDataUrl = '';
  document.getElementById('checkoutProofPreview').innerHTML = '';
  toast('Comprobante quitado', 'ok');
}
function hasCheckoutProof(){
  return !!(checkoutProofDataUrl && checkoutProofDataUrl.length > 100);
}

async function submitOrder(){
  const order = await createOrderFromCart(true, 'local');
  if(order) showInvoice(order);
}

/* Número de factura en formato F-AAAAMMDD-##### (igual al de createOrderFromCart) */
function dateOrderNumber(){
  const n = new Date();
  return 'F-' + n.getFullYear() + String(n.getMonth()+1).padStart(2,'0') + String(n.getDate()).padStart(2,'0') + '-' + String(Date.now()).slice(-5);
}

/* Crea y guarda la factura a partir de los datos del carrito, la registra en
   Firestore y la deja en `lastOrder`. Devuelve la factura o null si falta algo.
   La usan tanto el pago local (SINPE) como el checkout con tarjeta (PayPal),
   de modo que el cobro PayPal SIEMPRE coincida con el total de la factura.
   requireProof: true para pago local (comprobante obligatorio → pedido en espera). */
async function createOrderFromCart(requireProof, payMethod){
  const name = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const address = document.getElementById('cAddress').value.trim();
  const notes = document.getElementById('cNotes').value.trim();
  const delivery = document.querySelector('input[name="delivery"]:checked').value;
  if(!name){ toast('Ingresá tu nombre completo', 'err'); return null; }
  if(!phone || waDigits(phone).length < 8){ toast('Ingresá un teléfono válido', 'err'); return null; }
  if(!address){ toast('Ingresá tu dirección o ubicación', 'err'); return null; }
  if(requireProof && !hasCheckoutProof()){
    toast('Adjuntá la foto de tu comprobante de pago (es obligatoria)', 'err');
    document.getElementById('checkoutProofInput') && null;
    return null;
  }

  const t = cartTotals();
  if(!t.count){ toast('Tu canasta está vacía', 'err'); return null; }

  const items = Object.keys(cart).map(key => {
    const info = cartLineInfo(key);
    return info ? { id:info.p.id, name:info.label, price:info.unitPrice, qty:cart[key], image: (info.p.images && info.p.images[0]) || '' } : null;
  }).filter(Boolean);

  const now = new Date();
  const num = 'F-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(Date.now()).slice(-5);
  const digits = waDigits(phone);
  const order = {
    number:num, date:now.toISOString(), createdAtMs: now.getTime(),
    customer:{ name, phone, email, address, delivery, notes },
    trackPhone4: digits.slice(-4),
    items, subtotal:t.sub, discountAmt:t.discountAmt||0, discountPercent:t.discountPercent||0, iva:t.iva, total:t.total,
    proofImage: requireProof ? checkoutProofDataUrl : '',
    payMethod: payMethod || (requireProof ? 'local' : ''),
    status: requireProof ? 'en_espera' : 'recibido',
    timeline:[{status: requireProof ? 'en_espera' : 'recibido', at: now.toISOString()}]
  };

  try{
    await ordersCol.doc(num).set(order);
  }catch(e){
    toast('No se pudo registrar el pedido. Intentá de nuevo.', 'err');
    console.error(e);
    return null;
  }
  lastOrder = order;
  markProductsAsOrdered(items.map(it=>it.id));
  /* Avisar al administrador (CallMeBot/WhatsApp) que llegó un pedido con pago local */
  try{ if(typeof cloudCall === 'function') cloudCall('notifyTenantNewOrder', { slug: TENANT_ID, order: { number: order.number, total: order.total, customer: order.customer, items: order.items } }).catch(function(){}); }catch(_e){}

  cart = {}; updateCartUI(); renderGrid();
  return order;
}

/* ---------- reseñas escritas por el cliente ---------- */
function getOrderedProducts(){
  try{ return JSON.parse(localStorage.getItem(tenantLS('orderedProducts'))||'[]'); }catch(e){ return []; }
}
function markProductsAsOrdered(ids){
  const cur = new Set(getOrderedProducts());
  ids.forEach(id => cur.add(id));
  try{ localStorage.setItem(tenantLS('orderedProducts'), JSON.stringify(Array.from(cur))); }catch(e){}
}
function toggleMobileMenu(){
  const drawer = document.getElementById('mobileDrawer');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  const btn = document.getElementById('mobileMenuBtn');
  const open = drawer.classList.toggle('open');
  if(backdrop) backdrop.classList.toggle('open', open);
  if(btn) btn.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('no-scroll', open);
}

let csrProductId = null, csrRating = 5, csrPhoto = '';
function openReviewForm(id){
  csrProductId = id; csrRating = 5; csrPhoto = '';
  document.getElementById('csrName').value = '';
  document.getElementById('csrText').value = '';
  document.getElementById('csrPhotoPreview').innerHTML = logoSVG;
  renderCsrStars();
  document.getElementById('reviewFormModal').classList.add('show');
}
function closeReviewForm(){ document.getElementById('reviewFormModal').classList.remove('show'); }
function renderCsrStars(){
  document.getElementById('csrStars').innerHTML = starPickerHTML('csr', csrRating).replace(/reviewField\('csr','rating',(\d)\)/g, 'csrPickRating($1)');
}
function csrPickRating(n){ csrRating = n; renderCsrStars(); }

/* ---------- Opinión de experiencia post-compra ---------- */
let expRating = 5, expOrderNumber = '';
function openExpOpinion(orderNumber){
  expOrderNumber = orderNumber || '';
  expRating = 5;
  document.getElementById('expStars').innerHTML = starPickerHTML('exp', 5);
  document.getElementById('expName').value = lastOrder && lastOrder.customer && lastOrder.customer.name ? lastOrder.customer.name : '';
  document.getElementById('expText').value = '';
  document.getElementById('expOpinionModal').classList.add('show');
}
function closeExpOpinion(){ document.getElementById('expOpinionModal').classList.remove('show'); }
function expPickRating(n){ expRating = n; var el = document.getElementById('expStars'); if(el) el.innerHTML = starPickerHTML('exp', n); }
async function submitExpOpinion(){
  const name = document.getElementById('expName').value.trim() || 'Cliente';
  const text = document.getElementById('expText').value.trim();
  try{
    /* Notificar al administrador por CallMeBot/WhatsApp */
    if(typeof cloudCall === 'function'){
      cloudCall('notifyTenantReview', { slug: TENANT_ID, review: { name: name, rating: expRating, text: text, orderNumber: expOrderNumber } }).catch(function(){});
    }
    /* Guardar la opinión en el documento del pedido (historial) */
    try{
      if(expOrderNumber){
        await ordersCol.doc(expOrderNumber).set({ experience: firebase.firestore.FieldValue.arrayUnion({ id: rid(), name: name, rating: expRating, text: text, date: new Date().toISOString() }) }, { merge: true });
      }
    }catch(_e){}
    closeExpOpinion();
    toast('¡Gracias por tu opinión! 😊', 'ok');
  }catch(e){ toast('No se pudo enviar tu opinión', 'err'); }
}
function onCsrPhotoChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  compressImageFile(file, 700, 0.72).then(dataUrl => {
    csrPhoto = dataUrl;
    document.getElementById('csrPhotoPreview').innerHTML = '<img src="' + dataUrl + '" alt="">';
  }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  input.value = '';
}
async function submitCustomerReview(){
  const name = document.getElementById('csrName').value.trim();
  const text = document.getElementById('csrText').value.trim();
  if(!name){ toast('Ingresá tu nombre', 'err'); return; }
  if(!csrProductId) return;
  const review = { id: rid(), name, rating: csrRating, text, photo: csrPhoto, verified:true, date: todayStr() };
  try{
    await productsCol.doc(csrProductId).update({ reviews: firebase.firestore.FieldValue.arrayUnion(review) });
    const p = products.find(x=>x.id===csrProductId);
    if(p){ p.reviews = (p.reviews||[]).concat([review]); if(pvCurrentId===csrProductId) renderPvReviews(p); }
    closeReviewForm();
    toast('¡Gracias por tu reseña!', 'ok');
  }catch(e){
    toast('No se pudo publicar tu reseña. Intentá de nuevo.', 'err');
    console.error(e);
  }
}

/* ---------- factura ---------- */
function invoiceHTML(order){
  const d = new Date(order.date);
  const fecha = d.toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'}) + ' ' + d.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
  const rows = order.items.map(it => {
    const prodImg = it.image ? '<img src="' + esc(it.image) + '" style="width:40px;height:40px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:8px">' : '';
    return '<tr><td>' + prodImg + esc(it.name) + '</td><td class="c">' + it.qty + '</td><td class="r">' + fmt(it.price) + '</td><td class="r">' + fmt(it.price*it.qty) + '</td></tr>';
  }).join('');
return '<div class="inv-head">' +
      (settings.logoUrl ? '<img class="inv-logo" src="' + esc(settings.logoUrl) + '" alt="Logo">' : '') +
      '<div><div class="store">' + esc(settings.storeName) + '</div><div class="meta">' + esc(settings.tagline) + '</div></div>' +
      '<div class="inv-num"><b>' + 'FACTURA' + ' ' + order.number + '</b><span>' + fecha + '</span></div>' +
    '</div>' +
    '<div class="inv-body">' +
      '<div class="inv-client"><b>' + 'Cliente:' + '</b> ' + esc(order.customer.name) + '<br>' +
      '<b>' + 'Teléfono:' + '</b> ' + esc(order.customer.phone) + (order.customer.email ? ' · <b>' + 'Correo:' + '</b> ' + esc(order.customer.email) : '') + '<br>' +
      '<b>' + 'Entrega:' + '</b> ' + esc(order.customer.delivery) + ' — ' + esc(order.customer.address) +
      (order.customer.notes ? '<br><b>' + 'Notas:' + '</b> ' + esc(order.customer.notes) : '') + '</div>' +
      '<table class="inv-table"><thead><tr><th>' + 'Producto' + '</th><th class="c">' + 'Cant.' + '</th><th class="r">' + 'Precio' + '</th><th class="r">' + 'Importe' + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="inv-totals">' +
        '<div class="row"><span>' + 'Subtotal' + '</span><span>' + fmt(order.subtotal) + '</span></div>' +
        (order.discountAmt ? '<div class="row" style="color:#B45309"><span>Descuento global (' + (order.discountPercent||0) + '%)</span><span>−' + fmt(order.discountAmt) + '</span></div>' : '') +
        '<div class="row"><span>' + 'IVA' + ' (' + settings.iva + '%)</span><span>' + fmt(order.iva) + '</span></div>' +
        '<div class="row tt"><span>' + 'TOTAL' + '</span><span>' + fmt(order.total) + '</span></div>' +
        '<div class="row" id="invUsdRow" style="color:var(--blue);font-size:12px"><span>Equivalente USD (BCCR)</span><span id="invUsd">…</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="sinpe-box">' +
      '<div class="lbl">' + 'Pago por' + ' ' + esc(payMethodLabel()) + '</div>' +
      '<div class="num">' + esc(settings.sinpe) + '</div>' +
      '<div class="amt">Monto exacto: ' + fmt(order.total) + ' · A nombre de ' + esc(settings.storeName) + '</div>' +
      '<div class="steps">1. Abrí la app de tu banco → SINPE Móvil<br>2. Transferí el monto exacto al número indicado<br>3. Enviá el comprobante por WhatsApp con el botón de abajo</div>' +
    '</div>';
}

function showInvoice(order){
  document.getElementById('invoiceBox').innerHTML = invoiceHTML(order);
  document.getElementById('coTitle').textContent = 'Factura ' + order.number;
  document.getElementById('coStep1').style.display = 'none';
  document.getElementById('coStep2').style.display = 'block';
  /* Equivalente en dólares (tipo de cambio BCCR en tiempo real) */
  try{
    var local = (settings && settings.currency) || 'CRC';
    if(local !== 'USD'){
      convertCurrency(order.total || 0, local, 'USD').then(function(usd){
        var el = document.getElementById('invUsd');
        if(el) el.textContent = '$' + Number(usd).toFixed(2);
        var row = document.getElementById('invUsdRow');
        if(row) row.style.display = '';
      }).catch(function(){
        var row = document.getElementById('invUsdRow'); if(row) row.style.display = 'none';
      });
    } else {
      var row2 = document.getElementById('invUsdRow'); if(row2) row2.style.display = 'none';
    }
  }catch(e){}

  // mensaje de WhatsApp con la factura + espacio para comprobante
  const lines = [];
  lines.push('*NUEVO PEDIDO — ' + settings.storeName + '*');
  lines.push('Factura: ' + order.number);
  lines.push('--------------------------------');
  order.items.forEach(it => lines.push('• ' + it.qty + ' x ' + it.name + ' — ' + fmt(it.price*it.qty)));
  lines.push('--------------------------------');
  lines.push('Subtotal: ' + fmt(order.subtotal));
  lines.push('IVA ' + settings.iva + '%: ' + fmt(order.iva));
  lines.push('*TOTAL: ' + fmt(order.total) + '*');
  lines.push('');
  lines.push('*Cliente:* ' + order.customer.name);
  lines.push('*Teléfono:* ' + order.customer.phone);
  lines.push('*Entrega:* ' + order.customer.delivery + ' — ' + order.customer.address);
  if(order.customer.notes) lines.push('*Notas:* ' + order.customer.notes);
  lines.push('');
  lines.push('Ya realicé el SINPE Móvil al ' + settings.sinpe + ' por ' + fmt(order.total) + '. Adjunto mi comprobante de pago:');
  const waURL = 'https://wa.me/' + waDigits(settings.whatsapp) + '?text=' + encodeURIComponent(lines.join('\n'));
  document.getElementById('waReceiptBtn').onclick = () => {
    /* Antes de abrir WhatsApp, pedir la opinión de experiencia de la compra */
    if(typeof openExpOpinion === 'function'){
      openExpOpinion(order.number);
    }
    window.open(waURL, '_blank');
  };
}
/* ================= CONVERSIÓN DE DIVISA (local → divisa PayPal / dólares) =================
   Usa en TIEMPO REAL el tipo de cambio del Banco Central de Costa Rica (BCCR).
   Orden de fuentes:
     1) Tasa FORZADA por el superadmin (planConfig.fxRates['CRC:USD']).
     2) API del BCCR (indicador de referencia, sin clave).
     3) API frankfurter.app (market).
     4) Tasa de respaldo por defecto.
   Todas las tasas quedan cacheadas para no llamar a la API en cada cálculo. */
let _fx = {}; // { 'CRC:USD': 0.00026 }
function _fxRate(from, to){ var k=(from||'CRC')+':'+(to||'USD'); if(_fx[k]) return _fx[k]; return null; }
/* Tasa de cambio CRC→USD del BCCR (referencia de venta). Devuelve colones por USD o null. */
async function bccrRate(){
  try{
    var r = await fetch('https://api.hacienda.go.cr/indicadores/tc/venta', { headers: { 'Accept':'application/json' } });
    var j = await r.json();
    if(j && j.valores && j.valores[0] && j.valores[0].valor) return parseFloat(j.valores[0].valor);
  }catch(e){ console.warn('BCCR no disponible:', e); }
  return null;
}
async function convertCurrency(amount, from, to){
  from = from || 'CRC'; to = to || 'USD';
  if(from === to) return amount;
  /* 1) Tasa forzada por el superadmin (si existe) */
  var cfg = planConfig || DEFAULT_PLAN_CONFIG;
  var manualKey = (from||'') + ':' + (to||'');
  if(cfg && cfg.fxRates && cfg.fxRates[manualKey]) return amount * parseFloat(cfg.fxRates[manualKey]);
  /* 2) BCCR en tiempo real para CRC→USD y USD→CRC */
  if((from === 'CRC' && to === 'USD') || (from === 'USD' && to === 'CRC')){
    var crcUsd = await bccrRate();
    if(crcUsd){
      _fx['CRC:USD'] = 1 / crcUsd; // USD = 1 / colones por dólar
      _fx['USD:CRC'] = crcUsd;
      return amount * _fx[from + ':' + to];
    }
  }
  /* 3) Caché y frankfurter para el resto */
  try{
    var cached = _fxRate(from, to);
    if(cached != null) return amount * cached;
    var r = await fetch('https://api.frankfurter.app/latest?from=' + from + '&to=' + to);
    var j = await r.json();
    var rate = j && j.rates && j.rates[to];
    if(rate){ _fx[from + ':' + to] = rate; return amount * rate; }
  }catch(e){ console.warn('Fx error:', e); }
  /* 4) Respaldo por defecto */
  var fallback = from === 'CRC' ? 0.00026 : (from === 'EUR' ? 1.08 : 1);
  return amount * fallback;
}
/* Pago del pedido con PayPal CHECKOUT: el SERVIDOR crea la orden (la clave y el
   secreto PayPal nunca van al navegador), dirige el pago a la cuenta del negocio,
   y el cliente aprueba con el botón de PayPal. Cobra el monto EXACTO de la factura. */
function payOrderCard(){
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  if(typeof planAllows === 'function' && !planAllows('paypal')){
    toast('El pago con PayPal está disponible a partir del plan Profesional. Subí de plan para activarlo.', 'err'); return;
  }
  const hasEmail = !!(settings && settings.paypalEmail);
  const hasMe = !!(settings && settings.paypalMe);
  if(!hasEmail && !hasMe){
    toast('Este negocio no tiene configurado el pago con tarjeta.', 'err'); return;
  }
  /* CREAR LA FACTURA PRIMERO: así el cobro coincide con el total de la factura
     y se guarda el número (lastOrder) para la descripción y la notificación. */
  createOrderFromCart(false, 'PayPal').then(function(order){
    if(!order){ const btn = document.getElementById('cCardBtn'); if(btn){ btn.textContent = '💳 Pagar el monto exacto con tarjeta (PayPal)'; btn.disabled = false; } return; }
    const local = (settings && settings.currency) || 'CRC';
    const cur = (settings && settings.paypalCurrency) || (cfg.paymeCurrency || 'USD');
    const amount = order.total || 0;                 // TOTAL DE LA FACTURA (no del carrito)
    const facturaNum = order.number || '';
    const btn = document.getElementById('cCardBtn');
    if(btn){ btn.textContent = '💳 Convirtiendo a ' + cur + '…'; btn.disabled = true; }
    convertCurrency(amount, local, cur).then(function(converted){
      const amountFinal = Number(converted).toFixed(2);
      if(btn){ btn.textContent = '💳 Pagar ' + amountFinal + ' ' + cur + ' con PayPal'; btn.disabled = false; }
      /* Priorizar el enlace PayPal.Me del PROPIO negocio: garantiza que el
         dinero llegue a su cuenta (PayPal.Me siempre cobra al titular).
         Si el negocio no tiene PayPal.Me pero sí email de Checkout, usamos el
         Checkout (confirma y notifica automáticamente). Si no hay nada,
         caemos al PayPal.Me general de la plataforma. */
      const bizMe = settings && settings.paypalMe ? String(settings.paypalMe).trim() : '';
      if(bizMe){
        openPaypalMeDynamic(amountFinal, cur);
      } else if(settings && settings.paypalEmail){
        renderPaypalCheckout(settings.paypalEmail, amountFinal, cur, facturaNum);
      } else {
        openPaypalMeDynamic(amountFinal, cur);
      }
    }).catch(function(){
      if(btn){ btn.disabled = false; btn.textContent = '💳 Pagar con tarjeta (PayPal)'; }
      toast('No se pudo convertir la moneda. Probá de nuevo.', 'err');
    });
  });
}
/* Abre un enlace PayPal.Me con el monto dinámico del pago. Usa el usuario
   configurado por el negocio (paypalMe) o, si no, el del superadmin (paymeUser).
   Garantiza que SIEMPRE se muestre el monto a pagar, sin depender del Checkout API. */
function openPaypalMeDynamic(amount, currency){
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const me = (settings && settings.paypalMe ? String(settings.paypalMe).trim() : '');
  if(!me){ toast('Este negocio no tiene configurado su PayPal.Me. El administrador debe ingresarlo en Configuración → Pagos.', 'warn'); return; }
  const amt = Number(amount || 0).toFixed(2);
  const cur = currency || (settings && settings.paypalCurrency) || (cfg.paymeCurrency || 'USD');
  const url = 'https://www.paypal.com/paypalme/' + encodeURIComponent(me) + '?amount=' + amt + '&currency=' + encodeURIComponent(cur);
  window.open(url, '_blank', 'noopener');
  toast('Abriendo pago de ' + amt + ' ' + cur + '…', 'ok');
}

/* Renderiza un Smart Button de PayPal que cobra el monto exacto (CHECKOUT).
   La orden la crea el SERVIDOR (paypalCreateOrder), no el navegador, para no
   exponer el secreto. El pago se dirige a la cuenta del negocio (payeeEmail). */
function renderPaypalCheckout(payeeEmail, amount, currency, facturaNum){
  const box = document.getElementById('paypalCheckoutBox');
  if(!box) return;
  box.style.display = 'block';
  box.innerHTML = '';
  /* Usar el Client ID del propio negocio (el admin lo ingresa en su panel) */
  const bizClientId = (settings && settings.paypalClientId) ? settings.paypalClientId : '';
  if(!bizClientId){
    box.innerHTML = '<div style="font-size:12px;color:var(--danger);text-align:center;padding:10px">Este negocio aún no ha configurado su Client ID de PayPal. El administrador debe ingresar sus credenciales en Configuración → Pagos.</div>';
    return;
  }
  loadPayPalSdk(bizClientId).then(function(){
    if(typeof paypal === 'undefined' || !paypal.Buttons){
      box.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px">No se pudo cargar el botón de PayPal. Revisá el Client ID.</div>';
      return;
    }
    renderPaypalButtons(box, payeeEmail, amount, currency, facturaNum);
  });
}
/* Carga dinámicamente el SDK de PayPal con un client-id específico. Devuelve
   una promesa que resuelve cuando el SDK está listo (o rechaza si falla). */
var _paypalSdkLoaded = null;
function loadPayPalSdk(clientId){
  if(typeof paypal !== 'undefined' && paypal.Buttons) return Promise.resolve();
  if(_paypalSdkLoaded) return _paypalSdkLoaded;
  _paypalSdkLoaded = new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(clientId) + '&components=buttons&disable-funding=venmo&currency=USD';
    s.onload = function(){ resolve(); };
    s.onerror = function(){ _paypalSdkLoaded = null; reject(new Error('No se pudo cargar el SDK de PayPal')); };
    document.head.appendChild(s);
  });
  return _paypalSdkLoaded;
}
/* Renderiza el botón de PayPal (checkout) con la orden que crea el servidor */
function renderPaypalButtons(box, payeeEmail, amount, currency, facturaNum){
  try{
    var btn = paypal.Buttons({
      style: { layout:'vertical', label:'paypal', shape:'rect', color:'blue' },
      createOrder: function(data, actions){
        /* Pedir la orden al servidor (sin exponer secretos) con el monto de la factura */
        var desc = 'Pago de factura ' + (facturaNum ? facturaNum : dateOrderNumber()) + ' — ' + (settings.storeName||'Tienda');
        return cloudCallPublic('paypalCreateOrder', { amount: parseFloat(amount), currency: currency, description: desc, payeeEmail: payeeEmail, slug: TENANT_ID, orderNumber: facturaNum || '' }).then(function(res){
          if(!res || !res.orderId){
            /* FALLBACK: abrir PayPal.Me con el monto dinámico para que el cliente
               pague el importe exacto aunque el Checkout API no esté disponible. */
            openPaypalMeDynamic(amount, currency);
            return actions.reject();
          }
          if(res.payeeApplied === false){
            toast('⚠ El pago se hará a la cuenta de la plataforma. Verificá el email de PayPal del negocio.', 'warn');
          }
          return res.orderId;
        });
      },
      onApprove: function(data, actions){
        var orderInfo = null;
        try{
          if(lastOrder){ orderInfo = { number: lastOrder.number, total: lastOrder.total, customer: lastOrder.customer }; }
        }catch(e){}
        return cloudCallPublic('paypalCaptureOrder', { orderId: data.orderID, slug: TENANT_ID, orderInfo: orderInfo }).then(function(res){
          if(res && res.status){
            toast('✅ Pago aprobado por PayPal. ¡Gracias!', 'ok');
            try{
              if(lastOrder && lastOrder.number){ ordersCol.doc(lastOrder.number).update({ payMethod:'PayPal', payStatus:'pagado', payBy: res.payerEmail||'' }).catch(function(){}); }
            }catch(e){}
          } else { toast('El pago quedó pendiente de verificación.', 'warn'); }
        });
      }
    });
    btn.render('#paypalCheckoutBox');
  }catch(e){ console.error(e); box.innerHTML = '<div style="font-size:12px;color:var(--danger);text-align:center;padding:10px">No se pudo cargar el botón de PayPal.</div>'; }
}
/* Llamada a Cloud Function SIN requerir sesión (la usa el cliente al pagar). */
async function cloudCallPublic(name, data){
  try{
    const fn = cloudFns.httpsCallable(name);
    const res = await fn(data || {});
    return res.data;
  }catch(e){
    console.error('cloudCallPublic error [' + name + ']:', e);
    var msg = (e && e.message) || 'error';
    if(msg.indexOf('internal') !== -1 || msg.indexOf('INTERNAL') !== -1) msg = 'Error del servidor de pago. Revisá logs.';
    toast('No se pudo completar el pago: ' + msg, 'err');
    return null;
  }
}
/* Actualiza el botón de tarjeta con el monto convertido según el carrito */
function refreshCheckoutCardBtn(){
  const b = document.getElementById('cCardBtn');
  if(!b) return;
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const own = settings && settings.paypalMe ? String(settings.paypalMe).trim() : '';
  const has = !!(own || (settings && settings.paypalEmail) || (settings && settings.paypalClientId)) && planAllows('paypal');
  b.style.display = has ? 'block' : 'none';
  const lbl = document.getElementById('cPayLabel');
  if(lbl) lbl.textContent = settings.payMethodLabel || 'SINPE';
  const lbl2 = document.getElementById('step2PayLabel');
  if(lbl2) lbl2.textContent = settings.payMethodLabel || 'SINPE';
  /* Pre-convertir el monto del carrito y mostrarlo en la divisa de PayPal */
  if(has && !b.disabled){
    const local = (settings && settings.currency) || 'CRC';
    const cur = (settings && settings.paypalCurrency) || (cfg.paymeCurrency || 'USD');
    const t = cartTotals();
    if(t && t.count){
      const totalLocal = t.total || 0;
      convertCurrency(totalLocal, local, cur).then(function(conv){
        if(!b.disabled){
          /* Mostrar el total en moneda local + equivalente en dólares */
          b.textContent = '💳 Pagar ' + fmt(totalLocal) + ' ≈ ' + Number(conv).toFixed(2) + ' ' + cur + ' con PayPal';
        }
      }).catch(function(){});
    }
  }
}

function printInvoice(){
  if(!lastOrder) return;
  document.getElementById('printArea').innerHTML = '<div class="invoice">' + invoiceHTML(lastOrder) + '</div>';
  window.print();
}
