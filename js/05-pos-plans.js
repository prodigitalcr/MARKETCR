/* ---------- PUNTO DE VENTA (POS) ----------
   Ventas rápidas del local: usan el MISMO inventario de la tienda (descuentan
   stock al cobrar) y se guarda la venta tanto en "posSales" como en el
   documento diario de "finance" (tenants/{slug}/finance/YYYY-MM-DD). */
let posCart = {};          // clave = cartKey(id, variantId); valor = {qty}
let posPaymentMethod = 'efectivo';
let lastPOSSale = null;    // última venta de POS (para compartir factura por WhatsApp)
let posSales = [];
let financeToday = null;   // doc diario de finanzas (caché)
let unsubPosSales = null;
let unsubFinance = null;

function posDayKey(d){
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function posSalesRefs(){ return tenantCol('posSales'); }
function financeRef(day){ return tenantCol('finance').doc(day || posDayKey()); }

function listenPOSIfAdmin(){
  if(unsubPosSales) unsubPosSales();
  unsubPosSales = posSalesRefs().orderBy('createdAtMs','desc').limit(100).onSnapshot(snap=>{
    posSales = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
    if(document.body.classList.contains('in-admin') && document.getElementById('panel-pos').classList.contains('active')){
      renderPOSDashboard();
    }
  }, err=>{ console.error(err); });
}
function listenFinanceIfAdmin(){
  const day = posDayKey();
  if(unsubFinance) unsubFinance();
  unsubFinance = financeRef(day).onSnapshot(snap=>{
    financeToday = Object.assign({ openCash:0, salesCount:0, salesAmount:0, expenses:[] }, snap.exists ? snap.data() : {});
    if(document.body.classList.contains('in-admin')){
      renderFinancePanel();
      renderPOSDashboard();
    }
  }, err=>{ console.error(err); });
}

/* ---------- POS: catálogo y carrito ---------- */
function posTotals(){
  let sub = 0, count = 0;
  for(const key in posCart){
    const info = cartLineInfo(key);
    if(!info) continue;
    sub += info.unitPrice * posCart[key].qty; count += posCart[key].qty;
  }
  const discountPercent = Math.max(0, Math.min(100, settings.globalDiscountPercent || 0));
  const discountAmt = Math.round(sub * discountPercent / 100);
  const discountedSub = sub - discountAmt;
  const iva = Math.round(discountedSub * (settings.iva||0) / 100);
  return { sub, discountAmt, discountPercent, discountedSub, iva, total: discountedSub + iva, count };
}
function renderPOSCatalog(){
  const q = (document.getElementById('posSearch').value||'').toLowerCase().trim();
  const cat = document.getElementById('posCatFilter').value;
  const catsEl = document.getElementById('posCatFilter');
  const cats = ['Todos'].concat(settings.categories||[]);
  if(catsEl.options.length !== cats.length){
    catsEl.innerHTML = cats.map(c=>'<option value="'+esc(c)+'"'+(c===cat?' selected':'')+'>'+esc(c)+'</option>').join('');
  }
  const list = products.filter(p =>
    p.active !== false &&
    (!q || p.name.toLowerCase().includes(q)) &&
    (!cat || cat==='Todos' || p.cat===cat));
  document.getElementById('posCatalog').innerHTML = list.map(p => {
    const st = stockInfo(p);
    const g = gradFor(p.id);
    const cover = firstThumb(p);
    const thumb = cover ? '<img src="'+esc(cover)+'" alt="" loading="lazy">' : svgIcon(p.icon,34);
    const out = !st.can;
    return '<div class="pos-item' + (out?'" style="opacity:.45':'') + '" onclick="posPickProduct(\'' + p.id + '\')">' +
      '<div class="pi-img">' + thumb + '</div>' +
      '<div class="pi-body"><div class="pi-name">' + esc(p.name) + '</div>' +
      '<div class="pi-price">' + (p.hasVariants ? 'Desde ' : '') + displayPrice(p) + '</div></div></div>';
  }).join('') || '<div class="pos-empty">Sin productos que coincidan.</div>';
}
/* Al tocar un producto: si tiene variantes, elegís una primero; si no, suma directo. */
function posPickProduct(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  const st = stockInfo(p);
  if(!st.can){ toast('Junto a los productos sin stock, no se puede vender este ahora', 'err'); return; }
  if(p.hasVariants){
    const av = activeVariants(p);
    if(!av.length){ toast('Este producto no tiene variantes disponibles', 'err'); return; }
    const rows = av.map(v => {
      const out = (v.stock||0) <= 0;
      return '<div class="pos-var-item">' +
        '<div class="nm"><b>' + esc(v.name) + '</b><span class="st">' + fmt(v.price) + (p.unlimited ? '' : ' · ' + (v.stock||0) + ' uds') + '</span></div>' +
        '<button ' + (out?'disabled':'') + ' onclick="posAdd(\'' + p.id + '\',\'' + v.id + '\')">' + (out?'Sin stock':'Agregar') + '</button></div>';
    }).join('');
    showPOSVariantModal(esc(p.name), rows);
  } else {
    posAdd(id, null);
  }
}
function posAdd(id, variantId){
  const key = cartKey(id, variantId);
  const info = cartLineInfo(key);
  if(!info) return;
  const cur = posCart[key] || { qty:0 };
  const next = cur.qty + 1;
  if(info.unitStock !== Infinity && next > info.unitStock){ toast('Stock máximo disponible', 'err'); return; }
  posCart[key] = { qty: next };
  renderPOSCart();
  toast(info.label + ' agregado', 'ok');
}
function posQty(key, delta){
  const info = cartLineInfo(key);
  const cur = posCart[key] ? posCart[key].qty : 0;
  const next = cur + delta;
  if(next <= 0){ delete posCart[key]; }
  else {
    if(info && info.unitStock !== Infinity && next > info.unitStock){ toast('Stock máximo disponible', 'err'); return; }
    posCart[key] = { qty: next };
  }
  renderPOSCart();
}
function posRemove(key){ delete posCart[key]; renderPOSCart(); }
function posClearCart(){
  posCart = {};
  document.getElementById('posPaid') && (document.getElementById('posPaid').value='');
  document.getElementById('posChange') && (document.getElementById('posChange').textContent = fmt(0));
  const sh = document.getElementById('posShareWaBtn'); if(sh) sh.style.display = 'none';
  renderPOSCart();
  toast('Venta limpiada');
}
function posChangeMethod(m){
  posPaymentMethod = m;
  document.getElementById('posPaymentLabel').textContent = m[0].toUpperCase() + m.slice(1);
}
function renderPOSCart(){
  const t = posTotals();
  document.getElementById('posSub').textContent = fmt(t.sub);
  document.getElementById('posDiscountRow').style.display = t.discountAmt ? 'flex' : 'none';
  document.getElementById('posDiscount').textContent = '−' + fmt(t.discountAmt);
  var posIvaLbl = document.getElementById('posIvaLabel');
  if(posIvaLbl) posIvaLbl.textContent = 'IVA (' + (settings.iva||0) + '%)';
  document.getElementById('posIva').textContent = fmt(t.iva);
  document.getElementById('posTotal').textContent = fmt(t.total);
  document.getElementById('posCobrarBtn').disabled = !t.count;
  const box = document.getElementById('posCartItems');
  if(!t.count){
    box.innerHTML = '<div style="color:var(--muted);padding:30px 0;text-align:center">Tocá un producto del catálogo para armar la venta.</div>';
    return;
  }
  box.innerHTML = Object.keys(posCart).map(key => {
    const info = cartLineInfo(key);
    if(!info) return '';
    const qty = posCart[key].qty;
    return '<div class="pos-cart-row">' +
      '<div class="nm">' + esc(info.label) + '</div>' +
      '<span class="pv">' + fmt(info.unitPrice * qty) + '</span>' +
      '<div class="pos-qty">' +
        '<button onclick="posQty(\'' + key + '\',-1)">−</button><span>' + qty + '</span><button onclick="posQty(\'' + key + '\',1)">+</button>' +
      '</div>' +
'<button class="pos-rm" onclick="posRemove(\'' + key + '\')" title="Quitar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>';
  }).join('');
  posCalcChange();
}
/* ---------- POS: con cuánto paga / vuelto (caja rápida) ---------- */
function posCalcChange(){
  const chEl = document.getElementById('posChange');
  const paidEl = document.getElementById('posPaid');
  if(!chEl) return;
  const t = posTotals();
  const paid = paidEl ? (parseFloat(paidEl.value)||0) : 0;
  const change = Math.round(paid - t.total);
  chEl.textContent = change < 0 ? 'Faltan ' + fmt(-change) : fmt(change);
  chEl.classList.toggle('bad', change < 0);
}
function posSetPaid(v){
  const el = document.getElementById('posPaid');
  const t = posTotals();
  el.value = v === 'exacto' ? Math.round(t.total) : v;
  posCalcChange();
}
/* Búsqueda rápida: Enter agrega el primer resultado que coincida */
function posSearchEnter(){
  const q = (document.getElementById('posSearch').value||'').trim().toLowerCase();
  if(!q) return;
  const matches = products.filter(p => p.active !== false && (p.id===q || p.name.toLowerCase().includes(q) || (p.tag||'').toLowerCase().includes(q)));
  if(matches.length === 1){
    posPickProduct(matches[0].id);
    document.getElementById('posSearch').value = '';
    renderPOSCatalog();
  } else if(!matches.length){
    toast('Sin resultados para "' + q + '"', 'err');
  }
}
/* Agrega producto leído por cámara o láser: no repite si ya está en la venta */
function posAddByScan(code){
  const r = resolveScanCode(code);
  if(!r){ toast('No encontré el producto del código leído', 'err'); return; }
  if(r.variantId && r.variant){
    const out = (r.variant.stock||0) <= 0 && !r.p.unlimited;
    if(out){ toast('Esa presentación no tiene stock', 'err'); return; }
    posAdd(r.p.id, r.variantId);
    renderPOSCatalog();
    return;
  }
  posPickProduct(r.p.id);
}
/* ---------- lector láser (wedge de teclado): apunta, escanea, Enter ---------- */
let laserModeOn = false, laserBuf = '';
function toggleLaserMode(){
  laserModeOn = !laserModeOn;
  laserBuf = '';
  const b = document.getElementById('laserModeBtn');
  if(laserModeOn){
    b.textContent = '🔦 Láser: ON';
    b.style.background = 'var(--green)';
    b.style.color = '#fff';
    toast('Modo láser ON: apuntá con el lector y escaneá la etiqueta', 'ok');
  } else {
    b.textContent = '🔦 Láser';
    b.style.background = '';
    b.style.color = '';
    toast('Modo láser OFF', 'ok');
  }
}
window.addEventListener('keydown', function(e){
  if(!laserModeOn) return;
  if(e.key.length === 1 && !e.ctrlKey && !e.metaKey){
    e.preventDefault(); laserBuf += e.key;
  } else if(e.key === 'Enter'){
    e.preventDefault();
    if(laserBuf){ const code = laserBuf; laserBuf = ''; posAddByScan(code); }
  }
});
/* ---------- scanner con cámara (BarcodeDetector) ---------- */
let scanStream = null;
async function openScannerModal(){
  document.getElementById('scannerModal').classList.add('show');
  const video = document.getElementById('scanVideo');
  const ph = document.getElementById('scanPlaceholder');
  const st = document.getElementById('scanStatus');
  const fb = document.getElementById('scanFallback');
  video.style.display = 'block'; ph.style.display = 'none';
  st.textContent = 'Arrancando cámara…';
  try{
    scanStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }, audio:false });
    video.srcObject = scanStream;
    await video.play();
    st.textContent = 'Apuntá al código QR o de barras…';
    if(!('BarcodeDetector' in window)){
      fb.style.display = 'block';
      st.textContent = '';
      return;
    }
    const detector = new BarcodeDetector({ formats:['qr_code','ean_13','ean_8','code_128','code_39','code_93','upc_a','upc_e','itf','codabar'] });
    const tick = async () => {
      if(!document.getElementById('scannerModal').classList.contains('show')) return;
      if(!video.videoWidth){ setTimeout(tick, 200); return; }
      try{
        const codes = await detector.detect(video);
        if(codes && codes.length){
          st.textContent = '¡Producto detectado!';
          closeScannerModal();
          posAddByScan(codes[0].rawValue);
          return;
        }
      }catch(e){}
      setTimeout(tick, 220);
    };
    tick();
  }catch(e){
    st.textContent = 'No se pudo abrir la cámara: ' + (e && e.message ? e.message : 'permiso denegado');
    fb.style.display = 'block';
  }
}
function closeScannerModal(){
  document.getElementById('scannerModal').classList.remove('show');
  if(scanStream){ try{ scanStream.getTracks().forEach(t=>t.stop()); }catch(e){} scanStream = null; }
}
function showPOSVariantModal(title, rows){
  document.getElementById('posVariantTitle').textContent = title;
  document.getElementById('posVariantBody').innerHTML = rows;
  document.getElementById('posVariantModal').classList.add('show');
}
function closePOSVariantModal(){ document.getElementById('posVariantModal').classList.remove('show'); }

/* ---------- POS: cobrar venta ---------- */
async function confirmPOSSale(){
  const t = posTotals();
  if(!t.count){ toast('La venta está vacía', 'err'); return; }
  if(!confirm('¿Confirmar la venta por ' + fmt(t.total) + ' (' + posPaymentMethod + ')? Se descontará del inventario.')) return;
  const now = new Date();
  const day = posDayKey(now);
  const number = 'P-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + String(Date.now()).slice(-5);
  const items = Object.keys(posCart).map(key => {
    const parts = key.split('::');
    const p = products.find(x=>x.id===parts[0]);
    const info = cartLineInfo(key);
    return info ? { id:parts[0], variantId: parts[1] || '', name: info.label, price: info.unitPrice, qty: posCart[key].qty, image: (p && p.images && p.images[0]) || '' } : null;
  }).filter(Boolean);
const sale = {
    number, date: now.toISOString(), createdAtMs: now.getTime(), day,
    method: posPaymentMethod,
    sellerId: employeeSession ? (employeeSession.code || 'emp') : 'admin',
    seller: employeeSession ? employeeSession.name : 'Administrador',
    items, subtotal: t.sub, discountAmt: t.discountAmt, iva: t.iva, total: t.total, qtyTotal: t.count
  };
  const batch = db.batch();
  batch.set(posSalesRefs().doc(number), sale);
  batch.set(financeRef(day), {
    day,
    salesCount: firebase.firestore.FieldValue.increment(1),
    salesAmount: firebase.firestore.FieldValue.increment(t.total),
    lastSaleAt: now.toISOString()
  }, { merge:true });
  // Descontar stock de cada producto vendido (mismo inventario que la tienda web)
  Object.keys(posCart).forEach(key => {
    const parts = key.split('::');
    const p = products.find(x=>x.id===parts[0]);
    if(!p || p.unlimited) return;
    const qty = posCart[key].qty;
    if(parts[1]){
      const variants = (p.variants||[]).map(v => (v.id===parts[1] && !v.removed) ? Object.assign({}, v, { stock: Math.max(0,(v.stock||0)-qty) }) : v);
      batch.set(productsCol.doc(p.id), { variants }, { merge:true });
    } else {
      batch.set(productsCol.doc(p.id), { stock: Math.max(0,(p.stock||0)-qty) }, { merge:true });
    }
  });
  try{
    await batch.commit();
  }catch(e){
    toast('No se pudo registrar la venta. Intentá de nuevo.', 'err');
    console.error(e);
    return;
  }
posCart = {};
  lastPOSSale = sale;
  const shBtn = document.getElementById('posShareWaBtn');
  if(shBtn) shBtn.style.display = '';
  const paidEl = document.getElementById('posPaid'); if(paidEl) paidEl.value = '';
  renderPOSCart(); renderPOSCatalog();
  toast('Venta ' + number + ' registrada', 'ok');
  if(settings.facturaDigital && canEmitInvoice()){
    setTimeout(()=> printPOSSale(sale), 600);
  }
}

/* Comparte la última factura de POS por WhatsApp al cliente */
function shareLastPOSSaleWhatsApp(){
  const sale = lastPOSSale;
  if(!sale){ toast('No hay una venta reciente para compartir', 'err'); return; }
  const wa = settings.whatsapp;
  if(!wa){ toast('Configurá primero el WhatsApp de la tienda en los datos del negocio', 'err'); return; }
  const methodLabel = sale.method ? sale.method[0].toUpperCase() + sale.method.slice(1) : '';
  const lines = (sale.items||[]).map(i =>
    '• ' + i.name + (i.variantId ? ' (' + i.variantId + ')' : '') + ' x' + i.qty + ' = ' + fmt(i.price * i.qty)
  ).join('\n');
  const msg =
    '🧾 *FACTURA ' + sale.number + '*\n' +
    '*' + (settings.storeName || '') + '*\n' +
    new Date(sale.createdAtMs || Date.now()).toLocaleString('es-CR') + '\n\n' +
    lines + '\n\n' +
    'Subtotal: ' + fmt(sale.subtotal) +
    (sale.discountAmt ? '\nDescuento: −' + fmt(sale.discountAmt) : '') +
    '\nIVA: ' + fmt(sale.iva) +
    '\n*TOTAL: ' + fmt(sale.total) + '*' +
    '\nMétodo: ' + methodLabel +
    '\n\n¡Gracias por tu compra! 💚';
  window.open('https://wa.me/' + waDigits(wa) + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
}
function renderPOSDashboard(){
  populatePOSSellerFilter();
  const sellerF = document.getElementById('posSellerFilter') ? document.getElementById('posSellerFilter').value : '';
  let todaySales = posSales.filter(s => s.day === posDayKey());
  if(sellerF) todaySales = todaySales.filter(s => (s.sellerId||'') === sellerF);
  const amount = todaySales.reduce((s,x)=>s+x.total,0);
  document.getElementById('posSalesToday').textContent = fmt(amount);
  document.getElementById('posOrdersToday').textContent = todaySales.length;
  document.getElementById('posAvgToday').textContent = fmt(todaySales.length ? amount/todaySales.length : 0);
  document.getElementById('posUnitsToday').textContent = todaySales.reduce((s,x)=> s + (x.qtyTotal||0), 0);
  document.getElementById('posHistoryBody').innerHTML = todaySales.map(s => {
    const d = new Date(s.date);
    const itemsTxt = s.items.map(it=>it.qty+'× '+it.name).join(', ');
    return '<tr>' +
      '<td><b>' + s.number + '</b></td>' +
      '<td>' + d.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) + '</td>' +
      '<td><div class="order-items-list" title="'+esc(itemsTxt)+'">'+esc(itemsTxt.length>70?itemsTxt.slice(0,70)+'…':itemsTxt)+'</div></td>' +
'<td>' + (s.method||'efectivo') + '</td>' +
      '<td>' + esc(s.seller || 'Administrador') + '</td>' +
      '<td><b>' + fmt(s.total) + '</b></td>' +
      '<td style="text-align:right">' +
        '<button class="icon-btn" title="Crear factura en TicoFactura (copia los datos de la venta)" onclick="ticoFacturaForSale(\'' + s.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 21h14"/><path d="M7 7h10l-1.5 9h-7z"/></svg></button>' +
        '<button class="icon-btn" title="Cómo facturar en TicoFactura" onclick="showTicoFacturaHelp()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 11v5"/></svg></button>' +
        (canEmitInvoice() ? '<button class="icon-btn" title="Factura electrónica (XML Hacienda)" onclick="downloadPOSInvoiceXML(\'' + s.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l3 3v4M6 2v20a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9M6 14h3m3 0h3"/></svg></button>' : '') +
        '<button class="icon-btn" title="Imprimir factura" onclick="printPOSSale(\'' + s.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>' +
        '<button class="icon-btn danger" title="Eliminar" onclick="deletePOSSale(\'' + s.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0-1 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 6"/></svg></button>' +
      '</td>' +
      '</tr>';
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Aún no hay ventas hoy.</td></tr>';
}
async function deletePOSSale(number){
  if(!confirm('¿Eliminar la venta ' + number + '? Se devolverá el stock a los productos.')) return;
  const sale = posSales.find(s=>s.number===number);
  try{
    const batch = db.batch();
    batch.delete(posSalesRefs().doc(number));
    if(sale && sale.items && sale.items.length){
      // Devolver el stock descontado al inventario (misma lógica inversa de confirmPOSSale)
      sale.items.forEach(it => {
        const p = products.find(x=>x.id===it.id);
        if(!p || p.unlimited) return;
        if(it.variantId){
          const variants = (p.variants||[]).map(v => (v.id===it.variantId && !v.removed) ? Object.assign({}, v, { stock: (v.stock||0) + it.qty }) : v);
          batch.set(productsCol.doc(p.id), { variants }, { merge:true });
        } else {
          batch.set(productsCol.doc(p.id), { stock: (p.stock||0) + it.qty }, { merge:true });
        }
      });
    }
    await batch.commit();
    toast('Venta eliminada y stock devuelto', 'ok');
  }catch(e){
    toast('No se pudo eliminar: ' + (e && e.message ? e.message : 'error'), 'err');
    console.error(e);
  }
}
async function exportPOSPDF(){
  toast('Preparando el PDF…', 'ok');
  if(!(await ensurePdfLibs()) || !pdfReady()) return;
  const todaySales = posSales.filter(s => s.day === posDayKey());
  const doc = pdfNewDoc('Cierre de caja - Punto de Venta');
  const body = todaySales.map(s=>{
    const d = new Date(s.date);
    const itemsTxt = s.items.map(it=>it.qty+'x '+it.name).join(', ');
    return [s.number, d.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}), s.method||'efectivo', itemsTxt, fmtPdf(s.total)];
  });
  doc.autoTable({
    startY: 92,
    head: [['Factura','Hora','Método','Detalle','Total']],
    body: body.length ? body : [['Sin ventas hoy','','','','']],
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:9, cellPadding:5 },
    columnStyles:{ 3:{ cellWidth:150 }, 4:{ halign:'right' } }
  });
  const total = todaySales.reduce((s,x)=>s+x.total,0);
  doc.setFontSize(11);
  doc.setTextColor(17,32,42);
  doc.text('TOTAL DEL DÍA: ' + fmtPdf(total), 40, doc.lastAutoTable.finalY + 24);
  pdfFooter(doc);
  doc.save((TENANT_ID||'tienda') + '-pos-cierre-' + todayFileStamp() + '.pdf');
  toast('Cierre de caja descargado', 'ok');
}

/* ---------- FACTURACIÓN POS (impresa y/o digital Hacienda) ---------- */
function canEmitInvoice(){
  return !!(settings.facturaCedula && settings.facturaRazon);
}
function posInvoiceHTML(sale){
  const d = new Date(sale.date);
  const fecha = d.toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'}) + ' ' + d.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
  const rows = sale.items.map(it => {
    const prodImg = it.image ? '<img src="' + esc(it.image) + '" style="width:40px;height:40px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:8px">' : '';
    return '<tr><td>' + prodImg + esc(it.name) + '</td><td class="c">' + it.qty + '</td><td class="r">' + fmt(it.price) + '</td><td class="r">' + fmt(it.price*it.qty) + '</td></tr>';
  }).join('');
  const MET = {efectivo:'Efectivo', sinpe:'SINPE Móvil', tarjeta:'Tarjeta'};
  const emisor = [];
  if(settings.facturaCedula) emisor.push(esc(settings.facturaCedula));
  if(settings.facturaRazon) emisor.push(esc(settings.facturaRazon));
  if(settings.facturaTelefono) emisor.push('Tel: ' + esc(settings.facturaTelefono));
  if(settings.facturaCorreo) emisor.push(esc(settings.facturaCorreo));
  const dir = [settings.facturaDistrito, settings.facturaCanton, settings.facturaProvincia].filter(Boolean).join(', ');
  if(dir) emisor.push('Domicilio fiscal: ' + esc(dir));
  const fiscalBlock = settings.facturaCedula ? '<div class="inv-fiscal"><b>Emisor:</b> ' + emisor.join(' · ') + '</div>' : '';
return '<div class="inv-head">' +
      (settings.logoUrl ? '<img class="inv-logo" src="' + esc(settings.logoUrl) + '" alt="Logo">' : '') +
      '<div><div class="store">' + esc(settings.storeName) + '</div><div class="meta">' + esc(settings.facturaRazon || settings.tagline) + '</div></div>' +
      '<div class="inv-num"><b>FACTURA ' + sale.number + '</b><span>' + fecha + '</span></div>' +
    '</div>' +
    '<div class="inv-body">' +
      fiscalBlock +
      '<div class="inv-client"><b>Venta en tienda</b> — Método: ' + esc(MET[sale.method] || sale.method) + '<br>' +
      '<b>Operador:</b> ' + esc(sale.seller || (auth.currentUser && auth.currentUser.email) || '—') + '</div>' +
      '<table class="inv-table"><thead><tr><th>Producto</th><th class="c">Cant.</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="inv-totals">' +
        '<div class="row"><span>Subtotal</span><span>' + fmt(sale.subtotal) + '</span></div>' +
        (sale.discountAmt ? '<div class="row" style="color:#B45309"><span>Descuento</span><span>−' + fmt(sale.discountAmt) + '</span></div>' : '') +
        '<div class="row"><span>IVA (' + settings.iva + '%)</span><span>' + fmt(sale.iva) + '</span></div>' +
        '<div class="row tt"><span>TOTAL</span><span>' + fmt(sale.total) + '</span></div>' +
      '</div>' +
    '</div>';
}
function printPOSSale(number){
  const sale = typeof number === 'object' ? number : posSales.find(s=>s.number===number);
  if(!sale){ toast('No se encontró la venta', 'err'); return; }
  document.getElementById('printArea').innerHTML = '<div class="invoice">' + posInvoiceHTML(sale) + '</div>';
  toast('Imprimiendo factura ' + sale.number + '…', 'ok');
  window.print();
}
function downloadPOSInvoiceXML(number){
  const sale = posSales.find(s=>s.number===number);
  if(!sale){ toast('No se encontró la venta', 'err'); return; }
  if(!canEmitInvoice()){
    toast('Configurá la cédula y razón social en Configuraciones → Facturación (Hacienda)', 'err');
    return;
  }
  const consecutivo = (settings.facturaConsecutivo || 1000) + 1;
  const d = new Date(sale.date);
  const f = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0') + '-06:00';
  const toG = v => { return v && v.toFixed ? v.toFixed(5) : (0).toFixed(5); };
  const toGT = v => { return v && v.toFixed ? v.toFixed(5) : (0).toFixed(5); };
  const lines = (sale.items||[]).map(it =>
    '        <LineaDetalle numeroLinea="1">' +
    '          <CodigoTipo>01</CodigoTipo><Codigo>P' + esc(it.id) + '</Codigo>' +
    '          <Cantidad>' + it.qty + '</Cantidad><UnidadMedida>Unid</UnidadMedida>' +
    '          <Detalle>' + esc(it.name) + '</Detalle>' +
    '          <PrecioUnitario>' + toG(it.price) + '</PrecioUnitario>' +
    '          <MontoTotal>' + toGT(it.price * it.qty) + '</MontoTotal>' +
    '        </LineaDetalle>'
  ).join('\n');
  const xml = '<?xml version="1.0" encoding="utf-8"?>' +
    '<FacturaElectronica>' +
    '  <Clave>' + consecutivoKey(sale.number, consecutivo) + '</Clave>' +
    '  <NumeroConsecutivo>' + consecutivo + '</NumeroConsecutivo>' +
    '  <FechaEmision>' + f + '</FechaEmision>' +
    '  <Emisor>' +
    '    <NombreComercial>' + esc(settings.storeName) + '</NombreComercial>' +
    '    <RazonSocial>' + esc(settings.facturaRazon) + '</RazonSocial>' +
    '    <Identificacion>' + esc(settings.facturaCedula) + '</Identificacion>' +
    '    <Telefono>' + esc(settings.facturaTelefono) + '</Telefono>' +
    '    <CorreoElectronico>' + esc(settings.facturaCorreo) + '</CorreoElectronico>' +
    '    <Provincia>' + esc(settings.facturaProvincia) + '</Provincia>' +
    '    <Canton>' + esc(settings.facturaCanton) + '</Canton>' +
    '    <Distrito>' + esc(settings.facturaDistrito) + '</Distrito>' +
    '  </Emisor>' +
    '  <Receptor><Nombre>Consumidor Final</Nombre><IdentificacionDesconocida>Sin identificación</IdentificacionDesconocida></Receptor>' +
    '  <CondicionVenta>' + esc(settings.facturaCondicion || '01') + '</CondicionVenta>' +
    '  <MedioPago>' + (sale.method === 'sinpe' ? '04' : (sale.method === 'tarjeta' ? '06' : '01')) + '</MedioPago>' +
    '  <DetalleServicio>' + (settings.facturaDocumento === '04' ? 'No aplica (tiquete)' : 'Venta de bienes / servicios') + '</DetalleServicio>' +
    '  <ResumenFactura>' +
    '    <Descuento>' + toG(sale.discountAmt || 0) + '</Descuento>' +
    '    <SubTotal>' + toG(sale.subtotal) + '</SubTotal>' +
    '    <Iva>' + toG(sale.iva) + '</Iva>' +
    '    <Total>' + toGT(sale.total) + '</Total>' +
    '  </ResumenFactura>' +
    '</FacturaElectronica>';
  const blob = new Blob([xml], {type:'application/xml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'factura-' + (TENANT_ID||'tienda') + '-' + consecutivo + '.xml';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 400);
  // guardar el consecutivo usado para que la próxima factura siga la numeración
  saveSettingsToDB({ facturaConsecutivo: consecutivo }).catch(()=>{});
  toast('XML de factura descargado (' + a.download + ')', 'ok');
}
function consecutivoKey(number, consecutivo){
  const mask = number.replace(/[^0-9]/g, '').slice(-8);
  const d = new Date();
  const dateDigits = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  return '506' + dateDigits + '000101' + String(consecutivo).padStart(10,'0') + '1' + mask + String(Date.now() % 100000);
}

/* ---------- TICO FACTURA (facturación ante Hacienda) ---------- */
const TICO_FACTURA_URL = 'https://ovitribucr.hacienda.go.cr/home';
function ticoFacturaForSale(number){
  const sale = posSales.find(s=>s.number===number);
  if(!sale){ toast('No se encontró la venta', 'err'); return; }
  const d = new Date(sale.date);
  const fecha = d.toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'});
  const lineas = (sale.items||[]).map((it,i) =>
    (i+1) + '. ' + esc(it.name) + ' — ' + it.qty + ' x ' + fmt(it.price) + ' = ' + fmt(it.price*it.qty)
  ).join('\n');
  const metodo = {efectivo:'Efectivo', sinpe:'SINPE Móvil', tarjeta:'Tarjeta'}[sale.method] || sale.method;
  const resumen =
    'VENTA ' + sale.number + ' — ' + fecha + '\n' +
    'Método de pago: ' + metodo + '\n' +
    '----------------------------------------\n' +
    lineas + '\n' +
    '----------------------------------------\n' +
    'Subtotal: ' + fmt(sale.subtotal) + '\n' +
    (sale.discountAmt ? 'Descuento: −' + fmt(sale.discountAmt) + '\n' : '') +
    'IVA (' + settings.iva + '%): ' + fmt(sale.iva) + '\n' +
    'TOTAL: ' + fmt(sale.total);
  const copiar = () => {
    if(navigator.clipboard){
      navigator.clipboard.writeText(resumen).then(()=> toast('Datos de la venta copiados. Pegalos en el formulario de TicoFactura.', 'ok'))
        .catch(()=> window.prompt('Copiá estos datos para la factura:', resumen));
    } else {
      window.prompt('Copiá estos datos para la factura:', resumen);
    }
  };
  // copiar siempre y ofrecer abrir TicoFactura
  copiar();
  if(confirm('Se copiaron los datos de la venta. ¿Abrir el sistema de facturación de Hacienda ahora?')){
    window.open(TICO_FACTURA_URL, '_blank', 'noopener');
  }
}
function showTicoFacturaHelp(){
  const box = document.getElementById('ticoHelpBody');
  if(box) box.innerHTML =
    '<div class="tico-step"><b>1.</b> Entrá a <b>ovitribucr.hacienda.go.cr/home</b> con tu usuario de contribuyente (afiliado al Ministerio de Hacienda).</div>' +
    '<div class="tico-step"><b>2.</b> Usá el botón <b>«Crear factura en TicoFactura»</b> de cada venta: copia automáticamente productos, cantidades, precios, IVA y total que podés pegar en el formulario.</div>' +
    '<div class="tico-step"><b>3.</b> Completá los datos del cliente (o «Consumidor Final») y el medio de pago.</div>' +
    '<div class="tico-step"><b>4.</b> Confirmá el envío. TicoFactura genera el XML, lo firma con tu certificado y lo transmite a Hacienda. Ya tenés factura oficial.</div>';
  const modal = document.getElementById('ticoHelpModal');
  if(modal) modal.classList.add('show');
}
function closeTicoFacturaHelp(){ const m = document.getElementById('ticoHelpModal'); if(m) m.classList.remove('show'); }

/* ---------- FINANZAS DIARIAS ---------- */
function posIsLocalToday(ms){
  const d = new Date(ms||Date.now());
  const now = new Date();
  return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
}
function renderFinancePanel(){
  const t = financeToday || { openCash:0, salesCount:0, salesAmount:0, expenses:[] };
  const expenses = t.expenses || [];
  const webIncome = orders.filter(o=>o.status!=='cancelado' && posIsLocalToday(o.createdAtMs)).reduce((s,o)=>s+o.total,0);
  const income = (t.salesAmount||0) + webIncome;
  const expense = expenses.reduce((s,x)=>s+x.amount,0);
  const net = income - expense;
  document.getElementById('finIncome').textContent = fmt(income);
  document.getElementById('finIncomeSub').textContent = fmt(t.salesAmount) + ' POS + ' + fmt(webIncome) + ' web';
  document.getElementById('finExpense').textContent = fmt(expense);
  document.getElementById('finExpenseCount').textContent = expenses.length;
  document.getElementById('finNet').textContent = fmt(net);
  document.getElementById('finNet').parentElement.querySelector('.sub').textContent = 'neto sin contar la apertura';
  document.getElementById('finStatus').textContent = t.closed ? 'Cerrada' : 'Abierta';
  document.getElementById('finStatus').style.color = t.closed ? 'var(--green)' : '#B45309';
  document.getElementById('finOpenCash').value = (t.openCash||0) || '';
  renderFinanceExpenses();
  renderFinanceDayDetail(net);
}
function renderFinanceExpenses(){
  const t = financeToday || { expenses:[] };
  const expenses = t.expenses || [];
  const el = document.getElementById('finExpenseList');
  if(!expenses.length){
    el.innerHTML = '<div style="color:var(--muted);padding:8px 0">Sin gastos hoy.</div>';
    return;
  }
  el.innerHTML = '<table class="mini-table" style="width:100%"><thead><tr><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th><th style="text-align:right"></th></tr></thead><tbody>' +
    expenses.map(x=>'<tr><td>' + esc(x.desc) + '</td><td>' + esc(x.cat) + '</td><td class="r"><b>' + fmt(x.amount) + '</b></td><td class="r"><button class="icon-btn danger" title="Quitar" onclick="deleteFinanceExpense(\'' + x.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0-1 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 6"/></svg></button></td></tr>').join('') +
    '</tbody></table>';
}
function renderFinanceDayDetail(net){
  const t = financeToday || { openCash:0, salesCount:0, salesAmount:0, expenses:[] };
  const webIncome = orders.filter(o=>o.status!=='cancelado' && posIsLocalToday(o.createdAtMs)).reduce((s,o)=>s+o.total,0);
  const expense = (t.expenses||[]).reduce((s,x)=>s+x.amount,0);
  const rows = [
    ['Ventas punto de venta (POS)', (t.salesAmount||0)],
    ['Ventas tienda web', webIncome],
    ['RESUMEN DE INGRESOS', (t.salesAmount||0) + webIncome],
    ['Gastos del día', -(expense)],
    ['Neto del día', net]
  ];
  document.getElementById('finDayDetail').innerHTML = rows.map(([lbl,m],i)=>
    '<tr><td' + (i===2?' style="border-top:1.5px solid var(--line);font-weight:800"':'') + '>' + esc(lbl) + '</td><td class="r"><b style="color:' + (m<0?'var(--danger)':(i===2||i===4?'var(--green-dark)':'var(--ink)')) + '">' + fmt(m) + '</b></td></tr>').join('');
}
async function setFinanceOpenCash(){
  const val = Math.max(0, parseInt(document.getElementById('finOpenCash').value)||0);
  await financeRef(posDayKey()).set({ openCash: val, day: posDayKey() }, { merge:true });
  toast('Caja abierta con ' + fmt(val), 'ok');
}
async function addFinanceExpense(){
  const desc = (document.getElementById('finExpDesc').value||'').trim();
  const amount = Math.max(0, parseInt(document.getElementById('finExpAmount').value)||0);
  if(!desc){ toast('Escribí una descripción del gasto', 'err'); return; }
  if(amount <= 0){ toast('Ingresá un monto válido', 'err'); return; }
  const cat = document.getElementById('finExpCat').value || 'General';
  const cur = (financeToday && financeToday.expenses) || [];
  const t = financeToday || {};
  const updated = cur.concat([{ id: rid(), desc, cat, amount, at: new Date().toISOString() }]);
  await financeRef(posDayKey()).set({
    day: posDayKey(),
    expenses: updated,
    expensesCount: updated.length
  }, { merge:true });
  document.getElementById('finExpDesc').value = '';
  document.getElementById('finExpAmount').value = '';
  toast('Gasto registrado', 'ok');
  renderFinancePanel();
}
async function deleteFinanceExpense(id){
  const cur = (financeToday && financeToday.expenses) || [];
  const updated = cur.filter(x=>x.id!==id);
  await financeRef(posDayKey()).set({ expenses: updated, expensesCount: updated.length }, { merge:true });
  toast('Gasto eliminado', 'ok');
  renderFinancePanel();
}
async function financeCloseDay(){
  if(!financeToday || financeToday.closed){
    if(financeToday && financeToday.closed) toast('La caja de hoy ya está cerrada', 'err');
    return;
  }
  if(!confirm('¿Cerrar la caja del día de hoy?')) return;
  await financeRef(posDayKey()).set({ closed:true, closedAt: new Date().toISOString() }, { merge:true });
  toast('Caja del día cerrada', 'ok');
}

/* ---------- rastreo de pedido (cliente, estilo Uber Flash) ---------- */
function openTracking(){
  document.getElementById('trackForm').style.display = 'block';
  document.getElementById('trackResult').style.display = 'none';
  document.getElementById('trkNum').value = '';
  document.getElementById('trkPhone').value = '';
  document.getElementById('trackModal').classList.add('show');
}
function closeTracking(){ document.getElementById('trackModal').classList.remove('show'); }

async function trackOrder(){
  const num = document.getElementById('trkNum').value.trim();
  const last4 = document.getElementById('trkPhone').value.trim();
  if(!num || !last4){ toast('Ingresá el número de factura y tu teléfono', 'err'); return; }
  const box = document.getElementById('trackResult');
  try{
    const snap = await ordersCol.doc(num).get();
    if(!snap.exists || snap.data().trackPhone4 !== last4){
      document.getElementById('trackForm').style.display = 'none';
      box.style.display = 'block';
      box.innerHTML = '<div class="track-not-found">No encontramos un pedido con esos datos. Verificá el número de factura y tu teléfono.</div>' +
        '<button class="btn-ghost" onclick="openTracking()">Intentar de nuevo</button>';
      return;
    }
    renderTracking(snap.data());
  }catch(e){
    toast('No se pudo consultar el pedido', 'err');
    console.error(e);
  }
}
/* Arma el timeline visual de estados (recibido → confirmado → preparando → en camino → entregado),
   reutilizado tanto en el rastreo del cliente como en el detalle de pedido del admin. */
function orderStepsHTML(o){
  if(o.status === 'cancelado'){
    return '<div class="uber-step cancelled"><div class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></div><div class="txt"><b>Pedido cancelado</b><span>Contactanos por WhatsApp si tenés dudas</span></div></div>';
  }
  const doneIdx = UBER_STEPS.findIndex(s=>s.key===o.status);
  const timeMap = {};
  (o.timeline||[]).forEach(t=>{ timeMap[t.status] = t.at; });
  const steps = UBER_STEPS.map((s,i) => {
    const cls = (i < doneIdx ? 'done' : (i === doneIdx ? 'done current' : ''));
    const at = timeMap[s.key] ? new Date(timeMap[s.key]).toLocaleString('es-CR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
    const icon = i===0 ? '<path d="M9 11h6M9 15h4M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5z"/>' :
      i===1 ? '<path d="M20 6 9 17l-5-5"/>' :
      i===2 ? '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/>' :
      i===3 ? '<path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>' :
      '<path d="M20 6 9 17l-5-5"/>';
    return '<div class="uber-step ' + cls + '"><div class="line"></div>' +
      '<div class="dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + icon + '</svg></div>' +
      '<div class="txt"><b>' + s.lbl + '</b><span>' + (at || s.sub) + '</span></div></div>';
  }).join('');
  return '<div class="uber-track">' + steps + '</div>';
}
function renderTracking(o){
  document.getElementById('trackForm').style.display = 'none';
  const box = document.getElementById('trackResult');
  box.style.display = 'block';
  box.innerHTML =
    '<div class="trk-head"><b>Factura ' + esc(o.number) + '</b><span>' + fmt(o.total) + ' · ' + esc(o.customer.delivery) + '</span></div>' +
    orderStepsHTML(o) +
    '<button class="btn-ghost" onclick="openTracking()">Consultar otro pedido</button>';
}

/* ---------- configuraciones ---------- */
let pendingLogoDataUrl = null;
/* Iconos (foto) opcionales para los botones de enlaces externos de la tienda
   (sitio web y bingo). Se guardan como base64 igual que el logo, sin usar
   Firebase Storage. null = sin cambios pendientes; '' = el admin lo quitó. */
let pendingWebIcon = null;
let pendingBingoIcon = null;
/* ---------- claves enmascaradas (estado privado vía backend aiStatus) ----------
   El navegador NUNCA recibe la clave real: el servidor devuelve solo una
   versión enmascarada (ej: sk-or-v1-****abcd) y si existe. El admin la ve
   para saber que está guardada y puede reemplazarla escribiendo una nueva. */
let _masked = { openrouter:'', gemini:'', external:'' };
let _maskedPaypalSecret = '';
let _maskedCallmeKey = '';
let privatePaypal = {};
async function refreshMaskedAiKeys(){
  const setMask = (id, masked, exists, placeholder) => {
    const el = document.getElementById(id);
    if(!el) return;
    if(exists && masked){
      el.value = masked;
      el.placeholder = placeholder;
    } else {
      el.value = '';
      el.placeholder = placeholder;
    }
  };
  try{
    const st = await cloudCall('aiStatus', { slug: TENANT_ID });
    if(!st) return;
    const orSt = st.openrouter || {};
    const gmSt = st.gemini || {};
    const exSt = st.external || {};
    _masked.openrouter = orSt.masked || '';
    _masked.gemini = gmSt.masked || '';
    _masked.external = exSt.masked || '';
    setMask('sAiOpenrouterKey', _masked.openrouter, !!orSt.exists, orSt.exists ? ('Guardada: ' + _masked.openrouter + ' — escribí una nueva para reemplazarla') : 'sk-or-v1-...');
    setMask('sAiKey', _masked.gemini, !!gmSt.exists, gmSt.exists ? ('Guardada: ' + _masked.gemini + ' — escribí una nueva para reemplazarla') : 'Pegá tu API key de Gemini');
    setMask('sAiExternalKey', _masked.external, !!exSt.exists, exSt.exists ? ('Guardada: ' + _masked.external + ' — escribí una nueva para reemplazarla') : 'sk-... o la clave del proveedor elegido');
  }catch(e){
    console.warn('aiStatus no disponible (¿Cloud Functions desplegadas?):', e && e.message);
  }
}

/* Carga la config de WhatsApp de pagos del negocio desde privateSettings */
async function loadBizWhatsappConfig(){
  try{
    const snap = await privateSettingsRef.get();
    const p = (snap.exists && snap.data()) || {};
    const wpr = document.getElementById('sWaProvider');
    if(wpr) wpr.value = p.waProvider || 'twilio';
    const sid = document.getElementById('sWaSid');
    if(sid) sid.value = p.waSid || '';
    const auth = document.getElementById('sWaAuth');
    if(auth) auth.value = p.waAuth || '';
    const from = document.getElementById('sWaFrom');
    if(from) from.value = p.waFrom || 'whatsapp:+14155238886';
    const tok = document.getElementById('sWaToken');
    if(tok) tok.value = p.waToken || '';
    const ph = document.getElementById('sWaPhoneId');
    if(ph) ph.value = p.waPhoneId || '';
    /* Credenciales PayPal del negocio: el Client ID es público (se muestra),
       el Secret se muestra enmascarado (solo el servidor lo usa de verdad). */
    privatePaypal = { paypalClientId: p.paypalClientId || '', paypalSecret: p.paypalSecret || '' };
    const ppc = document.getElementById('sPaypalClientId');
    if(ppc) ppc.value = p.paypalClientId || '';
    const pps = document.getElementById('sPaypalSecret');
    if(pps){
      if(p.paypalSecret){
        _maskedPaypalSecret = p.paypalSecret.slice(0,6) + '****' + p.paypalSecret.slice(-4);
        pps.value = _maskedPaypalSecret;
        pps.placeholder = 'Guardada: ' + _maskedPaypalSecret + ' — escribí una nueva para reemplazarla';
      } else {
        _maskedPaypalSecret = '';
        pps.value = '';
        pps.placeholder = '****************************';
      }
    }
    /* CallMeBot del admin: el API key se muestra enmascarado si hay uno */
    const cmPhone = document.getElementById('sCallmePhone');
    if(cmPhone) cmPhone.value = p.callmePhone || '';
    const cmKey = document.getElementById('sCallmeApiKey');
    if(cmKey){
      if(p.callmeApiKey){
        _maskedCallmeKey = p.callmeApiKey.slice(0,4) + '****';
        cmKey.value = _maskedCallmeKey;
        cmKey.placeholder = 'Guardada: ' + _maskedCallmeKey + ' — escribí una nueva para reemplazarla';
      } else {
        _maskedCallmeKey = '';
        cmKey.value = '';
        cmKey.placeholder = 'tu-apikey';
      }
    }
    onBizWaProviderChange();
  }catch(e){ console.warn('No se pudo cargar config WhatsApp del negocio:', e && e.message); }
}
/* Muestra/oculta el bloque Twilio/Meta según el proveedor (negocio) */
function onBizWaProviderChange(){
  var v = document.getElementById('sWaProvider') ? document.getElementById('sWaProvider').value : 'twilio';
  var tw = document.getElementById('sBizWaTwilio');
  var meta = document.getElementById('sBizWaMeta');
  if(tw) tw.style.display = v === 'meta' ? 'none' : 'block';
  if(meta) meta.style.display = v === 'meta' ? 'block' : 'none';
}
function loadSettingsForm(){
  document.getElementById('sName').value = settings.storeName;
  document.getElementById('sTag').value = settings.tagline;
  document.getElementById('sHours').value = settings.hours;
  document.getElementById('sShip').value = settings.shipping;
  document.getElementById('sCats').value = settings.categories.join(', ');
  document.getElementById('sTipoProf').checked = settings.tipo === 'profesional';
  document.getElementById('sCategoriaProf').value = settings.categoria || '';
  document.getElementById('sServiciosProf').value = (settings.servicios||[]).join(', ');
  document.getElementById('profFieldsWrap').style.display = settings.tipo === 'profesional' ? '' : 'none';
  document.getElementById('sSinpe').value = settings.sinpe;
  document.getElementById('sCurrency').value = settings.currency || 'CRC';
  document.getElementById('sPayMethodLabel').value = settings.payMethodLabel || 'SINPE';
  document.getElementById('sPaypalMe').value = settings.paypalMe || '';
  document.getElementById('sPaypalEmail').value = settings.paypalEmail || '';
  document.getElementById('sPaypalCurrency').value = settings.paypalCurrency || 'USD';
  document.getElementById('sWa').value = settings.whatsapp;
  document.getElementById('sUberAddress').value = (settings.uberLocation && settings.uberLocation.address) || '';
  document.getElementById('sUberLat').value = (settings.uberLocation && settings.uberLocation.lat) || '';
  document.getElementById('sUberLng').value = (settings.uberLocation && settings.uberLocation.lng) || '';
  document.getElementById('sWebLabel').value = settings.websiteLabel||'Sitio web';
  document.getElementById('sWebUrl').value = settings.websiteUrl||'';
  document.getElementById('sBingoLabel').value = settings.bingoLabel||'Bingo de Plantas';
  document.getElementById('sBingoUrl').value = settings.bingoUrl||'';
  document.getElementById('sStoryVideoUrl').value = settings.storyVideoUrl||'';
  document.getElementById('sStoryVideoUrl2').value = settings.storyVideoUrl2||'';
  document.getElementById('sStoryVideoUrl3').value = settings.storyVideoUrl3||'';
  document.getElementById('sStoryVideoUrl4').value = settings.storyVideoUrl4||'';
  const svLockEl = document.getElementById('sStoryVideoLockNotice');
  if(svLockEl) svLockEl.style.display = (getActivePlanId() === 'emprendedor') ? '' : 'none';
  const svLockEl34 = document.getElementById('sStoryVideoLockNotice34');
  if(svLockEl34) svLockEl34.style.display = ['destacado','premium'].includes(getActivePlanId()) ? 'none' : '';
  document.getElementById('sIva').value = settings.iva || 13;
  document.getElementById('sDiscount').value = settings.globalDiscountPercent || 0;
  document.getElementById('sFacturaCedula').value = settings.facturaCedula || '';
  document.getElementById('sFacturaRazon').value = settings.facturaRazon || '';
  document.getElementById('sFacturaTelefono').value = settings.facturaTelefono || '';
  document.getElementById('sFacturaCorreo').value = settings.facturaCorreo || '';
  document.getElementById('sFacturaProvincia').value = settings.facturaProvincia || '';
  document.getElementById('sFacturaCanton').value = settings.facturaCanton || '';
  document.getElementById('sFacturaDistrito').value = settings.facturaDistrito || '';
  document.getElementById('sFacturaCondicion').value = settings.facturaCondicion || '01';
  document.getElementById('sFacturaDocumento').value = settings.facturaDocumento || '01';
  document.getElementById('sFacturaDigital').checked = !!settings.facturaDigital;
document.getElementById('sAiName').value = settings.aiAssistantName||'Cana';
  /* Las claves de API ya NO viven en settings público: se muestran enmascaradas
     (sk-or-****abcd) desde el estado privado vía el backend (aiStatus). */
  const _aiSessUser = auth.currentUser;
  const _isAdminOnlyView = !_aiSessUser || !isSuperAdminUser(_aiSessUser);
  const _saAiNotice = document.getElementById('sAiAdminOnlyNotice');
  const _saAiSuper = document.getElementById('sAiConfigSuperBlock');
  const _saBadge = document.getElementById('sAiVersionBadge');
  if(_saBadge) _saBadge.textContent = 'v2026.08.19-05';
  if(_saAiNotice) _saAiNotice.style.display = _isAdminOnlyView ? '' : 'none';
  // proveedor + claves + modelos: SOLO visibles para el superadministrador
  if(_saAiSuper) _saAiSuper.style.display = _isAdminOnlyView ? 'none' : '';
  console.log('[IA-ADMIN] email=' + (_aiSessUser ? _aiSessUser.email : 'null') + ' superadmin=' + _isAdminOnlyView + ' → superBlock.display=' + (_saAiSuper ? _saAiSuper.style.display : 'N/A'));
  if(!_isAdminOnlyView) refreshMaskedAiKeys(); // solo el superadmin ve claves (enmascaradas) y las ingresa
  const geminiModelEl = document.getElementById('sAiGeminiModel');
  if(geminiModelEl) geminiModelEl.value = settings.aiGeminiModel || 'gemini-2.0-flash';
  document.getElementById('sAiWelcome').value = settings.aiWelcomeMsg||'';
  document.getElementById('sAiEnabled').checked = !!settings.aiEnabled;
  document.getElementById('sAiProvider').value = settings.aiProvider || 'gemini';
  document.getElementById('sAiSystemPrompt').value = settings.aiSystemPrompt || '';
  // Deja el modelo guardado como única opción hasta que el negocio cargue la lista de OpenRouter
  const aiModelSel = document.getElementById('sAiModel');
  if(aiModelSel) aiModelSel.innerHTML = settings.aiModel ? '<option value="'+esc(settings.aiModel)+'">'+esc(settings.aiModel)+'</option>' : '<option value="">— Cargá los modelos primero —</option>';
const aiImgModelSel = document.getElementById('sAiImageModel');
  if(aiImgModelSel) aiImgModelSel.innerHTML = '<option value="'+esc(settings.aiImageModel || 'google/gemini-3.1-flash-lite-image')+'">'+esc(settings.aiImageModel || 'google/gemini-3.1-flash-lite-image')+'</option>';
  // Campos de API externa
const extProvEl = document.getElementById('sAiExternalProvider');
  if(extProvEl) extProvEl.value = settings.aiExternalProvider || 'openai';
  const extModelEl = document.getElementById('sAiExternalModel');
  if(extModelEl) extModelEl.value = settings.aiExternalModel || '';
  const extBaseEl = document.getElementById('sAiExternalBaseUrl');
  if(extBaseEl) extBaseEl.value = settings.aiExternalBaseUrl || '';
onExternalProviderChange();
  onAiProviderChange();
  // Re-forzar por seguridad: el contenedor de config avanzada queda oculto para admins de tienda
  if(_isAdminOnlyView){
    if(_saAiSuper) _saAiSuper.style.display = 'none';
    if(_saAiNotice) _saAiNotice.style.display = '';
  }
  const aiLockEl = document.getElementById('sAiLockNotice');
  if(aiLockEl) aiLockEl.style.display = (settings.aiSuperDisabled === true) ? '' : 'none';
  document.getElementById('sinpePreview').textContent = settings.sinpe;
  pendingLogoDataUrl = null;
  document.getElementById('logoPreview').innerHTML = settings.logoUrl ? '<img src="' + esc(settings.logoUrl) + '" alt="Logo">' : logoSVG;
  pendingWebIcon = null;
  pendingBingoIcon = null;
  document.getElementById('sWebIconPreview').innerHTML = settings.websiteIcon ? '<img src="' + esc(settings.websiteIcon) + '" alt="Icono">' : '';
  document.getElementById('sBingoIconPreview').innerHTML = settings.bingoIcon ? '<img src="' + esc(settings.bingoIcon) + '" alt="Icono">' : '';
  bizImages = (settings.landingImages && settings.landingImages.length) ? settings.landingImages.slice() : [];
  while(bizImages.length < 3) bizImages.push('');
renderBizImageGrid();
  checkLegacyMigration();
  renderBackupList();
  refreshStorePasswordStatus();
  showPermDebugHint();
  // Config de WhatsApp de pagos: viene del privateSettings del negocio
  loadBizWhatsappConfig();
  // Plan destacado / profesional / emprendedor
  const sponsEl = document.getElementById('sponsoredStatus');
  if(sponsEl){
    const plan = (TENANT_DATA && TENANT_DATA.plan) || 'basico';
    if(plan==='destacado'){
      sponsEl.textContent = '⭐ Plan Destacado activo — borde morado';
      sponsEl.style.color = 'var(--ruby-dark)';
    } else if(plan==='premium'){
      sponsEl.textContent = '🥇 Plan Profesional activo — borde dorado';
      sponsEl.style.color = '#92400E';
    } else {
      sponsEl.textContent = 'Plan Emprendedor — borde verde';
      sponsEl.style.color = 'var(--green-dark)';
    }
  }
}

function onTipoProfChanged(cb){
  document.getElementById('profFieldsWrap').style.display = cb.checked ? '' : 'none';
  markSettingsFormDirty();
}

/* ---------- diagnóstico visible de permisos (correo logueado vs adminEmails) ---------- */
function showPermDebugHint(){
  const box = document.getElementById('permDebugHint');
  if(!box) return;
  const me = (auth.currentUser && auth.currentUser.email) || '(sin sesión)';
  const list = (TENANT_DATA && TENANT_DATA.adminEmails) || [];
  const superAdmin = isSuperAdminUser(auth.currentUser);
  const autorizado = list.includes(me) || superAdmin;
  box.innerHTML = 'Sesión: <b>' + esc(me) + '</b> · Autorizados en Firestore: <b>' +
    (list.length ? esc(list.join(', ')) : '(vacío)') + '</b> · ' +
    (superAdmin ? '<span style="color:var(--ok,#1B7A43)">✔ superadministrador (acceso total)</span>' :
      (autorizado ? '<span style="color:var(--ok,#1B7A43)">✔ coincide</span>' : '<span style="color:var(--danger)">✘ no coincide</span>'));
}

/* ---------- clave extra de la tienda (segundo factor del panel admin) ---------- */
function refreshStorePasswordStatus(){
  const hasPass = !!(TENANT_DATA && TENANT_DATA.adminPasswordHash);
  document.getElementById('storePassStatus').textContent = hasPass ? 'Activada' : 'No configurada';
  document.getElementById('removeStorePassBtn').style.display = hasPass ? '' : 'none';
}
async function saveStorePassword(){
  const p1 = document.getElementById('sNewStorePass').value;
  const p2 = document.getElementById('sNewStorePass2').value;
  if(!p1 || p1.length < 4){ toast('La clave debe tener al menos 4 caracteres', 'err'); return; }
  if(p1 !== p2){ toast('Las claves no coinciden', 'err'); return; }
  try{
    const hash = await hashStorePassword(p1);
    await tenantRef().set({ adminPasswordHash: hash }, {merge:true});
    TENANT_DATA.adminPasswordHash = hash;
    storePasswordVerified = true; // ya la acaba de escribir en esta sesión
    document.getElementById('sNewStorePass').value = '';
    document.getElementById('sNewStorePass2').value = '';
    refreshStorePasswordStatus();
    toast('Clave de tienda guardada', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo guardar la clave: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
  }
}
async function removeStorePassword(){
  if(!confirm('¿Quitar la clave extra de esta tienda? Cualquier correo autorizado podrá entrar al panel sin ella.')) return;
  try{
    await tenantRef().set({ adminPasswordHash: firebase.firestore.FieldValue.delete() }, {merge:true});
    delete TENANT_DATA.adminPasswordHash;
    refreshStorePasswordStatus();
    toast('Clave de tienda eliminada', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo quitar la clave: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
  }
}

/* ---------- migración de datos del formato anterior (sin multi-tenant) ----------
   Antes de este cambio, TODA la tienda vivía en las colecciones raíz
   settings/products/orders. Ahora cada negocio vive en
   tenants/{slug}/settings|products|orders. Este botón, visible solo si
   detecta datos en el formato viejo, los copia (no los borra) hacia la
   tienda que se está administrando en este momento. */
let legacyCheckDone = false;
async function checkLegacyMigration(){
  if(legacyCheckDone) return;
  legacyCheckDone = true;
  try{
    const legacySettings = await db.collection('settings').doc('store').get();
    const legacyProducts = await db.collection('products').limit(1).get();
    if(legacySettings.exists || !legacyProducts.empty){
      const wrap = document.getElementById('migrationLegacyWrap');
      if(wrap) wrap.style.display = '';
    }
  }catch(e){
    /* sin datos viejos o sin permisos sobre la ruta anterior: no mostrar nada */
    console.error(e);
  }
}
async function runLegacyMigration(){
  const btn = document.getElementById('migrationBtn');
  const status = document.getElementById('migrationStatus');
  status.style.display = 'block';
btn.disabled = true;
  status.textContent = 'Migrando…';
  try{
    /* Respaldar el estado ACTUAL de la tienda antes de migrar, para poder
       revertir la migración si algo sale mal. Se guarda en backups/undo*. */
    await clearUndoBackup();
    const undoMeta = { at: firebase.firestore.FieldValue.serverTimestamp(), type:'legacyMigration', settings:false, products:0, orders:0 };
    const curSettingsSnap = await settingsRef.get();
    if(curSettingsSnap.exists){
      await tenantCol('backups').doc('undoSettings').set(curSettingsSnap.data());
      undoMeta.settings = true;
    }
    const curProductsSnap = await productsCol.get();
    let undoBatch = db.batch(), undoCount = 0;
    for(const d of curProductsSnap.docs){
      undoBatch.set(tenantCol('backups').doc('undoProducts').collection('items').doc(d.id), d.data());
      undoMeta.products++; undoCount++;
      if(undoCount >= 400){ await undoBatch.commit(); undoBatch = db.batch(); undoCount = 0; }
    }
    if(undoCount > 0) await undoBatch.commit();
    const curOrdersSnap = await ordersCol.get();
    undoBatch = db.batch(); undoCount = 0;
    for(const d of curOrdersSnap.docs){
      undoBatch.set(tenantCol('backups').doc('undoOrders').collection('items').doc(d.id), d.data());
      undoMeta.orders++; undoCount++;
      if(undoCount >= 400){ await undoBatch.commit(); undoBatch = db.batch(); undoCount = 0; }
    }
    if(undoCount > 0) await undoBatch.commit();
    await tenantCol('backups').doc('undoMeta').set(undoMeta);

    const migrated = { settings:false, products:0, orders:0 };

const legacySettingsSnap = await db.collection('settings').doc('store').get();
    if(legacySettingsSnap.exists){
      const legacyData = Object.assign({}, legacySettingsSnap.data());
      // Seguridad: nunca copiar claves de IA al doc público; si el formato viejo
      // las traía, se llevan directo a privateSettings (privado).
      const privKeys = {};
      ['aiOpenrouterKey','aiApiKey','aiExternalKey'].forEach(k => {
        if(typeof legacyData[k] === 'string' && legacyData[k].trim() !== ''){
          privKeys[k] = legacyData[k];
          delete legacyData[k];
        }
      });
      await settingsRef.set(legacyData, { merge:true });
      if(Object.keys(privKeys).length){
        try{ await privateSettingsRef.set(privKeys, { merge:true }); }
        catch(_e){ console.warn('privateSettings restringido a superadmin, no se migraron claves legacy:', _e.message); }
      }
      migrated.settings = true;
    }

    const legacyProductsSnap = await db.collection('products').get();
    let batch = db.batch(), count = 0;
    for(const d of legacyProductsSnap.docs){
      batch.set(productsCol.doc(d.id), d.data(), { merge:true });
      migrated.products++; count++;
      if(count >= 400){ await batch.commit(); batch = db.batch(); count = 0; }
    }
    if(count > 0) await batch.commit();

    const legacyOrdersSnap = await db.collection('orders').get();
    batch = db.batch(); count = 0;
    for(const d of legacyOrdersSnap.docs){
      batch.set(ordersCol.doc(d.id), d.data(), { merge:true });
      migrated.orders++; count++;
      if(count >= 400){ await batch.commit(); batch = db.batch(); count = 0; }
    }
    if(count > 0) await batch.commit();

    status.textContent = 'Listo — ' + (migrated.settings ? 'configuración migrada, ' : '') +
      migrated.products + ' producto(s) y ' + migrated.orders + ' pedido(s) copiados a esta tienda.';
    toast('Migración completa', 'ok');
  }catch(e){
    console.error(e);
    status.textContent = 'Ocurrió un error durante la migración. Revisá la consola o los permisos de Firestore.';
    toast('No se pudo migrar', 'err');
}finally{
    btn.disabled = false;
  }
}

/* ---------- revertir la migración (usa el respaldo undo creado antes de migrar) ---------- */
async function clearUndoBackup(){
  try{
    const metaSnap = await tenantCol('backups').doc('undoMeta').get();
    if(!metaSnap.exists) return;
    const meta = metaSnap.data() || {};
    const del = [tenantCol('backups').doc('undoMeta'), tenantCol('backups').doc('undoSettings')];
    if(meta.products){
      const items = await tenantCol('backups').doc('undoProducts').collection('items').get();
      let b = db.batch(), c = 0;
      for(const d of items.docs){ b.delete(d.ref); c++; if(c>=400){ await b.commit(); b = db.batch(); c = 0; } }
      if(c>0) await b.commit();
      del.push(tenantCol('backups').doc('undoProducts'));
    }
    if(meta.orders){
      const items = await tenantCol('backups').doc('undoOrders').collection('items').get();
      let b = db.batch(), c = 0;
      for(const d of items.docs){ b.delete(d.ref); c++; if(c>=400){ await b.commit(); b = db.batch(); c = 0; } }
      if(c>0) await b.commit();
      del.push(tenantCol('backups').doc('undoOrders'));
    }
    const batch = db.batch();
    del.forEach(r => { if(r) batch.delete(r); });
    await batch.commit();
  }catch(e){
    console.warn('clearUndoBackup:', e && e.message);
  }
}

async function revertLegacyMigration(){
  const status = document.getElementById('migrationStatus');
  status.style.display = 'block';
  try{
    const metaSnap = await tenantCol('backups').doc('undoMeta').get();
    if(!metaSnap.exists || (metaSnap.data()||{}).type !== 'legacyMigration'){
      status.textContent = 'No encontré una migración reciente para revertir (falta el respaldo undo).';
      status.style.color = 'var(--danger)';
      return;
    }
    if(!confirm('Se revertirá la migración: se restaurará la configuración y se eliminarán los productos/pedidos que trajo la migración. ¿Continuar?')) return;
    const meta = metaSnap.data() || {};
    status.textContent = 'Revertiendo…';
    status.style.color = 'var(--muted)';

    // configuración: restaurar el estado previo (o borrar si no existía)
    const undoSetSnap = await tenantCol('backups').doc('undoSettings').get();
    if(meta.settings && undoSetSnap.exists){
      await settingsRef.set(undoSetSnap.data());
    } else if(undoSetSnap.exists){
      await settingsRef.delete();
    }

    // productos: restaurar los que existían y borrar los agregados por la migración
    const bkItems = await tenantCol('backups').doc('undoProducts').collection('items').get();
    const bkIds = new Set(bkItems.docs.map(d => d.id));
    const curProductsSnap = await productsCol.get();
    let batch = db.batch(), count = 0, restored = 0, removed = 0;
    for(const d of curProductsSnap.docs){
      if(bkIds.has(d.id)){
        const old = bkItems.docs.find(x => x.id === d.id);
        if(old){ batch.set(productsCol.doc(d.id), old.data()); restored++; }
      } else {
        batch.delete(productsCol.doc(d.id)); removed++;
      }
      count++;
      if(count >= 400){ await batch.commit(); batch = db.batch(); count = 0; }
    }
    if(count > 0) await batch.commit();

    // pedidos: igual que productos
    const bkOrd = await tenantCol('backups').doc('undoOrders').collection('items').get();
    const bkOrdIds = new Set(bkOrd.docs.map(d => d.id));
    const curOrdersSnap = await ordersCol.get();
    batch = db.batch(); count = 0; let ordRestored = 0, ordRemoved = 0;
    for(const d of curOrdersSnap.docs){
      if(bkOrdIds.has(d.id)){
        const old = bkOrd.docs.find(x => x.id === d.id);
        if(old){ batch.set(ordersCol.doc(d.id), old.data()); ordRestored++; }
      } else {
        batch.delete(ordersCol.doc(d.id)); ordRemoved++;
      }
      count++;
      if(count >= 400){ await batch.commit(); batch = db.batch(); count = 0; }
    }
    if(count > 0) await batch.commit();

    await clearUndoBackup();
    status.textContent = 'Migración revertida: ' + restored + ' producto(s)/' + ordRestored + ' pedido(s) restaurados, ' + removed + ' producto(s)/' + ordRemoved + ' pedido(s) eliminados.';
    status.style.color = 'var(--ok,#1B7A43)';
    toast('Migración revertida', 'ok');
  }catch(e){
    console.error(e);
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudo revertir: ' + (e && e.message ? e.message : 'error');
    toast('No se pudo revertir', 'err');
  }
}

/* Comprime un string a gzip (ArrayBuffer) con la API nativa CompressionStream */
async function gzipBytes(text){
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
/* Descomprime gzip de vuelta a texto */
async function gunzipText(u8){
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
/* Caché rápida en IndexedDB del último backup comprimido (evita CORS al descargar) */
let _bkCacheDb = null;
function bkCacheDb(){
  if(_bkCacheDb) return Promise.resolve(_bkCacheDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('bk_cache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('blobs');
    req.onsuccess = () => { _bkCacheDb = req.result; resolve(_bkCacheDb); };
    req.onerror = () => reject(req.error);
  });
}
async function bkCachePut(key, u8){
  try{
    const db2 = await bkCacheDb();
    await new Promise((res, rej) => {
      const tx = db2.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(u8, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }catch(e){ console.warn('bkCachePut:', e); }
}
async function bkCacheGet(key){
  try{
    const db2 = await bkCacheDb();
    return await new Promise((res) => {
      const tx = db2.transaction('blobs', 'readonly');
      const rq = tx.objectStore('blobs').get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  }catch(e){ return null; }
}

/* ---------- copia de seguridad EN FIREBASE STORAGE (JSON comprimido gzip) ----------
   1) Se arma el JSON completo (settings + productos).
   2) Se COMPRIME con gzip (mucho menor peso).
   3) Se guarda en IndexedDB (caché local para descarga instantánea sin CORS)
      Y se sube a Firebase Storage (backups/{tenant}/{fecha}.json.gz).
   4) Firestore guarda solo metadata mínima. */
async function createTenantBackup(){
  const status = document.getElementById('backupStatus');
  status.style.display = 'block';
  status.style.color = 'var(--muted)';
  status.textContent = 'Creando copia de seguridad…';
  try{
    const setSnap = await settingsRef.get();
    const prodSnap = await productsCol.get();
    const settings = setSnap.exists ? setSnap.data() : {};
    const products = prodSnap.docs.map(d => ({ id: d.id, data: d.data() }));
    const payload = {
      app: 'MARKETCR',
      kind: 'backup-config-inventario',
      tenant: TENANT_ID,
      exportedAt: new Date().toISOString(),
      settings: settings,
      products: products
    };
    const rawText = JSON.stringify(payload);
    status.textContent = 'Comprimiendo copia…';
    const u8 = await gzipBytes(rawText);
    if(typeof firebase === 'undefined' || !firebase.storage){
      throw new Error('Firebase Storage no disponible en este navegador');
    }
    const stamp = Date.now();
    const name = 'backups/' + (TENANT_ID || 'x') + '/' + stamp + '.json.gz';
    const ref = firebase.storage().ref(name);
    const blob = new Blob([u8], { type: 'application/gzip' });
    status.textContent = 'Subiendo copia a Storage…';
    await ref.put(blob, { contentType: 'application/gzip', cacheControl: 'public,max-age=31536000' });
    await bkCachePut(name, u8);
    const meta = {
      at: new Date().toISOString(),
      type: 'manual',
      products: products.length,
      hasSettings: !!setSnap.exists,
      storagePath: name,
      bytes: blob.size
    };
    await tenantCol('backups').doc('bk_' + stamp + '_meta').set(meta);
    status.style.color = 'var(--ok,#1B7A43)';
    status.textContent = '✔ Copia creada y comprimida en Storage (' + (products.length ? products.length + ' producto(s)' : 'sin productos') + ', ' + (blob.size/1024).toFixed(0) + ' KB): ' + name;
    toast('Copia de seguridad creada (comprimida) en Storage', 'ok');
    renderBackupList();
  }catch(e){
    console.error(e);
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudo crear la copia: ' + (e && e.message ? e.message : 'error');
    toast('No se pudo crear la copia', 'err');
  }
}

/* listar copias de seguridad (metadatos en Firestore + archivo en Storage) */
async function renderBackupList(){
  try{
    const metas = await tenantCol('backups').limit(100).get();
    const list = document.getElementById('backupList');
    if(!list) return;
    const items = metas.docs
      .filter(d => /_meta$/.test(d.id) && (d.data()||{}).type === 'manual')
      .map(d => {
        const data = d.data();
        return {
          id: d.id.replace(/_meta$/,''),
          at: data.at || null,
          products: data.products || 0,
          bytes: data.bytes || 0,
          storagePath: data.storagePath || ''
        };
      })
      .sort((a,b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0))
      .slice(0,20);
    if(!items.length){ list.innerHTML = ''; return; }
    list.style.display = 'block';
    list.innerHTML = '<div style="margin-top:8px;font-size:12.5px">Copias guardadas:</div>' + items.map(m =>
      '<div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '• <code>' + esc(m.id) + '</code> — ' + esc(m.at ? new Date(m.at).toLocaleString() : 'reciente') +
        (m.products ? ' · ' + m.products + ' producto(s)' : '') +
        (m.bytes ? ' · ' + (m.bytes/1024).toFixed(0) + ' KB' : '') +
        (m.storagePath
          ? '<button type="button" class="btn-ghost" style="width:auto;padding:5px 10px;font-size:11.5px;color:var(--green);font-weight:700" onclick="restoreTenantBackup(this.dataset.path)" data-path="' + esc(m.storagePath) + '">↩ Restaurar</button>' +
            '<button type="button" class="btn-ghost" style="width:auto;padding:5px 10px;font-size:11.5px;color:var(--danger);font-weight:700" onclick="downloadTenantBackup(this.dataset.path, this.dataset.id)" data-path="' + esc(m.storagePath) + '" data-id="' + esc(m.id) + '">⬇ Descargar</button>'
          : '')
      + '</div>'
    ).join('');
  }catch(e){ /* sin permisos o sin copias: silencioso */ }
}

/* Restaurar una copia desde Storage: obtiene el .json.gz (caché o Storage),
   lo descomprime y aplica el JSON a Firestore. */
async function restoreTenantBackup(storagePath){
  if(!storagePath){ toast('No hay ruta de backup', 'err'); return; }
  if(!confirm('¿Restaurar esta copia de seguridad? Se sobreescribirá la configuración y se actualizarán/agregarán los productos (sin borrar otros).')) return;
  const status = document.getElementById('backupStatus');
  status.style.display = 'block';
  status.style.color = 'var(--muted)';
  status.textContent = 'Obteniendo copia de Storage…';
  try{
    let u8 = await bkCacheGet(storagePath);
    if(!u8){
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const ref = firebase.storage().ref(storagePath);
      const dlUrl = await ref.getDownloadURL();
      const res = await fetch(dlUrl);
      if(!res.ok) throw new Error('No se pudo descargar la copia (HTTP ' + res.status + ')');
      const buf = await res.arrayBuffer();
      u8 = new Uint8Array(buf);
    }
    status.textContent = 'Descomprimiendo copia…';
    const text = await gunzipText(u8);
    const payload = JSON.parse(text);
    if(!payload || payload.kind !== 'backup-config-inventario' || !payload.settings || !Array.isArray(payload.products)){
      throw new Error('El archivo de la copia no es válido (falta app/kind/settings/products).');
    }
    status.textContent = 'Aplicando copia… (' + payload.products.length + ' producto(s))';
    await settingsRef.set(payload.settings, { merge:true });
    let batch = db.batch(), count = 0;
    for(const p of payload.products){
      if(!p || !p.id) continue;
      batch.set(productsCol.doc(String(p.id)), p.data || {}, { merge:true });
      count++;
      if(count >= 400){ await batch.commit(); batch = db.batch(); count = 0; }
    }
    if(count > 0) await batch.commit();
    status.style.color = 'var(--ok,#1B7A43)';
    status.textContent = '✔ Copia restaurada: ' + payload.products.length + ' producto(s) procesados.';
    toast('Copia de seguridad restaurada', 'ok');
  }catch(e){
    console.error(e);
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudo restaurar: ' + (e && e.message ? e.message : 'error');
    toast('No se pudo restaurar la copia', 'err');
  }
}

/* Descargar el backup COMPRIMIDO (.json.gz) automáticamente al PC.
   Usa el caché IndexedDB si existe (descarga instantánea, sin CORS);
   si no, baja de Storage con fetch. Genera el archivo local y dispara
   la descarga automática con un <a download>. */
async function downloadTenantBackup(storagePath, id){
  try{
    let u8 = await bkCacheGet(storagePath);
    let desde = 'caché local';
    if(!u8){
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const ref = firebase.storage().ref(storagePath);
      const dlUrl = await ref.getDownloadURL();
      const res = await fetch(dlUrl);
      if(!res.ok) throw new Error('No se pudo descargar la copia (HTTP ' + res.status + ')');
      const buf = await res.arrayBuffer();
      u8 = new Uint8Array(buf);
      desde = 'Storage';
    }
    const blob = new Blob([u8], { type: 'application/gzip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (id || ('backup_' + TENANT_ID)) + '.json.gz';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 1000);
    toast('Descarga automática iniciada (' + desde + ', ' + (blob.size/1024).toFixed(0) + ' KB)', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo descargar la copia: ' + (e && e.message ? e.message : 'error'), 'err');
  }
}

/* ---------- exportar configuración + inventario a un archivo JSON ---------- */
async function exportTenantData(){
  try{
    const exportBtnMsg = document.getElementById('importStatus');
    exportBtnMsg.style.display = 'block';
    exportBtnMsg.textContent = 'Exportando…';
    const setSnap = await settingsRef.get();
    const settings = setSnap.exists ? setSnap.data() : {};
    const prodSnap = await productsCol.get();
    const products = prodSnap.docs.map(d => ({ id: d.id, data: d.data() }));
    const payload = {
      app: 'MARKETCR',
      kind: 'backup-config-inventario',
      tenant: TENANT_ID,
      exportedAt: new Date().toISOString(),
      settings: settings,
      products: products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_' + TENANT_ID + '_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    exportBtnMsg.textContent = '✔ Archivo descargado: ' + a.download;
    exportBtnMsg.style.color = 'var(--ok,#1B7A43)';
    toast('Exportación lista', 'ok');
  }catch(e){
    console.error(e);
    const m = document.getElementById('importStatus');
    if(m){ m.style.display='block'; m.style.color='var(--danger)'; m.textContent = 'No se pudo exportar: ' + (e && e.message ? e.message : 'error'); }
    toast('No se pudo exportar', 'err');
  }
}

/* ---------- importar configuración + inventario desde un archivo JSON ---------- */
function onImportTenantFileChosen(input){
  const file = input && input.files && input.files[0];
  input.value = '';
  if(!file) return;
  const status = document.getElementById('importStatus');
  status.style.display = 'block';
  status.style.color = 'var(--muted)';
  status.textContent = 'Leyendo archivo…';
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      let payload;
      try{ payload = JSON.parse(reader.result); }
      catch(_e){ throw new Error('El archivo no es un JSON válido'); }
      if(!payload || (payload.kind !== 'backup-config-inventario') || !payload.settings || !Array.isArray(payload.products)){
        throw new Error('El archivo no parece una copia exportada de esta plataforma (falta app/kind/settings/products).');
      }
      if(!confirm('Se importarán la configuración y ' + payload.products.length + ' producto(s) en la tienda "' + TENANT_ID + '". Los productos se actualizan/agregan sin borrar otros. ¿Continuar?')) return;
      status.textContent = 'Importando…';
      await settingsRef.set(payload.settings, { merge:true });
      let batch = db.batch(), count = 0;
      for(const p of payload.products){
        if(!p || !p.id) continue;
        batch.set(productsCol.doc(String(p.id)), p.data || {}, { merge:true });
        count++;
        if(count >= 400){ await batch.commit(); batch = db.batch(); count = 0; }
      }
      if(count > 0) await batch.commit();
      status.style.color = 'var(--ok,#1B7A43)';
      status.textContent = '✔ Importación lista: ' + payload.products.length + ' producto(s) procesados.';
      toast('Importación completada', 'ok');
    }catch(e){
      console.error(e);
      status.style.color = 'var(--danger)';
      status.textContent = 'No se pudo importar: ' + (e && e.message ? e.message : 'error');
      toast('No se pudo importar', 'err');
    }
  };
  reader.onerror = () => {
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudo leer el archivo.';
  };
  reader.readAsText(file);
}

/* ---------- subida de logo (comprimido a base64, sin Firebase Storage) ---------- */
function onLogoFileChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  compressImageFile(file, 400, 0.85).then(dataUrl => {
    pendingLogoDataUrl = dataUrl;
    document.getElementById('logoPreview').innerHTML = '<img src="' + dataUrl + '" alt="Logo">';
    toast('Logo cargado, recordá presionar "Guardar cambios"', 'ok');
  }).catch(()=> toast('No se pudo procesar la imagen del logo', 'err'));
  input.value = '';
}
function removeLogo(){
  pendingLogoDataUrl = '';
  document.getElementById('logoPreview').innerHTML = logoSVG;
}
/* Subir/quit ar una foto que se usa como ícono del botón de enlace externo
   ("web" o "bingo"). La imagen se comprime a base64 (igual que el logo). */
function onExternalIconFileChosen(input, key){
  const file = input.files && input.files[0];
  if(!file) return;
  /* Mantener el fondo transparente (PNG) para que el ícono se vea limpio
     sobre el botón de color. */
  compressImageToPng(file, 220).then(dataUrl => {
    if(key === 'web'){
      pendingWebIcon = dataUrl;
      document.getElementById('sWebIconPreview').innerHTML = '<img src="' + dataUrl + '" alt="Icono">';
    } else {
      pendingBingoIcon = dataUrl;
      document.getElementById('sBingoIconPreview').innerHTML = '<img src="' + dataUrl + '" alt="Icono">';
    }
    toast('Icono cargado con fondo transparente. Recordá presionar "Guardar cambios"', 'ok');
  }).catch(()=> toast('No se pudo procesar la imagen del ícono', 'err'));
  input.value = '';
}
function removeExternalIcon(key){
  if(key === 'web'){
    pendingWebIcon = '';
    document.getElementById('sWebIconPreview').innerHTML = '';
  } else {
    pendingBingoIcon = '';
    document.getElementById('sBingoIconPreview').innerHTML = '';
  }
}

/* Guarda el cambio de IVA/impuesto al instante (sin depender del botón).
   Se llama en el onchange del campo sIva. */
async function saveIvaImmediate(){
  try{
    const el = document.getElementById('sIva');
    let v = parseFloat(el.value);
    if(isNaN(v)) v = settings.iva || 0;
    v = Math.max(0, Math.min(100, v));
    el.value = v;
    await settingsRef.set({ iva: v }, { merge:true });
    /* Verificar que el write realmente se aplicó en Firestore (el SDK es
       optimista: con permisos incorrectos puede resolver sin escribir). */
    const chk = await settingsRef.get();
    let persisted = false;
    if(chk.exists){
      const chkIva = chk.data().iva;
      persisted = (chkIva === v) || (Math.abs(parseFloat(chkIva) - v) < 0.001);
    }
    settings.iva = v;
    try{ updateCartUI(); }catch(_e){}
    if(!persisted){
      const me2 = (auth.currentUser && auth.currentUser.email) || '(sin sesión)';
      const list2 = (TENANT_DATA && TENANT_DATA.adminEmails) || [];
      showPermDebugHint();
      toast('No persistió: ' + (me2 || 'sin sesión') + ' vs adminEmails [' + list2.join(', ') + ']', 'err');
      return;
    }
    toast('IVA actualizado a ' + v + '%', 'ok');
  }catch(e){
    toast('No se pudo guardar el IVA: ' + (e && e.message ? e.message : 'error'), 'err');
    console.error(e);
  }
}

async function saveSettings(){
  const name = document.getElementById('sName').value.trim();
  const sinpe = document.getElementById('sSinpe').value.trim();
  const wa = waDigits(document.getElementById('sWa').value);
  if(!name){ toast('El nombre de la tienda es obligatorio', 'err'); return; }
  /* Validaciones suaves: avisan pero NO bloquean el guardado, para que los
     demás cambios (IVA, descuento, precios, etc.) siempre se guarden. */
  if(waDigits(sinpe).length < 8 && waDigits(sinpe).length > 0){ toast('Aviso: el SINPE tiene menos de 8 dígitos. Revisá el número.', 'warn'); }
  if(wa.length > 0 && wa.length < 11){ toast('Aviso: el WhatsApp debería incluir el código de país (ej. 506+teléfono).', 'warn'); }
  /* El Asistente IA está disponible para todos los planes. Solo se bloquea si
     el superadministrador lo deshabilitó para este negocio (aiSuperDisabled). */
  if(document.getElementById('sAiEnabled').checked && settings.aiSuperDisabled === true){
    toast('El superadministrador ha deshabilitado el Asistente de IA para esta tienda.', 'err');
    document.getElementById('sAiEnabled').checked = false;
    return;
  }
const cats = document.getElementById('sCats').value.split(',').map(s=>s.trim()).filter(Boolean);
  /* Claves de API: nunca van al documento público. Se extraen acá para
     escribirlas en privateSettings (privado) y NO se incluyen en "data". */
  const newGemKey = document.getElementById('sAiKey').value.trim();
  const newORKey  = document.getElementById('sAiOpenrouterKey').value.trim();
  const newExtKey = document.getElementById('sAiExternalKey').value.trim();
  const data = {
    storeName:name,
    tagline:document.getElementById('sTag').value.trim(),
    hours:document.getElementById('sHours').value.trim(),
    shipping:document.getElementById('sShip').value.trim(),
    categories: cats.length ? cats : ['General'],    sinpe, whatsapp: wa,
    currency: ['CRC','USD','EUR'].includes(document.getElementById('sCurrency').value) ? document.getElementById('sCurrency').value : 'CRC',
    payMethodLabel: document.getElementById('sPayMethodLabel').value.trim() || 'SINPE',
    paypalMe: (function(){
      var raw = document.getElementById('sPaypalMe').value.trim();
      /* Extraer solo el usuario: acepta paypal.me/user, paypal.com/paypalme/user, www… */
      raw = raw.replace(/^https?:\/\/(www\.)?paypal\.(com|me)\/paypalme\//i,'').replace(/^https?:\/\/(www\.)?paypal\.me\//i,'').replace(/[?#].*$/,'').replace(/^\/+|\/+$/g,'');
      return raw.replace(/@/g,'');
    })(),
    paypalEmail: document.getElementById('sPaypalEmail').value.trim(),
    paypalCurrency: ['USD','EUR','CRC'].includes(document.getElementById('sPaypalCurrency').value) ? document.getElementById('sPaypalCurrency').value : 'USD',
    paypalClientId: (document.getElementById('sPaypalClientId').value || '').trim(),
    websiteUrl:document.getElementById('sWebUrl').value.trim(),
    websiteLabel:document.getElementById('sWebLabel').value.trim() || 'Sitio web',
    websiteIcon: pendingWebIcon !== null ? pendingWebIcon : (settings.websiteIcon||''),
    bingoUrl:document.getElementById('sBingoUrl').value.trim(),
    bingoLabel:document.getElementById('sBingoLabel').value.trim() || 'Bingo de Plantas',
    bingoIcon: pendingBingoIcon !== null ? pendingBingoIcon : (settings.bingoIcon||''),
    iva: (function(){ var v = parseFloat(document.getElementById('sIva').value); return isNaN(v) ? settings.iva||13 : Math.max(0, Math.min(100, v)); })(),
    globalDiscountPercent: (function(){ var v = parseFloat(document.getElementById('sDiscount').value); return isNaN(v) ? 0 : Math.max(0, Math.min(100, v)); })(),
    facturaEmisor: document.getElementById('sFacturaRazon').value.trim() || settings.storeName,
    facturaCedula: document.getElementById('sFacturaCedula').value.trim(),
    facturaRazon: document.getElementById('sFacturaRazon').value.trim(),
    facturaTelefono: document.getElementById('sFacturaTelefono').value.trim(),
    facturaCorreo: document.getElementById('sFacturaCorreo').value.trim(),
    facturaProvincia: document.getElementById('sFacturaProvincia').value.trim(),
    facturaCanton: document.getElementById('sFacturaCanton').value.trim(),
    facturaDistrito: document.getElementById('sFacturaDistrito').value.trim(),
    facturaCondicion: document.getElementById('sFacturaCondicion').value || '01',
    facturaDocumento: document.getElementById('sFacturaDocumento').value || '01',
    facturaDigital: document.getElementById('sFacturaDigital').checked,
    storyVideoUrl:document.getElementById('sStoryVideoUrl').value.trim(),
    storyVideoUrl2:document.getElementById('sStoryVideoUrl2').value.trim(),
    storyVideoUrl3:document.getElementById('sStoryVideoUrl3').value.trim(),
    storyVideoUrl4:document.getElementById('sStoryVideoUrl4').value.trim(),
aiEnabled: document.getElementById('sAiEnabled').checked,
    aiConfigured: false, // se corrige tras guardar, con el estado real del backend
    aiGeminiModel: (document.getElementById('sAiGeminiModel').value.trim() || 'gemini-2.0-flash'),
    aiAssistantName: document.getElementById('sAiName').value.trim() || 'Cana',
    aiWelcomeMsg: document.getElementById('sAiWelcome').value.trim() || DEFAULT_SETTINGS.aiWelcomeMsg,
    aiProvider: (['openrouter','external','gemini'].includes(document.getElementById('sAiProvider').value) ? document.getElementById('sAiProvider').value : 'gemini'),
    aiModel: document.getElementById('sAiModel').value.trim(),
    aiImageModel: document.getElementById('sAiImageModel').value.trim(),
    aiSystemPrompt: document.getElementById('sAiSystemPrompt').value.trim(),
    aiExternalProvider: document.getElementById('sAiExternalProvider').value || 'openai',
    aiExternalModel: document.getElementById('sAiExternalModel').value.trim(),
    aiExternalBaseUrl: (document.getElementById('sAiExternalBaseUrl') ? document.getElementById('sAiExternalBaseUrl').value.trim() : ''),
    logoUrl: pendingLogoDataUrl !== null ? pendingLogoDataUrl : (settings.logoUrl||''),
    landingImages: bizImages.map(u=>u.trim()).filter(Boolean),
    tipo: document.getElementById('sTipoProf').checked ? 'profesional' : '',
    categoria: document.getElementById('sCategoriaProf').value.trim(),
    servicios: document.getElementById('sServiciosProf').value.split(',').map(s=>s.trim()).filter(Boolean),
    /* Ubicación del negocio (origen del cotizador de mensajería) — la ingresa el
       propio administrador de la tienda. */
    uberLocation: {
      address: document.getElementById('sUberAddress').value.trim(),
      lat: document.getElementById('sUberLat').value.trim(),
      lng: document.getElementById('sUberLng').value.trim()
    }
  };
try{
    await saveSettingsToDB(data);
    /* Migración de seguridad: si este tenant todavía tenía claves en el doc
       público (formato viejo), se mueven a privateSettings y se eliminan de
       settings para que ningún visitante pueda leerlas. */
    await migrateStoreKeys(TENANT_ID);
    /* Escribir claves NUEVAS en privateSettings. Dejar el campo vacío (o con
       el valor enmascarado) = conservar la clave guardada. */
    const priv = {};
    if(newORKey && newORKey !== _masked.openrouter) priv.aiOpenrouterKey = newORKey;
    if(newGemKey && newGemKey !== _masked.gemini) priv.aiApiKey = newGemKey;
    if(newExtKey && newExtKey !== _masked.external) priv.aiExternalKey = newExtKey;
    /* Credenciales PayPal del NEGOCIO (privadas: el Secret solo lo lee el servidor) */
    const ppClientEl = document.getElementById('sPaypalClientId');
    const ppSecretEl = document.getElementById('sPaypalSecret');
    if(ppClientEl && ppClientEl.value.trim()) priv.paypalClientId = ppClientEl.value.trim();
    if(ppSecretEl && ppSecretEl.value.trim() && ppSecretEl.value !== _maskedPaypalSecret) priv.paypalSecret = ppSecretEl.value.trim();
    /* Config de notificación de pagos por WhatsApp del NEGOCIO (privada) */
    const wProvEl = document.getElementById('sWaProvider');
    const wSidEl = document.getElementById('sWaSid');
    const wAuthEl = document.getElementById('sWaAuth');
    const wFromEl = document.getElementById('sWaFrom');
    const wTokEl = document.getElementById('sWaToken');
    const wPhEl = document.getElementById('sWaPhoneId');
    if(wProvEl) priv.waProvider = wProvEl.value || 'twilio';
    if(wSidEl) priv.waSid = wSidEl.value.trim();
    if(wAuthEl) priv.waAuth = wAuthEl.value.trim();
    if(wFromEl) priv.waFrom = wFromEl.value.trim() || 'whatsapp:+14155238886';
    /* CallMeBot del admin (WhatsApp personal) */
    const cmPhoneEl = document.getElementById('sCallmePhone');
    if(cmPhoneEl && cmPhoneEl.value.trim()) priv.callmePhone = cmPhoneEl.value.trim();
    const cmKeyEl = document.getElementById('sCallmeApiKey');
    if(cmKeyEl && cmKeyEl.value.trim() && cmKeyEl.value !== _maskedCallmeKey) priv.callmeApiKey = cmKeyEl.value.trim();
    if(wTokEl) priv.waToken = wTokEl.value.trim();
    if(wPhEl) priv.waPhoneId = wPhEl.value.trim();
    if(Object.keys(priv).length) await privateSettingsRef.set(priv, { merge:true });
    /* Refrescar el flag público "aiConfigured" con el estado real del backend
       (el navegador no puede saber si hay clave: solo el servidor). */
    try{
      const st = await cloudCall('aiStatus', { slug: TENANT_ID });
      if(st && typeof st.configured === 'boolean' && st.configured !== settings.aiConfigured){
        await settingsRef.update({ aiConfigured: st.configured });
      }
    }catch(_e){ /* sin funciones desplegadas: se mantiene el flag actual */ }
    // Mantiene sincronizados el nombre, la descripción, el logo, las fotos
    // y el tipo de negocio (tienda / profesional) de esta tienda con su
    // tarjeta en la pantalla de inicio (tenants/{slug}), así lo que se
    // edita acá aparece automáticamente en el landing y en la sección
    // "Contactá un profesional" cuando corresponda.
    const tenantMirror = {
      nombre: data.storeName,
      tagline: data.tagline,
      logoUrl: data.logoUrl,
      landingImages: data.landingImages,
      tipo: data.tipo,
      categoria: data.categoria,
      servicios: data.servicios,
      whatsapp: data.whatsapp,
      activo: true
    };
    // Fecha de registro para el panel de superadministrador: solo se
    // fija la primera vez (si el tenant aún no la tiene), nunca se pisa.
    if(!TENANT_DATA || !TENANT_DATA.createdAt){
      tenantMirror.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    await tenantRef().set(tenantMirror, { merge:true });
    /* Refrescar la configuración en memoria y la UI para que el IVA/descuento
       nuevos se apliquen al carrito, POS y facturas sin recargar la página. */
    settings = Object.assign({}, settings, data);
    _CURRENCY = ['CRC','USD','EUR'].includes(settings.currency) ? settings.currency : 'CRC';
    try{ updateCartUI(); }catch(_e){}
    settingsFormDirty = false;
    pendingLogoDataUrl = null;
    pendingWebIcon = null;
    pendingBingoIcon = null;
    document.getElementById('sinpePreview').textContent = sinpe;
    toast('Configuración guardada', 'ok');
  }catch(e){
    const me = (auth.currentUser && auth.currentUser.email) || '(sin sesión)';
    const list = (TENANT_DATA && TENANT_DATA.adminEmails) || [];
    toast('No se pudo guardar: ' + (e && e.message ? e.message : 'error desconocido') +
      ' — sesión: ' + me + ' / autorizados: ' + (list.length ? list.join(', ') : '(vacío)'), 'err');
    showPermDebugHint();
    console.error(e);
  }
}

/* ---------- selector de negocios (multi-tenant) ---------- */
function goToTenant(slug){
  location.href = location.pathname + '?tienda=' + encodeURIComponent(slug);
}
function tenantCardMedia(images, nombre){
  if(images && images.length){
    const imgs = images.map((url,i)=> '<img src="' + url + '" alt="' + nombre + '" loading="lazy" decoding="async"' + (i===0?' fetchpriority="high" class="active"':' fetchpriority="low"') + '>').join('');
    const dots = images.length > 1
      ? '<div class="ts-dots">' + images.map((_,i)=> '<span class="ts-dot' + (i===0?' active':'') + '"></span>').join('') + '</div>'
      : '';
    return imgs + dots;
  }
  return '<span class="ts-fallback-wrap"><span class="ts-fallback">' + nombre.charAt(0).toUpperCase() + '</span></span>';
}
let tsCarouselTimer = null;
function startTenantCarousel(){
  if(tsCarouselTimer) clearInterval(tsCarouselTimer);
  tsCarouselTimer = setInterval(()=>{
    document.querySelectorAll('.ts-media').forEach(media=>{
      const imgs = media.querySelectorAll('img');
      if(imgs.length < 2) return;
      let idx = 0;
      imgs.forEach((img,i)=>{ if(img.classList.contains('active')) idx = i; });
      const next = (idx + 1) % imgs.length;
      imgs[idx].classList.remove('active');
      imgs[next].classList.add('active');
      const dots = media.querySelectorAll('.ts-dot');
      if(dots.length){
        dots[idx].classList.remove('active');
        dots[next].classList.add('active');
      }
    });
  }, 3200);
}
function renderTenantCards(docs){
  const list = document.getElementById('tenantSelectorList');
  if(tsCarouselTimer){ clearInterval(tsCarouselTimer); tsCarouselTimer = null; }
  if(!docs || !docs.length){
    list.innerHTML = '<div class="ts-empty" style="color:rgba(255,255,255,.75)">No encontramos tiendas con ese criterio.</div>';
    return;
  }
  /* Ordenar: patrocinados primero */
  const sorted = [...docs].sort((a,b)=>{
    const rankA = a.planRank||0, rankB = b.planRank||0;
    return rankB - rankA;
  });
  list.innerHTML = sorted.map(t=>{
    const nombre = esc(t.nombre || t.id);
    const logo = t.logoUrl
      ? '<img src="' + esc(t.logoUrl) + '" alt="' + nombre + '">'
      : '<span class="ts-fallback">' + nombre.charAt(0).toUpperCase() + '</span>';
    const tag = t.tagline ? '<span class="ts-tag">' + esc(t.tagline) + '</span>' : '';
    /* Info extra de portada: categoría/servicios, ubicación y rating */
    const cat = t.categoria ? '<span class="ts-chip">' + esc(t.categoria) + '</span>' : '';
    const meta = t.ciudad || t.direccion ? '<span class="ts-meta">' + sk('pin') + esc(t.ciudad || t.direccion || '') + '</span>' : '';
    const rating = t.rating ? '<span class="ts-meta ts-rating">' + sk('star') + esc(t.rating) + '</span>' : '';
    const media = tenantCardMedia(t.landingImages, nombre);
    // 3 niveles de plan: destacado = morado, profesional = dorado, básico = verde
    const tier = t.plan==='destacado' ? 'destacado' : (t.plan==='premium' ? 'profesional' : 'emprendedor');
    const tierTag = tier==='destacado'
      ? '<span class="ts-sponsored-tag"><span class="sponsored-badge"><svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px"><path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1z"/></svg>Destacada</span></span>'
      : tier==='profesional'
        ? '<span class="ts-sponsored-tag"><span class="profesional-badge"><svg viewBox="0 0 24 24" fill="currentColor" style="width:11px;height:11px"><path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1z"/></svg>Profesional</span></span>'
        : '';
    return '<button class="ts-card tier-' + tier + '" onclick="goToTenant(\'' + t.id.replace(/'/g,'') + '\')">' +
      '<span class="ts-media" style="position:relative">' + media + tierTag + '</span>' +
      '<span class="ts-body">' +
        '<span class="ts-name-row"><span class="ts-logo">' + logo + '</span><span class="ts-name">' + nombre + '</span></span>' +
        tag +
        '<span class="ts-meta-row">' + cat + rating + meta + '</span>' +
        '<span class="ts-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
      '</span>' +
      '</button>';
  }).join('');
  startTenantCarousel();
}

async function renderTenantSelector(msg){
  document.body.classList.add('selector-mode');
  const yearEl = document.getElementById('tsYear');
  if(yearEl) yearEl.textContent = new Date().getFullYear();
  /* Cargar la config del landing principal (portada del selector) */
  try{ await loadPlanConfig(); }catch(e){}
  const msgBox = document.getElementById('tenantSelectorMsg');
  if(msg){ msgBox.textContent = msg; msgBox.style.display = 'inline-block'; }
  else { msgBox.style.display = 'none'; }
  const list = document.getElementById('tenantSelectorList');
  list.innerHTML = '<div class="ts-loading">Cargando negocios…</div>';
  if(tsCarouselTimer){ clearInterval(tsCarouselTimer); tsCarouselTimer = null; }
  try{
    /* Cargar tiendas (tipo != 'profesional' o sin campo tipo) */
    const q = await db.collection('tenants').where('activo','==', true).get();
    const stores = [];
    const profs = [];
    q.docs.forEach(d=>{
      const t = Object.assign({id:d.id}, d.data());
      if(t.tipo === 'profesional') profs.push(t);
      else stores.push(t);
    });
    _allTenants = stores;
    _professionals = profs;
    if(!stores.length){
      list.innerHTML = '<div class="ts-empty" style="color:rgba(255,255,255,.75)">Todavía no hay negocios activos en la plataforma.</div>';
    } else {
      renderTenantCards(stores);
    }
    /* Render de profesionales */
    renderProfessionals(profs);
  }catch(e){
    console.error(e);
    list.innerHTML = '<div class="ts-empty" style="color:rgba(255,255,255,.75)">No se pudieron cargar los negocios. Intentá de nuevo.</div>';
  }
  /* Aplicar la config del landing (título, colores, imagen de fondo, fondo
     dinámico) una vez la portada está visible. */
  try{ applyLandingConfig(); }catch(e){ console.warn('applyLandingConfig:', e); }
}

/* ---------- init ---------- */
/* ---------- siembra única de negocios de ejemplo ----------
   Se dispara visitando la página con ?sembrar=1 en la URL (no requiere
   abrir la consola del navegador). Crea 5 negocios de ejemplo si todavía
   no existen, para poder editarlos después desde el panel administrador. */
async function seedDemoTenants(){
  const box = document.getElementById('tenantSelectorList');
  const msgBox = document.getElementById('tenantSelectorMsg');
  document.body.classList.add('selector-mode');
  msgBox.style.display = 'inline-block';
  msgBox.textContent = 'Creando negocios de ejemplo…';
  box.innerHTML = '<div class="ts-loading">Un momento…</div>';
  const negocios = [
    { slug:'vivero-el-roble',      nombre:'Vivero El Roble',      tagline:'Editá esta info desde el panel administrador' },
    { slug:'jardineria-dona-flor', nombre:'Jardinería Doña Flor', tagline:'Editá esta info desde el panel administrador' },
    { slug:'plantas-y-macetas-cr', nombre:'Plantas & Macetas CR', tagline:'Editá esta info desde el panel administrador' },
    { slug:'ecojardin',            nombre:'EcoJardín',            tagline:'Editá esta info desde el panel administrador' },
    { slug:'rincon-verde',         nombre:'Rincón Verde',         tagline:'Editá esta info desde el panel administrador' }
  ];
  const creados = [];
  try{
    for(const n of negocios){
      const ref = db.collection('tenants').doc(n.slug);
      const existing = await ref.get();
      if(existing.exists){ continue; }
      await ref.set({
        nombre: n.nombre,
        tagline: n.tagline,
        activo: true,
        logoUrl: '',
        landingImages: [],
        adminEmails: ['admin@canaan.com']
      });
      creados.push(n.slug);
    }
    msgBox.textContent = creados.length
      ? 'Listo: se crearon ' + creados.length + ' negocio(s) nuevo(s). Entrando a la pantalla de inicio…'
      : 'Los 5 negocios de ejemplo ya existían, no se creó nada nuevo.';
  }catch(e){
    console.error(e);
    msgBox.textContent = 'No se pudo sembrar: ' + (e && e.message ? e.message : 'error desconocido');
  }
  setTimeout(()=>{ location.href = location.pathname; }, 2200);
}

/* ======================================================================
   MÓDULO DE ANALYTICS — rastrea visitas, clics WA, búsquedas y fuente
   de tráfico en Firestore (tenants/{slug}/analytics/summary).
   Los datos son acumulativos; se actualizan con FieldValue.increment
   para ser seguros con múltiples visitantes simultáneos.
   ====================================================================== */
function detectTrafficSource(){
  const ref = document.referrer || '';
  if(!ref) return 'Directo';
  if(ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('l.facebook')) return 'Facebook';
  if(ref.includes('instagram.com')) return 'Instagram';
  if(ref.includes('google.com') || ref.includes('google.co')) return 'Google';
  if(ref.includes('tiktok.com')) return 'TikTok';
  if(ref.includes('wa.me') || ref.includes('whatsapp.com')) return 'WhatsApp';
  if(ref.includes('t.co') || ref.includes('twitter.com') || ref.includes('x.com')) return 'X / Twitter';
  if(ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube';
  // mismo dominio → directo (recarga)
  try{ if(new URL(ref).hostname === location.hostname) return 'Directo'; }catch(e){}
  return 'Otro enlace';
}

function analyticsCol(){ return TENANT_ID ? tenantRef().collection('analytics') : null; }
let _analyticsSessionDone = false;

async function trackPageVisit(){
  if(_analyticsSessionDone || !TENANT_ID) return;
  _analyticsSessionDone = true;
  const source = detectTrafficSource();
  const today = new Date().toISOString().slice(0,10);
  const monthKey = today.slice(0,7); // "2026-08"
  try{
    const col = analyticsCol();
    // Resumen total (últimos 30 días, acumulativo)
    await col.doc('summary').set({
      totalVisits: firebase.firestore.FieldValue.increment(1),
      [`sources.${source}`]: firebase.firestore.FieldValue.increment(1),
      lastVisit: today
    }, {merge:true});
    // Visitas por día (para futuras gráficas diarias)
    await col.doc('daily_' + today).set({
      visits: firebase.firestore.FieldValue.increment(1),
      date: today, month: monthKey
    }, {merge:true});
  }catch(e){ console.warn('Analytics visit track error:', e); }
}

async function trackWAClick(){
  if(!TENANT_ID) return;
  try{
    await analyticsCol().doc('summary').set({
      waClicks: firebase.firestore.FieldValue.increment(1)
    }, {merge:true});
  }catch(e){}
}

/* Botón "Contactar por WhatsApp" de cada tarjeta/servicio, cuando la
   tienda es de tipo "profesional" (sin carrito). Arma un mensaje con el
   nombre del servicio/trabajo y registra el clic en analytics. */
function profItemContactWA(id){
  const p = products.find(x=>x.id===id);
  const name = p ? p.name : '';
  const msg = 'Hola ' + (settings.storeName||'') + ', vi "' + name + '" en tu perfil y quisiera más información.';
  window.open('https://wa.me/' + waDigits(settings.whatsapp) + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  trackWAClick();
}

async function trackShare(){
  if(!TENANT_ID) return;
  try{
    await analyticsCol().doc('summary').set({
      shares: firebase.firestore.FieldValue.increment(1)
    }, {merge:true});
  }catch(e){}
}

/* Botón "Compartir" del encabezado: comparte el enlace propio de ESTE
   tenant (la URL actual con ?tienda=slug) y registra el conteo en
   analytics para que el administrador/profesional lo vea en su panel. */
function shareStoreLink(){
  const url = location.href.split('#')[0];
  const logo = settings.logoUrl || '';
  document.getElementById('shareQR').src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(url);
  const logoEl = document.getElementById('shareLogo');
  if(logo){ logoEl.src = logo; logoEl.style.display = 'block'; }
  else { logoEl.style.display = 'none'; }
  document.getElementById('shareTitle').textContent = 'Escaneá y visitá ' + (settings.storeName || 'nuestra tienda');
  document.getElementById('shareModal').classList.add('show');
}
function closeShareModal(){ document.getElementById('shareModal').classList.remove('show'); }
function nativeShareStore(){
  const url = location.href.split('#')[0];
  const title = (settings.storeName || 'Tienda') + (isProfessionalStore ? ' — Perfil profesional' : ' — Tienda en línea');
  const text = isProfessionalStore
    ? 'Mirá el perfil de ' + (settings.storeName || 'este profesional') + ':'
    : 'Mirá el catálogo de ' + (settings.storeName || 'esta tienda') + ':';
  if(navigator.share){
    navigator.share({ title, text, url }).then(()=>trackShare()).catch(()=>{});
  } else {
    copyStoreLink();
  }
}
function copyStoreLink(){
  const url = location.href.split('#')[0];
  navigator.clipboard.writeText(url).then(()=>{
    toast('Enlace copiado al portapapeles', 'ok');
    trackShare();
  }).catch(()=>{
    window.prompt('Copiá el enlace de tu tienda:', url);
    trackShare();
  });
}

async function trackSearch(query){
  if(!TENANT_ID || !query || query.length < 2) return;
  try{
    await analyticsCol().doc('summary').set({
      totalSearches: firebase.firestore.FieldValue.increment(1)
    }, {merge:true});
  }catch(e){}
}

async function trackProductView(){
  if(!TENANT_ID) return;
  try{
    await analyticsCol().doc('summary').set({
      productViews: firebase.firestore.FieldValue.increment(1)
    }, {merge:true});
  }catch(e){}
}

/* Carga y renderiza los datos de analytics en el panel de admin */
async function loadAnalytics(){
  const col = analyticsCol();
  if(!col) return;
  try{
    const snap = await col.doc('summary').get();
    const d = snap.exists ? snap.data() : {};
    const visits = d.totalVisits || 0;
    const waClicks = d.waClicks || 0;
    const searches = d.totalSearches || 0;
    const pvs = d.productViews || 0;
    const shares = d.shares || 0;
    document.getElementById('stVisits').textContent = visits.toLocaleString('es-CR');
    document.getElementById('stVisitsSub').textContent = d.lastVisit ? 'Última visita: ' + d.lastVisit : 'Sin visitas aún';
    document.getElementById('stWaClicks').textContent = waClicks.toLocaleString('es-CR');
    document.getElementById('stSearches').textContent = searches.toLocaleString('es-CR');
    document.getElementById('stProductViews').textContent = pvs.toLocaleString('es-CR');
    const stSharesEl = document.getElementById('stShares');
    if(stSharesEl) stSharesEl.textContent = shares.toLocaleString('es-CR');

    // Tabla de fuentes de tráfico
    const sources = d.sources || {};
    const SOURCE_ICONS = {
      'Facebook':'🔵','Instagram':'🟣','Google':'🔴','TikTok':'⚫','WhatsApp':'🟢',
      'YouTube':'🔴','X / Twitter':'⚪','Directo':'🏠','Otro enlace':'🔗'
    };
    const entries = Object.entries(sources).sort((a,b)=>b[1]-a[1]);
    const totalSrc = entries.reduce((s,[,v])=>s+v, 0) || 1;
    const tbody = document.getElementById('trafficSourceTable');
    if(!entries.length){
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">Aún no hay datos de tráfico. Las visitas aparecerán aquí automáticamente.</td></tr>';
    } else {
      tbody.innerHTML = entries.map(([src,cnt])=>{
        const pct = Math.round((cnt/totalSrc)*100);
        return '<tr><td><span class="tf-bar"><span class="traffic-source-icon">' + (SOURCE_ICONS[src]||'🔗') + '</span>' + esc(src) + '</span></td>' +
          '<td><b>' + cnt.toLocaleString('es-CR') + '</b></td>' +
          '<td>' + pct + '%</td>' +
          '<td><div class="tf-bar"><div class="traffic-bar-bg"><div class="traffic-bar-fill" style="width:' + pct + '%"></div></div></div></td></tr>';
      }).join('');
    }
  }catch(e){ console.warn('Analytics load error:', e); }
}

/* ======================================================================
   MÓDULO DE PROFESIONALES — tiendas con tipo "profesional" en Firestore
   muestran tarjeta de contacto en lugar de catálogo de productos.
   Campo en tenants/{slug}: tipo = "profesional"
   Campos adicionales: nombre, tagline, whatsapp, categoria, servicios[],
   logoUrl, landingImages[], activo:true
   ====================================================================== */
let _professionals = [];

async function loadProfessionals(){
  try{
    const q = await db.collection('tenants')
      .where('activo','==', true)
      .where('tipo','==','profesional')
      .get();
    _professionals = q.docs.map(d => Object.assign({id:d.id}, d.data()));
    renderProfessionals(_professionals);
  }catch(e){
    console.warn('Prof load error:', e);
    document.getElementById('profGrid').innerHTML =
      '<div class="ts-empty" style="color:rgba(255,255,255,.7)">No se pudieron cargar los profesionales.</div>';
  }
}

function renderProfessionals(list){
  const grid = document.getElementById('profGrid');
  if(!list || !list.length){
    grid.innerHTML = '<div class="ts-empty" style="color:rgba(255,255,255,.7);grid-column:1/-1">Próximamente profesionales disponibles.</div>';
    return;
  }
  grid.innerHTML = list.map(p => {
    const nombre = esc(p.nombre || p.id);
    const cat = esc(p.categoria || 'Servicios');
    const tagline = esc(p.tagline || '');
    const wa = p.whatsapp ? String(p.whatsapp).replace(/\D/g,'') : '';
    const img = (p.landingImages && p.landingImages[0]) ? p.landingImages[0] : null;
    const mediaHTML = img
      ? '<img src="' + img + '" alt="' + nombre + '" loading="lazy">'
      : '<div class="prof-avatar-fallback">' + (p.nombre||'P').charAt(0).toUpperCase() + '</div>';
    const services = (p.servicios || []).slice(0,3).map(s => '<span class="prof-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>' + esc(s) + '</span>').join('');
    const waBtn = wa
      ? '<button class="prof-wa-btn" onclick="event.stopPropagation();profContactWA(\'' + wa + '\',\'' + nombre + '\')">' +
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z"/></svg>Contactar por WhatsApp</button>'
      : '';
    const viewStoreBtn = '<button class="prof-view-store-btn" onclick="event.stopPropagation();goToTenant(\'' + esc(p.id) + '\')">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg>Ver tienda</button>';
    return '<div class="prof-card" onclick="goToTenant(\'' + esc(p.id) + '\')">' +
      '<div class="prof-card-media">' + mediaHTML + '<span class="prof-cat-badge">' + cat + '</span></div>' +
      '<div class="prof-card-body">' +
        '<div class="prof-name">' + nombre + '</div>' +
        (tagline ? '<div class="prof-tagline">' + tagline + '</div>' : '') +
        (services ? '<div class="prof-meta">' + services + '</div>' : '') +
        '<div class="prof-btn-row">' + viewStoreBtn + waBtn + '</div>' +
      '</div></div>';
  }).join('');
}

function profContactWA(wa, nombre){
  const msg = encodeURIComponent('Hola ' + nombre + ', vi tu perfil en PRO.DIGITAL y me gustaría cotizar un servicio.');
  window.open('https://wa.me/' + wa + '?text=' + msg, '_blank', 'noopener');
}

function openProfModal(id){
  const p = _professionals.find(x=>x.id===id);
  if(!p) return;
  const nombre = esc(p.nombre || p.id);
  const wa = p.whatsapp ? String(p.whatsapp).replace(/\D/g,'') : '';
  const img = (p.landingImages && p.landingImages[0]) ? p.landingImages[0] : null;
  const avatarHTML = img
    ? '<img src="' + img + '" alt="' + nombre + '">'
    : (p.nombre||'P').charAt(0).toUpperCase();
  const servicesHTML = (p.servicios || []).map(s =>
    '<span class="prof-service-chip">' + esc(s) + '</span>'
  ).join('');
  const waBtn = wa
    ? '<button class="prof-wa-btn" style="margin-top:16px" onclick="profContactWA(\'' + wa + '\',\'' + nombre + '\')">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z"/></svg>Contactar ahora por WhatsApp</button>'
    : '';
  document.getElementById('profModalBody').innerHTML =
    '<div class="prof-modal-header">' +
      '<div class="prof-modal-avatar">' + avatarHTML + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:18px;font-weight:800;line-height:1.2">' + nombre + '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:4px">' + esc(p.categoria || 'Profesional independiente') + '</div>' +
        (p.tagline ? '<div style="font-size:13.5px;margin-top:6px;color:var(--ink)">' + esc(p.tagline) + '</div>' : '') +
      '</div>' +
    '</div>' +
    (p.bio ? '<p style="font-size:14px;color:var(--muted);line-height:1.55;margin-bottom:12px">' + esc(p.bio) + '</p>' : '') +
    (servicesHTML ? '<div style="margin-bottom:8px"><b style="font-size:13px">Servicios</b><div class="prof-services">' + servicesHTML + '</div></div>' : '') +
    (p.zona ? '<div style="font-size:13px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' + esc(p.zona) + '</div>' : '') +
    waBtn;
  document.getElementById('profModal').classList.add('show');
}
function closeProfModal(){ document.getElementById('profModal').classList.remove('show'); }

/* Filtro de búsqueda del landing (filtra tiendas Y profesionales) */
let _allTenants = [];
function filterLanding(){
  const q = (document.getElementById('tsSearchInput').value||'').toLowerCase().trim();
  if(!q){
    renderTenantCards(_allTenants);
    renderProfessionals(_professionals);
    return;
  }
  const ft = _allTenants.filter(t => (t.nombre||t.id).toLowerCase().includes(q) || (t.tagline||'').toLowerCase().includes(q));
  const fp = _professionals.filter(p =>
    (p.nombre||p.id).toLowerCase().includes(q) ||
    (p.tagline||'').toLowerCase().includes(q) ||
    (p.categoria||'').toLowerCase().includes(q) ||
    (p.servicios||[]).some(s=>s.toLowerCase().includes(q))
  );
  renderTenantCards(ft);
  renderProfessionals(fp);
}

/* ======================================================================
   MÓDULO SUPERADMINISTRADOR — vista maestra de TODA la plataforma.
   Se activa con ?superadmin=1 en la URL (ver bootPlatform). Usa el mismo
   Firebase Auth que las tiendas, pero valida el correo contra
   SUPERADMIN_EMAILS (arriba en la config) en vez de contra el
   adminEmails de una tienda puntual. Lee y escribe directo en la
   colección raíz "tenants" (todas las tiendas y profesionales).
   ====================================================================== */
let isSuperadminMode = false;
let isSuperadminSession = false;
let _saTenants = [];

function initSuperadminMode(){
  isSuperadminMode = true;
  document.body.classList.add('superadmin-mode');
  // Verificar sesión actual inmediata
  const user = auth.currentUser;
  const isSuper = user && SUPERADMIN_EMAILS.includes(user.email);
  console.log('[SUPERADMIN DEBUG] user:', user?.email, 'isSuper:', isSuper, 'SUPERADMIN_EMAILS:', SUPERADMIN_EMAILS);
  if(isSuper){
    isSuperadminSession = true;
    document.getElementById('superadminLoginModal').classList.add('show');
    document.getElementById('superadminView').style.display = '';
    loadSuperadminData();
    return;
  }
  // Si no hay sesión, escuchar cambios
  auth.onAuthStateChanged(user => {
    isSuperadminSession = !!(user && SUPERADMIN_EMAILS.includes(user.email));
    console.log('[SUPERADMIN DEBUG] onAuthStateChanged user:', user?.email, 'isSuper:', isSuperadminSession);
    document.getElementById('superadminLoginModal').classList.toggle('show', !isSuperadminSession);
    document.getElementById('superadminView').style.display = isSuperadminSession ? '' : 'none';
    if(isSuperadminSession) loadSuperadminData();
  });
}

function openSaChangePasswordModal(){
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.zIndex = '301';
  modal.innerHTML = `
    <div class="modal-bg" onclick="closeSaChangePasswordModal()"></div>
    <div class="modal-card">
      <div class="modal-head"><h3>Cambiar contraseña de superadmin</h3>
        <button class="close-x" onclick="closeSaChangePasswordModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="modal-body">
        <div class="f-group"><label>Correo actual</label><input class="f-input" type="email" id="saNewPassEmail" value="" readonly></div>
        <div class="f-group"><label>Nueva contraseña</label><input class="f-input" type="password" id="saNewPassNew" placeholder="••••••••"></div>
        <div class="f-group"><label>Confirmar nueva contraseña</label><input class="f-input" type="password" id="saNewPassConfirm" placeholder="••••••••"></div>
        <div id="saChangePassMsg" style="color:var(--danger);font-size:12.5px;margin-top:4px;display:none"></div>
      </div>
      <div class="modal-foot">
        <button class="btn-primary" onclick="saveSaNewPassword()">Guardar nueva contraseña</button>
        <button class="btn-ghost" onclick="closeSaChangePasswordModal()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeSaChangePasswordModal(){
  const modal = document.querySelector('.modal:last-child');
  if(modal) document.body.removeChild(modal);
}

async function saveSaNewPassword(){
  const newPass = document.getElementById('saNewPassNew').value;
  const confirmPass = document.getElementById('saNewPassConfirm').value;
  const msg = document.getElementById('saChangePassMsg');
  if(!newPass || newPass.length < 6){ msg.textContent = 'La contraseña debe tener mínimo 6 caracteres'; msg.style.display='block'; return; }
  if(newPass !== confirmPass){ msg.textContent = 'Las contraseñas no coinciden'; msg.style.display='block'; return; }
  msg.style.display = 'none';
  try{
    const user = auth.currentUser;
    if(user) await user.updatePassword(newPass);
    msg.textContent = 'Contraseña actualizada exitosamente ✓';
    msg.style.display = 'block';
    setTimeout(closeSaChangePasswordModal, 1500);
  }catch(e){
    msg.textContent = 'Error al cambiar contraseña: ' + (e && e.message ? e.message : 'error desconocido');
    msg.style.display = 'block';
  }
}

async function doSuperadminLogin(){
  const email = document.getElementById('saEmail').value.trim();
  const pass = document.getElementById('saPass').value;
  const msg = document.getElementById('saLoginMsg');
  msg.style.display = 'none';
  if(!email || !pass){ msg.textContent = 'Ingresá correo y contraseña.'; msg.style.display='block'; return; }
  try{
    await auth.signInWithEmailAndPassword(email, pass);
    if(!SUPERADMIN_EMAILS.includes(email)){
      await auth.signOut();
      msg.textContent = 'Este correo no tiene acceso de superadministrador.';
      msg.style.display = 'block';
      return;
    }
  }catch(e){
    msg.textContent = 'No se pudo iniciar sesión: ' + (e && e.message ? e.message : 'error desconocido');
    msg.style.display = 'block';
  }
}
async function doSuperadminLogout(){
  await auth.signOut();
  isSuperadminSession = false;
  document.getElementById('superadminLoginModal').classList.add('show');
  document.getElementById('superadminView').style.display = 'none';
}
/* Volver a la pantalla anterior desde el panel superadmin */
function saGoBack(){
  location.href = location.pathname;
}

async function loadSuperadminData(){
  const tbody = document.getElementById('saTableBody');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">Cargando…</td></tr>';
  try{
    const snap = await db.collection('tenants').get();
    _saTenants = snap.docs.map(d => Object.assign({id:d.id}, d.data()));
_saTenants.sort((a,b) => (a.nombre||a.id).localeCompare(b.nombre||b.id, 'es'));
    saLoadAiKeyFlags();
    renderSuperadminSummary();
    renderSuperadminTable();
    saPopulateAiSlugSelect();
  }catch(e){
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--danger);padding:24px">No se pudo cargar la lista de negocios: ' + esc(e && e.message ? e.message : 'error desconocido') + '</td></tr>';
  }
}

function renderSuperadminSummary(){
  const tiendas = _saTenants.filter(t => t.tipo !== 'profesional');
  const profs = _saTenants.filter(t => t.tipo === 'profesional');
  const alDia = _saTenants.filter(t => (t.estadoPago||'al_dia') === 'al_dia').length;
  const pend = _saTenants.filter(t => t.estadoPago === 'pendiente').length;
  const venc = _saTenants.filter(t => t.estadoPago === 'vencido').length;
  const pendingPlans = _saTenants.filter(t => t.planApprovalStatus === 'pendiente').length;
  const montoTotal = _saTenants.reduce((s,t) => s + (Number(t.montoMensual)||0), 0);
  document.getElementById('saCountTiendas').textContent = tiendas.length;
  document.getElementById('saCountProf').textContent = profs.length;
  document.getElementById('saCountAlDia').textContent = alDia;
  document.getElementById('saCountPend').textContent = pend;
  document.getElementById('saCountVenc').textContent = venc;
  document.getElementById('saMontoTotal').textContent = fmt(montoTotal);
  const pendEl = document.getElementById('saCountPendingPlans');
  if(pendEl){
    pendEl.textContent = pendingPlans;
    pendEl.closest('.stat-card').style.display = pendingPlans > 0 ? '' : 'none';
  }
  /* Suscripciones nuevas pendientes (venían del landing con subSource:'landing') */
  const newSubs = _saTenants.filter(t => t.subSource === 'landing' && t.planApprovalStatus === 'pendiente').length;
  const subEl = document.getElementById('saCountNewSubs');
  if(subEl){
    subEl.textContent = newSubs;
    subEl.closest('.stat-card').style.display = newSubs > 0 ? '' : 'none';
  }
}

function saFechaLabel(t){
  try{
    if(t.createdAt && typeof t.createdAt.toDate === 'function'){
      return t.createdAt.toDate().toLocaleDateString('es-CR', {year:'numeric', month:'2-digit', day:'2-digit'});
    }
  }catch(e){}
  return '—';
}

function renderSuperadminTable(){
  const tbody = document.getElementById('saTableBody');
  const q = (document.getElementById('saFilterInput').value||'').toLowerCase().trim();
  const fTipo = document.getElementById('saFilterTipo').value;
  const fEstado = document.getElementById('saFilterEstado').value;
  const fPlan = document.getElementById('saFilterPlan').value;
  let list = _saTenants.slice();
  if(q) list = list.filter(t => (t.nombre||t.id).toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  if(fTipo === 'profesional') list = list.filter(t => t.tipo === 'profesional');
  else if(fTipo === 'tienda') list = list.filter(t => t.tipo !== 'profesional');
  if(fEstado) list = list.filter(t => (t.estadoPago||'al_dia') === fEstado);
  if(fPlan === 'pendiente_aprobacion') list = list.filter(t => t.planApprovalStatus === 'pendiente');
  else if(fPlan) list = list.filter(t => (t.membershipPlan||'emprendedor') === fPlan);

  if(!list.length){
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px">No hay negocios que coincidan con el filtro.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(t => {
    const tipoLabel = t.tipo === 'profesional'
      ? '<span class="pay-pill tipo-profesional">Profesional</span>'
      : '<span class="pay-pill tipo-tienda">Tienda</span>';
    const estado = t.estadoPago || 'al_dia';
    const activo = t.activo !== false;
    const url = location.pathname + '?tienda=' + encodeURIComponent(t.id);
    const adminUrl = url + '&panel=admin';

    // — columna de plan —
    const planActivo = t.membershipPlan || 'emprendedor';
    const planApproval = t.planApprovalStatus || 'aprobado'; // 'pendiente' | 'aprobado' | 'rechazado'
    const planApprovedId = t.planApprovedId || 'emprendedor'; // plan que está realmente habilitado
    const PLAN_NAMES = {emprendedor:'Emprendedor', profesional:'Profesional', destacado:'Destacado'};

    let planHtml = '';
    if(planApproval === 'pendiente'){
      planHtml = '<div style="display:flex;flex-direction:column;gap:4px">' +
        '<span class="plan-pill pendiente-aprobacion">⏳ Solicita: ' + esc(PLAN_NAMES[planActivo]||planActivo) + '</span>' +
        '<span class="plan-pill basico" style="font-size:10px">Activo: ' + esc(PLAN_NAMES[planApprovedId]||planApprovedId) + '</span>' +
        '<button class="sa-mini-btn" style="font-size:11px;padding:5px 10px;background:#F59E0B;margin-top:2px" onclick="openSaPlanModal(\'' + esc(t.id) + '\')">Revisar pago</button>' +
      '</div>';
    } else {
      const planClass = planApprovedId === 'destacado' ? 'destacado' : (planApprovedId === 'profesional' ? 'profesional' : 'emprendedor');
      planHtml = '<div style="display:flex;flex-direction:column;gap:4px">' +
        '<span class="plan-pill ' + planClass + '">' +
          (planApprovedId === 'destacado' ? '⭐' : planApprovedId === 'profesional' ? '🚀' : '🌱') + ' ' +
          esc(PLAN_NAMES[planApprovedId]||planApprovedId) +
        '</span>' +
        (t.membershipNextDueDate ? '<span style="font-size:10.5px;color:var(--muted)">Vence: ' + new Date(t.membershipNextDueDate).toLocaleDateString('es-CR') + '</span>' : '') +
        '<button class="sa-mini-btn ghost" style="font-size:11px;padding:5px 10px;margin-top:2px" onclick="openSaPlanModal(\'' + esc(t.id) + '\')">Gestionar plan</button>' +
      '</div>';
    }

    return '<tr data-tenant-row="' + esc(t.id) + '">' +
      '<td><b>' + esc(t.nombre || t.id) + '</b><br><span style="color:var(--muted);font-size:11.5px">' + esc(t.id) + '</span></td>' +
      '<td>' + tipoLabel + '</td>' +
      '<td>' + saFechaLabel(t) + '</td>' +
      '<td><input class="f-input" type="number" inputmode="decimal" data-sa-monto="' + esc(t.id) + '" value="' + (Number(t.montoMensual)||0) + '" style="width:110px"></td>' +
      '<td><select class="sort-select" data-sa-estado="' + esc(t.id) + '">' +
        '<option value="al_dia"' + (estado==='al_dia'?' selected':'') + '>Al día</option>' +
        '<option value="pendiente"' + (estado==='pendiente'?' selected':'') + '>Pendiente</option>' +
        '<option value="vencido"' + (estado==='vencido'?' selected':'') + '>Vencido</option>' +
      '</select></td>' +
      '<td class="sa-plan-col">' + planHtml + '</td>' +
      '<td><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" data-sa-activo="' + esc(t.id) + '" ' + (activo?'checked':'') + '> Activo</label></td>' +
      '<td><a class="sa-mini-link" href="' + url + '" target="_blank" rel="noopener">Ver</a> · <a class="sa-mini-link" href="' + adminUrl + '" target="_blank" rel="noopener" title="Entra directo al panel de administración de este negocio, con tu propia sesión de superadministrador">Administrar</a></td>' +
      '<td><div class="sa-actions-cell">' +
        '<button class="sa-mini-btn" onclick="saSaveTenantRow(\'' + esc(t.id) + '\')">Guardar</button>' +
        '<button class="sa-mini-btn ghost" onclick="saOpenEditModal(\'' + esc(t.id) + '\')">Editar</button>' +
        '<button class="sa-mini-btn danger" onclick="saDeleteTenant(\'' + esc(t.id) + '\')">Eliminar</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

async function saSaveTenantRow(id){
  const monto = Number(document.querySelector('[data-sa-monto="'+id+'"]').value) || 0;
  const estadoPago = document.querySelector('[data-sa-estado="'+id+'"]').value;
  const activo = document.querySelector('[data-sa-activo="'+id+'"]').checked;
  try{
    await db.collection('tenants').doc(id).set({ montoMensual: monto, estadoPago, activo }, {merge:true});
    const t = _saTenants.find(x=>x.id===id);
    if(t){ t.montoMensual = monto; t.estadoPago = estadoPago; t.activo = activo; }
    renderSuperadminSummary();
    toast('Negocio actualizado', 'ok');
  }catch(e){
    toast('No se pudo guardar: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}

/* ---------- editar toda la información de un negocio (modal completo) ---------- */
let _saEditingId = null;
let saEditLogoDataUrl = null;   // null = sin cambios; '' = quitar; string = nuevo logo
let saEditBizImages = ['','',''];
let saEditImgSlot = null;
function renderSaEditImageGrid(){
  const grid = document.getElementById('saEditBizImgGrid');
  if(!grid) return;
  grid.innerHTML = saEditBizImages.map((url,i) => {
    const preview = url ?
      '<img src="' + url + '">' :
      '<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg><span>Subir foto</span></div>';
    return '<div class="media-item' + (url?' filled':' upload') + '" onclick="triggerSaEditImageUpload(' + i + ')" title="' + (url?'Cambiar foto':'Subir foto') + '">' +
      preview +
      (url ? '<button type="button" class="rm-btn" onclick="event.stopPropagation();removeSaEditImageField(' + i + ')" title="Quitar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' : '') +
    '</div>';
  }).join('');
}
function triggerSaEditImageUpload(i){ saEditImgSlot = i; document.getElementById('saEditBizImgFileInput').click(); }
function onSaEditImageFileChosen(input){
  const file = input.files && input.files[0];
  const slot = saEditImgSlot;
  if(!file || slot===null){ input.value=''; return; }
  compressImageFile(file, 1600, 0.82).then(dataUrl => {
    saEditBizImages[slot] = dataUrl;
    renderSaEditImageGrid();
  }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  input.value = '';
}
function removeSaEditImageField(i){
  saEditBizImages.splice(i,1);
  while(saEditBizImages.length < 3) saEditBizImages.push('');
  renderSaEditImageGrid();
}
function onSaEditLogoFileChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  compressImageFile(file, 400, 0.85).then(dataUrl => {
    saEditLogoDataUrl = dataUrl;
    document.getElementById('saEditLogoPreview').innerHTML = '<img src="' + dataUrl + '" alt="Logo">';
  }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  input.value = '';
}
function removeSaEditLogo(){
  saEditLogoDataUrl = '';
  document.getElementById('saEditLogoPreview').innerHTML = logoSVG;
}
function saOpenEditModal(id){
  const t = _saTenants.find(x=>x.id===id);
  if(!t) return;
  _saEditingId = id;
  document.getElementById('saEditSlug').value = id;
  document.getElementById('saEditNombre').value = t.nombre || '';
  document.getElementById('saEditTipo').value = t.tipo === 'profesional' ? 'profesional' : '';
  document.getElementById('saEditWhatsapp').value = t.whatsapp || '';
  document.getElementById('saEditCategoria').value = t.categoria || '';
  document.getElementById('saEditServicios').value = (t.servicios || []).join(', ');
  document.getElementById('saEditAdminEmails').value = (t.adminEmails || []).join(', ');
  document.getElementById('saEditMonto').value = Number(t.montoMensual) || 0;
  document.getElementById('saEditEstado').value = t.estadoPago || 'al_dia';
  document.getElementById('saEditActivo').checked = t.activo !== false;
  const saEditPlanEl = document.getElementById('saEditPlan');
  if(saEditPlanEl) saEditPlanEl.value = t.planApprovedId || t.membershipPlan || 'emprendedor';
  loadPlanConfig().then(renderPlanConfigUI);
  saEditLogoDataUrl = null;
  document.getElementById('saEditLogoPreview').innerHTML = t.logoUrl ? '<img src="' + esc(t.logoUrl) + '" alt="Logo">' : logoSVG;
  saEditBizImages = (t.landingImages && t.landingImages.length) ? t.landingImages.slice() : [];
  while(saEditBizImages.length < 3) saEditBizImages.push('');
  renderSaEditImageGrid();
  document.getElementById('saEditModal').classList.add('show');
}
function saCloseEditModal(){
  document.getElementById('saEditModal').classList.remove('show');
  _saEditingId = null;
}
async function saSaveEditModal(){
  if(!_saEditingId) return;
  const id = _saEditingId;
  const nombre = document.getElementById('saEditNombre').value.trim();
  if(!nombre){ toast('El nombre es obligatorio', 'err'); return; }
  const prev = _saTenants.find(x=>x.id===id) || {};
  const saEditPlanEl = document.getElementById('saEditPlan');
  const saEditPlanId = saEditPlanEl ? saEditPlanEl.value : (prev.planApprovedId || 'emprendedor');
  const data = {
    nombre,
    tipo: document.getElementById('saEditTipo').value,
    whatsapp: waDigits(document.getElementById('saEditWhatsapp').value),
    categoria: document.getElementById('saEditCategoria').value.trim(),
    servicios: document.getElementById('saEditServicios').value.split(',').map(s=>s.trim()).filter(Boolean),
    adminEmails: document.getElementById('saEditAdminEmails').value.split(',').map(s=>s.trim()).filter(Boolean),
    montoMensual: Number(document.getElementById('saEditMonto').value) || 0,
    estadoPago: document.getElementById('saEditEstado').value,
    activo: document.getElementById('saEditActivo').checked,
    logoUrl: saEditLogoDataUrl !== null ? saEditLogoDataUrl : (prev.logoUrl || ''),
    landingImages: saEditBizImages.map(u=>u.trim()).filter(Boolean),
    // Plan activo aprobado
    planApprovedId: saEditPlanId,
    membershipPlan: saEditPlanId,
    planApprovalStatus: 'aprobado',
    plan: saEditPlanId === 'destacado' ? 'destacado' : (saEditPlanId === 'profesional' ? 'premium' : 'basico'),
    planRank: saEditPlanId === 'destacado' ? 3 : (saEditPlanId === 'profesional' ? 2 : 1)
  };
  try{
    await db.collection('tenants').doc(id).set(data, {merge:true});
    // También actualiza el documento de configuración de la tienda (settings/store)
    // para que nombre/tipo/whatsapp/categoría/servicios/logo/fotos queden en
    // sincronía con lo que ve el administrador de ese negocio en su propio panel.
    // Esto aplica igual para tiendas que para profesionales: las fotos de un
    // profesional se guardan y se muestran exactamente igual que las de un negocio.
    await db.collection('tenants').doc(id).collection('settings').doc('store').set({
      storeName: data.nombre, tipo: data.tipo, whatsapp: data.whatsapp,
      categoria: data.categoria, servicios: data.servicios,
      logoUrl: data.logoUrl, landingImages: data.landingImages
    }, {merge:true});
    Object.assign(_saTenants.find(x=>x.id===id) || {}, data);
    renderSuperadminSummary();
    renderSuperadminTable();
    saCloseEditModal();
    toast('Negocio actualizado', 'ok');
  }catch(e){
    toast('No se pudo guardar: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}

/* Migración masiva de seguridad (superadmin): mueve las claves de IA de todos
   los tenants que aún las tengan en el doc público settings/store hacia la
   subcolección privada privateSettings/ai y las elimina del público. Con esto
   ninguna clave queda expuesta a los visitantes. */
async function saMigrateAiKeys(){
  const status = document.getElementById('saMigrateStatus');
  if(!confirm('¿Migrar las claves de IA (OpenRouter/Gemini/API externa) de TODAS las tiendas al almacén privado? Se moverán las claves que aún estén en settings públicos y se borrarán de ahí. Los datos actuales no se pierden.')) return;
  if(!_saTenants || !_saTenants.length){
    try{ await loadSuperadminData(); }catch(e){}
  }
  status.textContent = 'Migrando…';
  status.style.color = 'var(--muted)';
  const slugs = (_saTenants || []).map(t => t.id).filter(Boolean);
  let total = 0, errores = 0;
  for(const slug of slugs){
    try{
      const res = await migrateStoreKeys(slug);
      total += res.moved || 0;
    }catch(e){
      errores++;
      console.warn('saMigrateAiKeys:', slug, e && e.message);
    }
  }
  status.style.color = total || errores ? (errores ? 'var(--danger)' : 'var(--ok,#1B7A43)') : 'var(--ok,#1B7A43)';
  status.textContent = 'Migración lista: ' + total + ' clave(s) movida(s) a privateSettings' + (errores ? (' · ' + errores + ' tienda(s) con error (revisá consola)') : '') + '.';
  toast('Migración de claves IA completada', total || errores ? 'ok' : 'ok');
}

/* ---------- Claves de IA desde el panel superadmin ---------- */
let _saAiMasked = { openrouter:'', gemini:'', external:'' };
let _saAiModel = '';
let _saAiImageModel = '';
let _saAiKeyed = {};
async function saLoadAiKeyFlags(){
  const slugs = (_saTenants || []).map(t => t.id).filter(Boolean);
  for(const slug of slugs){
    try{
      const snap = await db.collection('tenants').doc(slug).collection('privateSettings').doc('ai').get();
      const d = (snap.exists && snap.data()) || {};
      _saAiKeyed[slug] = !!(d.aiOpenrouterKey || d.aiApiKey || d.aiExternalKey || d.aiModel);
    }catch(e){
      _saAiKeyed[slug] = false;
    }
  }
  saPopulateAiSlugSelect();
}
function saPopulateAiSlugSelect(){
  const sel = document.getElementById('saAiSlug');
  if(!sel) return;
  const prev = sel.value || '';
  sel.innerHTML = '<option value="">— Elegí una tienda —</option>' +
    (_saTenants || []).map(t =>
      '<option value="' + esc(t.id) + '"' + (t.id === prev ? ' selected' : '') + '>' +
      esc(t.nombre || t.id) + ' (' + esc(t.id) + ')' + (_saAiKeyed[t.id] ? ' 🔑' : '') + '</option>'
    ).join('');
}
function saSetMaskedInput(id, masked, exists, placeholder){
  const el = document.getElementById(id);
  if(!el) return;
  el.value = exists && masked ? masked : '';
  el.placeholder = exists && masked ? ('Guardada: ' + masked + ' — escribí una nueva para reemplazarla') : placeholder;
}
async function saOnAiStoreChange(){
  const slug = document.getElementById('saAiSlug').value;
  const status = document.getElementById('saAiKeyStatus');
  status.textContent = ''; status.style.color = 'var(--muted)';
  const chatSel = document.getElementById('saAiModel');
  const imgSel = document.getElementById('saAiImageModel');
  if(!slug){
    if(chatSel) chatSel.innerHTML = '<option value="">Cargá los modelos gratis primero</option>';
    if(imgSel) imgSel.innerHTML = '<option value="">Cargá los modelos de imagen primero</option>';
    return;
  }
  status.textContent = 'Consultando estado…';
  try{
    const st = await cloudCall('aiStatus', { slug: slug });
    const orSt = (st && st.openrouter) || {};
    const gmSt = (st && st.gemini) || {};
    const exSt = (st && st.external) || {};
    _saAiMasked = { openrouter: orSt.masked || '', gemini: gmSt.masked || '', external: exSt.masked || '' };
    _saAiModel = (st && st.model) || '';
    _saAiImageModel = (st && st.imageModel) || 'google/gemini-3.1-flash-lite-image';
    saSetMaskedInput('saAiOpenrouterKey', _saAiMasked.openrouter, !!orSt.exists, 'sk-or-v1-...');
    saSetMaskedInput('saAiGeminiKey', _saAiMasked.gemini, !!gmSt.exists, 'AIza...');
    saSetMaskedInput('saAiExternalKey', _saAiMasked.external, !!exSt.exists, 'sk-...');
    if(imgSel) imgSel.innerHTML = '<option value="'+esc(_saAiImageModel)+'">'+esc(_saAiImageModel)+'</option>';
    /* Estado del interruptor "deshabilitar IA" del superadmin por tienda */
    const disEl = document.getElementById('saAiDisabled');
    if(disEl){
      try{
        const sSnap = await db.collection('tenants').doc(slug).collection('settings').doc('store').get();
        disEl.checked = !!(sSnap.exists && sSnap.data().aiSuperDisabled === true);
      }catch(_e){ disEl.checked = false; }
    }
    status.innerHTML = (st && st.configured)
      ? '<span style="color:var(--green)">✓ Asistente configurado' + (_saAiModel ? ' · modelo chat: <b>' + esc(_saAiModel) + '</b>' : '') + (_saAiImageModel ? ' · modelo imagen: <b>' + esc(_saAiImageModel) + '</b>' : '') + '.</span>'
      : '<span style="color:#92400E">La tienda aún no tiene el asistente completamente configurado (falta clave o modelo).</span>';
  }catch(e){
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudo consultar el estado: ' + (e && e.message ? e.message : 'error');
  }
}
async function saLoadAiModels(){
  const slug = document.getElementById('saAiSlug').value;
  const sel = document.getElementById('saAiModel');
  const status = document.getElementById('saAiKeyStatus');
  if(!slug){ toast('Elegí una tienda primero', 'err'); return; }
  if(!sel) return;
  if(!_saAiMasked.openrouter){ sel.innerHTML = '<option value="">Guardá la clave de OpenRouter primero</option>'; status.style.color='var(--danger)'; status.textContent='Guardá primero la clave de OpenRouter para poder listar los modelos gratuitos.'; return; }
  sel.innerHTML = '<option value="">Cargando modelos gratuitos…</option>';
  status.textContent = 'Consultando modelos gratuitos de OpenRouter…'; status.style.color = 'var(--muted)';
  try{
    const res = await cloudCall('aiModels', { slug: slug, kind: 'chat' });
    const models = (res && res.models) || [];
    if(!models.length) throw new Error('no vino ningún modelo');
    sel.innerHTML = models.map(m =>
      '<option value="' + esc(m.id) + '"' + (m.id === _saAiModel ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>'
    ).join('');
    if(_saAiModel) sel.value = _saAiModel;
    status.innerHTML = '<span style="color:var(--green)">✓ ' + models.length + ' modelo(s) gratuitos disponibles. Elegí uno y guardá.</span>';
  }catch(e){
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudieron cargar los modelos: ' + (e && e.message ? e.message : 'error');
    sel.innerHTML = '<option value="">Intentalo de nuevo</option>';
    console.error(e);
  }
}
async function saLoadAiImageModels(){
  const slug = document.getElementById('saAiSlug').value;
  const sel = document.getElementById('saAiImageModel');
  const status = document.getElementById('saAiKeyStatus');
  if(!slug){ toast('Elegí una tienda primero', 'err'); return; }
  if(!sel) return;
  if(!_saAiMasked.openrouter){ sel.innerHTML = '<option value="">Guardá la clave de OpenRouter primero</option>'; status.style.color='var(--danger)'; status.textContent='Guardá primero la clave de OpenRouter para poder listar los modelos de imagen.'; return; }
  sel.innerHTML = '<option value="">Cargando modelos de imagen…</option>';
  status.textContent = 'Consultando modelos de imagen de OpenRouter…'; status.style.color = 'var(--muted)';
  try{
    const res = await cloudCall('aiModels', { slug: slug, kind: 'image' });
    const models = (res && res.models) || [];
    if(!models.length) throw new Error('no vino ningún modelo');
    sel.innerHTML = models.map(m =>
      '<option value="' + esc(m.id) + '"' + (m.id === _saAiImageModel ? ' selected' : '') + '>' + esc(m.name || m.id) + (m.price ? ' — ' + m.price : '') + '</option>'
    ).join('');
    if(_saAiImageModel) sel.value = _saAiImageModel;
    status.innerHTML = '<span style="color:var(--green)">✓ ' + models.length + ' modelo(s) de imagen disponibles. Elegí uno y guardá.</span>';
  }catch(e){
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudieron cargar los modelos de imagen: ' + (e && e.message ? e.message : 'error');
    sel.innerHTML = '<option value="">Intentalo de nuevo</option>';
    console.error(e);
  }
}
async function saSaveAiKeys(){
  const slug = document.getElementById('saAiSlug').value;
  const status = document.getElementById('saAiKeyStatus');
  if(!slug){ toast('Elegí una tienda primero', 'err'); return; }
  const newOr = document.getElementById('saAiOpenrouterKey').value.trim();
  const newGem = document.getElementById('saAiGeminiKey').value.trim();
  const newExt = document.getElementById('saAiExternalKey').value.trim();
  const modelEl = document.getElementById('saAiModel');
  const newModel = (modelEl && modelEl.value) ? modelEl.value.trim() : '';
  const imgModelEl = document.getElementById('saAiImageModel');
  const newImgModel = (imgModelEl && imgModelEl.value) ? imgModelEl.value.trim() : '';
  const priv = {};
  if(newOr && newOr !== _saAiMasked.openrouter) priv.aiOpenrouterKey = newOr;
  if(newGem && newGem !== _saAiMasked.gemini) priv.aiApiKey = newGem;
  if(newExt && newExt !== _saAiMasked.external) priv.aiExternalKey = newExt;
  if(newModel && newModel !== _saAiModel) priv.aiModel = newModel;
  if(newModel !== _saAiModel && !newModel) priv.aiModel = firebase.firestore.FieldValue.delete();
  if(newImgModel && newImgModel !== _saAiImageModel) priv.aiImageModel = newImgModel;
  if(newImgModel !== _saAiImageModel && !newImgModel) priv.aiImageModel = firebase.firestore.FieldValue.delete();
  /* Interruptor del superadmin: deshabilitar la IA para esta tienda.
     Se guarda público (para que la tienda lo lea y oculte el botón al cliente). */
  const disEl = document.getElementById('saAiDisabled');
  const pubUpd = {};
  if(disEl){
    pubUpd.aiSuperDisabled = !!disEl.checked;
  }
  if(!Object.keys(priv).length && !Object.keys(pubUpd).length){ toast('No hay claves ni modelo nuevos para guardar', 'err'); return; }
  status.textContent = 'Guardando…'; status.style.color = 'var(--muted)';
  try{
    if(Object.keys(priv).length) await db.collection('tenants').doc(slug).collection('privateSettings').doc('ai').set(priv, { merge:true });
    await migrateStoreKeys(slug);
    if(priv.aiOpenrouterKey || newModel){ pubUpd.aiProvider = 'openrouter'; if(newModel) pubUpd.aiModel = newModel; }
    if(priv.aiApiKey) pubUpd.aiProvider = 'gemini';
    if(priv.aiExternalKey) pubUpd.aiProvider = 'external';
    if(Object.keys(pubUpd).length){
      await db.collection('tenants').doc(slug).collection('settings').doc('store').set(pubUpd, { merge:true });
    }
    _saAiMasked = { openrouter:newOr, gemini:newGem, external:newExt };
    _saAiModel = newModel;
    _saAiImageModel = newImgModel;
    status.innerHTML = '<span style="color:var(--green)">✓ Claves y modelo guardados en el almacén privado de ' + esc(slug) + (newModel ? (' · modelo chat: <b>' + esc(newModel) + '</b>') : '') + (newImgModel ? (' · modelo imagen: <b>' + esc(newImgModel) + '</b>') : '') + '.</span>';
    toast('Configuración de IA guardada', 'ok');
    _saAiKeyed[slug] = true;
    saOnAiStoreChange();
    saPopulateAiSlugSelect();
  }catch(e){
    let msg = e.message || 'error desconocido';
    if(e.code === 'permission-denied' || msg.includes('PERMISSION')){
      msg = 'Permiso denegado. Verifica que el documento platform/config exista y tengas permisos de superadmin.';
    }else if(e.code === 'not-found'){
      msg = 'Documento no encontrado. Verifica que la tienda exista.';
    }
    status.style.color = 'var(--danger)';
    status.textContent = 'No se pudo guardar: ' + msg;
    console.error('saSaveAiKeys error:', e);
  }
}
async function saTestAiOpenRouter(){
  const slug = document.getElementById('saAiSlug').value;
  const status = document.getElementById('saAiKeyStatus');
  if(!slug){ toast('Elegí una tienda primero', 'err'); return; }
  const modelEl = document.getElementById('saAiModel');
  const model = (modelEl && modelEl.value) ? modelEl.value : _saAiModel;
  status.textContent = 'Probando conexión con OpenRouter' + (model ? (' usando ' + model) : '') + '…'; status.style.color = 'var(--muted)';
  try{
    const res = await cloudCall('aiTest', { slug: slug, provider: 'openrouter', model: model || undefined });
    if(res && res.ok){
      status.innerHTML = '<span style="color:var(--green)">✓ Conexión OK: ' + esc(res.reply || 'respuesta recibida') + '</span>';
      toast('Conexión con OpenRouter correcta', 'ok');
    } else {
      status.innerHTML = '<span style="color:var(--danger)">✗ ' + esc((res && res.error) || 'Error desconocido') + '</span>';
    }
  }catch(e){
    status.style.color = 'var(--danger)';
    const det = (e && e.details) ? (' · detalle: ' + esc(JSON.stringify(e.details))) : '';
    status.textContent = 'Fallo al probar: ' + (e && e.code ? e.code : '') + ' — ' + (e && e.message ? e.message : 'error') + (det ? '' : (e && e.raw ? ' · raw: ' + esc(String(e.raw).slice(0,200)) : ''));
    console.error('saTestAiOpenRouter:', e);
    const d = await cloudCallDiag('aiTest', { slug: slug, provider: 'openrouter', model: model || undefined });
    const linea = 'HTTP ' + (d.status || '?') + ' sesión:' + (d.session ? 'sí' : 'NO') + (d.hasToken ? '[token]' : '') + ' ct:' + (d.contentType || '?');
    const extra = (d.parsed && d.parsed.error) ? (' · err: ' + esc(JSON.stringify(d.parsed.error)).slice(0,180)) : (d.body ? ' · body: ' + esc(String(d.body).slice(0,180)) : (d.diagError ? ' · diag: ' + esc(d.diagError) : ''));
    status.innerHTML += '<br><span style="font-size:12px;color:var(--muted)">🔎 ' + linea + extra + '</span>';
  }
}

/* ---------- eliminar un negocio por completo (tienda + subcolecciones) ---------- */
async function saDeleteCollectionDocs(colRef){
  const snap = await colRef.get();
  if(snap.empty) return;
  // Firestore permite máximo 500 operaciones por batch; se trocea por si acaso.
  const chunks = [];
  for(let i=0;i<snap.docs.length;i+=450) chunks.push(snap.docs.slice(i,i+450));
  for(const chunk of chunks){
    const batch = db.batch();
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
async function saDeleteTenant(id){
  const t = _saTenants.find(x=>x.id===id);
  const nombre = t ? (t.nombre || id) : id;
  if(!confirm('¿Seguro que querés eliminar "' + nombre + '"? Esto borra su tienda, productos, pedidos y estadísticas de forma permanente.')) return;
  const check = prompt('Para confirmar, escribí exactamente el slug del negocio:\n' + id);
  if(check !== id){ toast('Eliminación cancelada: el texto no coincide', 'err'); return; }
  try{
const ref = db.collection('tenants').doc(id);
    await saDeleteCollectionDocs(ref.collection('products'));
    await saDeleteCollectionDocs(ref.collection('orders'));
    await saDeleteCollectionDocs(ref.collection('settings'));
    await saDeleteCollectionDocs(ref.collection('privateSettings'));
    await saDeleteCollectionDocs(ref.collection('analytics'));
    await ref.delete();
    _saTenants = _saTenants.filter(x => x.id !== id);
    renderSuperadminSummary();
    renderSuperadminTable();
    toast('Negocio eliminado', 'ok');
    try{ if(typeof cloudCall === 'function') cloudCall('notifySuperadminTenantDeleted', { slug: id, nombre: nombre }).catch(function(){}); }catch(_e){}
  }catch(e){
    toast('No se pudo eliminar: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}

/* Eliminar la propia tienda desde el panel del administrador (con confirmación
   doble) y avisar al superadmin por WhatsApp. */
async function adminDeleteMyStore(){
  const nombre = (TENANT_DATA && (TENANT_DATA.nombre || settings.storeName)) || TENANT_ID;
  if(!confirm('¿Seguro que querés eliminar "' + nombre + '"? Se borran tu tienda, productos, pedidos y estadísticas de forma PERMANENTE.')) return;
  const check = prompt('Para confirmar, escribí exactamente el ID de tu negocio:\n' + TENANT_ID);
  if(check !== TENANT_ID){ toast('Eliminación cancelada: el texto no coincide', 'err'); return; }
  const btn = document.querySelector('.panel#panel-settings .settings-card:last-of-type button');
  if(btn){ btn.disabled = true; btn.textContent = 'Eliminando…'; }
  /* Enviar DESPEDIDA al admin ANTES de borrar (necesita su callmebot en privateSettings) */
  try{ if(typeof cloudCall === 'function') cloudCall('notifyTenantFarewell', { slug: TENANT_ID }).catch(function(){}); }catch(_e){}
  try{
    const ref = db.collection('tenants').doc(TENANT_ID);
    await saDeleteCollectionDocs(ref.collection('products'));
    await saDeleteCollectionDocs(ref.collection('orders'));
    await saDeleteCollectionDocs(ref.collection('settings'));
    await saDeleteCollectionDocs(ref.collection('privateSettings'));
    await saDeleteCollectionDocs(ref.collection('analytics'));
    await saDeleteCollectionDocs(ref.collection('posSales'));
    await saDeleteCollectionDocs(ref.collection('finance'));
    await saDeleteCollectionDocs(ref.collection('employees'));
    await saDeleteCollectionDocs(ref.collection('backups'));
    await ref.delete();
    /* Avisar al superadmin por WhatsApp */
    try{ if(typeof cloudCall === 'function') cloudCall('notifySuperadminTenantDeleted', { slug: TENANT_ID, nombre: nombre }).catch(function(){}); }catch(_e){}
    toast('Tu negocio fue eliminado', 'ok');
    setTimeout(function(){
      try{ auth.signOut(); }catch(_e){}
      location.href = location.origin + (window.basePath || '') + '?tienda=';
    }, 1200);
  }catch(e){
    toast('No se pudo eliminar: ' + (e && e.message ? e.message : 'error'),
 'err');
    if(btn){ btn.disabled = false; btn.textContent = '🗑️ Eliminar mi negocio'; }
    console.error(e);
  }
}

async function saCreateTenant(){
  const slug = slugify(document.getElementById('saNewSlug').value);
  const nombre = document.getElementById('saNewNombre').value.trim();
  const tipo = document.getElementById('saNewTipo').value;
  const adminEmail = document.getElementById('saNewAdminEmail').value.trim();
  const monto = Number(document.getElementById('saNewMonto').value) || 0;
  const estadoPago = document.getElementById('saNewEstado').value;
  if(!slug){ toast('Ingresá un slug válido para el negocio', 'err'); return; }
  if(!nombre){ toast('Ingresá el nombre del negocio', 'err'); return; }
  try{
    const ref = db.collection('tenants').doc(slug);
    const existing = await ref.get();
    if(existing.exists){ toast('Ya existe un negocio con ese slug', 'err'); return; }
    const saNewPlan = document.getElementById('saNewPlan') ? document.getElementById('saNewPlan').value : 'emprendedor';
    await ref.set({
      nombre, tipo,
      activo: true,
      montoMensual: monto,
      estadoPago,
      adminEmails: adminEmail ? [adminEmail] : [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      membershipPlan: saNewPlan,
      planApprovedId: saNewPlan,
      planApprovalStatus: 'aprobado',
      membershipStatus: estadoPago === 'al_dia' ? 'al_dia' : 'pendiente',
      membershipNextDueDate: addMonths(new Date(),1).toISOString(),
      plan: saNewPlan === 'destacado' ? 'destacado' : (saNewPlan === 'profesional' ? 'premium' : 'basico'),
      planRank: saNewPlan === 'destacado' ? 3 : (saNewPlan === 'profesional' ? 2 : 1)
    });
    toast('Negocio creado. Compartí este enlace con el dueño: ?tienda=' + slug, 'ok');
    document.getElementById('saNewSlug').value = '';
    document.getElementById('saNewNombre').value = '';
    document.getElementById('saNewAdminEmail').value = '';
    document.getElementById('saNewMonto').value = '';
    loadSuperadminData();
  }catch(e){
    toast('No se pudo crear el negocio: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}


/* ================================================================
   MÓDULO DE GESTIÓN DE PLANES (SUPERADMIN) — aprobación, rechazo
   y vencimiento automático con regresión a plan básico.
   ================================================================ */

/* Jerarquía de planes: emprendedor=1, profesional=2, destacado=3 */
const PLAN_RANK = {emprendedor:1, profesional:2, destacado:3};
/* Límite de productos en el catálogo según el plan activo. Sin entrada = sin límite. */
const PLAN_PRODUCT_LIMITS = {emprendedor:20, profesional:200};
function getProductLimit(){
  const plan = getActivePlanId();
  return PLAN_PRODUCT_LIMITS.hasOwnProperty(plan) ? PLAN_PRODUCT_LIMITS[plan] : Infinity;
}
const PLAN_NAMES_MAP = {emprendedor:'Emprendedor', profesional:'Profesional', destacado:'Destacado'};
const PLAN_ICONS = {emprendedor:'🌱', profesional:'🚀', destacado:'⭐'};

/* ---------- modal de gestión de plan del superadmin ---------- */
let _saPlanModalId = null;
async function openSaPlanModal(id){
  _saPlanModalId = id;
  const t = _saTenants.find(x=>x.id===id);
  if(!t) return;
  document.getElementById('saPlanModalTitle').textContent = 'Plan — ' + (t.nombre||id);
  const modal = document.getElementById('saPlanModal');
  modal.classList.add('show');
  await renderSaPlanModalContent(id);
}
function closeSaPlanModal(){
  document.getElementById('saPlanModal').classList.remove('show');
  _saPlanModalId = null;
}

async function renderSaPlanModalContent(id){
  const t = _saTenants.find(x=>x.id===id);
  if(!t){ return; }
  const body = document.getElementById('saPlanModalContent');

  // Cargar historial de pagos
  let payments = [];
  try{
    const snap = await db.collection('tenants').doc(id).collection('membershipPayments').orderBy('date','desc').limit(10).get();
    payments = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
  }catch(e){ console.warn('No se pudo cargar historial de pagos:', e); }

  const planActivo = t.membershipPlan || 'emprendedor';
  const planApproved = t.planApprovedId || 'emprendedor';
  const approvalStatus = t.planApprovalStatus || 'aprobado';
  const nextDue = t.membershipNextDueDate ? new Date(t.membershipNextDueDate) : null;
  const lastPayment = t.membershipLastPaymentDate ? new Date(t.membershipLastPaymentDate) : null;

  const planOptionsHtml = ['emprendedor','profesional','destacado'].map(pid => {
    const isApproved = planApproved === pid;
    return '<button class="sa-mini-btn ' + (isApproved?'':'ghost') + '" style="flex:1" onclick="saApprovePlan(\'' + esc(id) + '\',\'' + pid + '\')">' +
      PLAN_ICONS[pid] + ' ' + PLAN_NAMES_MAP[pid] + (isApproved?' ✓':'') + '</button>';
  }).join('');

  const paymentsHtml = payments.length ? payments.map(p => {
    const hasProof = p.proofImage && p.proofImage.length > 50;
    const isVerified = p.verified === true;
    const isRejected = p.verified === false;
    return '<div class="plan-request-card ' + (isVerified?'aprobado':isRejected?'rechazado':'pendiente') + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">' +
        '<div>' +
          '<div style="font-size:13.5px;font-weight:800">' + PLAN_NAMES_MAP[p.plan||'emprendedor'] + ' — ' + (p.periodLabel||p.period||'mensual') + '</div>' +
          '<div style="font-size:12px;color:var(--muted)">' + new Date(p.date).toLocaleDateString('es-CR', {year:'numeric',month:'long',day:'2-digit'}) + '</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--green);margin-top:2px">' + fmt(p.amount) + '</div>' +
          (p.reference ? '<div style="font-size:12px;color:var(--muted)">Ref: ' + esc(p.reference) + '</div>' : '') +
          (p.method ? '<div style="font-size:12px;color:var(--muted)">Método: ' + esc(p.method) + '</div>' : '') +
        '</div>' +
        (hasProof ? '<img src="' + p.proofImage + '" style="width:70px;height:70px;object-fit:cover;border-radius:10px;cursor:pointer;flex-shrink:0" onclick="openProofLightbox(\'' + esc(p.id) + '\',\'' + esc(id) + '\')" title="Ver comprobante">' : '') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        (isVerified
          ? '<span style="font-size:12px;font-weight:700;color:var(--green)">✓ Verificado</span>'
          : isRejected
            ? '<span style="font-size:12px;font-weight:700;color:var(--danger)">✗ Rechazado</span>'
            : '<button class="sa-mini-btn" style="font-size:11px;padding:5px 12px" onclick="saVerifyPayment(\'' + esc(id) + '\',\'' + esc(p.id) + '\',true)">✓ Aprobar y activar plan</button>' +
              '<button class="sa-mini-btn danger" style="font-size:11px;padding:5px 12px" onclick="saVerifyPayment(\'' + esc(id) + '\',\'' + esc(p.id) + '\',false)">✗ Rechazar</button>'
        ) +
      '</div>' +
    '</div>';
  }).join('') : '<div style="color:var(--muted);font-size:13px;padding:12px 0">Sin historial de pagos registrado.</div>';

  body.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">' +
      '<div class="panel-card"><div style="font-size:11.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Plan solicitado</div>' +
        '<div style="font-size:18px;font-weight:800">' + PLAN_ICONS[planActivo] + ' ' + esc(PLAN_NAMES_MAP[planActivo]||planActivo) + '</div>' +
        '<div style="font-size:12px;color:var(--muted)">' + (approvalStatus==='pendiente'?'⏳ Pendiente de aprobación':approvalStatus==='aprobado'?'✓ Aprobado':'—') + '</div>' +
      '</div>' +
      '<div class="panel-card"><div style="font-size:11.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Plan activo actual</div>' +
        '<div style="font-size:18px;font-weight:800">' + PLAN_ICONS[planApproved] + ' ' + esc(PLAN_NAMES_MAP[planApproved]||planApproved) + '</div>' +
        '<div style="font-size:12px;color:var(--muted)">Habilitado para el negocio</div>' +
      '</div>' +
    '</div>' +
    (nextDue ? '<div style="font-size:13px;color:var(--muted);margin-bottom:16px">📅 Próximo vencimiento: <b>' + nextDue.toLocaleDateString('es-CR',{year:'numeric',month:'long',day:'2-digit'}) + '</b></div>' : '') +

    '<div style="margin-bottom:18px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:8px">Activar plan manualmente:</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + planOptionsHtml + '</div>' +
      '<p style="font-size:12px;color:var(--muted);margin-top:6px">Al activar un plan se habilita inmediatamente para el negocio y se marca como aprobado. Podés cambiar la fecha de vencimiento a continuación.</p>' +
    '</div>' +

    '<div style="margin-bottom:18px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:8px">Establecer fecha de vencimiento:</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<input type="date" class="f-input" id="saPlanDueDate" style="max-width:200px" value="' + (nextDue ? nextDue.toISOString().substr(0,10) : '') + '">' +
        '<button class="sa-mini-btn" onclick="saUpdateDueDate(\'' + esc(id) + '\')">Guardar fecha</button>' +
      '</div>' +
    '</div>' +

    '<div>' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:10px">Historial de pagos y comprobantes:</div>' +
      paymentsHtml +
    '</div>';
}

/* Aprobar un plan manualmente desde el superadmin */
async function saApprovePlan(tenantId, planId){
  if(!confirm('¿Activar el plan ' + PLAN_NAMES_MAP[planId] + ' para este negocio?')) return;
  const planValue = planId === 'destacado' ? 'destacado' : (planId === 'profesional' ? 'premium' : 'basico');
  const rank = PLAN_RANK[planId] || 1;
  const now = new Date();
  const nextDue = addMonths(now, 1);
  try{
    await db.collection('tenants').doc(tenantId).set({
      membershipPlan: planId,
      planApprovedId: planId,
      planApprovalStatus: 'aprobado',
      membershipStatus: 'al_dia',
      estadoPago: 'al_dia',
      membershipLastPaymentDate: now.toISOString(),
      membershipNextDueDate: nextDue.toISOString(),
      membershipReminderSent: false,
      membershipReminderSent24h: false,
      membershipExpiryNotified: false,
      plan: planValue,
      planRank: rank,
      montoMensual: planId==='destacado'?25000:(planId==='profesional'?15000:9900),
      activo: true
    }, {merge:true});
    const t = _saTenants.find(x=>x.id===tenantId);
    if(t){ Object.assign(t, {membershipPlan:planId, planApprovedId:planId, planApprovalStatus:'aprobado', plan:planValue, planRank:rank, membershipNextDueDate:nextDue.toISOString(), estadoPago:'al_dia', activo:true}); }
    renderSuperadminTable();
    toast('Plan ' + PLAN_NAMES_MAP[planId] + ' activado para el negocio', 'ok');
    /* Avisar al superadmin: cuenta nueva (viene del landing) vs pago/renovación */
    const esNueva = !!(t && t.subSource === 'landing');
    try{
      if(typeof cloudCall === 'function'){
        if(esNueva) cloudCall('notifySuperadminAccountActivated', { slug: tenantId }).catch(function(){});
        else cloudCall('notifySuperadminMembershipPaid', { slug: tenantId, plan: planId, method: 'SINPE' }).catch(function(){});
      }
    }catch(_e){}
    await renderSaPlanModalContent(tenantId);
  }catch(e){
    toast('Error al activar plan: ' + (e.message||'error'), 'err');
    console.error(e);
  }
}

/* Actualizar fecha de vencimiento desde el superadmin */
async function saUpdateDueDate(tenantId){
  const val = document.getElementById('saPlanDueDate').value;
  if(!val){ toast('Seleccioná una fecha', 'err'); return; }
  const newDate = new Date(val + 'T23:59:59');
  try{
    await db.collection('tenants').doc(tenantId).set({ membershipNextDueDate: newDate.toISOString(), membershipReminderSent: false }, {merge:true});
    const t = _saTenants.find(x=>x.id===tenantId);
    if(t) t.membershipNextDueDate = newDate.toISOString();
    renderSuperadminTable();
    toast('Fecha de vencimiento actualizada', 'ok');
  }catch(e){
    toast('Error al actualizar fecha: ' + (e.message||'error'), 'err');
    console.error(e);
  }
}

/* Verificar / rechazar un comprobante de pago */
async function saVerifyPayment(tenantId, paymentId, approved){
  const t = _saTenants.find(x=>x.id===tenantId);
  try{
    const payRef = db.collection('tenants').doc(tenantId).collection('membershipPayments').doc(paymentId);
    // Leer el pago para obtener su plan y período
    const paySnap = await payRef.get();
    if(!paySnap.exists){ toast('Pago no encontrado', 'err'); return; }
    const payData = paySnap.data();
    await payRef.set({ verified: approved, verifiedAt: new Date().toISOString() }, {merge:true});

    if(approved){
      // Activar el plan pagado
      const planId = payData.plan || 'emprendedor';
      const months = payData.months || 1;
      const planValue = planId === 'destacado' ? 'destacado' : (planId === 'profesional' ? 'premium' : 'basico');
      const rank = PLAN_RANK[planId] || 1;
      const now = new Date();
      const nextDue = addMonths(now, months);
      await db.collection('tenants').doc(tenantId).set({
        membershipPlan: planId,
        planApprovedId: planId,
        planApprovalStatus: 'aprobado',
        membershipStatus: 'al_dia',
        estadoPago: 'al_dia',
        membershipLastPaymentDate: now.toISOString(),
        membershipNextDueDate: nextDue.toISOString(),
        membershipReminderSent: false,
        plan: planValue,
        planRank: rank,
        montoMensual: planId==='destacado'?25000:(planId==='profesional'?15000:9900),
        activo: true
      }, {merge:true});
      if(t){ Object.assign(t, {membershipPlan:planId, planApprovedId:planId, planApprovalStatus:'aprobado', estadoPago:'al_dia', membershipNextDueDate:nextDue.toISOString(), plan:planValue, planRank:rank}); }
      toast('Pago aprobado — plan ' + PLAN_NAMES_MAP[planId] + ' activado', 'ok');
    } else {
      // Rechazar sin cambiar el plan activo
      await db.collection('tenants').doc(tenantId).set({ planApprovalStatus: t?.membershipPlan === (t?.planApprovedId||'emprendedor') ? 'aprobado' : 'rechazado' }, {merge:true});
      toast('Pago rechazado', 'ok');
    }
    renderSuperadminTable();
    await renderSaPlanModalContent(tenantId);
  }catch(e){
    toast('Error al procesar verificación: ' + (e.message||'error'), 'err');
    console.error(e);
  }
}

/* Abrir lightbox de comprobante de pago */
async function openProofLightbox(paymentId, tenantId){
  try{
    const snap = await db.collection('tenants').doc(tenantId).collection('membershipPayments').doc(paymentId).get();
    if(!snap.exists || !snap.data().proofImage) return;
    const img = document.getElementById('lightboxImg');
    if(img){
      img.src = snap.data().proofImage;
      document.getElementById('imgLightbox').classList.add('show');
    }
  }catch(e){ console.error(e); }
}

/* ================================================================
   SISTEMA DE BLOQUEO DE FUNCIONES POR PLAN
   ================================================================
   Mapeo de funciones a plan mínimo requerido:
   - emprendedor: catálogo básico, WhatsApp, perfil
   - profesional: pedidos, inventario, SINPE, estadísticas, video, reseñas
   - destacado: posición destacada, insignia de plataforma
   ================================================================ */

const PLAN_FEATURE_MAP = {
  'panel-orders':   'profesional',  // panel de pedidos
  /* panel-analytics ya no requiere plan: Emprendedor ve estadísticas básicas,
     Profesional/Destacado ven el panel completo (ver renderStats/applyStatsPlanView) */
  'video':          'profesional',  // video historia flotante
  'reviews':        'profesional',  // reseñas de productos
  'pos-panel':      'profesional',  // Punto de Venta (POS)
  'finance-panel':  'profesional',  // finanzas (apertura, gastos, cierre)
  'employees-panel':'profesional',  // empleados (varios vendedores)
  'paypal':         'profesional',  // cobro por PayPal / tarjeta
  'wa-notify':      'profesional',  // notificación de pagos por WhatsApp
  /* 'ai-assistant', 'ai-image', 'sinpe' y 'inventory' ya NO requieren plan superior:
     están disponibles para todos los planes. El superadmin deshabilita la IA
     por negocio (aiSuperDisabled). SINPE y el inventario funcionan en todos. */
  'destacado-badge':'destacado',    // insignia y posición destacada
  'games-link':     'profesional',  // botón de juegos/bingo
};

const PLAN_FEATURE_LABELS = {
  'panel-orders':   'Panel de Pedidos',
  'panel-analytics':'Estadísticas',
  'sinpe':          'Pagos SINPE Móvil',
  'inventory':      'Control de Inventario',
  'video':          'Video Historia',
  'reviews':        'Reseñas de Productos',
  'pos-panel':      'Punto de Venta (POS)',
  'finance-panel':  'Finanzas',
  'employees-panel':'Empleados',
  'paypal':         'Pago con PayPal',
  'wa-notify':      'Notificación de pagos por WhatsApp',
  'ai-assistant':   'Asistente IA',
  'ai-image':       'Generador de Fotos con IA',
  'destacado-badge':'Posición Destacada',
  'games-link':     'Enlace de Juegos',
};

/* Información REAL de accesos por plan, para la ficha comparativa.
   Cada feature: {k, t, cats:[categoría], inc:[planes que lo tienen]}.
   Todos los planes tienen: catálogo, inventario, perfil, WhatsApp, SINPE,
   moneda, estadísticas básicas y Asistente IA. */
const PLAN_PLUS = {
  emprendedor: {
    tag:'🌱', color:'#1B7A43', sub:'Para empezar a vender',
    limit:'Hasta 20 productos',
    features:[
      {k:'catalog', t:'Catálogo (hasta 20 productos)', inc:['emprendedor']},
      {k:'inventory', t:'Inventario y precios', inc:['emprendedor','profesional','destacado']},
      {k:'profile', t:'Perfil y WhatsApp', inc:['emprendedor','profesional','destacado']},
      {k:'sinpe', t:'Cobro SINPE / moneda local', inc:['emprendedor','profesional','destacado']},
      {k:'stats', t:'Estadísticas básicas', inc:['emprendedor','profesional','destacado']},
      {k:'ai', t:'Asistente IA', inc:['emprendedor','profesional','destacado']},
      {k:'landing', t:'Landing / página de tienda', inc:['emprendedor','profesional','destacado']}
    ]
  },
  profesional: {
    tag:'🚀', color:'#D9770D', sub:'Para vender de forma constante',
    limit:'Hasta 200 productos',
    features:[
      {k:'catalog', t:'Catálogo (hasta 200 productos)', inc:['profesional','destacado']},
      {k:'inventory', t:'Inventario y precios', inc:['emprendedor','profesional','destacado']},
      {k:'orders', t:'Pedidos y facturación', inc:['profesional','destacado']},
      {k:'pos', t:'Punto de Venta (POS)', inc:['profesional','destacado']},
      {k:'finance', t:'Finanzas y empleados', inc:['profesional','destacado']},
      {k:'reviews', t:'Reseñas de productos', inc:['profesional','destacado']},
      {k:'video', t:'Video historia flotante', inc:['profesional','destacado']},
      {k:'paypal', t:'Cobro con PayPal', inc:['profesional','destacado']},
      {k:'whatsapp', t:'Notificación de pagos por WhatsApp', inc:['profesional','destacado']},
      {k:'games', t:'Enlace de juegos / Bingo', inc:['profesional','destacado']},
      {k:'ai', t:'Asistente IA', inc:['emprendedor','profesional','destacado']}
    ]
  },
  destacado: {
    tag:'⭐', color:'#7C3AED', sub:'Máxima visibilidad y herramientas',
    limit:'Productos ilimitados',
    features:[
      {k:'catalog', t:'Catálogo ilimitado', inc:['destacado']},
      {k:'everything', t:'Todo lo del plan Profesional', inc:['destacado']},
      {k:'badge', t:'Insignia "Destacado"', inc:['destacado']},
      {k:'priority', t:'Aparece primero en la plataforma', inc:['destacado']},
      {k:'promo', t:'Promoción dentro de la plataforma', inc:['destacado']},
      {k:'search', t:'Mejor posición en búsquedas', inc:['destacado']},
      {k:'ai', t:'Asistente IA', inc:['emprendedor','profesional','destacado']}
    ]
  }
};

/* Plan activo aprobado del tenant actual */
function getActivePlanId(){
  if(!TENANT_DATA) return 'emprendedor';
  // planApprovedId = el plan habilitado por superadmin
  // Si no existe (tenant viejo), se usa membershipPlan si está al_dia, sino emprendedor
  if(TENANT_DATA.planApprovedId) return TENANT_DATA.planApprovedId;
  if((TENANT_DATA.membershipStatus==='al_dia') && TENANT_DATA.membershipPlan) return TENANT_DATA.membershipPlan;
  return 'emprendedor';
}

/* Verifica si el plan activo permite una funcionalidad */
function planAllows(featureKey){
  const required = PLAN_FEATURE_MAP[featureKey];
  if(!required) return true; // funcionalidades no mapeadas siempre están permitidas
  const activePlanRank = PLAN_RANK[getActivePlanId()] || 1;
  const requiredRank = PLAN_RANK[required] || 1;
  return activePlanRank >= requiredRank;
}

/* Muestra el "plan wall" (muro de plan) cuando se intenta acceder a función bloqueada */
function showPlanWall(featureKey){
  const requiredPlan = PLAN_FEATURE_MAP[featureKey] || 'profesional';
  const activePlan = getActivePlanId();
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  document.getElementById('pwTitle').textContent = (PLAN_FEATURE_LABELS[featureKey]||'Esta función') + ' requiere plan superior';
  document.getElementById('pwDesc').textContent =
    'Tu plan activo es ' + (PLAN_NAMES_MAP[activePlan]||activePlan) + '. Para usar ' +
    (PLAN_FEATURE_LABELS[featureKey]||'esta función') + ', necesitás el plan ' +
    (PLAN_NAMES_MAP[requiredPlan]||requiredPlan) + ' o superior.';

  const plansHtml = cfg.plans.map(p => {
    const rank = PLAN_RANK[p.id]||1;
    const activeRank = PLAN_RANK[activePlan]||1;
    const requiredRank = PLAN_RANK[requiredPlan]||1;
    const isCurrent = p.id === activePlan;
    const isRequired = rank === requiredRank;
    const isLocked = rank < requiredRank;
    const d = PLAN_PLUS[p.id] || {};
    const accent = p.id==='destacado'?'#7C3AED':p.id==='profesional'?'#D9770D':'#1B7A43';
    return '<div class="plan-compare-card pw-mini ' + (isCurrent?'current':isRequired?'required':isLocked?'locked':'') + '" style="--pc-accent:'+accent+'">' +
      '<div class="pc-head">' +
        '<div class="pc-icon">' + (d.tag||PLAN_ICONS[p.id]||'📦') + '</div>' +
        '<div class="pc-name">' + esc(p.name) + '</div>' +
        '<div class="pc-price"><span class="pc-price-num">' + fmt(p.price) + '</span><span class="pc-price-per">/mes</span></div>' +
      '</div>' +
      '<div class="pc-features">' +
        ((p.features && p.features.length) ? p.features.slice(0,6).map(function(f){ return '<div class="pc-feature"><span class="pc-check">✓</span><span>'+esc(f)+'</span></div>'; }).join('') : (d.features||[]).slice(0,5).map(function(f){
          const inc = (typeof f === 'object' && f.inc) ? f.inc : [p.id];
          const incMe = inc.indexOf(p.id) !== -1;
          return '<div class="pc-feature'+(incMe?'':' off')+'"><span class="pc-check">'+(incMe?'✓':'×')+'</span><span>'+esc(typeof f==='object'?f.t:f)+'</span></div>';
        }).join('')) +
      '</div>' +
      (isCurrent ? '<div style="font-size:11px;color:var(--green);font-weight:800;text-align:center;margin-bottom:8px">✓ Tu plan</div>' :
        isRequired ? '<div style="font-size:11px;color:#92400E;font-weight:800;text-align:center;margin-bottom:8px">⬆ Requerido</div>' :
        isLocked ? '<div style="font-size:11px;color:var(--muted);font-weight:800;text-align:center;margin-bottom:8px">🔒 Bloqueado</div>' : '') +
    '</div>';
  }).join('');
  document.getElementById('pwPlansGrid').innerHTML = plansHtml;
  document.getElementById('planWall').classList.add('show');
}
function closePlanWall(){ document.getElementById('planWall').classList.remove('show'); }

/* Muestra/oculta banner de plan básico cuando el negocio no tiene plan activo */
function updatePlanLockBanner(){
  const activePlan = getActivePlanId();
  const banner = document.getElementById('planLockBanner');
  if(!banner) return;
  if(activePlan === 'emprendedor'){
    // Plan Emprendedor: sin viñeta verde superior (queda oculta, ya no molesta a este plan)
    banner.classList.remove('show');
  } else {
    const planName = PLAN_NAMES_MAP[activePlan]||activePlan;
    const nextDue = TENANT_DATA && TENANT_DATA.membershipNextDueDate ? new Date(TENANT_DATA.membershipNextDueDate) : null;
    if(nextDue && nextDue < new Date()){
      banner.innerHTML = '⚠️ Tu plan <b>' + planName + '</b> <b>ha vencido</b>. Tu tienda regresó al plan Emprendedor hasta que renueves. <a onclick="switchPanel(\'panel-membership\')">Renovar ahora</a>.';
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }
}

/* Hook para interceptar navegación a paneles bloqueados */
const _origSwitchPanel = typeof switchPanel !== 'undefined' ? switchPanel : null;
function switchPanelWithPlanCheck(panelId){
  if(!isAdminSession){ if(_origSwitchPanel) _origSwitchPanel(panelId); return; }
  const featureKey = panelId === 'panel-orders' ? 'panel-orders' : panelId === 'panel-analytics' ? 'panel-analytics' : null;
  if(featureKey && !planAllows(featureKey)){
    showPlanWall(featureKey);
    return;
  }
  if(typeof switchPanel === 'function') switchPanel(panelId);
}

/* Verificar y regresar al plan básico si venció */
async function checkAndRevertExpiredPlan(){
  if(!TENANT_DATA) return;
  const approvedPlan = TENANT_DATA.planApprovedId || TENANT_DATA.membershipPlan || 'emprendedor';
  if(approvedPlan === 'emprendedor') return; // ya en básico, nada que hacer
  const nextDue = TENANT_DATA.membershipNextDueDate ? new Date(TENANT_DATA.membershipNextDueDate) : null;
  if(!nextDue) return;
  const now = new Date();
  if(nextDue <= now){
    // Plan vencido — regresar a emprendedor
    const updates = {
      planApprovedId: 'emprendedor',
      planApprovalStatus: 'aprobado',
      membershipStatus: 'vencido',
      estadoPago: 'vencido',
      plan: 'basico',
      planRank: 1
    };
    // Suspender tienda si lleva 7+ días vencida
    const daysPast = daysBetween(nextDue, now);
    if(daysPast >= 7 && TENANT_DATA.membershipAutoSuspend !== false){
      updates.activo = false;
    }
    try{
      await tenantRef().set(updates, {merge:true});
      Object.assign(TENANT_DATA, updates);
      updatePlanLockBanner();
      if(document.body.classList.contains('in-admin')) renderMembershipUI();
    }catch(e){ console.error(e); }
  }
}

/* ================================================================
   MÓDULO DE MEMBRESÍA — Pagos, planes, vencimientos y recordatorios
   ================================================================ */
const DEFAULT_PLAN_CONFIG = {
  plans:[
    {id:'emprendedor', name:'Emprendedor', price:9900, features:['Catálogo (hasta 20)','Inventario básico','Perfil','Fotos','Servicios','Estadísticas básicas','WhatsApp','SINPE','Moneda','Asistente IA'], active:true},
    {id:'profesional', name:'Profesional', price:15000, features:['Todo lo de Emprendedor','Catálogo (hasta 200)','Pedidos y facturación','Punto de Venta (POS)','Finanzas','Empleados','Reseñas','Video','Pago con PayPal','Notificación de pagos por WhatsApp','Enlace de juegos','Asistente IA'], active:true},
    {id:'destacado', name:'Destacado', price:25000, features:['Todo lo de Profesional','Productos ilimitados','Mayor exposición','Aparece primero','Insignia Destacada','Promoción dentro de la plataforma','Mayor presencia en búsquedas','Asistente IA'], active:true}
  ],
  periods:[
    {id:'monthly', label:'Mensual', months:1, discount:0, active:true},
    {id:'quarterly', label:'Trimestral', months:3, discount:10, active:true},
    {id:'yearly', label:'Anual', months:12, discount:20, active:true}
  ],
  paymentMethods:['SINPE Móvil','Transferencia bancaria'],
  platformSinpe: '',
  buscarClientesUrl: '', // enlace de la plataforma para buscar clientes (ej. Google Maps) que ve cada negocio
  /* QUÉ NEGOCIOS USAN "BUSCAR CLIENTES":
     - buscarClientesPlanOnly: plan mínimo requerido ('destacado' = solo
       negocios destacados o superiores; null/null = también emprendedores)
     - buscarClientesAllowed: lista de slugs autorizados por el superadmin
       (vacío = TODOS los negocios que cumplan el plan) */
  buscarClientesPlanOnly: 'destacado',
  buscarClientesAllowed: [],
  /* LANDING PRINCIPAL (donde el cliente elige negocio): editable por el
     superadministrador desde Configuración de planes → "Landing principal".
     Si está vacío, se usan los valores visuales por defecto. */
  landing: {
    title: 'Elegí dónde comprar hoy.',
    subtitle: 'Explorá las tiendas y profesionales de la plataforma y entrá directo por WhatsApp.',
    heroImage: '',
    accentColor: '#FFD100',
    titleColor: '#FFFFFF',
    showStats: true,
    dynamicHtml: ''
  },
  /* TÉRMINOS Y CONDICIONES de contratación de planes (superadmin):
     - text: texto que el negocio acepta antes de enviar el comprobante
     - pdf: documento PDF opcional (se muestra como enlace)
     - plans[n].info / .desc: textos de presentación de cada plan */
  terms: {
    text: 'Al contratar un plan de PRO.DIGITAL aceptás pagar la tarifa mensual indicada mediante SINPE Móvil. El plan se activa una vez verificado el comprobante por el equipo. Los precios y características pueden actualizarse; la renovación es automática y podés cancelar antes del próximo vencimiento siguiendo las políticas de la plataforma.',
    pdf: '',
    plans: {}
  },
  /* COTIZADOR DE MENSAJERÍA UBER FLASH:
     - uberQuoteAllowed: slugs autorizados por el superadmin (vacío = ninguno.
       El negocio además debe tener plan Profesional o superior para verlo).
     - uberTariff: tarifas para el estimado simbólico (colones). */
  uberQuoteAllowed: [],
  uberTariff: { base: 400, perKm: 550, perMin: 6 },
  /* UBICACIÓN FIJA (origen) por negocio para el cotizador: { slug: {lat,lng,label} }.
     La configura el superadministrador. */
  uberLocations: {},
  /* PAGOS INTERNACIONALES:
     - payLinks: { planId: 'https://...' } — enlaces de cobro por plan que crea
       el superadmin en SU plataforma de pagos (PayPal.me, Payoneer "Request a
       Payment", Wise, o Stripe si lo consigue). El negocio paga desde ese enlace.
     - payDash: URL del panel/página de su cuenta para ver el estado de cuenta. */
  /* BOTONES DE PAGO PAYPAL HOSTED BUTTONS (plan → período → botón):
     - Emprendedor: mensual YUZDRC8347WRL · trimestral EHXRKLZU2BTG2 · anual 6WUEDY8WY389C
     - Profesional: mensual M3LSVWWH7ZUF8 · trimestral F7JYKDKJGS8DE · anual KAPMX24JYSXLQ
     - Destacado:   mensual KX7ZAR7GSUNY2 · trimestral HZABGRZHKJ6YG · anual 5T7XHNPYY5JDG */
  payLinks: {},
  payDash: '',
  /* ---------- PAGO CON TARJETA DINÁMICO (PayPal.Me) ----------
     El superadmin pone su usuario de PayPal.Me (o enlace de cobro) y la divisa
     de cobro. El monto se envía dinámicamente en el enlace. */
  paymeUser: '',
  paymeCurrency: 'USD',
  /* Tasa de cambio forzada (opcional): { 'CRC:USD': 0.00026 }. Si está vacío,
     se usa el tipo de cambio del BCCR en tiempo real. */
  fxRates: {},
  paypalButtons: {
    emprendedor: { monthly: 'YUZDRC8347WRL', quarterly: 'EHXRKLZU2BTG2', yearly: '6WUEDY8WY389C' },
    profesional: { monthly: 'M3LSVWWH7ZUF8', quarterly: 'F7JYKDKJGS8DE', yearly: 'KAPMX24JYSXLQ' },
    destacado:   { monthly: 'KX7ZAR7GSUNY2', quarterly: 'HZABGRZHKJ6YG', yearly: '5T7XHNPYY5JDG' }
  }
};

let planConfig = null;
let membershipPayments = [];
let unsubMembership = null;
let memTimerInterval = null;
let privatePaypalSecret = '';       // secret PayPal de la plataforma (solo servidor)
let _maskedPlatformSecret = '';     // versión enmascarada para mostrar al superadmin
let privatePlatformWa = {};         // claves WhatsApp del superadmin (solo servidor)

/* ---------- utilidades de fecha ---------- */
function addMonths(date, months){
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function daysBetween(a,b){ return Math.floor((b-a)/(1000*60*60*24)); }
function hoursBetween(a,b){ return Math.floor((b-a)/(1000*60*60)); }

/* ---------- cargar configuración global de planes (superadmin / admin) ---------- */
async function loadPlanConfig(){
  if(planConfig) return planConfig;
  planConfig = DEFAULT_PLAN_CONFIG; // fallback inmediato
  try{
    const snap = await db.collection('platform').doc('config').get();
    if(snap.exists) planConfig = Object.assign({}, DEFAULT_PLAN_CONFIG, snap.data());
    /* El mapeo de los botones de PayPal (plan→período→botón) siempre se
       restaura desde DEFAULT, porque el documento guardado puede tener la
       estructura vieja/plana que rompería la selección por período. */
    planConfig.paypalButtons = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG.paypalButtons));
  }catch(e){
    console.warn('loadPlanConfig error, usando defaults:', e);
  }
  /* Aplicar la config del landing principal a la portada en vivo */
  try{ applyLandingConfig(); }catch(e){}
  return planConfig;
}

/* ---------- guardar configuración de planes (superadmin) ---------- */
async function savePlanConfig(){
  const wrap = document.getElementById('saPlanConfigWrap');
  const sinpeEl = document.getElementById('saPlatformSinpe');
  if(sinpeEl) planConfig.platformSinpe = sinpeEl.value.trim();
  const bcEl = document.getElementById('saBuscarClientesUrl');
  if(bcEl) planConfig.buscarClientesUrl = bcEl.value.trim();
  const bpEl = document.getElementById('saBuscarPlanOnly');
  if(bpEl) planConfig.buscarClientesPlanOnly = bpEl.value;
  /* Negocios autorizados: los checkboxes marcados */
  const allowed = [];
  document.querySelectorAll('#saBuscarClientsList input:checked').forEach(function(el){
    if(el.value) allowed.push(el.value);
  });
  planConfig.buscarClientesAllowed = allowed;
  /* Cotizador Uber Flash: negocios autorizados + tarifas */
  const uAllowed = [];
  document.querySelectorAll('#saUberClientsList input:checked').forEach(function(el){
    if(el.value) uAllowed.push(el.value);
  });
  planConfig.uberQuoteAllowed = uAllowed;
  const uT = planConfig.uberTariff = planConfig.uberTariff || {};
  const num = function(x){ return Math.max(0, parseFloat(document.getElementById(x) && document.getElementById(x).value) || 0); };
  uT.base = num('saUberBase');
  uT.perKm = num('saUberPerKm');
  uT.perMin = num('saUberPerMin');
  /* Guardar ubicación fija (origen) por negocio autorizado */
  const uLocs = planConfig.uberLocations = planConfig.uberLocations || {};
  uAllowed.forEach(function(slug){
    const addrEl = document.getElementById('saUberLoc_' + slug);
    const latEl = document.getElementById('saUberLat_' + slug);
    const lngEl = document.getElementById('saUberLng_' + slug);
    if(addrEl || latEl || lngEl){
      const a = addrEl ? addrEl.value.trim() : '';
      const lat = latEl ? latEl.value : '';
      const lng = lngEl ? lngEl.value : '';
      if((lat && lng) || a){ uLocs[slug] = { address: a, lat: lat, lng: lng }; }
      else delete uLocs[slug];
    }
  });
  /* Guardar usuario de PayPal.Me para pago con tarjeta dinámico */
  const pmEl = document.getElementById('saPaymeUser');
  if(pmEl) planConfig.paymeUser = pmEl.value.trim().replace(/^https?:\/\/paypal\.me\//i,'').replace(/@/g,'');
  const pmC = document.getElementById('saPaymeCurrency');
  if(pmC) planConfig.paymeCurrency = pmC.value;
  /* Credenciales PayPal de la PLATAFORMA (para el cobro de membresías con monto exacto) */
  const saPpC = document.getElementById('saPaypalClientId');
  if(saPpC) planConfig.paypalClientId = saPpC.value.trim();
  const saPpS = document.getElementById('saPaypalSecret');
  const saPpE = document.getElementById('saPaypalEmail');
  if(saPpE) planConfig.paypalEmail = saPpE.value.trim();
  /* El SECRET no va al doc público (lo lee cualquier usuario logueado): se
     guarda en platform/private, que solo lee el servidor. */
  if(saPpS && saPpS.value.trim() && saPpS.value !== _maskedPlatformSecret) privatePaypalSecret = saPpS.value.trim();
  else if(!saPpS || !saPpS.value.trim()) { /* vacío = conservar */ }
  /* WhatsApp del superadmin: número/proveedor en doc público, claves en privado */
  /* WhatsApp del superadmin: CallMeBot (principal) + Twilio/Meta (respaldo) */
  const callmePhoneEl = document.getElementById('saCallmePhone');
  if(callmePhoneEl) planConfig.callmePhone = callmePhoneEl.value.trim();
  const callmeKeyEl = document.getElementById('saCallmeApiKey');
  if(callmeKeyEl && callmeKeyEl.value.trim()) privatePlatformWa.callmeApiKey = callmeKeyEl.value.trim();
  if(callmePhoneEl && callmePhoneEl.value.trim()) privatePlatformWa.callmePhone = callmePhoneEl.value.trim();
  /* Tasa de cambio forzada CRC→USD (si el superadmin la define) */
  const fxEl = document.getElementById('saFxRate');
  var fxRates = planConfig.fxRates = planConfig.fxRates || {};
  if(fxEl && fxEl.value.trim()) fxRates['CRC:USD'] = parseFloat(fxEl.value) || 0;
  else delete fxRates['CRC:USD'];
  const inputs = wrap.querySelectorAll('[data-plan-field]');
  const newPlans = [];
  const newPeriods = [];
  inputs.forEach(el=>{
    const type = el.dataset.planField;
    const idx = parseInt(el.dataset.idx);
    if(type==='planActive'){
      if(!newPlans[idx]) newPlans[idx] = Object.assign({}, planConfig.plans[idx]);
      newPlans[idx].active = el.checked;
    }
    if(type==='planPrice'){
      if(!newPlans[idx]) newPlans[idx] = Object.assign({}, planConfig.plans[idx]);
      newPlans[idx].price = Math.max(0, parseInt(el.value)||0);
    }
    if(type==='planFeatures'){
      if(!newPlans[idx]) newPlans[idx] = Object.assign({}, planConfig.plans[idx]);
      newPlans[idx].features = el.value.split('\n').map(s=>s.trim()).filter(Boolean);
    }
    if(type==='periodActive'){
      if(!newPeriods[idx]) newPeriods[idx] = Object.assign({}, planConfig.periods[idx]);
      newPeriods[idx].active = el.checked;
    }
    if(type==='periodDiscount'){
      if(!newPeriods[idx]) newPeriods[idx] = Object.assign({}, planConfig.periods[idx]);
      newPeriods[idx].discount = Math.max(0, Math.min(100, parseInt(el.value)||0));
    }
  });
  // mergear con existentes para no perder ids/nombres
  planConfig.plans.forEach((p,i)=>{ if(newPlans[i]) Object.assign(p, newPlans[i]); });
  planConfig.periods.forEach((p,i)=>{ if(newPeriods[i]) Object.assign(p, newPeriods[i]); });
  /* Guardar enlaces de pago internacional por plan + panel de la cuenta */
  const sLinks = planConfig.payLinks = planConfig.payLinks || {};
  planConfig.plans.forEach(function(p){
    const el = document.getElementById('saStripeLink_' + p.id);
    if(el) sLinks[p.id] = el.value.trim();
  });
  const dashEl = document.getElementById('saStripeDashboard');
  if(dashEl) planConfig.payDash = dashEl.value.trim();
  try{
    /* Los SECRETOS (PayPal y WhatsApp) se guardan aparte, en platform/private,
       porque platform/config es legible por cualquier usuario logueado. */
    const privUpdate = {};
    if(privatePaypalSecret){ privUpdate.paypalSecret = privatePaypalSecret; privatePaypalSecret = ''; }
    if(Object.keys(privatePlatformWa).length){ Object.assign(privUpdate, privatePlatformWa); privatePlatformWa = {}; }
    if(Object.keys(privUpdate).length){
      await db.collection('platform').doc('private').set(privUpdate, {merge:true});
    }
    await db.collection('platform').doc('config').set(planConfig, {merge:true});
    toast('Configuración guardada', 'ok');
    renderPlanConfigUI();
  }catch(e){
    toast('No se pudo guardar: ' + (e.message||'error'), 'err');
  }
}
/* Prueba la notificación por WhatsApp del superadmin llamando a la Cloud Function */
async function saTestSuperadminWa(){
  const st = document.getElementById('saWaTestStatus');
  if(st){ st.textContent = 'Enviando…'; st.style.color = 'var(--muted)'; }
  try{
    const res = await cloudCall('testSuperadminWhatsapp', {});
    if(st){
      st.textContent = res.message || '—';
      st.style.color = res.ok ? 'var(--green)' : 'var(--danger)';
    }
    if(res.ok) toast('Notificación enviada ✓ (revisá tu WhatsApp)', 'ok');
    else toast('No se pudo enviar. Revisá la config.', 'err');
  }catch(e){
    if(st){ st.textContent = 'Error al probar: ' + ((e && e.message)||'error'); st.style.color = 'var(--danger)'; }
    toast('No se pudo probar la notificación', 'err');
  }
}
/* Ejecuta el barrido de membresías vencidas (aviso al superadmin) manualmente */
async function saTestExpiredAlert(){
  const st = document.getElementById('saWaTestStatus');
  if(st){ st.textContent = 'Revisando vencimientos…'; st.style.color = 'var(--muted)'; }
  try{
    const res = await cloudCall('notifyExpiredMemberships', {});
    if(st){
      st.textContent = res && res.notified ? ('Avisos enviados: ' + res.notified) : 'Sin vencimientos pendientes.';
      st.style.color = (res && res.notified) ? 'var(--green)' : 'var(--muted)';
    }
    toast((res && res.notified ? 'Avisos de vencidas enviados ✓' : 'No hay vencimientos por avisar'), 'ok');
  }catch(e){
    if(st){ st.textContent = 'Error: ' + ((e && e.message)||'error'); st.style.color = 'var(--danger)'; }
    toast('No se pudo ejecutar el barrido', 'err');
  }
}
function resetPlanConfigDefaults(){
  planConfig = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIG));
  renderPlanConfigUI();
  toast('Valores restaurados (recordá guardar)', 'ok');
}
/* Abre el dashboard de Stripe del superadmin (ver estado de cuenta).
   Si no hay URL configurada, abre la página de PayPal. */
function openStripeDashboard(){
  const url = (planConfig && planConfig.payDash) ? planConfig.payDash.trim() : 'https://www.paypal.com/';
  window.open(url, '_blank', 'noopener');
}
/* ---------- LANDING PRINCIPAL: guardar y cargar la portada del selector ---------- */
async function saveLandingConfig(){
  try{
    if(!planConfig) await loadPlanConfig();
    const l = planConfig.landing = planConfig.landing || {};
    const id = function(x){ return document.getElementById(x); };
    l.title = id('saLandTitle') ? id('saLandTitle').value.trim() : l.title;
    l.subtitle = id('saLandSubtitle') ? id('saLandSubtitle').value.trim() : l.subtitle;
    l.heroImage = id('saLandHero') ? id('saLandHero').value.trim() : l.heroImage;
    l.accentColor = id('saLandAccent') ? id('saLandAccent').value : l.accentColor;
    l.titleColor = id('saLandTitleColor') ? id('saLandTitleColor').value : l.titleColor;
    l.showStats = id('saLandStats') ? id('saLandStats').checked : l.showStats;
    l.dynamicHtml = id('saLandDyn') ? id('saLandDyn').value.trim() : l.dynamicHtml;
    await db.collection('platform').doc('config').set(planConfig, {merge:true});
    toast('Landing principal guardada ✓', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo guardar la landing: ' + (e && e.message ? e.message : 'error'), 'err');
  }
}
/* ---------- EDITOR DE INFORMACIÓN Y TÉRMINOS DE PLANES (superadmin) ----------
   El superadmin edita: textos de cada plan, términos y condiciones y el
   documento PDF que los negocios aceptan antes de enviar el comprobante. */
function openPlanTermsEditor(){
  const m = document.getElementById('planTermsModal');
  if(!m) return;
  const t = (planConfig && planConfig.terms) || {};
  renderPlanTermsFields();
  const tt = document.getElementById('ptTermsText');
  if(tt) tt.value = t.text || '';
  const pd = document.getElementById('ptTermsPdf');
  if(pd) pd.value = t.pdf || '';
  const st = document.getElementById('ptPdfStatus');
  if(st){ st.textContent = t.pdf ? '✓ Documento cargado' : 'Sin documento'; st.style.color = t.pdf ? 'var(--green-dark)' : 'var(--muted)'; }
  m.classList.add('show');
}
function closePlanTermsEditor(){
  const m = document.getElementById('planTermsModal');
  if(m) m.classList.remove('show');
}
/* Campos de texto por plan en el editor de términos */
function renderPlanTermsFields(){
  const box = document.getElementById('planTermsPlans');
  if(!box) return;
  const plans = (planConfig && planConfig.plans) || [];
  const terms = (planConfig && planConfig.terms && planConfig.terms.plans) || {};
  box.innerHTML = '<h4 style="font-size:14px;margin-bottom:8px">💬 Textos de cada plan</h4>' + plans.map(function(p){
    const info = (terms[p.id] && terms[p.id].info) || p.features.join(' · ');
    const desc = (terms[p.id] && terms[p.id].desc) || '';
    return '<div class="f-group" style="margin-bottom:10px">' +
      '<label style="font-weight:700">' + esc(p.name) + '</label>' +
      '<textarea class="f-input" data-pt-plan="' + esc(p.id) + '" data-pt-field="info" rows="2" style="margin-top:4px" placeholder="Texto informativo del plan...">' + esc(info) + '</textarea>' +
      '<textarea class="f-input" data-pt-plan="' + esc(p.id) + '" data-pt-field="desc" rows="2" style="margin-top:6px" placeholder="Descripción breve del plan...">' + esc(desc) + '</textarea>' +
      '</div>';
  }).join('');
  /* Aviso de uso si no hay config previa */
  if(!planConfig.terms){ }
}
/* Guardar información y términos de planes */
async function savePlanTerms(){
  try{
    if(!planConfig) await loadPlanConfig();
    const terms = planConfig.terms = planConfig.terms || {};
    terms.plans = terms.plans || {};
    document.querySelectorAll('#planTermsPlans [data-pt-plan]').forEach(function(el){
      const pid = el.getAttribute('data-pt-plan');
      const fid = el.getAttribute('data-pt-field');
      if(!terms.plans[pid]) terms.plans[pid] = {};
      terms.plans[pid][fid] = el.value.trim();
    });
    const tt = document.getElementById('ptTermsText');
    if(tt) terms.text = tt.value.trim();
    const pd = document.getElementById('ptTermsPdf');
    if(pd) terms.pdf = pd.value.trim();
    await db.collection('platform').doc('config').set(planConfig, {merge:true});
    toast('Información y términos guardados ✓', 'ok');
    closePlanTermsEditor();
  }catch(e){
    console.error(e);
    toast('No se pudo guardar: ' + ((e && e.message) || 'error'), 'err');
  }
}
/* Subir PDF de términos a Storage */
function pickTermsPdf(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async function(){
    const f = inp.files && inp.files[0];
    if(!f) return;
    if(!/\.pdf$/i.test(f.name||'')){ toast('Subí un archivo .pdf', 'err'); return; }
    if(f.size > 10 * 1024 * 1024){ toast('El PDF es muy pesado (máx 10 MB)', 'err'); return; }
    toast('Subiendo PDF…', 'ok');
    try{
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const name = 'platform/landing/terminos-' + Date.now() + '.pdf';
      const ref = firebase.storage().ref(name);
      await ref.put(f, { contentType: 'application/pdf', cacheControl: 'public,max-age=31536000' });
      const url = await ref.getDownloadURL();
      const pd = document.getElementById('ptTermsPdf');
      if(pd) pd.value = url;
      const st = document.getElementById('ptPdfStatus');
      if(st){ st.textContent = '✓ Documento cargado'; st.style.color = 'var(--green-dark)'; }
      toast('PDF subido ✓ (recordá Guardar)', 'ok');
    }catch(e){ console.error(e); toast('No se pudo subir el PDF: ' + ((e && e.message)||'error'), 'err'); }
  };
  inp.click();
}

/* Muestra/oculta el bloque de config de WhatsApp según el proveedor */
function loadLandingConfigFields(){
  try{
    const l = (planConfig && planConfig.landing) || DEFAULT_PLAN_CONFIG.landing || {};
    const id = function(x){ return document.getElementById(x); };
    if(id('saLandTitle')) id('saLandTitle').value = l.title || '';
    if(id('saLandSubtitle')) id('saLandSubtitle').value = l.subtitle || '';
    if(id('saLandHero')) id('saLandHero').value = l.heroImage || '';
    if(id('saLandAccent')) id('saLandAccent').value = l.accentColor || '#FFD100';
    if(id('saLandTitleColor')) id('saLandTitleColor').value = l.titleColor || '#FFFFFF';
    if(id('saLandStats')) id('saLandStats').checked = l.showStats !== false;
    if(id('saLandHeroPrev')){ id('saLandHeroPrev').src = l.heroImage || ''; id('saLandHeroPrev').style.display = l.heroImage ? '' : 'none'; }
    if(id('saLandDyn')){ id('saLandDyn').value = l.dynamicHtml || ''; }
    if(id('saLandDynStatus')){
      const st = id('saLandDynStatus');
      if(l.dynamicHtml){ st.textContent = '✓ Fondo HTML cargado'; st.style.color = 'var(--green-dark)'; }
      else { st.textContent = 'Sin fondo dinámico'; st.style.color = 'var(--muted)'; }
    }
  }catch(e){ console.warn('No se pudo cargar la config del landing:', e); }
}
/* Aplica la config del landing al elemento del selector (título, subtítulo,
   imagen de fondo, colores y contadores). Se llama antes de renderizar. */
function applyLandingConfig(){
  const l = (planConfig && planConfig.landing) || DEFAULT_PLAN_CONFIG.landing || {};
  const ts = document.getElementById('tenantSelector');
  if(!ts) return;
  /* Título: mantiene el estilo con <em> resaltado. Si el superadmin no
     escribió título, se conserva el original con "dónde comprar" resaltado. */
  if(l.title){
    const el = ts.querySelector('.ts-title');
    if(el){
      const t = String(l.title).trim();
      if(t && t.toLowerCase() !== 'elegí dónde comprar hoy.'){
        /* Resaltar la última palabra con <em>, salvo que ya traiga marcado */
        const parts = t.split(/\s+/);
        if(parts.length > 1){
          const last = parts.pop();
          el.innerHTML = esc(parts.join(' ')) + '<br><em>' + esc(last) + '</em>';
        } else {
          el.innerHTML = esc(t);
        }
      }
    }
  }
  if(l.subtitle && ts.querySelector('#tenantSelectorMsg')){
    const msg = ts.querySelector('#tenantSelectorMsg');
    msg.innerHTML = esc(l.subtitle);
    msg.style.display = 'inline-block';
  }
  /* Aplicar colores e imagen de fondo al contenedor */
  applyLandingBgMotion(l);
  /* Color de acento y título sobre variables CSS */
  ts.style.setProperty('--yellow', (l.accentColor || '#FFD100'));
  ts.style.setProperty('--ts-title-color', (l.titleColor || '#FFFFFF'));
  /* Fondo dinámico (HTML) */
  applyDynamicBg(l);
}
/* Fondo con efecto Ken Burns (movimiento suave de zoom/desplazamiento).
   Se inyecta como <img> animado a nivel de BODY (hermano del selector),
   detrás del contenido. Así no lo recorta el overflow del selector.
   SOLO se muestra si el selector de negocios está activo (selector-mode),
   para que no aparezca en las tiendas individuales. */
function applyLandingBgMotion(l){
  l = l || (planConfig && planConfig.landing) || DEFAULT_PLAN_CONFIG.landing || {};
  const ts = document.getElementById('tenantSelector');
  if(!ts) return;
  let bg = document.getElementById('tsBgMotion');
  const active = document.body.classList.contains('selector-mode');
  if(l.heroImage && active){
    if(!bg){
      bg = document.createElement('div');
      bg.id = 'tsBgMotion';
      bg.className = 'ts-bg-motion';
      document.body.insertBefore(bg, document.body.firstChild);
    }
    bg.innerHTML = '<img src="' + esc(l.heroImage) + '" alt="">';
    bg.style.display = '';
    ts.setAttribute('data-bg', '1');
  } else {
    if(bg){ bg.style.display = 'none'; }
    if(ts) ts.removeAttribute('data-bg');
  }
}

/* Quitar la imagen de fondo del hero (limpia el input y la vista previa) */
function clearLandingHero(){
  const el = document.getElementById('saLandHero');
  if(el) el.value = '';
  const ph = document.getElementById('saLandHeroPrev');
  if(ph){ ph.src = ''; ph.style.display = 'none'; }
  toast('Imagen de fondo quitada (recordá Guardar landing)', 'ok');
}

/* Subir imagen de fondo en ALTA RESOLUCIÓN (compresión mínima).
   Usa la ruta sites/ (reglas seguras y probadas) y actualiza la vista previa. */
function pickHighResLandingHero(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/jpeg,image/png';
  inp.onchange = async function(){
    const f = inp.files && inp.files[0];
    if(!f) return;
    toast('Subiendo fondo en alta resolución…', 'ok');
    try{
      /* ALTA RESOLUCIÓN para fondos grandes: hasta 4000px y calidad 0.98. */
      const blob = await resimageHighRes(f, 4000, 0.98);
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const name = 'sites/' + (TENANT_ID || 'x') + '/hero-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + (blob.type === 'image/png' ? '.png' : '.jpg');
      const ref = firebase.storage().ref(name);
      await ref.put(blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
      const url = await ref.getDownloadURL();
      const el = document.getElementById('saLandHero');
      if(el) el.value = url;
      const ph = document.getElementById('saLandHeroPrev');
      if(ph){ ph.src = url; ph.style.display = ''; }
      console.log('[LANDING HERO] subida OK:', url);
      toast('Fondo en alta resolución subido ✓ (recordá Guardar landing)', 'ok');
    }catch(e){
      console.error('[LANDING HERO] error:', e);
      toast('No se pudo subir el fondo: ' + ((e && e.message) || 'error'), 'err');
    }
  };
  inp.click();
}
/* Redimensiona la imagen SOLO si supera el máximo (no amplía ni baja la
   calidad de imágenes ya buenas) y la comprime en JPEG de alta calidad 0.98. */
function resimageHighRes(file, maxDim, quality){
  return new Promise(function(resolve, reject){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function(){
      try{
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if(file.type === 'image/png'){ ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const type = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
        cv.toBlob(function(b){ URL.revokeObjectURL(url); resolve(b || file); }, type, type === 'image/jpeg' ? quality : undefined);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
/* ---------- FONDO DINÁMICO (archivo HTML) de la página principal ----------
   El superadmin sube un .html que se muestra en un <iframe sandbox> detrás
   del contenido del selector (título, buscador, tarjetas de negocios). */
function pickLandingDynamicHtml(){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'text/html,.html,text/plain';
  inp.onchange = async function(){
    const f = inp.files && inp.files[0];
    if(!f) return;
    if(!/\.html?$/i.test(f.name || '')){ toast('Subí un archivo .html', 'err'); return; }
    if(f.size > 5 * 1024 * 1024){ toast('El archivo HTML es muy pesado (máx 5 MB)', 'err'); return; }
    toast('Subiendo fondo HTML…', 'ok');
    try{
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const name = 'platform/landing/fondo-' + Date.now() + '.html';
      const ref = firebase.storage().ref(name);
      await ref.put(f, { contentType: 'text/html', cacheControl: 'public,max-age=31536000' });
      const url = await ref.getDownloadURL();
      const el = document.getElementById('saLandDyn');
      if(el){ el.value = url; el.dataset.tpl = ''; }
      const st = document.getElementById('saLandDynStatus');
      if(st){ st.textContent = '✓ Fondo HTML cargado'; st.style.color = 'var(--green-dark)'; }
      toast('Fondo HTML subido ✓ (recordá Guardar landing)', 'ok');
    }catch(e){ console.error(e); toast('No se pudo subir el HTML: ' + ((e && e.message) || 'error'), 'err'); }
  };
  inp.click();
}
/* Renderiza el fondo dinámico en el selector (iframer con el HTML subido) */
function applyDynamicBg(l){
  l = l || (planConfig && planConfig.landing) || DEFAULT_PLAN_CONFIG.landing || {};
  const holder = document.getElementById('tsDynamicBg');
  if(!holder) return;
  const ts = document.getElementById('tenantSelector');
  holder.innerHTML = '';
  const url = l.dynamicHtml || '';
  if(url){
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('loading', 'lazy');
    f.src = url;
    holder.appendChild(f);
    /* Guardar referencia para enviarle el mouse (las partículas siguen el
       cursor aunque el iframe tenga pointer-events:none). */
    window.__tsDynFrame = f;
    bindTsDynMouse();
    if(ts) ts.setAttribute('data-dyn', '1');
  } else {
    if(ts) ts.removeAttribute('data-dyn');
    window.__tsDynFrame = null;
  }
}
/* Envía la posición del mouse (relativa al iframe) al fondo dinámico.
   El iframe tiene pointer-events:none, así que el padre captura el mouse. */
let _tsDynMouseBound = false;
function bindTsDynMouse(){
  if(_tsDynMouseBound) return;
  _tsDynMouseBound = true;
  document.addEventListener('mousemove', function(ev){
    const f = window.__tsDynFrame;
    const holder = document.getElementById('tsDynamicBg');
    if(!f || !holder || !f.contentWindow) return;
    const r = holder.getBoundingClientRect();
    try{
      f.contentWindow.postMessage({ tx: ev.clientX - r.left, ty: ev.clientY - r.top }, '*');
    }catch(e){}
  });
}

/* Negocios autorizados para "Buscar clientes": checkboxes pintados desde
   la lista de tenants que cargó el superadmin (_saTenants). */
function renderSaBuscarClientesChoices(){
  const list = document.getElementById('saBuscarClientsList');
  if(!list) return;
  const allowed = (planConfig && planConfig.buscarClientesAllowed) || [];
  const tenants = (typeof _saTenants !== 'undefined' && _saTenants) ? _saTenants : [];
  if(!tenants.length){
    list.innerHTML = '<div style="font-size:12px;color:var(--muted)">Cargando lista de negocios…</div>';
    return;
  }
  list.innerHTML = tenants.map(function(t){
    const slug = t.id || '';
    const name = (t.nombre || t.storeName || slug);
    return '<label style="display:inline-flex;align-items:center;gap:6px;background:#F7F9FB;border:1px solid #E8EDF2;border-radius:9px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">' +
      '<input type="checkbox" value="' + esc(slug) + '"' + (allowed.indexOf(slug) !== -1 ? ' checked' : '') + ' style="width:15px;height:15px"> ' + esc(name) + '</label>';
  }).join('');
}
/* Negocios autorizados para el cotizador de mensajería Uber Flash */
function renderSaUberClientsChoices(){
  const list = document.getElementById('saUberClientsList');
  if(!list) return;
  const allowed = (planConfig && planConfig.uberQuoteAllowed) || [];
  const tenants = (typeof _saTenants !== 'undefined' && _saTenants) ? _saTenants : [];
  if(!tenants.length){
    list.innerHTML = '<div style="font-size:12px;color:var(--muted)">Cargando lista de negocios…</div>';
    return;
  }
  list.innerHTML = tenants.map(function(t){
    const slug = t.id || '';
    const name = (t.nombre || t.storeName || slug);
    return '<label style="display:inline-flex;align-items:center;gap:6px;background:#F7F9FB;border:1px solid #E8EDF2;border-radius:9px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer">' +
      '<input type="checkbox" value="' + esc(slug) + '"' + (allowed.indexOf(slug) !== -1 ? ' checked' : '') + ' style="width:15px;height:15px"> ' + esc(name) + '</label>';
  }).join('');
}
/* Cargar tarifas y ubicaciones del cotizador en el panel */
function loadUberConfigFields(){
  const id = function(x){ return document.getElementById(x); };
  const t = (planConfig && planConfig.uberTariff) || DEFAULT_PLAN_CONFIG.uberTariff || {};
  if(id('saUberBase')) id('saUberBase').value = t.base || 400;
  if(id('saUberPerKm')) id('saUberPerKm').value = t.perKm || 550;
  if(id('saUberPerMin')) id('saUberPerMin').value = t.perMin || 6;
}
/* Ubicaciones fijas de negocio (origen) — un input por negocio autorizado */
function renderSaUberLocationsChoices(){
  const box = document.getElementById('saUberLocationsList');
  if(!box) return;
  const allowed = (planConfig && planConfig.uberQuoteAllowed) || [];
  const locs = (planConfig && planConfig.uberLocations) || {};
  const tenants = (typeof _saTenants !== 'undefined' && _saTenants) ? _saTenants : [];
  const auths = tenants.filter(function(t){ return allowed.indexOf(t.id) !== -1; });
  if(!auths.length){ box.innerHTML = '<div style="font-size:12px;color:var(--muted)">Primero marcá los negocios autorizados arriba.</div>'; return; }
  box.innerHTML = auths.map(function(t){
    const slug = t.id || '';
    const name = (t.nombre || t.storeName || slug);
    const loc = locs[slug] || {};
    return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<b style="font-size:12px;min-width:120px">' + esc(name) + '</b>' +
      '<input class="f-input" id="saUberLoc_' + esc(slug) + '" placeholder="Dirección del negocio (ej: EBAIS La Carpio, San José)" value="' + esc(loc.address || '') + '" style="flex:1;min-width:200px">' +
      '<button type="button" class="btn-ghost" style="width:auto;padding:8px 12px;font-size:12px" onclick="geocodeUberLoc(\'' + esc(slug) + '\')">🔎 Buscar</button>' +
      '<input class="f-input" id="saUberLat_' + esc(slug) + '" value="' + esc(loc.lat || '') + '" placeholder="lat" style="width:90px;padding:8px 10px">' +
      '<input class="f-input" id="saUberLng_' + esc(slug) + '" value="' + esc(loc.lng || '') + '" placeholder="lng" style="width:90px;padding:8px 10px">' +
      '</div>';
  }).join('');
}
/* Geocodificar una dirección usando Nominatim (OSM) y llenar dos inputs */
function geocodeAddr(addr, latId, lngId){
  if(!addr){ toast('Escribí la dirección primero', 'err'); return; }
  toast('Buscando ubicación…', 'ok');
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(addr))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data && data[0]){
        document.getElementById(latId).value = data[0].lat;
        document.getElementById(lngId).value = data[0].lon;
        toast('Ubicación encontrada: ' + (data[0].display_name || '').slice(0, 60), 'ok');
      } else { toast('No se encontró esa dirección', 'err'); }
    })
    .catch(function(){ toast('No se pudo buscar la dirección', 'err'); });
}
/* Geocodificar la ubicación del negocio (panel superadmin, por slug) */
function geocodeUberLoc(slug){
  const addrEl = document.getElementById('saUberLoc_' + slug);
  if(!addrEl) return;
  geocodeAddr(addrEl.value.trim(), 'saUberLat_' + slug, 'saUberLng_' + slug);
}
/* Geocodificar la ubicación del negocio (panel del admin de tienda) */
function geocodeMyStore(){
  const addrEl = document.getElementById('sUberAddress');
  if(!addrEl) return;
  geocodeAddr(addrEl.value.trim(), 'sUberLat', 'sUberLng');
}
function renderPlanConfigUI(){
  const wrap = document.getElementById('saPlanConfigWrap');
  if(!wrap || !planConfig) return;
  const sinpeEl = document.getElementById('saPlatformSinpe');
  if(sinpeEl) sinpeEl.value = planConfig.platformSinpe || '';
  const bcEl = document.getElementById('saBuscarClientesUrl');
  if(bcEl) bcEl.value = planConfig.buscarClientesUrl || '';
  const bpEl = document.getElementById('saBuscarPlanOnly');
  if(bpEl && planConfig.buscarClientesPlanOnly) bpEl.value = planConfig.buscarClientesPlanOnly;
  renderSaBuscarClientesChoices();
  renderSaUberClientsChoices();
  loadUberConfigFields();
  renderSaUberLocationsChoices();
  let html = '<div style="display:grid;gap:16px">';
  html += '<div><b style="font-size:14px">Planes disponibles</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:8px">';
  planConfig.plans.forEach((p,i)=>{
    html += '<div style="background:#fff;border:1.5px solid '+(p.active?'var(--green)':'var(--line)')+';border-radius:14px;padding:14px">' +
      '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:8px;cursor:pointer">' +
      '<input type="checkbox" data-plan-field="planActive" data-idx="'+i+'" '+(p.active?'checked':'')+'> ' + esc(p.name) + '</label>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">'+p.features.map(f=>esc(f)).join(' · ')+'</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:13px">Precio ₡</span>' +
      '<input type="number" class="f-input" data-plan-field="planPrice" data-idx="'+i+'" value="'+p.price+'" style="width:110px;padding:8px 10px"></div>' +
      '<label style="font-size:12px;font-weight:700;display:block;margin-bottom:3px">Ventajas que ve el administrador (una por línea)</label>' +
      '<textarea class="f-input" data-plan-field="planFeatures" data-idx="'+i+'" rows="5" style="font-size:12px;width:100%;padding:8px 10px;line-height:1.5">'+esc((p.features||[]).join('\n'))+'</textarea>' +
      '</div>';
  });
  html += '</div></div>';
  html += '<div><b style="font-size:14px">Períodos de pago y descuentos</b><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">';
  planConfig.periods.forEach((p,i)=>{
    html += '<div style="background:#fff;border:1.5px solid '+(p.active?'var(--green)':'var(--line)')+';border-radius:14px;padding:14px;min-width:160px">' +
      '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:8px;cursor:pointer">' +
      '<input type="checkbox" data-plan-field="periodActive" data-idx="'+i+'" '+(p.active?'checked':'')+'> ' + esc(p.label) + '</label>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">'+p.months+' mes'+(p.months>1?'es':'')+'</div>' +
      '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px">Descuento %</span>' +
      '<input type="number" class="f-input" data-plan-field="periodDiscount" data-idx="'+i+'" value="'+p.discount+'" style="width:70px;padding:8px 10px"></div>' +
      '</div>';
  });
  html += '</div></div>';
  /* NOTIFICACIONES AL SUPERADMIN POR WHATSAPP (nuevas suscripciones + pagos de membresía) */
  html += '<div><b style="font-size:14px">📲 Notificaciones del superadministrador</b>' +
    '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">Recibís un aviso cuando alguien se suscribe con el mes gratis y cuando una tienda paga su membresía. Usá <b>CallMeBot</b> (WhatsApp personal, gratis) o el respaldo Twilio/Meta.</div>' +
    '<div style="border:1.5px solid var(--green);border-radius:12px;padding:10px 12px;background:var(--green-soft);margin-bottom:8px">' +
      '<b style="font-size:12.5px">🥇 CallMeBot (WhatsApp personal — GRATIS)</b>' +
      '<div style="font-size:11px;color:var(--muted);margin:2px 0 6px">Se envían los avisos a tu propio WhatsApp sin sandbox ni límites de prueba. Obtené tu APiKey en <b>callmebot.com</b> según su paso 1.</div>' +
      '<div class="f-row" style="grid-template-columns:1fr 1fr;gap:8px">' +
        '<div class="f-group"><label>Tu número (formato internacional)</label><input class="f-input" id="saCallmePhone" placeholder="50672284602" value="' + esc((planConfig.callmePhone || '')) + '"></div>' +
        '<div class="f-group"><label>API Key de CallMeBot</label><input class="f-input" id="saCallmeApiKey" type="password" autocomplete="off" value="' + esc((planConfig.callmeApiKey || '')) + '"></div>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:11.5px;color:var(--muted);margin:6px 0 8px;padding:8px 10px;background:#F1F5F9;border-radius:10px"><b>Debug:</b> Si CallMeBot no está configurado, se usa Twilio/Meta como respaldo. Las claves se guardan en un almacén privado (solo el servidor las lee).</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<button type="button" class="btn-primary" style="width:auto;padding:10px 18px" onclick="saTestSuperadminWa()">🧪 Probar notificación</button>' +
      '<button type="button" class="btn-ghost" style="width:auto;padding:9px 14px" onclick="saTestExpiredAlert()">⏰ Probar aviso de vencidas</button>' +
      '<span id="saWaTestStatus" style="font-size:12px;color:var(--muted)"></span>' +
    '</div>' +
  '</div>';
  /* PAGOS INTERNACIONALES (superadmin): enlaces por plan + panel de su cuenta */
  html += '<div><b style="font-size:14px">💳 Pagos internacionales (PayPal / Payoneer / Wise)</b>' +
    '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">Para cobrar fuera de Costa Rica, creá un enlace de cobro en tu cuenta de <b>PayPal</b> (paypal.me o "Request Money"), <b>Payoneer</b> (Request a Payment) o <b>Wise</b>, y pegá el enlace por plan. Los negocios verán el botón "Pagar con PayPal / tarjeta" además del SINPE. También podés agregar el enlace a tu cuenta para ver tu estado.</div>' +
    planConfig.plans.map(function(p){
      const link = (planConfig.payLinks && planConfig.payLinks[p.id]) || '';
      return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
        '<b style="font-size:12px;min-width:110px">' + esc(p.name) + '</b>' +
        '<input class="f-input" id="saStripeLink_' + esc(p.id) + '" placeholder="https://paypal.me/tu-usuario | https://payoneer.com/..." value="' + esc(link) + '" style="flex:1;min-width:220px">' +
        '</div>';
    }).join('') +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<b style="font-size:12px;min-width:110px">Tu cuenta / estado</b>' +
      '<input class="f-input" id="saStripeDashboard" placeholder="https://www.paypal.com/ | https://www.payoneer.com/" value="' + esc((planConfig.payDash || '')) + '" style="flex:1;min-width:220px">' +
      '<a class="btn-ghost" style="width:auto;padding:8px 12px;font-size:12px" href="' + esc((planConfig.payDash || '#')) + '" target="_blank" rel="noopener">Abrir mi cuenta →</a>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<b style="font-size:12px;min-width:110px">Pago con tarjeta dinámico</b>' +
      '<input class="f-input" id="saPaymeUser" placeholder="paypal.me/tu-usuario (o usuario)" value="' + esc((planConfig.paymeUser || '')) + '" style="flex:1;min-width:220px">' +
      '<select class="f-input" id="saPaymeCurrency" style="width:100px;min-width:100px">' +
        '<option value="USD"' + ((planConfig.paymeCurrency||'USD')==='USD'?' selected':'') + '>USD $</option>' +
        '<option value="EUR"' + ((planConfig.paymeCurrency||'')==='EUR'?' selected':'') + '>EUR €</option>' +
        '<option value="CRC"' + ((planConfig.paymeCurrency||'')==='CRC'?' selected':'') + '>CRC ₡</option>' +
      '</select>' +
    '</div>' +
    /* Credenciales PayPal de la PLATAFORMA (para el cobro de membresías con
       monto exacto: el dinero llega a TU cuenta de PayPal) */
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">' +
      '<div class="f-group"><label>Client ID de tu app PayPal (membresía)</label><input class="f-input" id="saPaypalClientId" autocomplete="off" placeholder="ARxxAx..." value="' + esc((planConfig.paypalClientId || '')) + '"></div>' +
      '<div class="f-group"><label>Secret Key de tu app PayPal</label><input class="f-input" id="saPaypalSecret" type="password" autocomplete="off" placeholder="****************************" value="' + esc(_maskedPlatformSecret || '') + '"></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<b style="font-size:12px;min-width:110px">Email Checkout (membresía)</b>' +
      '<input class="f-input" id="saPaypalEmail" type="email" autocomplete="off" placeholder="tu@cuenta-paypal.com" value="' + esc((planConfig.paypalEmail || '')) + '" style="flex:1;min-width:220px">' +
      '<span style="font-size:11px;color:var(--muted)">El pago de membresía se cobra con el monto exacto y llega a esta cuenta (empresarial/verificada).</span>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">' +
      '<b style="font-size:12px;min-width:110px">Tasa CRC→USD (opcional)</b>' +
      '<input class="f-input" id="saFxRate" placeholder="Ej: 0.00026 (vacío = usar BCCR en tiempo real)" value="' + esc((planConfig.fxRates && planConfig.fxRates['CRC:USD']) || '') + '" style="flex:1;min-width:220px">' +
    '</div>' +
    '<div style="font-size:11.5px;color:var(--muted);margin-top:4px">Si lo dejás vacío, la plataforma usa en <b>tiempo real</b> el tipo de cambio del Banco Central de Costa Rica (BCCR) para mostrar el equivalente en dólares. Podés forzar una tasa aquí.</div>' +
  '</div>';
  html += '</div>';
  wrap.innerHTML = html;
  loadLandingConfigFields();
  loadPlatformPaypalSecret();
}
/* Carga el Secret PayPal de la plataforma (platform/private) y lo muestra
   enmascarado. Solo el superadmin puede leerlo (reglas: platform/private). */
async function loadPlatformPaypalSecret(){
  try{
    const snap = await db.collection('platform').doc('private').get();
    const d = snap.exists ? snap.data() : {};
    const s = (d.paypalSecret || '');
    if(s){
      _maskedPlatformSecret = s.slice(0,6) + '****' + s.slice(-4);
      const el = document.getElementById('saPaypalSecret');
      if(el){ el.value = _maskedPlatformSecret; el.placeholder = 'Guardada: ' + _maskedPlatformSecret + ' — escribí una nueva para reemplazarla'; }
    }
  }catch(_e){ /* si falla, queda vacío */ }
}

/* ---------- "Buscar clientes" (enlace definido por el superadministrador) ---------- */
/* ¿El negocio actual está autorizado para "Buscar clientes"?
   Solo si el superadmin lo habilitó para su plan (por defecto: DESTACADO)
   y lo incluyó en la lista de negocios autorizados (si la lista existe). */
function canUseBuscarClientes(){
  let cfg = planConfig || (window.__planConfigLoaded ? planConfig : DEFAULT_PLAN_CONFIG);
  const plan = getActivePlanId();
  const minPlan = (cfg && cfg.buscarClientesPlanOnly) || 'destacado';
  const planOk = !PLAN_RANK[minPlan] || (PLAN_RANK[plan] || 1) >= PLAN_RANK[minPlan];
  if(!planOk) return false;
  const allowed = (cfg && cfg.buscarClientesAllowed) || [];
  /* Si el superadmin definió una lista, el negocio debe estar en ella */
  if(allowed && allowed.length){
    return allowed.indexOf(TENANT_ID || '') !== -1;
  }
  return true;
}
async function openBuscarClientes(){
  /* Asegurar que planConfig esté cargado (font: Firestore real, no defaults) */
  try{ if(!planConfig && typeof loadPlanConfig === 'function') await loadPlanConfig(); }catch(e){}
  if(!canUseBuscarClientes()){
    toast('"Buscar clientes" es exclusivo del plan Destacado y solo está habilitado en tu negocio si el superadmin lo autorizó.', 'err');
    return;
  }
  let url = '';
  if(planConfig) url = planConfig.buscarClientesUrl || '';
  else {
    try{
      const snap = await db.collection('platform').doc('config').get();
      if(snap.exists) url = snap.data().buscarClientesUrl || '';
    }catch(e){}
  }
  if(!url){
    toast('El superadministrador aún no configuró la plataforma para buscar clientes', 'err');
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/* ---------- carga del panel de membresía (admin de tienda) ---------- */
async function loadMembershipPanel(){
  await loadPlanConfig();
  // Recargar TENANT_DATA fresco desde Firestore para tener el estado actual
  try{
    const fresh = await tenantRef().get();
    if(fresh.exists) TENANT_DATA = Object.assign(TENANT_DATA||{}, fresh.data());
  }catch(e){ console.warn('No se pudo recargar TENANT_DATA', e); }
  await loadMembershipData();
  renderMembershipUI();
  startMemCountdown();
}

async function loadMembershipData(){
  if(unsubMembership) unsubMembership();
  try{
    const snap = await tenantRef().get();
    const data = snap.exists ? snap.data() : {};
    // Normalizar datos de membresía
    if(!data.membershipPlan){
      // Inicializar por primera vez con plan emprendedor
      const initPlan = 'emprendedor';
      const initPlanValue = 'basico';
      await tenantRef().set({
        membershipPlan: initPlan,
        membershipPeriod:'monthly',
        membershipStatus:'al_dia',
        membershipNextDueDate: addMonths(new Date(),1).toISOString(),
        membershipLastPaymentDate: new Date().toISOString(),
        membershipAutoSuspend:true,
        membershipReminderSent:false,
        plan: initPlanValue,
        planRank: 1,
        montoMensual: 9900
      }, {merge:true});
      TENANT_DATA.membershipPlan = initPlan;
      TENANT_DATA.plan = initPlanValue;
      TENANT_DATA.planRank = 1;
      TENANT_DATA.montoMensual = 9900;
    }
  }catch(e){ console.error(e); }

  // Escuchar historial de pagos
  unsubMembership = tenantRef().collection('membershipPayments').orderBy('date','desc').onSnapshot(snap=>{
    membershipPayments = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
    if(document.body.classList.contains('in-admin') && document.getElementById('panel-membership').classList.contains('active')){
      renderMembershipUI();
    }
  });
}

function getMembershipStatusColor(st){
  return {al_dia:'green', pendiente:'amber', vencido:'red', suspendido:'red'}[st] || 'gray';
}

function renderMembershipUI(){
  const planCfg = planConfig || DEFAULT_PLAN_CONFIG;
  const t = TENANT_DATA || {};
  // plan solicitado (puede estar pendiente de aprobación)
  const planSolicitado = planCfg.plans.find(p=>p.id===t.membershipPlan) || planCfg.plans[0];
  // plan APROBADO Y ACTIVO (el que realmente tiene el negocio)
  const planAprobado = planCfg.plans.find(p=>p.id===(t.planApprovedId||t.membershipPlan)) || planCfg.plans[0];
  const approvalStatus = t.planApprovalStatus || 'aprobado';
  const status = t.membershipStatus || 'al_dia';
  const nextDue = t.membershipNextDueDate ? new Date(t.membershipNextDueDate) : null;
  const now = new Date();

  // Mostrar plan activo real (aprobado) en la tarjeta principal
  const displayPlan = planAprobado || planSolicitado;
  document.getElementById('memPlanName').textContent = displayPlan ? displayPlan.name : '—';
  document.getElementById('memPlanPrice').textContent = displayPlan ? fmt(displayPlan.price) + '/mes' : '—';

  // Indicar si hay un plan superior pendiente de aprobación
  const planCardEl = document.getElementById('memPlanCard');
  let pendingBadge = document.getElementById('memPendingBadge');
  if(approvalStatus === 'pendiente' && planSolicitado && planSolicitado.id !== (t.planApprovedId||'emprendedor')){
    if(!pendingBadge){
      pendingBadge = document.createElement('div');
      pendingBadge.id = 'memPendingBadge';
      pendingBadge.style.cssText = 'margin-top:6px;font-size:12px;font-weight:700;color:#B45309;background:#FFF7ED;border:1px solid #F59E0B;border-radius:8px;padding:5px 10px;display:flex;align-items:center;gap:6px';
      planCardEl.appendChild(pendingBadge);
    }
    pendingBadge.innerHTML = '⏳ Plan <b>' + esc(planSolicitado.name) + '</b> pendiente de aprobación';
    pendingBadge.style.display = 'flex';
  } else if(pendingBadge){
    pendingBadge.style.display = 'none';
  }

  document.getElementById('memStatus').textContent = status.charAt(0).toUpperCase() + status.slice(1).replace('_',' ');
  document.getElementById('memStatus').style.color = status==='al_dia'?'var(--green)':(status==='suspendido'?'var(--danger)':'#B45309');
  document.getElementById('memStatusSub').textContent = status==='al_dia'?'Sin problemas':(status==='suspendido'?'Servicio suspendido':'Requiere atención');
  document.getElementById('memDueDate').textContent = nextDue ? nextDue.toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'}) : '—';

  // Calcular saldo / balance
  let balance = 0;
  if(nextDue && nextDue < now && status!=='al_dia'){
    balance = displayPlan ? displayPlan.price : 0;
  }
  document.getElementById('memBalance').textContent = fmt(balance);

  // Alerta 24h / vencido / suspendido / pendiente de aprobación
  const alertBox = document.getElementById('memAlertBox');
  const alertText = document.getElementById('memAlertText');
  const hoursLeft = nextDue ? hoursBetween(now, nextDue) : Infinity;
  alertBox.style.display = 'flex';
  if(approvalStatus === 'pendiente'){
    alertBox.style.background = '#FFFBEB'; alertBox.style.borderColor = '#F59E0B'; alertBox.style.color = '#92400E';
    alertText.innerHTML = '⏳ <b>Pago enviado, en revisión.</b> El superadministrador verificará tu comprobante y activará tu plan en breve.';
  }else if(hoursLeft <= 24 && hoursLeft > 0 && status!=='suspendido'){
    alertBox.style.background = 'var(--danger-soft)'; alertBox.style.borderColor = 'var(--danger)'; alertBox.style.color = 'var(--danger)';
    alertText.textContent = '⏰ Tu membresía vence en menos de 24 horas (' + Math.floor(hoursLeft) + 'h). Pagá ahora para evitar la suspensión automática.';
  }else if(status==='vencido'){
    alertBox.style.background = 'var(--danger-soft)'; alertBox.style.borderColor = 'var(--danger)'; alertBox.style.color = 'var(--danger)';
    alertText.innerHTML = '⚠️ <b>Tu membresía está vencida.</b> Tu negocio regresó al Plan Emprendedor hasta que renueves. Algunas funciones están bloqueadas.';
  }else if(status==='suspendido'){
    alertBox.style.background = 'var(--danger-soft)'; alertBox.style.borderColor = 'var(--danger)'; alertBox.style.color = 'var(--danger)';
    alertText.textContent = '🔒 Servicio suspendido por falta de pago. Contactá al superadministrador para reactivar.';
  }else{
    alertBox.style.display = 'none';
  }

  // Historial
  const tbody = document.getElementById('memHistoryBody');
  if(!membershipPayments.length){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Aún no hay pagos registrados.</td></tr>';
  }else{
    tbody.innerHTML = membershipPayments.map(p=>{
      const d = p.date ? new Date(p.date) : null;
      const verifiedBadge = p.verified === true ? '<span style="color:var(--green);font-size:11px;font-weight:700">✓ Verificado</span>' :
        p.verified === false ? '<span style="color:var(--danger);font-size:11px;font-weight:700">✗ Rechazado</span>' :
        '<span style="color:#B45309;font-size:11px;font-weight:700">⏳ Pendiente</span>';
      return '<tr><td>'+(d?d.toLocaleDateString('es-CR'):'—')+'</td><td>'+esc(p.periodLabel||p.period)+'</td><td>'+esc(p.planName||p.plan)+'</td><td><b>'+fmt(p.amount)+'</b></td><td>'+verifiedBadge+'</td><td>'+esc(p.reference||'—')+'</td></tr>';
    }).join('');
  }

  updateMembershipNavBadge();
}

function startMemCountdown(){
  if(memTimerInterval) clearInterval(memTimerInterval);
  memTimerInterval = setInterval(()=>{
    const t = TENANT_DATA || {};
    const nextDue = t.membershipNextDueDate ? new Date(t.membershipNextDueDate) : null;
    const now = new Date();
    const el = document.getElementById('memCountdown');
    if(!el) return;
    if(!nextDue){ el.textContent = '—'; return; }
    const diff = nextDue - now;
    if(diff <= 0){ el.textContent = 'Vencido'; el.style.color='var(--danger)'; return; }
    const d = Math.floor(diff/(1000*60*60*24));
    const h = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
    const m = Math.floor((diff%(1000*60*60))/(1000*60));
    el.textContent = (d>0?d+'d ':'') + h+'h ' + m+'m restantes';
    el.style.color = diff < 24*60*60*1000 ? 'var(--danger)' : 'var(--green)';
  }, 60000);
  // Ejecutar inmediatamente
  const evt = new Event('interval');
  // Hack: llamar manualmente una vez
  setTimeout(()=>{
    const t = TENANT_DATA || {};
    const nextDue = t.membershipNextDueDate ? new Date(t.membershipNextDueDate) : null;
    const now = new Date();
    const el = document.getElementById('memCountdown');
    if(el && nextDue){
      const diff = nextDue - now;
      if(diff <= 0){ el.textContent = 'Vencido'; el.style.color='var(--danger)'; }
      else {
        const d = Math.floor(diff/(1000*60*60*24));
        const h = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
        const m = Math.floor((diff%(1000*60*60))/(1000*60));
        el.textContent = (d>0?d+'d ':'') + h+'h ' + m+'m restantes';
        el.style.color = diff < 24*60*60*1000 ? 'var(--danger)' : 'var(--green)';
      }
    }
  }, 500);
}

function updateMembershipNavBadge(){
  const badge = document.getElementById('membershipNavBadge');
  const t = TENANT_DATA || {};
  const status = t.membershipStatus || 'al_dia';
  const nextDue = t.membershipNextDueDate ? new Date(t.membershipNextDueDate) : null;
  const hoursLeft = nextDue ? hoursBetween(new Date(), nextDue) : Infinity;
  const show = status==='vencido' || status==='suspendido' || (hoursLeft <= 24 && hoursLeft > 0);
  badge.style.display = show ? 'flex' : 'none';
  badge.textContent = '!';
}

/* ---------- modal pagar membresía ---------- */

let memPayProofDataUrl = null;
function onMemPayProofChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  compressImageFile(file, 1200, 0.8).then(dataUrl => {
    memPayProofDataUrl = dataUrl;
    document.getElementById('memPayProofPreview').innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
    document.getElementById('memPayProofHint').textContent = 'Comprobante cargado ✓';
    document.getElementById('memPayProofHint').style.color = 'var(--green)';
    document.getElementById('memPayConfirmBtn').disabled = false;
    toast('Comprobante cargado', 'ok');
  }).catch(()=>{
    toast('No se pudo procesar la foto del comprobante', 'err');
    memPayProofDataUrl = null;
  });
  input.value = '';
}
function resetMemPayForm(){
  memPayProofDataUrl = null;
  document.getElementById('memPayProofPreview').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:36px;height:36px"><path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
  document.getElementById('memPayProofHint').textContent = 'Tocá el recuadro o el botón para subir el comprobante';
  document.getElementById('memPayProofHint').style.color = 'var(--muted)';
  document.getElementById('memPayRef').value = '';
  const a = document.getElementById('memAcceptTerms');
  if(a) a.checked = false;
  const sinpe = document.getElementById('memMethodSinpe');
  if(sinpe){ sinpe.checked = true; }
  _paypalRendered = false;
  const pc = document.getElementById('paypalContainer');
  if(pc) pc.innerHTML = '';
  if(typeof toggleMemPayMethod === 'function') toggleMemPayMethod();
}

async function openMembershipPaymentModal(){
  document.getElementById('memPaymentModal').classList.add('show'); // abrir inmediatamente
  await loadPlanConfig();
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const t = TENANT_DATA || {};
  const currentPlan = cfg.plans.find(p=>p.id===t.membershipPlan) || cfg.plans[0];
  if(!currentPlan){ toast('No se pudo determinar tu plan', 'err'); closeMemPaymentModal(); return; }

  document.getElementById('memPayPlan').value = currentPlan.name + ' — ' + fmt(currentPlan.price) + '/mes';
  /* Mostrar el método de pago local con su nombre editable (SINPE u otro) */
  var _pml = payMethodLabel();
  var _s1 = document.getElementById('memSinpeLabel'); if(_s1) _s1.textContent = _pml;
  var _s2 = document.getElementById('memSinpeLabel2'); if(_s2) _s2.textContent = _pml;
  var _btn = document.getElementById('memPayConfirmBtn'); if(_btn) _btn.textContent = 'Confirmar pago por ' + _pml;
  var periodSel = document.getElementById('memPayPeriod');
  periodSel.innerHTML = cfg.periods.filter(p=>p.active).map(p=>{
    const total = Math.round(currentPlan.price * p.months * (1 - p.discount/100));
    return '<option value="'+p.id+'" data-months="'+p.months+'" data-discount="'+p.discount+'" data-total="'+total+'">'+esc(p.label)+' — '+fmt(total)+ (p.discount>0?' (ahorrás '+p.discount+'%)':'') +'</option>';
  }).join('');
  updateMemPayTotal();
  /* SINPE exclusivo si hay número configurado */
  const sinpeBox = document.getElementById('memPaySinpeBox');
  if(sinpeBox){ document.getElementById('memPaySinpeNum').textContent = (cfg.platformSinpe || '').trim(); sinpeBox.style.display = (cfg.platformSinpe || '').trim() ? 'flex' : 'none'; }
  toggleMemPayMethod();
  /* Mostrar los términos y condiciones (texto del superadmin + PDF opcional) */
  renderMembershipTermsLink();
}
/* Cambia entre SINPE (Costa Rica) y PayPal (internacional) */
function toggleMemPayMethod(){
  const isPaypal = document.getElementById('memMethodPaypal') && document.getElementById('memMethodPaypal').checked;
  const sinpeWrap = document.getElementById('memSinpeWrap');
  const paypalWrap = document.getElementById('memPaypalWrap');
  const confirmBtn = document.getElementById('memPayConfirmBtn');
  if(sinpeWrap) sinpeWrap.style.display = isPaypal ? 'none' : 'block';
  if(paypalWrap) paypalWrap.style.display = isPaypal ? 'block' : 'none';
  if(confirmBtn) confirmBtn.style.display = isPaypal ? 'none' : 'block';
  if(isPaypal){
    renderPaypalButton();
    const cfg = planConfig || DEFAULT_PLAN_CONFIG;
    const cardBtn = document.getElementById('memCardBtn');
    if(cardBtn) cardBtn.style.display = (cfg.paymeUser && cfg.paymeUser.trim()) ? 'block' : 'none';
    /* Registrar el pago por PayPal en el historial (para aprobación del superadmin) */
    if(typeof registerPaypalPayment === 'function') registerPaypalPayment();
  }
}
/* Renderiza el botón de pago de membresía con PayPal de forma DINÁMICA:
   el servidor crea la orden por el MONTO EXACTO del plan + período (precio ×
   meses × descuento), convertido a la divisa de la plataforma. Así el cobro
   siempre coincide con el precio establecido. Si el SDK no está disponible,
   ofrece el enlace de PayPal.Me dinámico como respaldo. */
let _paypalRendered = '';
function renderPaypalButton(){
  const box = document.getElementById('paypalContainer');
  if(!box) return;
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const t = TENANT_DATA || {};
  const currentPlan = cfg.plans.find(p=>p.id===t.membershipPlan) || cfg.plans[0];
  const sel = document.getElementById('memPayPeriod');
  const periodId = sel && sel.value ? sel.value : 'monthly';
  const periodCfg = (cfg.periods || []).find(p=>p.id===periodId) || {months:1, discount:0};
  const localAmt = Math.round(currentPlan.price * (periodCfg.months || 1) * (1 - (periodCfg.discount || 0)/100));
  const cur = (cfg.paymeCurrency || 'USD');
  const key = currentPlan.id + ':' + periodId + ':' + localAmt + ':' + cur;
  if(_paypalRendered === key) return;
  _paypalRendered = key;
  box.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:14px">Preparando pago de ' + fmt(localAmt) + '…</div>';
  /* El precio de la plataforma está en colones (CRC). Para PayPal convertimos
     el monto a la divisa de cobro (USD por defecto) usando BCCR o la tasa forzada. */
  const localCurrency = 'CRC';
  const doButtonsWithAmount = function(amountFinal){
    const doButtons = function(){
      if(typeof paypal === 'undefined' || !paypal.Buttons){
        openMemPayaplMe(amountFinal, cur);
        return;
      }
      try{
        paypal.Buttons({
          style: { layout:'vertical', label:'paypal', shape:'rect', color:'blue' },
          createOrder: function(data, actions){
            const desc = 'Membresía ' + currentPlan.name + ' (' + (periodCfg.label || periodId) + ')';
            return cloudCallPublic('membershipPaypalCreateOrder', { amount: amountFinal, currency: cur, description: desc, slug: TENANT_ID, months: periodCfg.months || 1 }).then(function(res){
              if(!res || !res.orderId){ openMemPayaplMe(amountFinal, cur); return actions.reject(); }
              if(res.payeeApplied === false){ toast('⚠ El pago se hará a la cuenta de la plataforma. Verificá el email de PayPal configurado.', 'warn'); }
              return res.orderId;
            });
          },
          onApprove: function(data, actions){
            return cloudCallPublic('membershipPaypalCaptureOrder', { orderId: data.orderID, slug: TENANT_ID, months: periodCfg.months || 1 }).then(function(res){
              if(res && res.status){
                toast('✅ Pago de membresía aprobado por PayPal. ¡Gracias!', 'ok');
                try{ if(typeof registerPaypalPayment === 'function') registerPaypalPayment(); }catch(_e){}
              } else { toast('El pago quedó pendiente de verificación.', 'warn'); }
            });
          }
        }).render('#paypalContainer');
      }catch(e){ console.error(e); openMemPayaplMe(amountFinal, cur); }
    };
    if(planConfig && planConfig.paypalClientId){
      loadPayPalSdk(planConfig.paypalClientId).then(doButtons).catch(doButtons);
    } else {
      doButtons();
    }
  };
  convertCurrency(localAmt, localCurrency, cur).then(function(conv){
    doButtonsWithAmount(Number(conv).toFixed(2));
  }).catch(function(){
    doButtonsWithAmount(localAmt);
  });
}
/* Abre PayPal.Me de la plataforma con el monto dinámico de la membresía */
function openMemPayaplMe(amount, currency){
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const user = (cfg.paymeUser || '').trim().replace(/^https?:\/\/paypal\.me\//i,'').replace(/@/g,'');
  if(!user){ toast('La plataforma aún no configuró PayPal para membresías.', 'err'); return; }
  const amt = Number(amount||0).toFixed(2);
  const cur = currency || (cfg.paymeCurrency || 'USD');
  window.open('https://paypal.me/' + encodeURIComponent(user) + '?amount=' + amt + '&currency=' + encodeURIComponent(cur), '_blank', 'noopener');
  toast('Abriendo pago por ' + amt + ' ' + cur + '…', 'ok');
}
/* Registra el pago por PayPal en el historial del negocio para que el
   superadmin pueda verlo en su panel y aprobarlo. El pago de PayPal lo cobra
   directamente PayPal; acá solo registramos la intención/estado pendiente. */
async function registerPaypalPayment(){
  try{
    const sel = document.getElementById('memPayPeriod');
    const opt = sel && sel.options[sel.selectedIndex];
    const periodId = opt ? opt.value : 'monthly';
    const months = opt ? parseInt(opt.dataset.months)||1 : 1;
    const amount = opt ? parseInt(opt.dataset.total)||0 : 0;
    const cfg = planConfig || DEFAULT_PLAN_CONFIG;
    const t = TENANT_DATA || {};
    const currentPlan = cfg.plans.find(p=>p.id===t.membershipPlan) || cfg.plans[0];
    const periodCfg = (cfg.periods || []).find(p=>p.id===periodId) || {label:periodId};
    await tenantRef().collection('membershipPayments').add({
      date: new Date().toISOString(),
      amount, period: periodId, periodLabel: periodCfg.label, months: months,
      plan: currentPlan.id, planName: currentPlan.name,
      status: 'pendiente', method: 'PayPal',
      reference: 'Pago PayPal',
      proofImage: ''
    });
    await tenantRef().set({ planApprovalStatus: 'pendiente', estadoPago: 'pendiente' }, { merge:true });
    console.info('Pago PayPal registrado (pendiente de aprobación)');
  }catch(e){ console.warn('No se pudo registrar el pago PayPal:', e); }
}
/* Pago con tarjeta DINÁMICO: abre PayPal.Me con el monto exacto del
   plan + período elegido. Requiere que el superadmin haya puesto su usuario. */
function payWithCardDynamic(){
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const user = (cfg.paymeUser || '').trim().replace(/^https?:\/\/paypal\.me\//i,'').replace(/@/g,'');
  if(!user){ toast('La plataforma aún no configuró el pago con tarjeta dinámico.', 'err'); return; }
  const sel = document.getElementById('memPayPeriod');
  const opt = sel && sel.options[sel.selectedIndex];
  const amountCRC = opt ? (parseInt(opt.dataset.total)||0) : 0;
  const cur = (cfg.paymeCurrency || 'USD');
  convertCurrency(amountCRC, 'CRC', cur).then(function(conv){
    const amt = Number(conv).toFixed(2);
    const url = 'https://paypal.me/' + encodeURIComponent(user) + '?amount=' + amt + '&currency=' + encodeURIComponent(cur);
    window.open(url, '_blank', 'noopener');
    toast('Abriendo pago por ' + amt + ' ' + cur + '…', 'ok');
  }).catch(function(){
    toast('No se pudo convertir la divisa. Probá de nuevo.', 'err');
  });
}
function closeMemPaymentModal(){ document.getElementById('memPaymentModal').classList.remove('show'); resetMemPayForm(); }
/* Muestra el texto/enlace de los términos en el modal de pago */
function renderMembershipTermsLink(){
  const lnk = document.getElementById('memTermsLink');
  if(!lnk) return;
  const t = (planConfig && planConfig.terms) || DEFAULT_PLAN_CONFIG.terms || {};
  let html = '';
  if(t.text) html += ' — <a href="javascript:void(0)" onclick="openMemTermsPreview()" style="color:var(--blue);text-decoration:underline;cursor:pointer">Ver términos</a>';
  if(t.pdf) html += ' · <a href="' + esc(t.pdf) + '" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:underline">Documento PDF</a>';
  lnk.innerHTML = html;
}
/* Previsualización de los términos en un modal */
function openMemTermsPreview(){
  const t = (planConfig && planConfig.terms) || DEFAULT_PLAN_CONFIG.terms || {};
  getModal('memTermsPreview', t.text || '', 'Términos y condiciones', t.pdf || '');
}
function getModal(modalId, textHtml, title, pdfUrl){
  let m = document.getElementById(modalId);
  if(!m){
    m = document.createElement('div');
    m.id = modalId;
    m.className = 'modal';
    m.style.zIndex = '401';
    m.innerHTML = '<div class="modal-bg" onclick="closeModalEl(\'' + modalId + '\')"></div><div class="modal-card" style="max-width:620px"><div class="modal-head"><h3>' + esc(title) + '</h3><button class="close-x" onclick="closeModalEl(\'' + modalId + '\')">&times;</button></div><div class="modal-body"><div class="pt-body" style="font-size:13px;line-height:1.6;color:var(--ink);white-space:pre-wrap">' + esc(textHtml || '') + '</div>' + (pdfUrl ? '<p style="margin-top:12px"><a class="btn-ghost" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px" href="' + esc(pdfUrl) + '" target="_blank" rel="noopener">📄 Ver documento PDF</a></p>' : '') + '</div></div>';
    document.body.appendChild(m);
  }
  m.classList.add('show');
}
function closeModalEl(id){ const m = document.getElementById(id); if(m) m.classList.remove('show'); }
function updateMemPayTotal(){
  const sel = document.getElementById('memPayPeriod');
  const opt = sel.options[sel.selectedIndex];
  if(!opt){ return; }
  const base = parseInt(opt.dataset.total) || 0;
  const discount = parseInt(opt.dataset.discount) || 0;
  const months = parseInt(opt.dataset.months) || 1;
  // Recalcular base sin descuento para mostrar
  const t = TENANT_DATA || {};
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const currentPlan = cfg.plans.find(p=>p.id===t.membershipPlan) || cfg.plans[0];
  const rawTotal = currentPlan ? currentPlan.price * months : 0;
  document.getElementById('memPayBase').textContent = fmt(rawTotal);
  const discRow = document.getElementById('memPayDiscountRow');
  if(discount > 0){
    discRow.style.display = 'flex';
    document.getElementById('memPayDiscount').textContent = '−' + fmt(rawTotal - base);
  }else{
    discRow.style.display = 'none';
  }
  document.getElementById('memPayTotal').textContent = fmt(base);
  /* Si el admin pagará por PayPal, re-renderizar el botón del período elegido */
  const isPaypal = document.getElementById('memMethodPaypal') && document.getElementById('memMethodPaypal').checked;
  if(isPaypal && typeof renderPaypalButton === 'function') renderPaypalButton();
}

async function processMembershipPayment(){
  const sel = document.getElementById('memPayPeriod');
  const opt = sel.options[sel.selectedIndex];
  if(!opt){ toast('Seleccioná un período de pago', 'err'); return; }
  const periodId = opt.value;
  const months = parseInt(opt.dataset.months) || 1;
  const amount = parseInt(opt.dataset.total) || 0;
  const reference = document.getElementById('memPayRef').value.trim();
  /* Si eligió PayPal, debe usar el botón de PayPal (no el flujo SINPE) */
  const isPaypal = document.getElementById('memMethodPaypal') && document.getElementById('memMethodPaypal').checked;
  if(isPaypal){ toast('Paga con el botón de PayPal que aparece arriba.', 'err'); return; }

  /* Exigir aceptar los términos y condiciones antes de confirmar */
  const acceptEl = document.getElementById('memAcceptTerms');
  if(acceptEl && !acceptEl.checked){
    toast('Debés aceptar los términos y condiciones para continuar', 'err');
    acceptEl.focus && acceptEl.focus();
    return;
  }

  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const t = TENANT_DATA || {};
  const currentPlan = cfg.plans.find(p=>p.id===t.membershipPlan) || cfg.plans[0];
  const periodCfg = cfg.periods.find(p=>p.id===periodId) || {label:periodId};

  const now = new Date();
  const nextDue = addMonths(now, months);

  if(!memPayProofDataUrl){
    toast('Subí una foto del comprobante de pago para continuar', 'err');
    return;
  }
  const payment = {
    date: now.toISOString(),
    amount, period: periodId, periodLabel: periodCfg.label,
    plan: currentPlan.id, planName: currentPlan.name,
    status: 'completado',
    method: 'SINPE Móvil',
    reference: reference || 'Pago manual',
    proofImage: memPayProofDataUrl
  };

  // Incluir cantidad de meses en el registro del pago (necesario para aprobación)
  payment.months = months;

  try{
    await tenantRef().collection('membershipPayments').add(payment);
    // IMPORTANTE: el pago no activa el plan automáticamente.
    // Se marca como "pendiente de aprobación" y el superadmin lo aprueba manualmente.
    // Mientras tanto, el plan activo (planApprovedId) no cambia.
    const currentApproved = TENANT_DATA.planApprovedId || TENANT_DATA.membershipPlan || 'emprendedor';
    const isPlanChange = currentPlan.id !== currentApproved;

    await tenantRef().set({
      membershipPlan: currentPlan.id,     // plan SOLICITADO (puede diferir del aprobado)
      planApprovalStatus: 'pendiente',    // superadmin debe aprobar
      membershipLastPaymentDate: now.toISOString(),
      membershipReminderSent: false,
      montoMensual: currentPlan.price,
      estadoPago: 'pendiente'            // pendiente de verificación
    }, {merge:true});

    TENANT_DATA.membershipPlan = currentPlan.id;
    TENANT_DATA.planApprovalStatus = 'pendiente';
    TENANT_DATA.membershipLastPaymentDate = now.toISOString();
    TENANT_DATA.montoMensual = currentPlan.price;
    TENANT_DATA.estadoPago = 'pendiente';

    closeMemPaymentModal();
    renderMembershipUI();
    updatePlanLockBanner();
    toast('¡Pago enviado! Estamos verificando tu comprobante. Tu plan se activará en breve.', 'ok');
  }catch(e){
    toast('No se pudo registrar el pago: ' + (e.message||'error'), 'err');
    console.error(e);
  }
}

/* ---------- modal cambiar plan (ficha moderna de los 3 planes) ---------- */
async function openChangePlanModal(){
  await loadPlanConfig();
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const t = TENANT_DATA || {};
  const currentId = t.planApprovedId || t.membershipPlan || 'emprendedor';
  const body = document.getElementById('memChangePlanBody');
  /* Cabecera con selector de período y divisa */
  body.innerHTML = '<div style="margin-bottom:16px">' +
    '<div style="font-size:15px;font-weight:800;margin-bottom:4px">Elegí el plan ideal para tu negocio</div>' +
    '<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Compará los accesos de cada membresía. Todos los planes incluyen catálogo, inventario, perfil, SINPE, WhatsApp y el Asistente IA.</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<span style="font-size:12px;font-weight:700;color:var(--muted)">Período:</span>' +
      '<div class="mem-period-toggle" id="memPlanPeriodToggle">' +
        cfg.periods.filter(p=>p.active).map(p=>'<button type="button" class="seg-btn'+(p.id==='monthly'?' active':'')+'" data-period="'+p.id+'" data-months="'+p.months+'" data-discount="'+p.discount+'">'+esc(p.label)+'</button>').join('') +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="plan-compare-grid" id="planCompareGrid">' +
    cfg.plans.filter(p=>p.active).map(function(p){
      const d = PLAN_PLUS[p.id] || {};
      const isCurrent = p.id === currentId;
      const isTop = p.id === 'destacado';
      return '<div class="plan-compare-card'+(isCurrent?' current':'')+(isTop?' top':'')+'" data-plan="'+p.id+'" style="'+(isTop?'--pc-accent:#7C3AED':p.id==='profesional'?'--pc-accent:#D9770D':'--pc-accent:#1B7A43')+'">' +
        (isTop?'<span class="pc-flag">✦ Más popular</span>':'') +
        '<div class="pc-head">' +
          '<div class="pc-icon">'+(d.tag||'📦')+'</div>' +
          '<div class="pc-name">'+esc(p.name)+'</div>' +
          '<div class="pc-sub">'+esc(d.sub||'')+'</div>' +
          '<div class="pc-price"><span class="pc-price-num" data-base="'+p.price+'">'+fmt(p.price)+'</span><span class="pc-price-per">/mes</span></div>' +
          '<div class="pc-limit">'+esc(d.limit||'')+'</div>' +
        '</div>' +
        '<div class="pc-features">' +
          ((p.features && p.features.length) ? p.features.map(function(f){ return '<div class="pc-feature"><span class="pc-check">✓</span><span>'+esc(f)+'</span></div>'; }).join('') : (d.features||[]).map(function(f){
            const inc = (typeof f === 'object' && f.inc) ? f.inc : [p.id];
            const incMe = inc.indexOf(p.id) !== -1;
            return '<div class="pc-feature'+(incMe?'':' off')+'"><span class="pc-check">'+(incMe?'✓':'×')+'</span><span>'+esc(typeof f === 'object' ? f.t : f)+'</span></div>';
          }).join('')) +
        '</div>' +
        '<div class="pc-btn-wrap">' +
          '<div class="pc-total">Total: <b data-total>'+fmt(p.price)+'</b></div>' +
          '<button class="'+(isCurrent?'btn-ghost':'btn-primary')+'" style="width:100%"'+(isCurrent?' disabled':' onclick="changeMembershipPlan(\''+p.id+'\')"')+'>'+(isCurrent?'✓ Plan actual':'Elegir este plan')+'</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
  /* Interacción: toggle de período recalcula precios */
  bindPlanPeriodToggle();
  document.getElementById('memChangePlanModal').classList.add('show');
}
function closeChangePlanModal(){ document.getElementById('memChangePlanModal').classList.remove('show'); }

/* ================= SUSCRIPCIÓN DE NEGOCIO DESDE EL LANDING ================= */
let _subSelectedPlan = null;
/* Abre la ventana de planes desde el landing */
async function openSuscribeLanding(){
  await loadPlanConfig();
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const grid = document.getElementById('subPlanGrid');
  grid.innerHTML = cfg.plans.filter(p=>p.active).map(function(p){
    const d = PLAN_PLUS[p.id] || {};
    const isTop = p.id === 'destacado';
    const accent = isTop?'#7C3AED':p.id==='profesional'?'#D9770D':'#1B7A43';
    return '<div class="plan-compare-card'+(isTop?' top':'')+'" data-plan="'+p.id+'" style="--pc-accent:'+accent+'">' +
      (isTop?'<span class="pc-flag">✦ Más popular</span>':'') +
      '<div class="pc-head">' +
        '<div class="pc-icon">'+(d.tag||'📦')+'</div>' +
        '<div class="pc-name">'+esc(p.name)+'</div>' +
        '<div class="pc-sub">'+esc(d.sub||'')+'</div>' +
        '<div class="pc-price"><span>'+fmt(p.price)+'</span><span class="pc-price-per">/mes</span></div>' +
        '<div class="pc-limit">'+esc(d.limit||'')+'</div>' +
      '</div>' +
      '<div class="pc-features">' +
        ((p.features && p.features.length) ? p.features.map(function(f){ return '<div class="pc-feature"><span class="pc-check">✓</span><span>'+esc(f)+'</span></div>'; }).join('') : (d.features||[]).map(function(f){
          const inc = (typeof f==='object'&&f.inc)?f.inc:[p.id];
          const incMe = inc.indexOf(p.id)!==-1;
          return '<div class="pc-feature'+(incMe?'':' off')+'"><span class="pc-check">'+(incMe?'✓':'×')+'</span><span>'+esc(typeof f==='object'?f.t:f)+'</span></div>';
        }).join('')) +
      '</div>' +
      '<div class="pc-btn-wrap"><button class="btn-primary" style="width:100%" onclick="selectSubPlan(\''+p.id+'\')">Elegir este plan</button></div>' +
    '</div>';
  }).join('');
  document.getElementById('subPlanModal').classList.add('show');
}
/* Elige un plan y pasa al formulario de registro */
function selectSubPlan(planId){
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const p = cfg.plans.find(x=>x.id===planId) || cfg.plans[0];
  _subSelectedPlan = planId;
  document.getElementById('subPlanName').textContent = p.name + ' · ' + fmt(p.price) + '/mes';
  document.getElementById('subFecha').textContent = new Date().toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'});
  document.getElementById('subFormPlan').innerHTML =
    '<div class="sub-selected-plan" style="--pc-accent:'+(planId==='destacado'?'#7C3AED':planId==='profesional'?'#D9770D':'#1B7A43')+'">' +
      '<div class="pc-icon">'+(PLAN_PLUS[planId]?.tag||'📦')+'</div>' +
      '<div><b>'+esc(p.name)+'</b><span>'+esc(PLAN_PLUS[planId]?.sub||'')+'</span></div>' +
      '<div class="pc-price-num">'+fmt(p.price)+'<span class="pc-price-per">/mes</span></div>' +
    '</div>';
  closeModalEl('subPlanModal');
  document.getElementById('subFormModal').classList.add('show');
  requestAnimationFrame(function(){
    document.getElementById('subSlug').focus();
    updateSubUrlPreview();
  });
}
/* Actualiza la vista previa de la URL según el slug */
function updateSubUrlPreview(){
  const s = slugify(document.getElementById('subSlug').value || '');
  const el = document.getElementById('subUrlPreview');
  if(el) el.textContent = s ? (location.origin + location.pathname + '?tienda=' + s) : '–';
}
function closeSubLanding(){
  closeModalEl('subPlanModal');
  closeModalEl('subFormModal');
  _subSelectedPlan = null;
}
/* Envía la solicitud de suscripción: crea el tenant en estado PENDIENTE de
   aprobación (con plan elegido y 1 mes de prueba) y avisa al superadmin. */
async function submitNewBusiness(){
  const slug = slugify(document.getElementById('subSlug').value);
  const nombre = document.getElementById('subNombre').value.trim();
  const tipo = document.getElementById('subTipo').value;
  const adminEmail = document.getElementById('subAdminEmail').value.trim();
  if(!slug){ toast('Ingresá un ID/URL válido para tu negocio', 'err'); return; }
  if(!nombre){ toast('Ingresá el nombre del negocio', 'err'); return; }
  if(!adminEmail || !/[^@\s]+@[^@\s]+\.[^@\s]+/.test(adminEmail)){ toast('Ingresá un correo válido del administrador', 'err'); return; }
  try{
    const ref = db.collection('tenants').doc(slug);
    const existing = await ref.get();
    if(existing.exists){ toast('Ese ID ya está en uso. Elegí otro.', 'err'); return; }
    const planId = _subSelectedPlan || 'emprendedor';
    await ref.set({
      nombre, tipo,
      activo: false, // PENDIENTE de aprobación del superadmin
      adminEmails: adminEmail ? [adminEmail] : [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      membershipPlan: planId,
      planApprovedId: planId,
      planApprovalStatus: 'pendiente',
      membershipStatus: 'pendiente',
      membershipNextDueDate: addMonths(new Date(),1).toISOString(),
      plan: planId === 'destacado' ? 'destacado' : (planId === 'profesional' ? 'premium' : 'basico'),
      planRank: planId === 'destacado' ? 3 : (planId === 'profesional' ? 2 : 1),
      subSource: 'landing',
      subCreatedAt: new Date().toISOString(),
      subTrialMonths: 1
    });
    /* Registrar notificación para el superadmin (cumpleaños en el panel + WhatsApp) */
    await db.collection('platform').doc('notifications').set({
      _pending: firebase.firestore.FieldValue.arrayUnion({
        id: 'sub:' + slug, type:'new_business', slug: slug, nombre: nombre, plan: planId,
        adminEmail: adminEmail, fecha: new Date().toISOString(), leido: false
      })
    }, { merge:true });
    /* No se puede avisar por WhatsApp desde el navegador (falta el secreto);
       se hace desde Cloud Function (notifySuperadmin). Por eso registramos el
       evento y el frontend, si hay funciones, pide el aviso. */
    try{ if(typeof cloudCall === 'function') cloudCall('notifySuperadminNewBusiness', { slug: slug }).catch(function(){}); }catch(_e){}
    closeSubLanding();
    toast('¡Solicitud enviada! Aprobaremos tu negocio en breve. Te llegará el correo de acceso.', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo enviar: ' + ((e && e.message) || 'error'), 'err');
  }
}

/* Toggle interactivo de período (mensual / trimestral / anual) */
let _memPlanPeriod = 'monthly';
function bindPlanPeriodToggle(){
  const toggle = document.getElementById('memPlanPeriodToggle');
  if(!toggle) return;
  toggle.querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click', function(){
      toggle.querySelectorAll('.seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _memPlanPeriod = btn.dataset.period;
      const months = parseInt(btn.dataset.months)||1;
      const discount = parseInt(btn.dataset.discount)||0;
      document.querySelectorAll('.plan-compare-card').forEach(card=>{
        const base = parseFloat(card.querySelector('.pc-price-num').getAttribute('data-base'))||0;
        const total = Math.round(base * months * (1 - discount/100));
        card.querySelector('.pc-price-num').textContent = fmt(base);
        const totEl = card.querySelector('[data-total]');
        if(totEl) totEl.textContent = fmt(total) + (discount>0 ? ' · ahorrás '+discount+'%' : '');
      });
    });
  });
}

async function changeMembershipPlan(planId){
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  const plan = cfg.plans.find(p=>p.id===planId);
  if(!plan){ toast('Plan no encontrado', 'err'); return; }
  const currentApproved = TENANT_DATA.planApprovedId || TENANT_DATA.membershipPlan || 'emprendedor';
  // Si se selecciona un plan más alto al actual aprobado, se queda pendiente
  // Si se baja de plan (downgrade), se aplica inmediatamente
  const isUpgrade = (PLAN_RANK[planId]||1) > (PLAN_RANK[currentApproved]||1);
  try{
    if(isUpgrade){
      // Marcar como solicitud pendiente — no se activa hasta que el superadmin apruebe
      await tenantRef().set({
        membershipPlan: planId,
        montoMensual: plan.price,
        planApprovalStatus: 'pendiente'
      }, {merge:true});
      TENANT_DATA.membershipPlan = planId;
      TENANT_DATA.montoMensual = plan.price;
      TENANT_DATA.planApprovalStatus = 'pendiente';
      closeChangePlanModal();
      renderMembershipUI();
      toast('Solicitaste el plan ' + plan.name + '. Pagá el servicio para que el superadmin lo active.', 'ok');
    } else {
      // Downgrade o mismo plan: se aplica inmediatamente
      const planValue = planId === 'destacado' ? 'destacado' : (planId === 'profesional' ? 'premium' : 'basico');
      await tenantRef().set({
        membershipPlan: planId,
        planApprovedId: planId,
        planApprovalStatus: 'aprobado',
        montoMensual: plan.price,
        plan: planValue,
        planRank: PLAN_RANK[planId]||1
      }, {merge:true});
      TENANT_DATA.membershipPlan = planId;
      TENANT_DATA.planApprovedId = planId;
      TENANT_DATA.planApprovalStatus = 'aprobado';
      TENANT_DATA.montoMensual = plan.price;
      TENANT_DATA.plan = planValue;
      TENANT_DATA.planRank = PLAN_RANK[planId]||1;
      closeChangePlanModal();
      renderMembershipUI();
      updatePlanLockBanner();
      toast('Plan cambiado a ' + plan.name, 'ok');
    }
  }catch(e){
    toast('No se pudo cambiar el plan: ' + (e.message||'error'), 'err');
  }
}

/* ---------- verificación automática de vencimiento ---------- */
async function checkMembershipExpiry(){
  const t = TENANT_DATA || {};
  if(!t.membershipNextDueDate) return;
  const nextDue = new Date(t.membershipNextDueDate);
  const now = new Date();
  const hoursLeft = hoursBetween(now, nextDue);
  let newStatus = t.membershipStatus || 'al_dia';
  let updates = {};

  if(nextDue <= now && newStatus === 'al_dia'){
    newStatus = 'vencido';
    updates.membershipStatus = 'vencido';
    updates.estadoPago = 'vencido';
    // REGRESAR AL PLAN BÁSICO automáticamente cuando vence
    const currentApproved = t.planApprovedId || t.membershipPlan || 'emprendedor';
    if(currentApproved !== 'emprendedor'){
      updates.planApprovedId = 'emprendedor';
      updates.plan = 'basico';
      updates.planRank = 1;
      // No tocamos membershipPlan — se preserva como "último plan pagado"
    }
  }
  if(nextDue <= now && (newStatus === 'vencido' || newStatus === 'pendiente')){
    // Suspensión automática después de 7 días de vencido
    const daysPast = daysBetween(nextDue, now);
    if(daysPast >= 7 && newStatus !== 'suspendido' && t.membershipAutoSuspend !== false){
      newStatus = 'suspendido';
      updates.membershipStatus = 'suspendido';
      updates.estadoPago = 'vencido';
      updates.activo = false; // desactivar tienda en plataforma
    }
  }
  // Recordatorio 24h antes
  if(hoursLeft <= 24 && hoursLeft > 0 && !t.membershipReminderSent){
    updates.membershipReminderSent = true;
    // Aquí se podría enviar notificación push/email
  }

  if(Object.keys(updates).length){
    try{
      await tenantRef().set(updates, {merge:true});
      Object.assign(TENANT_DATA, updates);
      if(document.body.classList.contains('in-admin')){
        renderMembershipUI();
        updatePlanLockBanner();
      }
    }catch(e){ console.error(e); }
  }
}

/* ---------- integrar en bootPlatform ---------- */
