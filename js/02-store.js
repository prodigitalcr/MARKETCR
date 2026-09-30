/* =====================================================
   CANAAN STORE — tienda web con pago SINPE + WhatsApp
   Datos persistentes en Firebase Firestore (proyecto canaan-24688)
===================================================== */

const DEFAULT_SETTINGS = {
  storeName:'Mi Tienda',
  tagline:'Vivero, jardinería y servicios',
  hours:'Lun - Sáb · 6:00 a.m. - 5:00 p.m.',
  shipping:'Hacemos envíos por Uber Flash · San José, CR',

  sinpe:'8888-8888',
  currency:'CRC', // CRC (colones ₡) | USD (dólares $) | EUR (euros €) — se usa en todo
  payMethodLabel:'SINPE', // nombre del método de pago local (editable; en otros países puede ser otro)
  paypalMe:'', // usuario de PayPal.me del negocio (pago del carrito por tarjeta por el cliente)
  paypalEmail:'rubynica@outlook.es', // email de PayPal del negocio (para que el checkout dirija el pago a su cuenta)
  paypalCurrency:'USD', // divisa en la que cobra el cliente por PayPal.me
  whatsapp:'50688888888',
  categories:['Plantas','Productos','Servicios'],
  websiteUrl:'',
  websiteLabel:'Sitio web',
  websiteIcon:'',
  bingoUrl:'',
  bingoLabel:'Bingo de Plantas',
  bingoIcon:'',
  storyVideoUrl:'',
  storyVideoUrl2:'',
  storyVideoUrl3:'',
  storyVideoUrl4:'',
  otherBusinesses:[],
  logoUrl:'',
  landingImages:[],
  iva:13, globalDiscountPercent:0,
  tipo:'', // '' = tienda normal con carrito. 'profesional' = perfil de servicios, sin carrito, contacto directo por WhatsApp
  categoria:'', // categoría principal mostrada en el landing de profesionales
  servicios:[], // lista corta de servicios mostrada en el landing (independiente de "categories")
  aiEnabled:false,
  /* NOTA DE SEGURIDAD: las claves de API (aiApiKey / aiOpenrouterKey /
     aiExternalKey) ya NO se guardan acá (documento público). Viven en la
     subcolección PRIVADA tenants/{slug}/privateSettings/ai, que solo leen
     el administrador y el backend. Este flag es lo único que necesita la
     tienda pública para saber si el asistente está configurado. */
  aiConfigured:false,
  aiGeminiModel:'gemini-2.0-flash',
  aiAssistantName:'Cana',
  aiWelcomeMsg:'¡Hola! ¿Buscás algo en especial o querés que te recomiende algo?',
  aiProvider:'gemini',        // 'gemini' | 'openrouter' | 'external'
  aiModel:'',                 // id del modelo elegido en OpenRouter, ej: 'meta-llama/llama-3.3-70b-instruct:free'
  aiImageModel:'google/gemini-3.1-flash-lite-image', // default: el modelo de imagen de pago mínimo (no hay :free con salida de imagen)
  aiSystemPrompt:'',          // instrucciones/"entrenamiento" propio del negocio para el modelo elegido
  aiExternalProvider:'openai', // 'openai' | 'claude' | 'groq' | 'kimi' | 'custom'
  aiExternalModel:'',         // modelo del proveedor externo (ej: gpt-4o-mini, claude-sonnet-4-6, etc.)
  aiExternalBaseUrl:'',       // URL base custom (solo para 'custom')
  facturaEmisor:'',           // = settings para emitir factura en el POS:
  facturaCedula:'',           //   cédula jurídica/física del comercio (irá en la factura emitida)
  facturaRazon:'',            //   razón social (si difiere del nombre comercial)
  facturaTelefono:'',         //   teléfono del comercio en la factura
  facturaCorreo:'',           //   correo de Hacienda / del comercio
  facturaProvincia:'',        //   provincia del domicilio fiscal
  facturaCanton:'',           //   cantón del domicilio fiscal
  facturaDistrito:'',         //   distrito del domicilio fiscal
  facturaCondicion:'01',      //   condición de venta: 01 contado, 02 crédito
  facturaDocumento:'01',      //   tipo de documento: 01 factura (tradicional), 04 tiquete
  facturaDigital:false,       //   si true, al cobrar se genera factura electrónica (XML)
  facturaConsecutivo:1000     //   último consecutivo utilizado (se autoincrementa por venta)
};

const GRADS = [
  ['#D9F2E2','#B7E4C7'],['#FDF3D8','#F9E7A8'],['#E0F0E9','#C3E2D2'],['#EAF6E6','#D4EBC9'],
  ['#FFF1DC','#FFE3B3'],['#E4F4F1','#C4E8E1'],['#F2E8DC','#E4D2B8'],['#E8F0DC','#D2E2B8']
];

/* ---------- capa de datos (Firestore) ---------- */
let settings = Object.assign({}, DEFAULT_SETTINGS);
let isProfessionalStore = false; // true cuando settings.tipo === 'profesional': catálogo sin carrito, solo contacto por WhatsApp
let products = [];
let orders = [];
let cart = {}; // {productId: qty}
let isAdminSession = false;
let unsubOrders = null;
let unsubSettings = null;
let unsubProducts = null;

/* ---------- multi-tenant: qué negocio se está mostrando ---------- */
/* La plataforma es UN solo archivo/código para todos los negocios.
   Cada negocio vive en su propio documento tenants/{slug} dentro del
   MISMO proyecto Firebase, y sus datos (settings, products, orders)
   están separados en subcolecciones: tenants/{slug}/settings,
   tenants/{slug}/products, tenants/{slug}/orders. Así cada tienda
   tiene su propia "base de datos" lógica sin mezclarse con las demás,
   y su propia URL vía "?tienda=slug". */
function getTenantSlugFromURL(){
  return (new URLSearchParams(location.search).get('tienda') || '').trim().toLowerCase();
}
let TENANT_ID = getTenantSlugFromURL();
let TENANT_DATA = null;
function tenantRef(){ return db.collection('tenants').doc(TENANT_ID); }
function tenantCol(name){ return tenantRef().collection(name); }

let settingsRef, privateSettingsRef, productsCol, ordersCol, posSalesCol, financeCol, siteDoc;
function bindTenantRefs(){
  settingsRef = tenantCol('settings').doc('store');        // tenants/{slug}/settings/store
  privateSettingsRef = tenantCol('privateSettings').doc('ai');
  productsCol = tenantCol('products');                     // tenants/{slug}/products
  ordersCol = tenantCol('orders');
  posSalesCol = tenantCol('posSales');
  financeCol = tenantCol('finance');
  siteDoc = tenantCol('sites').doc('corporate');           // tenants/{slug}/sites/corporate
}

/* claves de localStorage separadas por negocio, para que "me gusta" y
   "productos ya comprados" de una tienda no se mezclen con otra tienda
   abierta en el mismo navegador */
function tenantLS(key){ return key + '_' + (TENANT_ID || 'default'); }

/* Evita que la grilla de productos "salte" mientras el cliente está tocando:
   el banner publicitario (settings) y los productos llegan de Firestore por
   separado y en momentos distintos. Si el banner aparece DESPUÉS de que la
   grilla ya se pintó, empuja todos los productos hacia abajo justo cuando
   alguien está por tocar uno, haciendo que el dedo "pierda" el producto.
   Por eso esperamos a tener settings + products al menos una vez antes de
   pintar la grilla por primera vez; las actualizaciones posteriores en vivo
   sí se reflejan normalmente. */
/* ---------- clave de tienda (segundo factor para el panel admin) ----------
   Cada tienda puede tener, además del correo/contraseña de Firebase Auth,
   una clave propia que el administrador define desde Configuraciones →
   Seguridad. Se guarda como hash (no en texto plano) en el documento
   tenants/{slug}, campo adminPasswordHash. El cliente NUNCA ve esta clave:
   solo se pide después de iniciar sesión con un correo autorizado. */
async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function hashStorePassword(plain){
  // se mezcla con el slug de la tienda para que el mismo texto no genere
  // el mismo hash en dos tiendas distintas
  return sha256Hex('storepass:' + TENANT_ID + ':' + plain);
}
function slugify(text){
  return (text||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

let settingsReady = false, productsReady = false, storeFirstPaintDone = false;
let settingsFormDirty = false; // true mientras hay cambios sin guardar en el formulario de Configuración
function markSettingsFormDirty(){ settingsFormDirty = true; }
function tryStoreFirstPaint(){
  if(storeFirstPaintDone || !settingsReady || !productsReady) return;
  storeFirstPaintDone = true;
  renderGrid();
}

function listenSettings(){
  if(unsubSettings) unsubSettings();
  unsubSettings = settingsRef.onSnapshot(snap=>{
    settings = Object.assign({}, DEFAULT_SETTINGS, snap.exists ? snap.data() : {});
    /* Actualizar la divisa global usada por fmt() en todo el sistema */
    _CURRENCY = ['CRC','USD','EUR'].includes(settings.currency) ? settings.currency : 'CRC';
    isProfessionalStore = settings.tipo === 'profesional';
    document.body.classList.toggle('professional-mode', isProfessionalStore);
    settingsReady = true;
    renderHeader(); renderChips(); renderExternalLinks(); renderStoryVideo(); renderAIAssistant();
    if(document.body.classList.contains('in-admin') && !settingsFormDirty) loadSettingsForm();
    else if(document.body.classList.contains('in-admin')) showPermDebugHint();
    tryStoreFirstPaint();
  });
}

function listenProducts(){
  if(unsubProducts) unsubProducts();
  unsubProducts = productsCol.onSnapshot(snap=>{
    products = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
    productsReady = true;
    if(storeFirstPaintDone) renderGrid();
    else tryStoreFirstPaint();
    if(document.body.classList.contains('in-admin')){
      renderInventory();
      if(document.getElementById('panel-pos').classList.contains('active')) renderPOSCatalog();
    }
    maybeOpenProductDeepLink();
  }, err=>{ console.error(err); });
}

/* Deep link directo a un producto (?p=ID), usado por los QR que se comparten.
   Espera a que el catálogo esté listo y abre la ficha del producto. */
let _deepLinkPid = '';
let _deepLinkVi = '';
function scheduleProductDeepLink(pid, vi){ _deepLinkPid = pid; _deepLinkVi = vi || ''; }
function maybeOpenProductDeepLink(){
  if(!_deepLinkPid) return;
  const pid = _deepLinkPid; const vi = _deepLinkVi;
  const p = products.find(x=>x.id===pid && x.active !== false);
  /* Si el catálogo aún no trajo ese producto (primer snapshot vacío), NO se
     descarta el pendiente: se reintenta en el próximo snapshot del catálogo. */
  if(!p) return;
  _deepLinkPid = ''; _deepLinkVi = '';
  openProductView(p.id, vi);
}

/* los pedidos completos (listado) solo los puede leer el admin, según las
   reglas de seguridad de Firestore. El cliente consulta UN pedido puntual
   por su número de factura desde "Rastrear pedido". */
let ordersFirstLoad = true;
let knownOrderNumbers = new Set();
function listenOrdersIfAdmin(){
  if(unsubOrders) unsubOrders();
  ordersFirstLoad = true;
  knownOrderNumbers = new Set();
  unsubOrders = ordersCol.orderBy('createdAtMs','desc').onSnapshot(snap=>{
    orders = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
    if(!ordersFirstLoad){
      const nuevos = orders.filter(o => !knownOrderNumbers.has(o.number));
      nuevos.forEach(o => toast('🛎️ Nuevo pedido ' + o.number + ' — ' + fmt(o.total), 'ok'));
    }
    knownOrderNumbers = new Set(orders.map(o=>o.number));
    ordersFirstLoad = false;
    renderOrders(); renderStats(); updateOrdersNavBadge();
  }, err=>{ console.error(err); });
}
function updateOrdersNavBadge(){
  const badge = document.getElementById('ordersNavBadge');
  const n = orders.filter(o=>o.status==='recibido').length;
  badge.style.display = n ? 'flex' : 'none';
  badge.textContent = n;
}

async function saveSettingsToDB(data){ await settingsRef.set(data, {merge:true}); }
/* Se dispara al cambiar la divisa en Configuraciones: convierte los precios */
async function onCurrencyChange(el){
  var newCur = el.value;
  var oldCur = (settings && settings.currency) || 'CRC';
  if(newCur === oldCur) return;
  /* Si el admin es posible, convertir precios; si no, avisar que necesita cargar catálogo */
  if(typeof convertStorePrices === 'function'){
    try{
      var res = await convertStorePrices(oldCur, newCur);
      if(res && res.done){
        /* Refrescar la divisa global y el formulario */
        _CURRENCY = newCur;
        settings.currency = newCur;
        renderGrid && renderGrid();
        updateCartUI && updateCartUI();
      }
    }catch(e){ console.error(e); }
  }
}
/* ---------- CONVERSIÓN DE DIVISA DE PRECIOS ----------
   Cuando el admin cambia la divisa del negocio, convierte TODOS los precios
   (productos, variantes, costos, precios comparativos y ofertas) de la divisa
   anterior a la nueva, y guarda los cambios en Firestore. El total del carrito
   también se recalcula en vivo con fmt() usando la nueva divisa. */
async function convertStorePrices(fromCur, toCur){
  if(fromCur === toCur) return { done:0 };
  try{
    var rate = await getFxRate(fromCur, toCur);
    if(!rate){ toast('No se pudo obtener la tasa de ' + fromCur + '→' + toCur + '. Convertí a mano o probá más tarde.', 'err'); return null; }
    if(!confirm('Se convertirán TODOS los precios de "' + fromCur + '" a "' + toCur + '" (x' + rate.toFixed(5) + ').\n\n¿Continuar?')) return null;
    toast('Convirtiendo precios…', 'ok');
    var done = 0;
    /* Recorrer el catálogo local (products ya cargado) y actualizar cada doc */
    var batch = db.batch();
    var ops = 0;
    for(var i = 0; i < products.length; i++){
      var p = products[i];
      var patch = {};
      var changed = false;
      if(p.price != null){ patch.price = Math.round(p.price * rate); changed = true; }
      if(p.compareAtPrice != null){ patch.compareAtPrice = Math.round(p.compareAtPrice * rate); changed = true; }
      if(p.cost != null){ patch.cost = Math.round(p.cost * rate); changed = true; }
      if(p.hasVariants && Array.isArray(p.variants)){
        patch.variants = p.variants.map(function(v){
          var nv = Object.assign({}, v);
          if(v.price != null){ nv.price = Math.round(v.price * rate); }
          return nv;
        });
        changed = true;
      }
      if(changed){
        var ref = productsCol.doc(p.id);
        batch.set(ref, patch, { merge:true });
        ops++;
        if(ops >= 400){ await batch.commit(); batch = db.batch(); ops = 0; }
        done++;
      }
    }
    await batch.commit();
    /* Recargar catálogo y re-renderizar */
    productsReady = false;
    toast('Se convirtieron ' + done + ' productos a ' + toCur + ' ✓', 'ok');
    return { done: done, rate: rate };
  }catch(e){
    console.error('convertStorePrices:', e);
    toast('No se pudieron convertir los precios: ' + ((e && e.message)||'error'), 'err');
    return null;
  }
}
/* Tasa de cambio entre dos divisas (API gratuita, con caché y respaldo) */
async function getFxRate(from, to){
  if(from === to) return 1;
  try{
    var r = await fetch('https://api.frankfurter.app/latest?from=' + from + '&to=' + to);
    var j = await r.json();
    if(j && j.rates && j.rates[to]) return j.rates[to];
  }catch(e){ console.warn('Fx error:', e); }
  /* Respaldo común */
  if(from === 'CRC' && to === 'USD') return 0.00026;
  if(from === 'CRC' && to === 'EUR') return 0.00024;
  return null;
}
/* Migración segura: mueve claves que aún estén en el doc PÚBLICO
   tenants/{slug}/settings/store hacia la subcolección PRIVADA
   tenants/{slug}/privateSettings/ai y las borra del público. NO elimina
   datos si no existen; solo mueve y deja documentado cuántas movió. */
async function migrateStoreKeys(slug){
  const sRef = db.collection('tenants').doc(slug).collection('settings').doc('store');
  const pRef = db.collection('tenants').doc(slug).collection('privateSettings').doc('ai');
  const sSnap = await sRef.get();
  if(!sSnap.exists) return { moved:0 };
  const d = sSnap.data() || {};
  const keysToMove = ['aiOpenrouterKey','aiApiKey','aiExternalKey'];
  const found = keysToMove.filter(k => typeof d[k] === 'string' && d[k].trim() !== '');
  if(!found.length) return { moved:0 };
  // no pisar claves privadas ya migradas (priorizar privateSettings).
  // privateSettings solo lo lee/escribe el superadmin (reglas Firestore),
  // así que si el guardado lo disparó un admin normal, se saltea el bloqueo.
  let p = {};
  try{ const pSnap = await pRef.get(); p = (pSnap.exists ? pSnap.data() : {}) || {}; }
  catch(_e){ return { moved:0, blocked:true }; }
  const upd = {};
  found.forEach(k => { if(!p[k]) upd[k] = d[k]; });
  if(Object.keys(upd).length) await pRef.set(upd, { merge:true });
  // borrar las claves del doc público: ya pasaron o ya existían en privado
  const del = {};
  found.forEach(k => { del[k] = firebase.firestore.FieldValue.delete(); });
  await sRef.update(del);
  // si con esto el asistente queda configurado, marcarlo para la tienda pública
  if(found.includes('aiOpenrouterKey') && d.aiModel){
    try{ await sRef.update({ aiConfigured: true }); }catch(_e){}
  } else if(found.includes('aiExternalKey') && d.aiExternalModel){
    try{ await sRef.update({ aiConfigured: true }); }catch(_e){}
  } else if(found.includes('aiApiKey') && d.aiGeminiModel){
    try{ await sRef.update({ aiConfigured: true }); }catch(_e){}
  }
  return { moved: found.length };
}
async function saveProductToDB(id, data){
  if(id) await productsCol.doc(id).set(data, {merge:true});
  else await productsCol.add(data);
}
async function deleteProductFromDB(id){ await productsCol.doc(id).delete(); }
async function setProductStatus(id, status){
  try{
    await saveProductToDB(id, {status});
    toast('Estado actualizado a "' + (PROD_STATUS[status] ? PROD_STATUS[status].lbl : status) + '"', 'ok');
  }catch(e){
    toast('No se pudo actualizar el estado: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}

/* ---------- helpers ---------- */
/* Símbolos de divisa soportadas. _CURRENCY se actualiza con la configuración
   del negocio (settings.currency): se usa en productos, variantes, facturas,
   reportes, POS y carrito para mostrar el monto en la divisa elegida. */
var _CURRENCY = 'CRC'; // CRC | USD | EUR
var CURRENCY_SYMBOL = { CRC:'₡', USD:'$', EUR:'€' };
function currencySymbol(){ return CURRENCY_SYMBOL[_CURRENCY] || '₡'; }
/* Nombre del método de pago local (por defecto "SINPE", editable por el admin) */
function payMethodLabel(){ return (settings && settings.payMethodLabel) || 'SINPE'; }
function fmt(n){ return currencySymbol() + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009'); }
function fmtUsd(n){ return '$' + Number(n||0).toFixed(2); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* Convierte la descripción del producto en párrafos: cada renglón/espacio en
   blanco ingresado en el editor pasa a ser un párrafo separado en la ficha. */
function descParagraphs(t){
  return String(t||'').split(/\n+/).map(p => {
    const s = p.trim();
    return s ? '<p>' + esc(s) + '</p>' : '';
  }).join('');
}
function toast(msg, type){
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + (type||'');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2600);
}
function waDigits(num){ return String(num||'').replace(/\D/g,''); }
function todayStr(){ return new Date().toLocaleDateString('es-CR',{year:'numeric',month:'2-digit',day:'2-digit'}); }
function gradFor(id){ let h=0; for(const c of id) h=(h*31+c.charCodeAt(0))>>>0; return GRADS[h%GRADS.length]; }
function rid(){ return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g,'') : Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

/* Comprime una foto subida por el admin y la convierte a base64 (se guarda directo
   en Firestore, ya que esta tienda no usa Firebase Storage). maxDim limita el lado
   más largo en píxeles; quality es la calidad JPEG (0-1). */
function compressImageFile(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    if(!file || !file.type.startsWith('image/')){ reject(new Error('Archivo no es una imagen')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.onload = () => {
        let w = img.width, h = img.height;
        const max = maxDim || 900;
        if(w > max || h > max){
          if(w >= h){ h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
      };
      img.src = reader.result;
    };
reader.readAsDataURL(file);
  });
}

/* Comprime una imagen manteniendo el FONDO TRANSPARENTE (PNG). Sirve para
   íconos/logos que deben verse sobre fondos de color: no rellena de blanco y
   genera PNG. Si el archivo original es PNG (o no tiene fondo), conserva el
   canal alfa; el resultado queda recortado sin fondo. */
function compressImageToPng(file, maxDim){
  return new Promise((resolve, reject) => {
    if(!file || !file.type.startsWith('image/')){ reject(new Error('Archivo no es una imagen')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.onload = () => {
        let w = img.width, h = img.height;
        const max = maxDim || 300;
        if(w > max || h > max){
          if(w >= h){ h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        /* NO rellenar de blanco: se dibuja la imagen directo (si el PNG trae
           alpha, el fondo queda transparente). */
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
reader.readAsDataURL(file);
  });
}

/* Comprime una foto de VARIANTE a un cuadrado exacto de size×size px: recorta
   el centro de la imagen, la escala a un único tamaño estandarizado y la guarda
   en base64. Así todas las fotos de los tamaños se abren a 1280×1280 en la
   tienda (nítidas, con la misma proporción que las miniaturas y el visor). */
function compressSquareImageFile(file, size, quality){
  return new Promise((resolve, reject) => {
    if(!file || !file.type.startsWith('image/')){ reject(new Error('Archivo no es una imagen')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.onload = () => {
        const s = Math.round(size) || 1280;
        const side = Math.min(img.width, img.height);
        const sx = Math.max(0, Math.round((img.width - side) / 2));
        const sy = Math.max(0, Math.round((img.height - side) / 2));
        const canvas = document.createElement('canvas');
        canvas.width = s; canvas.height = s;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, s, s);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, s, s);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.86));
      };
      img.src = reader.result;
    };
reader.readAsDataURL(file);
  });
}
/* Igual que compressImageFile, pero parte de una foto que YA está en memoria
   como base64 (no un archivo nuevo) y la reduce más todavía. Se usa para
   generar la miniatura liviana ("thumb") de cada foto de producto en el
   momento de guardar, sin pedirle al admin que suba nada dos veces. */
function downscaleDataUrl(dataUrl, maxDim, quality){
  return new Promise((resolve, reject) => {
    if(!dataUrl){ reject(new Error('Sin imagen')); return; }
    const img = new Image();
    img.onerror = () => reject(new Error('No se pudo procesar la miniatura'));
    img.onload = () => {
      let w = img.width, h = img.height;
      const max = maxDim || 260;
      if(w > max || h > max){
        if(w >= h){ h = Math.round(h * max / w); w = max; }
        else { w = Math.round(w * max / h); h = max; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality || 0.55));
    };
    img.src = dataUrl;
  });
}
/* Genera el arreglo "thumbs" (una miniatura liviana por cada foto en
   "images"). Si por lo que sea alguna falla, se reutiliza la foto completa
   para esa posición en vez de dejar el catálogo sin imagen. */
async function buildThumbsFor(images){
  const out = [];
  for(const url of images){
    /* Si es una URL de Firebase Storage (o cualquier https), NO se miniaturiza:
       la miniatura sería la misma URL (Storage ya sirve optimizada). Esto evita
       guardar base64 pesados en el documento. Solo se miniaturizan dataUrls. */
    if(typeof url === 'string' && url.startsWith('https://')){
      out.push(url);
      continue;
    }
    try{ out.push(await downscaleDataUrl(url, 260, 0.55)); }
    catch(e){ out.push(url); }
  }
  return out;
}
/* Presupuesto de tamaño para TODAS las fotos base64 de un producto (portada
   + fotos + variantes) dentro del documento de Firestore (límite 1 MiB). Se
   usa solo como red de seguridad: mientras el total quepa, las fotos se
   guardan a 1600 px en su tamaño completo para que el cliente las vea
   nítidas y grandes. Solo si el documento quedaría muy pesado se bajan en
   pasos (empezando por las menos importantes) para que el guardado nunca
   falle. */
const PRODUCT_MEDIA_BUDGET = 900000; // caracteres base64 (~675 KB) con margen

function imageCharSize(u){ return u ? u.length : 0; }

/* Reduce una foto (que ya está en memoria como base64) hasta que su versión
   JPEG quepa dentro de capChars, bajando el lado mayor en pasos. Devuelve la
   foto ajustada; si ya cabe, la devuelve tal cual. */
async function fitImageChars(url, capChars, minDim){
  if(imageCharSize(url) <= capChars) return url;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('No se pudo leer la imagen para ajustar el tamaño'));
    i.src = url;
  });
  const min = minDim || 360;
  let w = img.naturalWidth || 800, h = img.naturalHeight || 800;
  let step = 0;
  while(step < 16){
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL('image/jpeg', 0.82);
    if(out.length <= capChars || w <= min) return out;
    w = Math.max(min, Math.round(w * 0.82));
    h = Math.max(min, Math.round(h * 0.82));
    step++;
  }
  return url;
}
/* Botón "Optimizar fotos" del Inventario: genera miniaturas livianas para
   los productos que se crearon ANTES de este acelerador (o que se subieron
   con fotos pero nunca se volvieron a guardar), sin que el admin tenga que
   editar producto por producto. Es opcional: la tienda ya funciona sin
   esto, pero el catálogo pintará más rápido después de correrlo. */
let optimizingThumbs = false;
function productNeedsThumbs(p){
  if(p.images && p.images.length && (!p.thumbs || p.thumbs.length < p.images.length)) return true;
  return (p.variants||[]).some(v => !v.removed && (v.images||[]).filter(Boolean).length && (!v.thumbs || v.thumbs.length < (v.images||[]).filter(Boolean).length));
}
async function optimizeCatalogThumbs(){
  if(optimizingThumbs) return;
  const pending = products.filter(productNeedsThumbs);
  if(!pending.length){ toast('Todas las fotos del catálogo ya están optimizadas ✨', 'ok'); return; }
  optimizingThumbs = true;
  const btn = document.getElementById('btnOptimizeThumbs');
  const originalHTML = btn ? btn.innerHTML : '';
  let done = 0;
  if(btn){ btn.disabled = true; btn.innerHTML = 'Optimizando 0/' + pending.length + '…'; }
  for(const p of pending){
    try{
      const patch = {};
      if(p.images && p.images.length && (!p.thumbs || p.thumbs.length < p.images.length)) patch.thumbs = await buildThumbsFor(p.images);
      const variants = (p.variants||[]);
      const newVariants = [];
      let vChanged = false;
      for(const v of variants){
        const imgs = (v.images||[]).filter(Boolean);
        const need = !v.removed && imgs.length && (!v.thumbs || v.thumbs.length < imgs.length);
        if(need){ newVariants.push(Object.assign({}, v, { thumbs: await buildThumbsFor(imgs) })); vChanged = true; }
        else newVariants.push(v);
      }
      if(vChanged) patch.variants = newVariants;
      await productsCol.doc(p.id).set(patch, { merge:true });
    }catch(e){ console.error('No se pudo optimizar', p.id, e); }
    done++;
    if(btn) btn.innerHTML = 'Optimizando ' + done + '/' + pending.length + '…';
  }
  optimizingThumbs = false;
  if(btn){ btn.disabled = false; btn.innerHTML = originalHTML; }
  syncThumbButtons();
  toast('Fotos optimizadas: ' + done + ' producto(s), incluidas las de variantes. El catálogo cargará más rápido de ahora en más.', 'ok');
}
/* Muestra u oculta el botón "Restaurar fotos originales" según si hay
   productos con miniaturas generadas (thumbs de producto o de variantes).
   Se llama tras optimizar, tras restaurar y cada vez que se pinta el inventario. */
function productHasThumbs(p){
  if(p.thumbs && p.thumbs.length) return true;
  if(p.optimizedPhotos) return true;
  return (p.variants||[]).some(v => v.thumbs && v.thumbs.length);
}
function syncThumbButtons(){
  const hasThumbs = products.some(productHasThumbs);
  const restoreBtn = document.getElementById('btnRestoreThumbs');
  const optimizeBtn = document.getElementById('btnOptimizeThumbs');
  if(restoreBtn) restoreBtn.style.display = hasThumbs ? '' : 'none';
  if(optimizeBtn) optimizeBtn.style.display = products.some(productNeedsThumbs) ? '' : 'none';
}
/* Revierte el botón "Optimizar fotos": borra las miniaturas livianas (thumbs)
   de los productos Y de sus variantes, de modo que las páginas vuelvan a usar
   las fotos ORIGINALES que el admin subió. Es la operación inversa exacta:
   los thumbs son datos derivados que se regeneran automáticamente al guardar
   de nuevo, así que renunciar a ellos no pierde información.
   Pide confirmación por si fue un toque accidental. */
async function restoreOriginalThumbs(){
  const affected = products.filter(productHasThumbs);
  if(!affected.length){ toast('No hay fotos optimizadas para restaurar.', 'warn'); return; }
  if(!window.confirm('Restaurar las fotos originales de ' + affected.length + ' producto(s)? Se quitarán las miniaturas livianas (incluidas las de las variantes) y se usarán las fotos completas. Podés volver a optimizar en cualquier momento.')) return;
  const btn = document.getElementById('btnRestoreThumbs');
  const originalHTML = btn ? btn.innerHTML : '';
  let done = 0;
  if(btn){ btn.disabled = true; btn.innerHTML = 'Restaurando…'; }
  for(const p of affected){
    try{
      const patch = {};
      if(p.thumbs && p.thumbs.length || p.optimizedPhotos) patch.thumbs = [];
      const variants = (p.variants||[]);
      const newVariants = [];
      let vChanged = false;
      for(const v of variants){
        if(v.thumbs && v.thumbs.length){ newVariants.push(Object.assign({}, v, { thumbs: [] })); vChanged = true; }
        else newVariants.push(v);
      }
      if(vChanged) patch.variants = newVariants;
      await productsCol.doc(p.id).set(patch, { merge:true });
    }catch(e){ console.error('No se pudo restaurar', p.id, e); }
    done++;
  }
  if(btn){ btn.disabled = false; btn.innerHTML = originalHTML; }
  syncThumbButtons();
  toast('Fotos restauradas: ' + done + ' producto(s), incluidas las de variantes. Se usan de nuevo las fotos originales.', 'ok');
}

/* Convierte enlaces de YouTube (watch, youtu.be, shorts) a una URL de embed. Devuelve null si no aplica. */
function youtubeEmbedUrl(url){
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? ('https://www.youtube.com/embed/' + m[1]) : null;
}

/* Convierte un enlace de reel de TikTok (formato .../@usuario/video/ID) a su URL de embed oficial.
   Los enlaces cortos (vm.tiktok.com, vt.tiktok.com) no se pueden resolver desde el navegador,
   así que en ese caso se ofrece un botón que abre el reel directamente en TikTok. */
function tiktokVideoId(url){
  if(!url) return null;
  const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return m ? m[1] : null;
}
function tiktokEmbedUrl(url){
  const id = tiktokVideoId(url);
  return id ? ('https://www.tiktok.com/embed/v2/' + id) : null;
}

/* ---------- video flotante tipo historia (hasta 4 slots) ----------
   Slot 1: cualquier plan excepto Emprendedor (Profesional/Destacado/Premium).
   Slot 2: Profesional/Destacado/Premium.
   Slots 3 y 4: EXCLUSIVOS del plan Destacado/Premium. */
let storyMuted = true;
const STORY_SLOTS = {
  1: { closed:false, lastUrl:null, settingsKey:'storyVideoUrl',  wrapId:'storyFloat',  mediaId:'storyMedia',  muteBtnId:'storyMuteBtn',  planCheck: pid => pid !== 'emprendedor' },
  2: { closed:false, lastUrl:null, settingsKey:'storyVideoUrl2', wrapId:'storyFloat2', mediaId:'storyMedia2', muteBtnId:'storyMuteBtn2', planCheck: pid => ['profesional','destacado','premium'].includes(pid) },
  3: { closed:false, lastUrl:null, settingsKey:'storyVideoUrl3', wrapId:'storyFloat3', mediaId:'storyMedia3', muteBtnId:'storyMuteBtn3', planCheck: pid => ['destacado','premium'].includes(pid) },
  4: { closed:false, lastUrl:null, settingsKey:'storyVideoUrl4', wrapId:'storyFloat4', mediaId:'storyMedia4', muteBtnId:'storyMuteBtn4', planCheck: pid => ['destacado','premium'].includes(pid) }
};
function storyYoutubeId(url){
  if(!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function renderStoryVideo(){
  const activePlanId = (typeof getActivePlanId === 'function') ? getActivePlanId() : 'destacado';
  Object.keys(STORY_SLOTS).forEach(n=>{
    const slot = STORY_SLOTS[n];
    const wrap = document.getElementById(slot.wrapId);
    if(!wrap) return;
    const url = (settings[slot.settingsKey]||'').trim();
    const planOk = (typeof getActivePlanId !== 'function') || slot.planCheck(activePlanId);
    if(!url || slot.closed || !planOk){ wrap.classList.remove('show'); return; }
    if(url !== slot.lastUrl){
      slot.lastUrl = url;
      const media = document.getElementById(slot.mediaId);
      const ytId = storyYoutubeId(url);
      const muteBtn = document.getElementById(slot.muteBtnId);
      if(ytId){
        media.innerHTML = '<iframe src="https://www.youtube.com/embed/' + ytId + '?autoplay=1&mute=' + (storyMuted?1:0) + '&loop=1&playlist=' + ytId + '&controls=0&modestbranding=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
        if(muteBtn) muteBtn.style.display = 'none';
      }else{
        media.innerHTML = '<video src="' + esc(url) + '" autoplay loop playsinline' + (storyMuted?' muted':'') + '></video>';
        if(muteBtn) muteBtn.style.display = 'flex';
      }
    }
    wrap.classList.add('show');
  });
}
function closeStoryVideo(n){
  const slot = STORY_SLOTS[n||1];
  if(!slot) return;
  slot.closed = true;
  const wrap = document.getElementById(slot.wrapId);
  if(wrap) wrap.classList.remove('show');
}
function toggleStoryMute(n){
  storyMuted = !storyMuted;
  const slot = STORY_SLOTS[n||1];
  const v = slot ? document.querySelector('#' + slot.mediaId + ' video') : null;
  if(v) v.muted = storyMuted;
}

/* ---------- asistente de compras con IA ----------
   Cada tienda lo activa desde Configuraciones con su propio proveedor,
   modelo y clave. Las claves viven en privateSettings (privadas, solo las usa
   el backend) y el público ve el botón solo si aiConfigured + plan lo permiten.
   El asistente solo conoce los productos de ESTA tienda (nunca otros negocios). */
let aiMessages = []; // historial (role/content) que viaja al backend "aiChat"
let aiWelcomeShown = false;
/* Proveedores que la plataforma NO soporta: hoy solo OpenAI (ChatGPT), cuya
   API bloquea las llamadas del navegador con CORS y que no habilitamos en el
   proxy del servidor. Se centraliza acá para que el panel de Configuraciones y
   lo que ven los clientes usen el mismo criterio. */
function aiProviderWorksHere(provider, externalProvider){
  if(provider === 'external' && externalProvider === 'openai') return false;
  return true;
}
function renderAIAssistant(){
  const btn = document.getElementById('aiFloatBtn');
  const provider = settings.aiProvider || 'gemini';
  // La clave ya no vive en settings público: miramos el flag aiConfigured
  // (lo refresca el servidor al guardar). Para tiendas viejas sin migrar,
  // caemos al chequeo legacy si todavía tienen los campos de clave en el doc.
  const hasCreds = (settings.aiConfigured !== undefined)
    ? !!settings.aiConfigured
    : provider === 'openrouter'
      ? !!(settings.aiOpenrouterKey && settings.aiModel)
      : provider === 'external'
        ? !!(settings.aiExternalKey && settings.aiExternalModel)
        : !!settings.aiApiKey;
  // A los clientes reales solo les mostramos el asistente si de verdad puede
  // responder en este chat — si el negocio dejó configurado un proveedor que
  // no funciona desde el navegador (ver aiProviderWorksHere), es mejor no
  // mostrar un botón que va a fallar en cada mensaje.
  // Todos los PLANES pueden usar el asistente IA. El superadministrador puede
  // deshabilitarlo por negocio (aiSuperDisabled). El negocio además debe
  // activarlo (aiEnabled) y el superadmin configurarlo con credenciales válidas.
  const superDisabled = settings.aiSuperDisabled === true;
  const canUse = !!(settings.aiEnabled && hasCreds && !superDisabled && aiProviderWorksHere(provider, settings.aiExternalProvider));
  btn.style.display = canUse ? 'flex' : 'none';
  document.getElementById('aiAssistantName').textContent = settings.aiAssistantName || 'Asistente';
  const logoUrl = (settings.logoUrl||'').trim();
  const floatIcon = document.getElementById('aiFloatIcon');
  const floatLogo = document.getElementById('aiFloatLogo');
  const panelAvatar = document.getElementById('aiPanelAvatar');
  if(logoUrl){
    floatLogo.src = logoUrl; floatLogo.style.display = 'block'; floatIcon.style.display = 'none';
    panelAvatar.innerHTML = '<img src="' + esc(logoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  } else {
    floatLogo.style.display = 'none'; floatIcon.style.display = 'flex';
    panelAvatar.textContent = '✨';
  }
  if(!canUse){
    document.getElementById('aiPanel').classList.remove('open');
    return;
  }
  if(!aiWelcomeShown){
    aiWelcomeShown = true;
    document.getElementById('aiChatBody').innerHTML = '';
    appendMessage(settings.aiWelcomeMsg || DEFAULT_SETTINGS.aiWelcomeMsg, 'bot');
  }
}
function toggleAI(){
  document.getElementById('aiPanel').classList.toggle('open');
}
function appendMessage(text, sender){
  const body = document.getElementById('aiChatBody');
  const msgDiv = document.createElement('div');
  msgDiv.className = 'ai-msg ' + sender;
  msgDiv.textContent = text;
  body.appendChild(msgDiv);
  body.scrollTop = body.scrollHeight;
  return msgDiv;
}
function appendProductSuggestion(productId){
  const product = products.find(p => p.id === productId);
  if(!product) return;
  const body = document.getElementById('aiChatBody');
  const card = document.createElement('div');
  card.className = 'ai-suggest-card';
  const img = firstThumb(product) || '';
  // Si el producto tiene variantes (tallas, tamaños, etc.) no podemos
  // agregarlo al carrito directo desde acá — el cliente primero necesita
  // elegir CUÁL opción quiere. Igual que en la grilla principal, el botón
  // lo manda a elegir la opción en vez de agregar algo incorrecto.
  const addAction = product.hasVariants
    ? 'openProductView(\'' + product.id + '\')'
    : 'addToCart(\'' + product.id + '\')';
const addLabel = product.hasVariants ? 'Elegir opción' : 'Añadir';
  const waBtn = (settings.whatsapp && String(settings.whatsapp).trim())
    ? '<button class="ai-btn-wa" onclick="openChatWhatsApp(\'' + product.id + '\')">WhatsApp</button>'
    : '';
  card.innerHTML =
    '<div class="asc-img">' + (img ? '<img src="' + esc(img) + '">' : '') + '</div>' +
    '<div class="asc-body">' +
      '<div class="asc-name">' + esc(product.name) + '</div>' +
      '<div class="asc-price"><span class="now">' + displayPrice(product) + '</span></div>' +
      '<div class="asc-actions">' +
        '<button class="ai-btn-view" onclick="openProductView(\'' + product.id + '\')">Ver detalle</button>' +
        '<button class="ai-btn-add" onclick="' + addAction + '">' + addLabel + '</button>' +
        waBtn +
      '</div>' +
    '</div>';
body.appendChild(card);
  body.scrollTop = body.scrollHeight;
  appendVariantCarousel(product);
}
/* Carpeta de imágenes de las variantes del mismo producto: cuando el agente
   recomienda un producto que tiene variantes con foto, muestra un carrusel
   con cada opción (su foto real, nombre y precio) para que el cliente vea
   todas las presentaciones sin salir del chat. */
function appendVariantCarousel(p){
  if(!p || !p.hasVariants) return;
  const variants = activeVariants(p).filter(v => v && !v.removed);
  const withImg = variants.filter(v => v.image);
  if(withImg.length < 2) return;
  const body = document.getElementById('aiChatBody');
  const wrap = document.createElement('div');
  wrap.className = 'ai-carousel-wrap';
  const hasWa = !!(settings.whatsapp && String(settings.whatsapp).trim());
  wrap.innerHTML =
    '<div class="ai-c-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Opciones de ' + esc(p.name) + '</div>' +
    '<div style="display:flex;align-items:center;gap:6px">' +
      '<button type="button" class="ai-nav" onclick="aiCarouselNav(this,-1)" aria-label="Anterior">‹</button>' +
      '<div class="ai-carousel">' +
        variants.map(v => {
          const img = v.image || '';
          const price = fmt(Number(v.price) || 0);
          return '<div class="ai-c-item" onclick="openProductView(\'' + p.id + '\')">' +
            '<div class="ai-c-img"><img src="' + esc(img) + '" alt="" loading="lazy"></div>' +
            '<div class="ai-c-body"><div class="ai-c-name">' + esc(v.name) + '</div><div class="ai-c-price">' + price + '</div>' +
            (hasWa ? '<div class="ai-c-wa" onclick="event.stopPropagation();openVariantWhatsApp(\'' + p.id + '\',\'' + (v.name || '').replace(/'/g, "\\'") + '\',' + (Number(v.price) || 0) + ')"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z"/></svg>WhatsApp</div>' : '') +
            '</div></div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="ai-nav" onclick="aiCarouselNav(this,1)" aria-label="Siguiente">›</button>' +
    '</div>';
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}
function openVariantWhatsApp(productId, variantName, price){
  const wa = String(settings.whatsapp || '').trim();
  if(!wa) return;
  const p = products.find(x => x.id === productId);
  const msg = 'Hola ' + (settings.storeName || '') + ', me interesa "' + (p ? p.name : '') + '" (' + variantName + ')' + (price ? ' — ' + fmt(Number(price) || 0) : '') + '. ¿Está disponible?';
  window.open('https://wa.me/' + waDigits(wa) + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
}
/* Muestra una fila horizontal (carrusel) con los productos recomendados por
   el asistente. Si es un solo producto, seguimos usando la tarjeta grande
   (appendProductSuggestion); a partir de dos o más van en carrusel para que
   el chat no se llene de tarjetas enormes. */
function appendProductCarousel(productIds){
  const list = (productIds||[]).filter(id => products.some(p => p.id === id && p.active !== false));
  if(!list.length) return;
  if(list.length === 1){ appendProductSuggestion(list[0]); return; }
  const body = document.getElementById('aiChatBody');
  const wrap = document.createElement('div');
  wrap.className = 'ai-carousel-wrap';
  const hasWa = !!(settings.whatsapp && String(settings.whatsapp).trim());
  wrap.innerHTML =
    '<div class="ai-c-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Recomendados para vos</div>' +
    '<div style="display:flex;align-items:center;gap:6px">' +
      '<button type="button" class="ai-nav" onclick="aiCarouselNav(this,-1)" aria-label="Anterior">‹</button>' +
      '<div class="ai-carousel">' +
        list.map(id => {
          const p = products.find(x => x.id === id);
          const img = firstThumb(p) || '';
          const g = gradFor(p.id);
          const media = img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : svgIcon(p.icon, 40);
          return '<div class="ai-c-item" onclick="openProductView(\'' + p.id + '\')">' +
            '<div class="ai-c-img" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + media + '</div>' +
            '<div class="ai-c-body"><div class="ai-c-name">' + esc(p.name) + '</div><div class="ai-c-price">' + displayPrice(p) + '</div>' +
            (hasWa ? '<div class="ai-c-wa" onclick="event.stopPropagation();openChatWhatsApp(\'' + p.id + '\')"><svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z"/></svg>WhatsApp</div>' : '') +
            '</div></div>';
        }).join('') +
      '</div>' +
      '<button type="button" class="ai-nav" onclick="aiCarouselNav(this,1)" aria-label="Siguiente">›</button>' +
    '</div>';
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
  list.forEach(id => {
    const p = products.find(x => x.id === id);
    appendVariantCarousel(p);
  });
}
function aiCarouselNav(btn, dir){
  const row = btn.parentElement;
  const car = row && row.querySelector('.ai-carousel');
  if(!car) return;
  const step = Math.max(120, car.clientWidth * 0.75);
  car.scrollBy({ left: dir * step, behavior: 'smooth' });
}
function chatWhatsAppLink(id){
  const wa = String(settings.whatsapp || '').trim();
  if(!wa) return '';
  const p = products.find(x => x.id === id);
  const msg = 'Hola ' + (settings.storeName || '') + ', me interesa "' + (p ? p.name : '') + '"' + (p ? ' (' + displayPrice(p) + ')' : '') + '. ¿Está disponible?';
  return 'https://wa.me/' + waDigits(wa) + '?text=' + encodeURIComponent(msg);
}
function openChatWhatsApp(id){
  const url = chatWhatsAppLink(id);
  if(url) window.open(url, '_blank', 'noopener');
}
/* Elige qué productos incluir en el prompt del asistente: si el catálogo es
   chico, van todos; si es grande, se prioriza por relevancia con el último
   mensaje del cliente (nombre/descripción/categoría) en vez de mandar
   siempre los primeros N sin importar el tema. Si no hay suficientes
   coincidencias, se completa con los más vendidos para no dejar el catálogo
   corto. */
function pickRelevantProducts(userText, limit){
  const active = products.filter(p => p.active !== false);
  if(active.length <= limit) return active;
  const words = (userText||'').toLowerCase().split(/[^a-zá-úñ0-9]+/i).filter(w => w.length >= 3);
  if(!words.length){
    return active.slice().sort((a,b)=>(b.soldCount||0)-(a.soldCount||0)).slice(0, limit);
  }
  const scored = active.map(p => {
    const hay = ((p.name||'') + ' ' + (p.desc||'') + ' ' + (p.cat||'')).toLowerCase();
    let score = 0;
    for(const w of words) if(hay.includes(w)) score++;
    return { p, score };
  });
  const relevant = scored.filter(s => s.score > 0).sort((a,b)=>b.score-a.score).slice(0, limit);
  if(relevant.length >= Math.min(limit, 6)) return relevant.map(s=>s.p);
  const chosenIds = new Set(relevant.map(s=>s.p.id));
  const fillers = active.filter(p => !chosenIds.has(p.id))
    .sort((a,b)=>(b.soldCount||0)-(a.soldCount||0))
    .slice(0, limit - relevant.length);
  return relevant.map(s=>s.p).concat(fillers);
}

/* Instrucción base común a cualquier proveedor: quién es el asistente,
   el inventario de ESTA tienda (con variantes y solo los productos más
   relevantes a lo que preguntó el cliente), los datos reales del negocio
   (horario, envío, pago), y las instrucciones de "entrenamiento" propias
   del negocio (settings.aiSystemPrompt) escritas desde Configuraciones. */
function buildAiSystemInstruction(userText){
  // Ventanas de contexto chicas (sobre todo en modelos gratuitos): mandar
  // menos productos, pero los que sí importan, hace el chat más rápido
  // (menos texto por turno) y más coherente (recomienda lo que encaja).
  const MAX_PRODUCTS_IN_PROMPT = 18;
  const MAX_DESC_CHARS = 90;
  const MAX_VARIANTS_SHOWN = 6;

  const relevant = pickRelevantProducts(userText, MAX_PRODUCTS_IN_PROMPT);
  const activeCount = products.filter(p=>p.active!==false).length;

  const invJson = JSON.stringify(
    relevant.map(p => {
      const item = {
        id:p.id,
        nombre:p.name,
        desc: (p.desc||'').slice(0, MAX_DESC_CHARS)
      };
      if(p.hasVariants){
        const av = activeVariants(p);
        item.opciones = p.variantGroupName || 'Opciones';
        item.variantes = av.slice(0, MAX_VARIANTS_SHOWN).map(v => ({ nombre:v.name, precio:v.price, stock:v.stock||0 }));
        if(av.length > MAX_VARIANTS_SHOWN) item.variantesExtra = av.length - MAX_VARIANTS_SHOWN;
      } else {
        item.precio = displayPrice(p);
        item.stock = p.unlimited ? 'ilimitado' : (p.stock||0);
      }
      return item;
    })
  );

  // Datos que ya están configurados en otras partes de Configuraciones: se
  // agregan solos para que el asistente nunca invente ni contradiga el
  // horario, el envío o el método de pago real del negocio.
  const facts = [];
  if(settings.hours) facts.push('Horario: ' + settings.hours);
  if(settings.shipping) facts.push('Envíos: ' + settings.shipping);
  if(settings.sinpe) facts.push('SINPE Móvil: ' + settings.sinpe);
  if(settings.whatsapp) facts.push('WhatsApp: ' + settings.whatsapp);
  if(settings.iva) facts.push('IVA aplicado: ' + settings.iva + '%');

  const custom = (settings.aiSystemPrompt || '').trim().slice(0, 1500);

  return 'Eres "' + (settings.aiAssistantName||'Cana') + '", asistente de ventas de "' + (settings.storeName||'la tienda') + '".\n' +
    (facts.length ? ('Datos reales del negocio (no los cambies ni inventes otros):\n- ' + facts.join('\n- ') + '\n') : '') +
    'Catálogo' + (activeCount > relevant.length ? (' (' + relevant.length + ' productos más relevantes a lo que preguntó el cliente, de ' + activeCount + ' en total)') : '') + ': ' + invJson + '\n' +
    (custom ? ('Instrucciones propias del negocio (seguilas siempre):\n' + custom + '\n') : '') +
    'Reglas:\n' +
    '1. Recomendá SOLO productos de este catálogo, usando su "id" exacto. Nunca inventes productos, precios ni stock que no estén acá.\n' +
    '2. Si un producto tiene "variantes", mencioná en tu respuesta de texto las opciones disponibles (nombre y precio) para que el cliente elija, antes de sugerirlo.\n' +
    '3. Si nada del catálogo encaja con lo que pide el cliente, decilo con honestidad en vez de sugerir algo que no corresponde.\n' +
    '4. Respondé con amabilidad y resaltando el valor, en español costarricense.\n' +
    '5. Respondé SOLO en JSON válido sin formato markdown, sin texto antes ni después.\n' +
    'Schema: {"reply": "Texto de respuesta", "productIdsToRecommend": ["id1","id2"]}';
}

async function handleAISubmit(e){
  e.preventDefault();
  const inputEl = document.getElementById('aiInput');
  const userText = inputEl.value.trim();
  if(!userText) return;

  appendMessage(userText, 'user');
  inputEl.value = '';

  const body = document.getElementById('aiChatBody');
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'ai-typing';
  loadingMsg.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(loadingMsg);
  body.scrollTop = body.scrollHeight;

  try{
    aiMessages.push({ role:'user', content: userText });
    if(aiMessages.length > 16) aiMessages = aiMessages.slice(-16);
    const data = await cloudCall('aiChat', {
      slug: TENANT_ID,
      text: userText,
      system: buildAiSystemInstruction(userText),
      history: aiMessages.slice(0, -1)
    });
    loadingMsg.remove();
    if(data && data.reply !== undefined){
      aiMessages.push({ role:'assistant', content: data.reply });
      appendMessage(data.reply, 'bot');
      if(Array.isArray(data.productIdsToRecommend) && data.productIdsToRecommend.length){
        appendProductCarousel(data.productIdsToRecommend);
      }
    } else if(data === null){
      // JSON malformado del modelo — pedir que repita
      appendMessage('Perdón, no entendí bien eso. ¿Podés repetirlo?', 'bot');
    }
    // data === undefined: el backend ya mostró su propio mensaje de error, no repetir
  }catch(error){
    loadingMsg.remove();
    console.error(error);
const msg = (error && error.message && /quota|cuota|plan|permiso|configurado|clave|modelo|proveedor|timeout|tard|HTTP|no devolvi|Error conectando/.test(error.message))
      ? error.message
      : 'Tuve un problemita técnico. 🌿';
    appendMessage(msg, 'bot');
  }
}

/* ============================================================================
   ASISTENTE DE IA — TODO el tráfico pasa por el backend (Cloud Functions
   "aiChat"). El navegador ya NO tiene ni usa ninguna API key: las claves viven
   en la subcolección PRIVADA tenants/{slug}/privateSettings/ai y solo el
   servidor las lee (Admin SDK) para llamar a OpenRouter / Gemini / API externa.
Cada tienda conserva su proveedor, modelo, prompt y clave (multi-tenant).
   ============================================================================ */
/* ---------- Configuraciones: proveedor de IA y catálogo de modelos de OpenRouter ---------- */
function onAiProviderChange(){
  const provider = document.getElementById('sAiProvider').value;
  const geminiBlock = document.getElementById('sAiGeminiBlock');
  const orBlock = document.getElementById('sAiOpenrouterBlock');
  const extBlock = document.getElementById('sAiExternalBlock');
  if(geminiBlock) geminiBlock.style.display = (provider === 'gemini') ? '' : 'none';
  if(orBlock) orBlock.style.display = (provider === 'openrouter') ? '' : 'none';
  if(extBlock) extBlock.style.display = (provider === 'external') ? '' : 'none';
// Limpiar el historial al cambiar proveedor para evitar contexto cruzado
  aiMessages = [];
  aiWelcomeShown = false;
  const chatBody = document.getElementById('aiChatBody');
  if(chatBody) chatBody.innerHTML = '';
}

/* Configuración de modelos sugeridos y URL base según proveedor externo elegido */
const EXTERNAL_PROVIDERS = {
  openai:  { baseUrl:'https://api.openai.com/v1',          models:['gpt-4o-mini','gpt-4o','gpt-4o-2024-11-20','o1-mini'] },
  claude:  { baseUrl:'https://api.anthropic.com',           models:['claude-haiku-4-5-20251001','claude-sonnet-4-6','claude-opus-4-6'] },
  groq:    { baseUrl:'https://api.groq.com/openai/v1',      models:['llama-3.3-70b-versatile','llama3-8b-8192','gemma2-9b-it','mixtral-8x7b-32768'] },
  kimi:    { baseUrl:'https://api.moonshot.cn/v1',          models:['moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k'] },
  custom:  { baseUrl:'',                                    models:[] }
};

function onExternalProviderChange(){
  const prov = document.getElementById('sAiExternalProvider').value;
  const cfg = EXTERNAL_PROVIDERS[prov] || EXTERNAL_PROVIDERS.custom;
  const sugEl = document.getElementById('sAiExternalModelSuggestions');
  const customGroup = document.getElementById('sAiExternalCustomUrlGroup');
  if(sugEl) sugEl.textContent = cfg.models.join(', ') || '—';
  if(customGroup) customGroup.style.display = (prov === 'custom') ? '' : 'none';
  const warnEl = document.getElementById('sAiExternalWarning');
  if(warnEl) warnEl.style.display = (prov === 'openai') ? '' : 'none';
  // sugerir el primer modelo si el campo está vacío
  const modelInput = document.getElementById('sAiExternalModel');
  if(modelInput && !modelInput.value && cfg.models.length) modelInput.value = cfg.models[0];
  document.getElementById('sAiExternalStatus').textContent = '';
}

/* ====== Configuración IA (admin): todo pasa por el backend. Las claves nunca
   salen de tenants/{slug}/privateSettings/ai — el servidor las usa y devuelve
   resultados sin exponerlas. ====== */

/* Cargar lista de modelos del proveedor externo (a través del backend seguro) */
async function loadExternalModels(){
  const prov = document.getElementById('sAiExternalProvider').value;
  const statusEl = document.getElementById('sAiExternalStatus');
  const modelInput = document.getElementById('sAiExternalModel');
  const baseUrl = document.getElementById('sAiExternalBaseUrl') ? document.getElementById('sAiExternalBaseUrl').value.trim() : '';
  statusEl.textContent = 'Cargando modelos (servidor)…';
  try{
    if(prov === 'claude'){
      // Claude no expone GET /models igual que los demás — lista estática
      if(!modelInput.value) modelInput.value = 'claude-haiku-4-5-20251001';
      statusEl.innerHTML = '<span style="color:var(--green)">✓ Modelos de Claude: ' + EXTERNAL_PROVIDERS.claude.models.join(', ') + '</span>';
      return;
    }
    const res = await cloudCall('aiModels', { slug: TENANT_ID, provider: 'external', providerName: prov, baseUrl });
    const names = (res && Array.isArray(res.models)) ? res.models : [];
    if(!names.length) throw new Error('No se encontraron modelos');
    statusEl.innerHTML = '<span style="color:var(--green)">✓ ' + names.length + ' modelos disponibles: ' + names.slice(0,8).join(', ') + (names.length > 8 ? '…' : '') + '</span>';
    if(!modelInput.value && names.length) modelInput.value = names[0];
    toast('Modelos cargados: ' + names.length, 'ok');
  }catch(err){
    console.error('loadExternalModels error:', err);
    statusEl.innerHTML = '<span style="color:var(--danger)">✗ No se pudo cargar: ' + esc(err.message||'error desconocido') + '. Ingresá el modelo manualmente.</span>';
    // Si falla la carga, mostramos sugerencias hardcoded
    const cfg2 = EXTERNAL_PROVIDERS[prov];
    if(cfg2 && cfg2.models.length){
      const el = document.getElementById('sAiExternalModelSuggestions');
      if(el) el.textContent = cfg2.models.join(', ');
    }
  }
}

/* Prueba rápida de conexión OpenRouter (la hace el servidor con la clave guardada) */
async function testOpenRouterConnection(){
  const statusEl = document.getElementById('sAiORStatus');
  const model = document.getElementById('sAiModel').value.trim();
  if(!model){ statusEl.innerHTML = '<span style="color:var(--danger)">✗ Cargá y seleccioná un modelo primero.</span>'; return; }
  statusEl.innerHTML = '<span style="color:var(--muted)">Probando conexión (desde el servidor)…</span>';
  try{
    const res = await cloudCall('aiTest', { slug: TENANT_ID, provider: 'openrouter', model });
    if(res && res.ok){
      statusEl.innerHTML = '<span style="color:var(--green)">✓ Conexión exitosa. Respuesta: "' + esc((res.reply||'ok').slice(0,60)) + '"</span>';
    } else {
      statusEl.innerHTML = '<span style="color:var(--danger)">✗ ' + esc((res && res.error) || 'Sin respuesta del servidor') + '</span>';
    }
  }catch(e){
    statusEl.innerHTML = '<span style="color:var(--danger)">✗ ' + esc(e.message||'Error de red') + '</span>';
  }
}

/* ---------- ESTADO Y CONEXIÓN del agente IA (visible para el admin) ----------
   El admin de tienda NO ve claves, pero sí puede comprobar que el agente
   configurado por el superadmin responde, y refrescar/probar el modelo activo. */
async function checkAiAgentStatus(){
  const el = document.getElementById('sAiAgentStatus');
  if(el) el.innerHTML = '<span style="color:var(--muted)">Consultando estado…</span>';
  try{
    const st = await cloudCall('aiStatus', { slug: TENANT_ID });
    if(st && st.configured){
      el.innerHTML = '<span style="color:var(--green)">✓ Agente configurado y activo (proveedor: ' + esc(st.provider || '—') + ', modelo: ' + esc(st.model || '—') + ')</span>';
      return true;
    } else {
      el.innerHTML = '<span style="color:var(--orange)">⚠ El asistente no está configurado aún. El superadmin debe configurar la clave y el modelo.</span>';
      return false;
    }
  }catch(e){
    el.innerHTML = '<span style="color:var(--danger)">✗ No se pudo consultar: ' + esc((e && e.message) || 'error') + '</span>';
    return false;
  }
}
/* Prueba REAL el modelo activo (llamada mínima) y muestra si responde */
async function refreshAiAgentModel(){
  const el = document.getElementById('sAiAgentStatus');
  const model = (settings && settings.aiModel) || (document.getElementById('sAiModel') && document.getElementById('sAiModel').value) || '';
  const provider = (settings && settings.aiProvider) || 'openrouter';
  if(el) el.innerHTML = '<span style="color:var(--muted)">Probando el modelo activo…</span>';
  if(!model){ if(el) el.innerHTML = '<span style="color:var(--orange)">⚠ No hay modelo activo seleccionado. Cargá los modelos primero.</span>'; return false; }
  try{
    const res = await cloudCall('aiTest', { slug: TENANT_ID, provider: provider, model: model });
    if(res && res.ok){
      if(el) el.innerHTML = '<span style="color:var(--green)">✓ El agente "' + esc(model) + '" responde correctamente.</span>';
      return true;
    } else {
      if(el) el.innerHTML = '<span style="color:var(--danger)">✗ El modelo "' + esc(model) + '" no responde: ' + esc((res && res.error) || 'sin respuesta') + '. Elegí otro modelo.</span>';
      return false;
    }
  }catch(e){
    if(el) el.innerHTML = '<span style="color:var(--danger)">✗ Error al probar: ' + esc((e && e.message) || 'error') + '</span>';
    return false;
  }
}

/* Prueba rápida de conexión de la API externa (desde el servidor, sin exponer la clave) */
async function testExternalConnection(){
  const statusEl = document.getElementById('sAiExternalStatus');
  statusEl.innerHTML = '<span style="color:var(--muted)">Probando conexión (desde el servidor)…</span>';
  try{
const prov = document.getElementById('sAiExternalProvider').value;
    const model = document.getElementById('sAiExternalModel').value.trim();
    const baseUrl = document.getElementById('sAiExternalBaseUrl') ? document.getElementById('sAiExternalBaseUrl').value.trim() : '';
    const res = await cloudCall('aiTest', { slug: TENANT_ID, provider: 'external', providerName: prov, model, baseUrl });
    if(res && res.ok){
      statusEl.innerHTML = '<span style="color:var(--green)">✓ Conexión exitosa. Respuesta: "' + esc((res.reply||'ok').slice(0,80)) + '"</span>';
    } else {
      statusEl.innerHTML = '<span style="color:var(--danger)">✗ ' + esc((res && res.error) || 'Respuesta vacía o inesperada del modelo') + '</span>';
    }
  }catch(e){
    statusEl.innerHTML = '<span style="color:var(--danger)">✗ Error: ' + esc(e.message||'desconocido') + '</span>';
  }
}

/* Trae el catálogo de modelos de OpenRouter a través del backend (la clave
   guardada la usa el servidor; el navegador no la ve). kind='chat' llena el
   modelo del chat; kind='image' llena el del generador de fotos con fondo blanco. */
async function loadOpenRouterModels(kind){
  const selId = kind === 'image' ? 'sAiImageModel' : 'sAiModel';
  const sel = document.getElementById(selId);
  if(!sel) return;
  const previous = sel.value;
  sel.innerHTML = '<option value="">Cargando modelos (servidor)…</option>';
  try{
    const res = await cloudCall('aiModels', { slug: TENANT_ID, kind });
    const filtered = (res && Array.isArray(res.models)) ? res.models : [];
    if(!filtered.length){
      sel.innerHTML = '<option value="">' + (kind==='image' ? 'No hay modelos con salida de imagen disponibles' : 'No se encontraron modelos gratis') + '</option>';
      toast(kind==='image' ? 'OpenRouter no tiene modelos de imagen disponibles en este momento' : 'No se encontraron modelos gratuitos en OpenRouter', 'err');
      return;
    }
    sel.innerHTML = '<option value="">Verificando cuáles responden (esto fija solo los operativos)…</option>';
    /* Probar cada modelo con una llamada mínima: se conservan SOLO los que
       responden, así el agente que se elija queda fijo al que funciona y los
       caídos no aparecen en la lista. */
    const working = [];
    const toTry = filtered.slice(0, 10);
    for(let i = 0; i < toTry.length; i++){
      sel.innerHTML = '<option value="">Verificando cuáles responden (' + (i+1) + '/' + toTry.length + ')…</option>';
      try{
        const t = await cloudCall('aiTest', { slug: TENANT_ID, provider: 'openrouter', model: toTry[i].id });
        if(t && t.ok){ working.push(toTry[i]); }
      }catch(e){ /* modelo no disponible → se omite */ }
    }
    const finalList = working.length ? working : filtered.slice(0, 5);
    sel.innerHTML = finalList.map(m =>
      '<option value="'+esc(m.id)+'">'+esc(m.name||m.id)+(m.price ? ' · $' + m.price.toFixed(6) + '/token salida' : '')+'</option>'
    ).join('');
    if(previous && finalList.some(m=>m.id===previous)){
      sel.value = previous;
    } else if(kind==='image'){
      const def = finalList.find(m => m.id === 'google/gemini-3.1-flash-lite-image') || finalList[0];
      if(def) sel.value = def.id;
    }
    toast('Modelos operativos: ' + finalList.length + (working.length ? '' : ' (se usaron los primeros disponibles)'), 'ok');
  }catch(err){
    console.error(err);
    sel.innerHTML = '<option value="">Error al cargar — probá de nuevo</option>';
    toast('No se pudieron cargar los modelos: ' + (err.message||'error'), 'err');
  }
}
/* ---------- selector de negocios (accesos rápidos a otras tiendas) ---------- */
const BIZ_COLORS = ['#2E9E5B','#D97706','#2563EB','#DB2777','#7C3AED','#0D9488','#DC2626','#4B5563'];
function bizColor(seed){
  let h = 0;
  for(let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) >>> 0;
  return BIZ_COLORS[h % BIZ_COLORS.length];
}
function normalizeUrl(u){
  u = (u||'').trim();
  if(!u) return '';
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function renderBizList(){
  const list = document.getElementById('bizList');
  if(!list) return;
  const biz = settings.otherBusinesses || [];
  if(!biz.length){ list.innerHTML = '<div class="biz-empty">Todavía no agregaste otros negocios.</div>'; return; }
  list.innerHTML = biz.map(b =>
    '<div class="biz-row">' +
      '<button type="button" class="biz-item" onclick="openBusiness(\'' + esc(b.url) + '\')">' +
        '<span class="biz-avatar" style="background:' + bizColor(b.name||'?') + '">' + esc((b.name||'?').trim().charAt(0).toUpperCase()) + '</span>' +
        '<div class="biz-t"><b>' + esc(b.name) + '</b><span>Otro negocio</span></div>' +
      '</button>' +
      '<button type="button" class="biz-del" title="Quitar" onclick="removeBusiness(\'' + b.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    '</div>'
  ).join('');
}
let platformTenantsCache = null;
async function loadPlatformBizList(){
  const box = document.getElementById('platformBizList');
  if(!box) return;
  if(platformTenantsCache){ renderPlatformBizList(platformTenantsCache); return; }
  try{
    const q = await db.collection('tenants').where('activo','==', true).get();
    platformTenantsCache = q.docs.filter(d => d.id !== TENANT_ID).map(d => Object.assign({id:d.id}, d.data()));
    renderPlatformBizList(platformTenantsCache);
  }catch(e){
    console.error(e);
    box.innerHTML = '<div class="biz-empty">No se pudieron cargar.</div>';
  }
}
function renderPlatformBizList(list){
  const box = document.getElementById('platformBizList');
  if(!box) return;
  if(!list.length){ box.innerHTML = '<div class="biz-empty">No hay más tiendas activas todavía.</div>'; return; }
  box.innerHTML = list.map(t => {
    const nombre = esc(t.nombre || t.id);
    const avatar = t.logoUrl
      ? '<img src="' + esc(t.logoUrl) + '" alt="' + nombre + '" loading="lazy" decoding="async">'
      : nombre.charAt(0).toUpperCase();
    return '<button type="button" class="biz-item" onclick="goToTenant(\'' + t.id.replace(/'/g,"") + '\')">' +
      '<span class="biz-avatar" style="background:' + bizColor(nombre) + '">' + avatar + '</span>' +
      '<div class="biz-t"><b>' + nombre + '</b><span>Cambiar a esta tienda</span></div>' +
    '</button>';
  }).join('');
}
function toggleBizSwitcher(ev){
  if(ev) ev.stopPropagation();
  const sw = document.getElementById('bizSwitcher');
  const btn = document.getElementById('bizSwitcherBtn');
  const open = !sw.classList.contains('open');
  sw.classList.toggle('open', open);
  btn.classList.toggle('open', open);
  if(open) loadPlatformBizList();
  if(!open) toggleBizAddForm(false);
}
document.addEventListener('input', function(ev){
  if(ev.target && ev.target.closest && ev.target.closest('#panel-settings')) markSettingsFormDirty();
});
document.addEventListener('change', function(ev){
  if(ev.target && ev.target.closest && ev.target.closest('#panel-settings')) markSettingsFormDirty();
});
document.addEventListener('click', function(ev){
  const sw = document.getElementById('bizSwitcher');
  const btn = document.getElementById('bizSwitcherBtn');
  if(!sw || !sw.classList.contains('open')) return;
  if(sw.contains(ev.target) || (btn && btn.contains(ev.target))) return;
  sw.classList.remove('open');
  if(btn) btn.classList.remove('open');
  toggleBizAddForm(false);
});
function toggleBizAddForm(show){
  document.getElementById('bizAddForm').classList.toggle('open', show);
  document.getElementById('bizAddBtn').style.display = show ? 'none' : 'flex';
  if(show){
    document.getElementById('bizNewName').value = '';
    document.getElementById('bizNewUrl').value = '';
    document.getElementById('bizNewName').focus();
  }
}
function openBusiness(url){ if(url) window.open(url, '_blank', 'noopener'); }
async function saveNewBusiness(){
  const name = document.getElementById('bizNewName').value.trim();
  const url = normalizeUrl(document.getElementById('bizNewUrl').value);
  if(!name){ toast('Ingresá el nombre del negocio', 'err'); return; }
  if(!url){ toast('Ingresá el enlace del negocio', 'err'); return; }
  const list = (settings.otherBusinesses || []).concat([{ id: rid(), name, url }]);
  try{
    await saveSettingsToDB({ otherBusinesses: list });
    toggleBizAddForm(false);
    toast('Negocio agregado', 'ok');
  }catch(e){
    toast('No se pudo agregar el negocio', 'err');
    console.error(e);
  }
}
async function removeBusiness(id){
  const list = (settings.otherBusinesses || []).filter(b => b.id !== id);
  try{
    await saveSettingsToDB({ otherBusinesses: list });
  }catch(e){
    toast('No se pudo quitar el negocio', 'err');
    console.error(e);
  }
}

/* ---------- íconos SVG de productos ---------- */
function svgIcon(type, size){
  const s = size||72;
  const paths = {
    leaf:'<path d="M12 2C7.5 6.5 4 11 4 15a8 8 0 0 0 16 0c0-4-3.5-8.5-8-13z" fill="#fff" opacity=".95"/><path d="M12 6v13M12 11l3.5-3M12 14l-3.5-3" stroke="#1B7A43" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
    plant:'<path d="M7 13h10l-1.5 8a1.5 1.5 0 0 1-1.5 1h-4A1.5 1.5 0 0 1 8.5 21L7 13z" fill="#fff" opacity=".95"/><path d="M12 13V7m0 0c-2.5 0-4-1.8-4-4 2.5 0 4 1.5 4 4zm0 0c2.5 0 4-1.8 4-4-2.5 0-4 1.5-4 4z" fill="#fff" opacity=".8"/>',
    cactus:'<path d="M10 22V8a2 2 0 0 1 4 0v14h-4z" fill="#fff" opacity=".95"/><path d="M10 12H7.5A1.5 1.5 0 0 1 6 10.5V8m8 6h2.5A1.5 1.5 0 0 0 18 12.5v-3" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    flower:'<circle cx="12" cy="12" r="3" fill="#FFD100"/><g fill="#fff" opacity=".95"><ellipse cx="12" cy="6" rx="2.4" ry="3.4"/><ellipse cx="12" cy="18" rx="2.4" ry="3.4"/><ellipse cx="6" cy="12" rx="3.4" ry="2.4"/><ellipse cx="18" cy="12" rx="3.4" ry="2.4"/></g>',
    citrus:'<circle cx="12" cy="13" r="8" fill="#fff" opacity=".95"/><path d="M12 5c0-1.5 1-2.5 2.5-2.5C14.5 4 13.5 5 12 5z" fill="#1B7A43"/><circle cx="9.5" cy="12" r="1" fill="#F5C518"/><circle cx="13" cy="15" r="1" fill="#F5C518"/><circle cx="14" cy="11" r="1" fill="#F5C518"/>',
    seedling:'<path d="M12 21v-8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M12 13C12 9 9 6.5 5 6.5c0 4 3 6.5 7 6.5zm0-2c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5z" fill="#fff" opacity=".95"/>',
    palm:'<path d="M12 22c0-6 .5-10 1.5-13" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M13.5 9C10 7 6.5 7.5 4 10c2.8.6 5.6.3 8-.5m2-.5c2-2.8 5.5-3.5 8-2-2 2.2-5 3-8 1.5zm.3 3.2c3-.8 5.8.2 7.2 2.3-2.7 1-5.5.3-7.2-2.3zm-1.6-.6C8 10 5 11 3.4 13.4c2.6.9 5.4-.1 6.8-2.8z" fill="#fff" opacity=".95"/>',
    bottle:'<path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3V2z" fill="#fff" opacity=".95"/><rect x="9.3" y="12" width="5.4" height="5" rx="1" fill="#1B7A43" opacity=".85"/>',
    spray:'<path d="M9 8h6v3l1.5 2v7a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-7L9 11V8z" fill="#fff" opacity=".95"/><path d="M9 8V6h4V3h2v3h2v2M18 5l3-2m-2.5 5H21" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    shears:'<path d="M6 4l14 9M20 4 6 13" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="5" cy="17" r="2.6" fill="none" stroke="#fff" stroke-width="2"/><circle cx="19" cy="17" r="2.6" fill="none" stroke="#fff" stroke-width="2"/>',
    brush:'<path d="M4 20c2.5 0 4-1.5 4-4l8.5-8.5a2.1 2.1 0 0 1 3 3L11 19c-2.5 0-4 1.5-7 1z" fill="#fff" opacity=".95"/>',
    camera:'<rect x="3" y="7" width="18" height="12" rx="2.5" fill="#fff" opacity=".95"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="#1B7A43" stroke-width="1.8"/><path d="M8 7l1.5-2.5h5L16 7" fill="#fff"/>',
    drops:'<path d="M8 3C6 6 4 8.5 4 11a4 4 0 0 0 8 0c0-2.5-2-5-4-8zm9 4c-1.5 2.2-3 4-3 6a3 3 0 0 0 6 0c0-2-1.5-3.8-3-6zM8 14c-1.5 2.2-3 4-3 6a3 3 0 0 0 6 0c0-2-1.5-3.8-3-6z" fill="#fff" opacity=".95"/>',
    jar:'<path d="M8 4h8v2a6 6 0 0 1 2 4.5V18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-7.5A6 6 0 0 1 8 6V4z" fill="#fff" opacity=".9"/><path d="M12 17v-4m0 0c-1.8 0-2.8-1.2-2.8-2.8C11 10.4 12 11.5 12 13zm0 0c1.8 0 2.8-1.2 2.8-2.8C13 10.4 12 11.5 12 13z" stroke="#1B7A43" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
  };
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none">'+(paths[type]||paths.leaf)+'</svg>';
}
const logoSVG = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22v-8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M12 14c0-4.5-3.5-7.5-8-7.5 0 4.5 3.5 7.5 8 7.5zm0-3c0-4.5 3.5-7.5 8-7.5 0 4.5-3.5 7.5-8 7.5z" fill="#fff"/></svg>';

/* ---------- render tienda ---------- */
let activeCat = 'Todos';

function checkBasePath(){ // utilidad mínima
  var p = location.pathname.replace(/\/index\.html$/, '/');
  return p;
}
/* Lleva SIEMPRE al landing principal (selector de negocios). Usa ?tienda=
   (parámetro presente, aunque vacío) para que el boot muestre el selector y
   nunca abra el panel del superadministrador, sin importar la sesión. */
function goToLandingRoot(){
  location.href = location.origin + checkBasePath() + '?tienda=';
}

/* ================= COTIZADOR DE MENSAJERÍA UBER FLASH =================
   El cliente marca punto A (origen) y punto B (destino) en un mapa moderno
   (Leaflet + OpenStreetMap, sin necesidad de API key). Se calcula la ruta
   real (OSRM) y un estimado simbólico del costo de Uber Flash tarifado por
   km + tarifa base. Botón final para ir a la app de Uber a realizar el viaje.
   Disponible SOLO si la tienda lo tiene activado (superadmin) y plan >=
   Profesional. */
let _uberMap = null, _uberMode = 'A', _uberA = null, _uberB = null, _uberMarkers = {}, _uberRoute = null, _uberLeafCssOk = false, _uberOrigin = null;
const UBER_TARIFF_DEFAULT = { base: 250, perKm: 350, perMin: 5 }; // colones aprox.
let _uberTariff = UBER_TARIFF_DEFAULT;
/* Ubicación fija del negocio (origen), definida por el administrador de la
   tienda (settings.uberLocation). Por compatibilidad, si no existe, se usa
   la que pudo configurar el superadmin (platform/config.uberLocations[slug]). */
function uberOrigin(){
  /* 1) Ubicación que ingresó el propio administrador de la tienda */
  if(settings && settings.uberLocation && settings.uberLocation.lat && settings.uberLocation.lng){
    return {
      lat: settings.uberLocation.lat,
      lng: settings.uberLocation.lng,
      label: settings.uberLocation.address || (settings.storeName || 'Negocio'),
      address: settings.uberLocation.address || ''
    };
  }
  /* 2) Fallback: dirección del negocio en settings (solo address, sin coords) */
  if(settings && settings.address){
    return { lat: '', lng: '', address: settings.address, label: settings.address };
  }
  /* 3) Compatibilidad: ubicación configurada por el superadmin */
  const cfg = planConfig || DEFAULT_PLAN_CONFIG;
  if(cfg && cfg.uberLocations && cfg.uberLocations[TENANT_ID]){
    const o = cfg.uberLocations[TENANT_ID];
    if(o.lat && o.lng) return { lat: o.lat, lng: o.lng, label: o.address || settings && settings.storeName, address: o.address || '' };
  }
  return null;
}
function uberIsEnabled(){
  const cfg = planConfig || (window.__planConfigLoaded ? planConfig : DEFAULT_PLAN_CONFIG);
  const allowed = (cfg && cfg.uberQuoteAllowed) || [];
  if(!allowed.length) return false;
  if(allowed.indexOf(TENANT_ID || '') === -1) return false;
  const plan = getActivePlanId();
  const rank = PLAN_RANK[plan] || 1;
  if(rank < (PLAN_RANK['profesional'] || 2)) return false;
  /* Cargar tarifas si el superadmin las cambió */
  if(cfg && cfg.uberTariff) _uberTariff = cfg.uberTariff;
  return true;
}
function ubQuery(){ /* mapa Leaflet (lazy) */ }
function loadLeaflet(cb){
  if(typeof L !== 'undefined'){ cb(); return; }
  if(!_uberLeafCssOk){
    _uberLeafCssOk = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
  }
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload = cb;
  document.head.appendChild(s);
}
function openUberQuote(){
  const m = document.getElementById('uberQuoteModal');
  if(!m) return;
  if(!uberIsEnabled()){ toast('Este negocio no tiene activado el cotizador de mensajería.', 'err'); return; }
  m.classList.add('show');
  /* Mostrar nombre del negocio en el botón de compartir y en el origen */
  const name = settings && settings.storeName ? settings.storeName : 'el negocio';
  const shareBtn = document.getElementById('uberShareBtn');
  if(shareBtn) shareBtn.innerHTML = '📍 Compartir ubicación de <b>' + esc(name) + '</b>';
  const bizName = document.getElementById('uberBizName');
  if(bizName) bizName.textContent = name;
  loadLeaflet(function(){
    try{
      if(!_uberMap){
        _uberMap = L.map('uberMap').setView(['9.944', '-84.111'], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(_uberMap);
        _uberMap.on('click', function(e){ uberSetPoint(e.latlng.lat, e.latlng.lng); });
      } else {
        _uberMap.invalidateSize();
      }
      /* Ubicación fija del negocio (origen) */
      const o = uberOrigin();
      if(o && o.lat && o.lng){
        _uberOrigin = { lat: parseFloat(o.lat), lng: parseFloat(o.lng), label: o.label || 'Punto de recogida' };
        _uberA = _uberOrigin;
        _uberMarkers['A'] = L.circleMarker([_uberA.lat, _uberA.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#1B7A43', fillOpacity: 1 }).addTo(_uberMap);
        L.marker([_uberA.lat, _uberA.lng]).addTo(_uberMap).bindPopup('<b>' + esc(settings && settings.storeName ? settings.storeName : 'Negocio') + '</b><br>' + esc(o.label || 'Punto de recogida')).openPopup();
        _uberMap.setView([_uberA.lat, _uberA.lng], 14);
        const oi = document.getElementById('uberOriginInfo');
        if(oi) oi.textContent = '📍 Origen: ' + (o.label || (settings && settings.storeName ? settings.storeName : 'Negocio'));
      } else if(o && o.address){
        /* Solo hay dirección: geocodificarla automáticamente */
        const oi = document.getElementById('uberOriginInfo');
        if(oi) oi.textContent = '📍 Origen: ' + o.address + ' (buscando coordenadas…)';
        fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(o.address))
          .then(function(r){ return r.json(); })
          .then(function(data){
            if(data && data[0]){
              _uberOrigin = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: o.address };
              _uberA = _uberOrigin;
              _uberMarkers['A'] = L.circleMarker([_uberA.lat, _uberA.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#1B7A43', fillOpacity: 1 }).addTo(_uberMap);
              L.marker([_uberA.lat, _uberA.lng]).addTo(_uberMap).bindPopup('<b>' + esc(settings && settings.storeName ? settings.storeName : 'Negocio') + '</b><br>' + esc(o.address)).openPopup();
              _uberMap.setView([_uberA.lat, _uberA.lng], 14);
            } else {
              if(oi) oi.textContent = '📍 Origen: ' + o.address + ' (no se encontraron coordenadas)';
            }
          }).catch(function(){});
      } else {
        const oi = document.getElementById('uberOriginInfo');
        if(oi) oi.textContent = '📍 Origen: (el negocio aún no configuró su ubicación)';
      }
    }catch(e){ console.error(e); toast('No se pudo cargar el mapa', 'err'); }
  });
  uberClear();
}
function closeUberQuote(){
  const m = document.getElementById('uberQuoteModal');
  if(m) m.classList.remove('show');
}
function uberSetPoint(lat, lng){
  /* El destino siempre es el punto que marca el cliente (GPS o clic) */
  const key = 'B';
  if(_uberMarkers[key]) _uberMap.removeLayer(_uberMarkers[key]);
  _uberMarkers[key] = L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#DC2626', fillOpacity: 1 }).addTo(_uberMap);
  _uberB = { lat, lng };
  uberComputeRoute();
}
function uberUseMyLocation(){
  if(!navigator.geolocation){ toast('Tu navegador no soporta geolocalización', 'err'); return; }
  toast('Obteniendo tu ubicación…', 'ok');
  navigator.geolocation.getCurrentPosition(function(pos){
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    _uberMap.setView([lat, lng], 15);
    uberSetPoint(lat, lng);
    toast('Ubicación fijada como destino ✓', 'ok');
  }, function(err){
    console.error(err);
    toast('No se pudo obtener tu ubicación: ' + (err.message || 'error'), 'err');
  }, { enableHighAccuracy: true, timeout: 10000 });
}
function shareBusinessLocation(){
  const o = _uberOrigin;
  const name = settings && settings.storeName ? settings.storeName : 'el negocio';
  const uberAddr = (settings && settings.uberLocation && settings.uberLocation.address) || (settings && settings.address) || '';
  if(o && o.lat && o.lng && !isNaN(o.lat) && !isNaN(o.lng)){
    const label = 'Ubicación de ' + name;
    window.open('https://www.google.com/maps?q=' + o.lat + ',' + o.lng + '(' + encodeURIComponent(label) + ')', '_blank', 'noopener');
    toast('Ubicación de ' + name + ' lista para compartir ✓', 'ok');
  } else if(uberAddr){
    window.open('https://www.google.com/maps/search/' + encodeURIComponent(uberAddr), '_blank', 'noopener');
    toast('Abriendo mapa con la dirección del negocio', 'ok');
  } else {
    toast('El negocio no configuró su ubicación', 'err');
  }
}
function uberClear(){
  _uberB = null; _uberRoute = null;
  if(_uberMap){
    if(_uberMarkers.B) _uberMap.removeLayer(_uberMarkers.B);
    _uberMarkers.B = null;
    /* restaurar el marcador de origen si existe */
    const o = uberOrigin();
    if(o && !_uberMarkers.A){
      _uberA = { lat: parseFloat(o.lat), lng: parseFloat(o.lng) };
      _uberMarkers.A = L.circleMarker([_uberA.lat, _uberA.lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#1B7A43', fillOpacity: 1 }).addTo(_uberMap);
    }
  }
  ['uberDist','uberTime','uberPrice'].forEach(function(id){ const el=document.getElementById(id); if(el) el.textContent='—'; });
  const g = document.getElementById('uberGoBtn'); if(g) g.disabled = true;
}
/* Perfiles de demanda (multiplicador sobre la tarifa base) */
async function uberComputeRoute(){
  if(!_uberA || !_uberB){ return; }
  try{
    const r = await fetch('https://router.project-osrm.org/route/v1/driving/' + _uberA.lng + ',' + _uberA.lat + ';' + _uberB.lng + ',' + _uberB.lat + '?overview=full&geometries=geojson');
    const j = await r.json();
    if(j && j.routes && j.routes[0]){
      _uberRoute = j.routes[0];
      const distKm = (_uberRoute.distance / 1000);
      const mins = Math.round(_uberRoute.duration / 60);
      /* Estimado simbólico Uber Flash: base + por km + por minuto */
      const est = _uberTariff.base + distKm * _uberTariff.perKm + mins * _uberTariff.perMin;
      document.getElementById('uberDist').textContent = distKm.toFixed(1) + ' km';
      document.getElementById('uberTime').textContent = mins + ' min';
      document.getElementById('uberPrice').textContent = fmt(Math.round(est));
      const g = document.getElementById('uberGoBtn');
      if(g) g.disabled = false;
      /* dibujar la ruta en el mapa */
      const geo = _uberRoute.geometry;
      if(geo && geo.coordinates){
        if(_uberRoute._line) _uberMap.removeLayer(_uberRoute._line);
        _uberRoute._line = L.polyline(geo.coordinates.map(function(c){ return [c[1], c[0]]; }), { color: '#7C3AED', weight: 5, opacity: .8 }).addTo(_uberMap);
        _uberMap.fitBounds(_uberRoute._line.getBounds(), { padding: [30,30] });
      }
    } else {
      throw new Error('Sin ruta');
    }
  }catch(e){
    document.getElementById('uberDist').textContent = '—';
    document.getElementById('uberPrice').textContent = '—';
    toast('No se pudo calcular la ruta', 'err');
  }
}
function goUberRide(){
  if(!_uberA || !_uberB){ toast('Fijá tu ubicación o destino en el mapa', 'err'); return; }
  /* Deep link a UBER: pickup = negocio (origen), dropoff = cliente (destino) */
  const url = 'https://m.uber.com/launch?action=ride&pickup[latitude]=' + _uberA.lat + '&pickup[longitude]=' + _uberA.lng + '&dropoff[latitude]=' + _uberB.lat + '&dropoff[longitude]=' + _uberB.lng + '&pickup[formatted_address]=' + encodeURIComponent(settings && settings.storeName ? settings.storeName : 'Negocio') + '&dropoff[formatted_address]=Mi ubicación';
  window.open(url, '_blank', 'noopener');
}
/* Mostrar/ocultar el botón flotante del cotizador según plan y activación */
async function refreshUberFloat(){
  const b = document.getElementById('uberFloat');
  if(!b) return;
  try{ if(!planConfig && typeof loadPlanConfig === 'function') await loadPlanConfig(); }
  catch(e){}
  const activo = uberIsEnabled();
  b.style.display = activo ? 'flex' : 'none';
}
function renderHeader(){
  document.getElementById('brandName').textContent = settings.storeName;
  const logoHTML = settings.logoUrl ? '<img src="' + esc(settings.logoUrl) + '" alt="Logo">' : logoSVG;
  document.getElementById('brandLogo').innerHTML = logoHTML;
  document.getElementById('admLogo').innerHTML = logoHTML;
  document.getElementById('admStoreName').textContent = settings.storeName;
  document.getElementById('bizCurrentAvatar').innerHTML = logoHTML;
  document.getElementById('bizCurrentName').textContent = settings.storeName;
  renderBizList();
  document.getElementById('footName').textContent = settings.storeName;
  document.getElementById('footTag').textContent = settings.tagline;
  document.title = settings.storeName + ' — Tienda en línea';
  document.getElementById('waFloat').href = 'https://wa.me/' + waDigits(settings.whatsapp) + '?text=' + encodeURIComponent('Hola ' + settings.storeName + ', tengo una consulta sobre un producto.');
  document.getElementById('infoBar').innerHTML =
    '<span class="item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span class="dot-open">Abierto</span> · ' + esc(settings.hours) + '</span>' +
    '<span class="item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>' + esc(settings.shipping) + '</span>';
  document.getElementById('shipHint').textContent = settings.shipping;
  refreshUberFloat();
  if(typeof refreshCheckoutCardBtn === 'function') refreshCheckoutCardBtn();
}
function renderChips(){
  const cats = ['Todos'].concat(settings.categories);
  /* Si la categoría activa ya no existe (por ejemplo, el admin la renombró
     o la borró en Configuraciones), volvemos a "Todos" automáticamente.
     Si no se hiciera esto, el filtro seguiría buscando una categoría que
     ya no coincide con ningún producto y la grilla se quedaría vacía sin
     que el cliente entienda por qué, hasta que recargue la página. */
  if(!cats.includes(activeCat)) activeCat = 'Todos';
  document.getElementById('catChips').innerHTML = cats.map(c =>
    '<button class="chip' + (c===activeCat?' active':'') + '" onclick="setCat(\'' + esc(c) + '\')">' + (c==='Todos'?'Ver todos':esc(c)) + '</button>'
  ).join('');
}
function setCat(c){ activeCat = c; renderChips(); renderGrid(); }

function renderExternalLinks(){
  const bar = document.getElementById('externalLinksBar');
  const btns = [];
  if(settings.websiteUrl) btns.push('<a class="ext-btn web" href="' + esc(settings.websiteUrl) + '" target="_blank" rel="noopener">' + (settings.websiteIcon ? '<img class="ext-icon" src="' + esc(settings.websiteIcon) + '" alt="">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>') + esc(settings.websiteLabel || 'Sitio web') + '<span class="ext-badge">Visitar</span></a>');
  if(settings.bingoUrl && planAllows('games-link')) btns.push('<a class="ext-btn games blink" href="' + esc(settings.bingoUrl) + '" target="_blank" rel="noopener">' + (settings.bingoIcon ? '<img class="ext-icon" src="' + esc(settings.bingoIcon) + '" alt="">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>') + esc(settings.bingoLabel || 'Bingo de Plantas') + '<span class="ext-badge">Jugar</span></a>');
  bar.innerHTML = btns.join('');
}

/* el cliente NUNCA ve la cantidad exacta en inventario, solo disponibilidad */
function activeVariants(p){ return (p.variants||[]).filter(v=>!v.removed); }
/* estados manuales que el administrador puede asignar desde la columna
   "Estado" del inventario, para clasificar el producto de un vistazo */
const PROD_STATUS = {
  disponible:{lbl:'Disponible'},
  descuento:{lbl:'Descuento'},
  agotado:{lbl:'Agotado'}
};
function stockInfo(p){
  /* disponibilidad real según el stock cargado (nunca deja comprar algo sin stock) */
  let real;
  if(p.hasVariants){
    const av = activeVariants(p);
    const total = av.reduce((s,v)=>s+(v.stock||0),0);
    real = (!av.length || total <= 0) ? {ok:false, low:false} : {ok:true, low:(total<=3 || av.every(v=>v.stock<=3))};
  } else if(p.unlimited){
    real = {ok:true, low:false};
  } else {
    real = {ok:(p.stock||0) > 0, low:(p.stock||0) > 0 && p.stock <= 3};
  }
  const manual = p.status || 'disponible';
  if(manual === 'agotado' || !real.ok) return {label:'Agotado', cls:'out', can:false, status:'agotado'};
  if(manual === 'descuento') return {label:'Descuento', cls:'discount', can:true, status:'descuento'};
  if(real.low) return {label:'Pocas unidades', cls:'low', can:true, status:'disponible'};
  return {label:'Disponible', cls:'ok', can:true, status:'disponible'};
}
/* precio a mostrar en tarjeta/detalle: si tiene variantes con precios distintos, se muestra "Desde ¢X" */
function displayPrice(p){
  if(p.hasVariants){
    const av = activeVariants(p);
    if(!av.length) return fmt(0);
    const min = Math.min(...av.map(v=>v.price));
    const max = Math.max(...av.map(v=>v.price));
    return min===max ? fmt(min) : ('Desde ' + fmt(min));
  }
  return fmt(p.price);
}

function firstImage(p){
  return (p.images && p.images.length) ? p.images[0] : null;
}
/* Miniatura liviana para listados (grilla, tabla admin, chat IA, "completá tu
   pedido"): si el producto ya tiene "thumbs" (generadas automáticamente al
   guardar, ver saveProduct) se usa esa versión chica, que pesa mucho menos
   que la foto completa y hace que el catálogo cargue más rápido. Productos
   viejos que aún no se han vuelto a guardar no tienen "thumbs" todavía, así
   que caen de vuelta a la foto completa (nada se rompe). */
function firstThumb(p){
  if(p.thumbs && p.thumbs.length && p.thumbs[0]) return p.thumbs[0];
  return firstImage(p);
}

/* ---------- oferta / urgencia / reseñas (estilo Temu) ---------- */
function dealInfo(p){
  const compareAt = p.compareAtPrice || 0;
  const base = p.hasVariants ? Math.min(...(activeVariants(p).map(v=>v.price).concat([p.price||0]))) : (p.price||0);
  const active = compareAt > base && (p.dealEndsAt||0) > Date.now();
  if(!active) return { active:false };
  const pct = Math.round((1 - base/compareAt) * 100);
  return { active:true, compareAt, base, pct, endsAt:p.dealEndsAt, remainMs: p.dealEndsAt - Date.now() };
}
function fmtCountdown(ms){
  if(ms<=0) return {h:'00',m:'00',s:'00'};
  const totalSec = Math.floor(ms/1000);
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  const pad = n => String(n).padStart(2,'0');
  return { h: pad(Math.min(h,99)), m: pad(m), s: pad(s) };
}
function reviewStats(p){
  const revs = p.reviews || [];
  if(!revs.length) return { count:0, avg:0 };
  const avg = revs.reduce((s,r)=>s+(r.rating||0),0) / revs.length;
  return { count: revs.length, avg: Math.round(avg*10)/10 };
}
function starsHTML(rating, size){
  const s = size||13;
  let out = '';
  for(let i=1;i<=5;i++){
    const filled = rating >= i - 0.25;
    out += '<svg viewBox="0 0 24 24" fill="' + (filled?'#F5A623':'#E5E7EB') + '" width="' + s + '" height="' + s + '"><path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1z"/></svg>';
  }
  return out;
}
function stockUnitsLeft(p){
  if(p.unlimited) return Infinity;
  if(p.hasVariants) return activeVariants(p).reduce((s,v)=>s+(v.stock||0),0);
  return p.stock||0;
}
/* Actualiza en vivo los contadores de oferta (tarjetas de la grilla + barra del detalle) */
function tickDealTimers(){
  document.querySelectorAll('[data-timer]').forEach(el => {
    const p = products.find(x=>x.id===el.dataset.timer);
    if(!p) return;
    const deal = dealInfo(p);
    if(!deal.active){ el.querySelector('span').textContent = 'Oferta finalizada'; return; }
    const t = fmtCountdown(deal.endsAt - Date.now());
    el.querySelector('span').textContent = 'Termina en ' + t.h + ':' + t.m + ':' + t.s;
  });
  const bar = document.getElementById('pvDealTimer');
  if(bar && pvCurrentId){
    const p = products.find(x=>x.id===pvCurrentId);
    if(p){
      const deal = dealInfo(p);
      if(deal.active){
        const t = fmtCountdown(deal.endsAt - Date.now());
        bar.innerHTML = '<span>' + t.h + '</span>:<span>' + t.m + '</span>:<span>' + t.s + '</span>';
      }
    }
  }
}
setInterval(tickDealTimers, 1000);

function renderGrid(){
  const grid = document.getElementById('productGrid');
  try{
    const q = (document.getElementById('searchInput').value||'').toLowerCase().trim();
    const sort = document.getElementById('sortSelect').value;
    let list = products.filter(p => p.active !== false);
    if(activeCat !== 'Todos') list = list.filter(p => p.cat === activeCat);
    if(q) list = list.filter(p => ((p.name||'') + ' ' + (p.desc||'')).toLowerCase().includes(q));
    /* Ordenar de forma defensiva: un solo producto con datos incompletos
       (precio o nombre faltante) no debe romper la comparación y vaciar
       toda la grilla; en ese caso simplemente se deja sin ordenar. */
    if(sort==='asc') list.sort((a,b)=>(a.price||0)-(b.price||0));
    else if(sort==='desc') list.sort((a,b)=>(b.price||0)-(a.price||0));
    else if(sort==='name') list.sort((a,b)=>(a.name||'').localeCompare(b.name||'','es'));

    if(!list.length){
      grid.innerHTML = '<div class="empty-msg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><br>No encontramos productos con ese criterio.</div>';
      return;
    }
    grid.innerHTML = list.map(p => {
      const st = stockInfo(p);
      const g = gradFor(p.id);
      const img = firstThumb(p);
      const media = img ?
        '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async" fetchpriority="low" draggable="false" style="width:100%;height:100%;object-fit:cover">' :
        svgIcon(p.icon);
      const deal = dealInfo(p);
      const rs = reviewStats(p);
      const badges = [];
      if(deal.active) badges.push('<span class="p-discount-badge">-' + deal.pct + '%</span>');
      if(p.soldCount) badges.push('<span class="p-sold-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1 3-4 5-4 9a4 4 0 0 0 8 0c0-1-.3-2-.8-2.8.5 2-1 3-1 3 .5-2.5-1-4-2.2-5.7C11.5 4.5 12 2 12 2z"/></svg>' + p.soldCount + ' vendidos</span>');
      const priceHTML = deal.active ?
        '<span class="p-price-row"><span class="p-price" style="color:#E8351D">' + fmt(deal.base) + '</span><span class="p-price-was">' + fmt(deal.compareAt) + '</span></span>' :
        '<span class="p-price">' + displayPrice(p) + '</span>';
      const timerHTML = deal.active ? '<div class="mini-timer" data-timer="' + p.id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>Termina en --:--:--</span></div>' : '';
      const ratingHTML = rs.count ? '<div class="p-rating-row"><span class="stars">' + starsHTML(rs.avg,11) + '</span>' + rs.avg + ' (' + rs.count + ')</div>' : '';
      const liked = isLiked(p.id);
      const adminEditBtn = isAdminSession ?
        '<button class="card-edit-btn" data-edit="' + esc(p.id) + '" title="Editar producto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>' : '';
      return '<div class="p-card" data-id="' + esc(p.id) + '">' +
        '<div class="p-img" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' +
          media +
          adminEditBtn +
          '<button class="card-like-btn' + (liked?' on':'') + '" data-like="' + esc(p.id) + '" title="Me gusta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button>' +
          '<span class="p-stock ' + st.cls + '">' + st.label + '</span>' +
          (badges.length ? '<div class="p-badges">' + badges.join('') + '</div>' : '') +
        '</div>' +
        '<div class="p-body">' +
          '<div class="p-name">' + esc(p.name) + '</div>' +
          ratingHTML +
          '<div class="p-desc">' + esc(p.desc||'') + '</div>' +
          timerHTML +
          '<div class="p-foot">' + priceHTML +
          '<button class="add-btn" ' + (st.can?'':'disabled') + ' data-add="' + esc(p.id) + '" data-variants="' + (p.hasVariants?'1':'0') + '" title="' + (p.hasVariants?'Elegir opción':'Agregar al carrito') + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></button>' +
          '</div>' +
          (isProfessionalStore ?
            '<button class="prof-item-wa-btn" data-prof-wa="' + esc(p.id) + '">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm4.6 12.1c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.2-.8l.4-.5c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.1 2.2-.2 3.9a11.6 11.6 0 0 0 4.5 4.2c1.7.8 2.4.9 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.1-.5-.2z"/></svg>' +
              'Contactar por WhatsApp</button>' : '') +
        '</div></div>';
    }).join('');
    tickDealTimers();
  }catch(e){
    /* Si algo falla al pintar la grilla, lo dejamos registrado en la
       consola en vez de dejar la pantalla en blanco sin explicación. */
    console.error('renderGrid error:', e);
  }
}
/* Delegación de clics: un único listener fijo en el contenedor de la grilla
   en vez de "onclick" individuales por tarjeta. Así, aunque la grilla se
   vuelva a pintar en el momento exacto en que el cliente toca un producto
   (por una actualización en vivo de Firestore), el clic sigue funcionando
   porque el listener vive en el contenedor, no en la tarjeta que pudo haber
   sido reemplazada. */
document.getElementById('productGrid').addEventListener('click', function(e){
  try{
    const likeBtn = e.target.closest('[data-like]');
    if(likeBtn){
      e.stopPropagation();
      toggleLike(likeBtn.dataset.like);
      return;
    }
    const editBtn = e.target.closest('[data-edit]');
    if(editBtn){
      e.stopPropagation();
      if(isAdminSession) openProductModal(editBtn.dataset.edit);
      return;
    }
    const profWaBtn = e.target.closest('[data-prof-wa]');
    if(profWaBtn){
      e.stopPropagation();
      profItemContactWA(profWaBtn.dataset.profWa);
      return;
    }
    const addBtn = e.target.closest('[data-add]');
    if(addBtn){
      e.stopPropagation();
      const id = addBtn.dataset.add;
      if(addBtn.dataset.variants === '1') openProductView(id);
      else addToCart(id);
      return;
    }
    const card = e.target.closest('.p-card');
    if(card) openProductView(card.dataset.id);
  }catch(e){
    console.error('product click error:', e);
  }
});

/* ---------- vista detalle de producto (galería + video + variantes + cantidad) ---------- */
let pvCurrentId = null;
let pvSelectedVariantId = null;
let pvQty = 1;
let pvBaseMedia = [];
function openProductView(id, preselectVi){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  pvCurrentId = id;
  pvSelectedVariantId = null;
  pvQty = 1;
  if(preselectVi && (p.variants||[]).some(x=>x.id===preselectVi && !x.removed)) pvSelectedVariantId = preselectVi;
  document.getElementById('pvQty').textContent = 1;
  document.getElementById('pvName').textContent = p.name;
  document.getElementById('pvDesc').innerHTML = descParagraphs(p.desc);
  document.getElementById('pvShipTxt').textContent = settings.shipping || 'Envío disponible';
  renderPvMeta(p);
  const media = [];
  (p.images||[]).forEach((url, i) => media.push({type:'image', url, thumb: (p.thumbs && p.thumbs[i]) || ''}));
  if(p.videoUrl) media.push({type:'video', url:p.videoUrl});
  const ytEmbed = youtubeEmbedUrl(p.videoLink);
  if(ytEmbed) media.push({type:'youtube', url:ytEmbed});
  if(p.tiktokUrl) media.push({type:'tiktok', url:p.tiktokUrl});
  if(!media.length) media.push({type:'icon', url:p.icon});
  pvBaseMedia = media;
  pvCurrentMedia = media;
  pvShowMedia(media, 0);
  renderPvThumbs(media, 0);

  const wrap = document.getElementById('pvVariantWrap');
  if(p.hasVariants){
    document.getElementById('pvVariantLabel').textContent = p.variantGroupName || 'Tamaños';
    renderPvVariants(p);
    wrap.style.display = 'block';
    if(pvSelectedVariantId) selectPvVariant(pvSelectedVariantId);
  } else {
    wrap.style.display = 'none';
  }
  updatePvTotal(p);
  renderPvDealBar(p);
  renderPvStockUrgency(p);
  updateLikeUI(p);
  renderPvReviews(p);
  renderPvRelated(p);

  const addBtn = document.getElementById('pvAddBtn');
  updatePvAddBtn(p);
  document.getElementById('pvQtyCtl').closest('.pv-qty-row').style.display = isProfessionalStore ? 'none' : '';
  if(isProfessionalStore){
    addBtn.disabled = false;
    addBtn.textContent = 'Contactar por WhatsApp';
    addBtn.onclick = () => { profItemContactWA(id); };
  } else {
    addBtn.onclick = () => {
      if(p.hasVariants && !pvSelectedVariantId){ toast('Elegí una opción de ' + (p.variantGroupName||'tamaño').toLowerCase(), 'err'); return; }
      addToCart(id, pvSelectedVariantId, pvQty);
      closeProductView();
    };
  }
  document.getElementById('productViewModal').classList.add('show');
}
function renderPvVariants(p){
  const box = document.getElementById('pvVariants');
  box.innerHTML = activeVariants(p).map(v => {
    const out = (v.stock||0) <= 0;
    return '<button type="button" class="pv-vchip' + (v.id===pvSelectedVariantId?' sel':'') + (out?' disabled':'') + '" ' + (out?'disabled':'') + ' onclick="selectPvVariant(\'' + v.id + '\')">' +
      esc(v.name) + '<span>' + (out ? 'Agotado' : fmt(v.price)) + '</span></button>';
  }).join('');
}
function selectPvVariant(vid){
  pvSelectedVariantId = vid;
  const p = products.find(x=>x.id===pvCurrentId);
  if(!p) return;
  pvQty = 1;
  document.getElementById('pvQty').textContent = 1;
  renderPvVariants(p);
const v = activeVariants(p).find(x=>x.id===vid);
  applyVariantMedia(v);
  updatePvTotal(p);
  updatePvAddBtn(p);
}
/* Las fotos de la variante seleccionada se muestran todas (hasta 5), pasándolas
   con la flecha ◀ ▶; si la variante no trae fotos propias se vuelven a mostrar
   las fotos generales del producto. */
function applyVariantMedia(v){
  const imgs = (v && Array.isArray(v.images) ? v.images : (v && v.image ? [v.image] : [])).filter(Boolean).slice(0,5);
  const vThumbs = (v && Array.isArray(v.thumbs)) ? v.thumbs : [];
  let media = imgs.map((url, idx) => ({type:'image', url, thumb: vThumbs[idx] || ''}));
  if(!media.length) media = pvBaseMedia && pvBaseMedia.length ? pvBaseMedia.slice() : [];
  pvCurrentMedia = media;
  pvMediaIndex = 0;
  if(media.length){ pvShowMedia(media, 0); renderPvThumbs(media, 0); }
}
function pvUnit(p){
  if(p.hasVariants){
    const v = pvSelectedVariantId ? activeVariants(p).find(x=>x.id===pvSelectedVariantId) : null;
    return v ? v.price : Math.min(...(activeVariants(p).map(x=>x.price).concat([0])));
  }
  return p.price;
}
function pvMaxQty(p){
  if(p.unlimited) return 99;
  if(p.hasVariants){
    const v = pvSelectedVariantId ? activeVariants(p).find(x=>x.id===pvSelectedVariantId) : null;
    return v ? Math.max(0, v.stock||0) : 99;
  }
  return Math.max(0, p.stock||0);
}
function pvChangeQty(delta){
  const p = products.find(x=>x.id===pvCurrentId);
  if(!p) return;
  const max = Math.max(1, pvMaxQty(p));
  pvQty = Math.min(max, Math.max(1, pvQty + delta));
  document.getElementById('pvQty').textContent = pvQty;
  updatePvTotal(p);
}
function updatePvTotal(p){
  const unit = pvUnit(p);
  const total = unit * pvQty;
  const priceBox = document.getElementById('pvPrice');
  if(p.hasVariants && !pvSelectedVariantId){
    priceBox.textContent = displayPrice(p);
  } else {
    priceBox.innerHTML = fmt(total) + (pvQty>1 ? '<span class="pv-unit-hint">' + fmt(unit) + ' c/u</span>' : '');
  }
}
function updatePvAddBtn(p){
  const addBtn = document.getElementById('pvAddBtn');
  if(isProfessionalStore){ addBtn.disabled = false; addBtn.textContent = 'Contactar por WhatsApp'; return; }
  const st = stockInfo(p);
  if(p.status === 'agotado'){ addBtn.disabled = true; addBtn.textContent = 'Agotado'; return; }
  if(p.hasVariants){
    const v = pvSelectedVariantId ? activeVariants(p).find(x=>x.id===pvSelectedVariantId) : null;
    if(!activeVariants(p).length){ addBtn.disabled = true; addBtn.textContent = 'Agotado'; return; }
    addBtn.disabled = v ? (v.stock||0) <= 0 : false;
    addBtn.textContent = v && (v.stock||0) <= 0 ? 'Agotado' : 'Agregar al pedido';
  } else {
    addBtn.disabled = !st.can;
    addBtn.textContent = st.can ? 'Agregar al pedido' : 'Agotado';
  }
}
let pvCurrentMedia = [];
let pvMediaIndex = 0;
function pvShowMedia(media, i){
  const m = media[i];
  pvMediaIndex = i;
  const box = document.getElementById('pvMedia');
  /* el video, YouTube y TikTok se muestran en formato vertical tipo historia (9:16) */
  box.classList.toggle('is-story', m.type==='video' || m.type==='youtube' || m.type==='tiktok');
  box.classList.toggle('zoomable', m.type==='image');
  box.onclick = m.type==='image' ? function(){ openLightbox(pvMediaIndex); } : null;
  if(m.type==='image') box.innerHTML = '<img src="' + m.url + '" alt="">';
  else if(m.type==='video') box.innerHTML = '<video src="' + esc(m.url) + '" controls playsinline muted autoplay loop></video>';
  else if(m.type==='youtube') box.innerHTML = '<iframe src="' + esc(m.url) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  else if(m.type==='tiktok'){
    const embed = tiktokEmbedUrl(m.url);
    if(embed){
      box.innerHTML = '<iframe src="' + esc(embed) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    } else {
      box.innerHTML = '<div class="pv-tiktok-link"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Ver reel en TikTok</span></div>';
      const linkEl = box.querySelector('.pv-tiktok-link');
      if(linkEl) linkEl.addEventListener('click', () => openBusiness(m.url));
    }
  }
else box.innerHTML = svgIcon(m.url, 120);
  pvUpdateNav(media, i);
}
function pvUpdateNav(media, i){
  const multi = media.length > 1;
  const prev = document.querySelector('.pv-nav.prev'), next = document.querySelector('.pv-nav.next');
  const count = document.getElementById('pvCount');
  if(prev) prev.style.display = multi ? 'flex' : 'none';
  if(next) next.style.display = multi ? 'flex' : 'none';
  if(count){
    if(multi){ count.textContent = (i+1) + ' / ' + media.length; count.style.display = 'block'; }
    else count.style.display = 'none';
  }
}
function pvMediaNav(delta){
  if(!pvCurrentMedia.length) return;
  const n = pvCurrentMedia.length;
  pvShowMedia(pvCurrentMedia, ((pvMediaIndex + delta) % n + n) % n);
  renderPvThumbs(pvCurrentMedia, pvMediaIndex);
}
function renderPvThumbs(media, idx){
  document.getElementById('pvThumbs').innerHTML = media.map((m,i) => {
    if(m.type==='image') return '<div class="th' + (i===idx?' active':'') + '" data-i="' + i + '" onclick="pvSelectThumb(' + i + ')"><img src="' + (m.thumb || m.url) + '"></div>';
    if(m.type==='video'||m.type==='youtube'||m.type==='tiktok') return '<div class="th vid' + (i===idx?' active':'') + '" data-i="' + i + '" onclick="pvSelectThumb(' + i + ')"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>';
return '<div class="th' + (i===idx?' active':'') + '" data-i="' + i + '" onclick="pvSelectThumb(' + i + ')" style="display:flex;align-items:center;justify-content:center;background:var(--green-soft)">' + svgIcon(m.url,30) + '</div>';
  }).join('');
}
/* ---------- visor de fotos a pantalla completa ---------- */
function openLightbox(i){
  const images = pvCurrentMedia.filter(m => m.type==='image');
  if(!images.length) return;
  const startIdx = pvCurrentMedia[i] && pvCurrentMedia[i].type==='image' ? images.indexOf(pvCurrentMedia[i]) : 0;
  lightboxImages = images;
  lightboxIdx = Math.max(0, startIdx);
  renderLightbox();
  document.getElementById('imgLightbox').classList.add('show');
}
let lightboxImages = [];
let lightboxIdx = 0;
function renderLightbox(){
  const m = lightboxImages[lightboxIdx];
  if(!m) return;
  document.getElementById('lightboxImg').src = m.url;
  document.getElementById('lightboxCount').textContent = (lightboxIdx+1) + ' / ' + lightboxImages.length;
  const multi = lightboxImages.length > 1;
  document.getElementById('lightboxPrev').style.display = multi ? 'flex' : 'none';
  document.getElementById('lightboxNext').style.display = multi ? 'flex' : 'none';
}
function lightboxNav(delta){
  lightboxIdx = (lightboxIdx + delta + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}
function closeLightbox(){ document.getElementById('imgLightbox').classList.remove('show'); }
document.addEventListener('keydown', e => {
  if(!document.getElementById('imgLightbox').classList.contains('show')) return;
  if(e.key==='Escape') closeLightbox();
  else if(e.key==='ArrowLeft') lightboxNav(-1);
  else if(e.key==='ArrowRight') lightboxNav(1);
});

/* ---------- reacciones: me gusta / compartir ---------- */
function getLocalLikes(){
  try{ return JSON.parse(localStorage.getItem(tenantLS('likes'))||'[]'); }catch(e){ return []; }
}
function saveLocalLikes(arr){ try{ localStorage.setItem(tenantLS('likes'), JSON.stringify(arr)); }catch(e){} }
function isLiked(id){ return getLocalLikes().includes(id); }
function updateLikeUI(p){
  const btn = document.getElementById('pvLikeBtn');
  if(!btn) return;
  const liked = isLiked(p.id);
  btn.classList.toggle('on', liked);
  const count = p.likes || 0;
  document.getElementById('pvLikeCount').textContent = liked ? ('Te gusta' + (count?' · '+count:'')) : ('Me gusta' + (count?' · '+count:''));
}
async function toggleLike(id){
  if(!id) return;
  const p = products.find(x=>x.id===id);
  if(!p) return;
  const likes = getLocalLikes();
  const liked = likes.includes(id);
  const delta = liked ? -1 : 1;
  saveLocalLikes(liked ? likes.filter(x=>x!==id) : likes.concat([id]));
  p.likes = Math.max(0, (p.likes||0) + delta);
  updateLikeUI(p);
  renderGrid();
  try{
    await productsCol.doc(id).update({ likes: firebase.firestore.FieldValue.increment(delta) });
  }catch(e){ console.error('like error:', e); }
}
/* URL pública de un producto (siempre con la tienda para que el QR funcione
   al escanearlo desde cualquier dispositivo: producto + variante opcional). */
function storeProductUrl(id, vi){
  const base = location.href.split('#')[0].split('?')[0] || '';
  const q = [];
  if(TENANT_ID) q.push('tienda=' + encodeURIComponent(TENANT_ID));
  q.push('p=' + encodeURIComponent(id));
  if(vi) q.push('vi=' + encodeURIComponent(vi));
  return base + '?' + q.join('&');
}
function shareProduct(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  const vi = (id === pvCurrentId && pvSelectedVariantId) ? pvSelectedVariantId : '';
  const url = storeProductUrl(id, vi);
  const text = p.name + (vi && p.variants ? (' (' + esc(p.variants.find(x=>x.id===vi) ? p.variants.find(x=>x.id===vi).name : '') + ')') : '') + ' — ' + (settings.storeName||'Mi Tienda');
  if(navigator.share){
    navigator.share({ title:p.name, text, url }).catch(()=>{});
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(url).then(()=> toast('Enlace copiado. ¡Compartilo con quien quieras!', 'ok'))
      .catch(()=> toast('No se pudo copiar el enlace', 'err'));
  } else {
    toast('Enlace: ' + url, 'ok');
  }
}
function shareProductQR(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  const vi = (id === pvCurrentId && pvSelectedVariantId) ? pvSelectedVariantId : '';
  const url = storeProductUrl(id, vi);
  document.getElementById('shareQR').src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(url);
  const logoEl = document.getElementById('shareLogo');
  if(settings.logoUrl){ logoEl.src = settings.logoUrl; logoEl.style.display = 'block'; }
  else { logoEl.style.display = 'none'; }
  document.getElementById('shareTitle').textContent = 'Escaneá y mirá: ' + p.name;
  document.getElementById('shareModal').classList.add('show');
  trackShare();
}
/* QR de la etiqueta: enlaza a la ficha del producto Y a la presentación elegida
   (medida/precio), para que escanearla abra ese producto con esa variante ya
   seleccionada. A distinta medida/precio, distinto QR. El POS también lo lee. */
function labelQRData(pid, variant){
  return storeProductUrl(pid, variant ? variant.id : '');
}
function qrImgUrl(pid, variant, size){
  const data = labelQRData(pid, variant);
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' + (size||480) + '&margin=10&data=' + encodeURIComponent(data);
}
function posProductQRData(id){ return TENANT_ID + ':' + id; }
function resolveScanCode(code){
  const s = String(code||'').trim();
  if(!s) return null;
  let id = s, variantId = null, fromJson = false;
  try{
    if(s.charCodeAt(0) === 123){ // '{' → JSON de la etiqueta
      const o = JSON.parse(s);
      if(o && o.p){ id = String(o.p); variantId = o.vi ? String(o.vi) : null; fromJson = true; }
    }
  }catch(e){}
  if(!fromJson){
    const m = s.match(/[?&]p=([^&]+)/);
    if(m) id = decodeURIComponent(m[1]);
    else if(s.indexOf(':') > -1) id = s.split(':').pop();
    const vm = s.match(/[?&]vi=([^&]+)/);
    if(vm) variantId = decodeURIComponent(vm[1]) || null;
  }
  const p = products.find(x=>x.id===id) || null;
  if(!p) return null;
  if(variantId){
    const v = (p.variants||[]).find(x=>x.id===variantId && !x.removed);
    if(v) return { p, variantId, variant: v };
  }
  return { p, variantId: null };
}
/* Etiqueta imprimible por producto: QR + nombre + precio (para caja rápida). */
function printProductLabel(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  const qr = qrImgUrl(id, null, 480);
  const label = '<div class="qr-label">' +
    '<div class="ql-store">' + esc(settings.storeName || '') + '</div>' +
    '<img src="' + qr + '" alt="QR">' +
    '<div class="nm">' + esc(p.name) + '</div>' +
    (p.tag ? '<div class="prod-tag" style="color:#5B21B6;background:#F5E9FB;margin-top:6px">' + esc(p.tag) + '</div>' : '') +
    '<div class="pr">' + displayPrice(p) + '</div>' +
    '<div class="ql-foot">Escaneá y llevá este producto</div>' +
    '</div>';
  document.getElementById('printArea').innerHTML = label;
  window.print();
  document.getElementById('printArea').innerHTML = '';
}
/* ---------- Vista previa de etiqueta (QR · nombre · medida · precio) ---------- */
let labelPreviewPid = null;
let labelFromInventory = false;
function labelPreviewInfo(){
  let p = products.find(x=>x.id===labelPreviewPid);
  const existing = !!p;
  if(!p){
    const name = document.getElementById('pName').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value)||0;
    p = { id: labelPreviewPid, name: name || 'Producto', price };
  }
  const idxRaw = parseInt(document.getElementById('labelMeasureSel').value, 10);
  const idx = isNaN(idxRaw) ? -1 : idxRaw;
  const vActs = existing && labelFromInventory && p.hasVariants
    ? activeVariants(p)
    : (pmVariants||[]).filter(v=>!v.removed);
  let medida = '', price = Number(p.price)||0;
  const variant = (idx>=0 && vActs[idx]) ? vActs[idx] : null;
  if(variant){ medida = (variant.name||'').trim(); price = Number(variant.price)||0; }
  const qrUrl = qrImgUrl(labelPreviewPid, variant, 480);
  return { p, medida, price, variant, qrUrl, existing };
}
function hlabelHTML(info){
  return '<div class="hlabel">' +
    '<div class="hl-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M8 7V5h8v2"/><path d="m15 3-1 4M17 6l-1.5 4.5"/></svg>' + esc(settings.storeName || '') + '</div>' +
    '<div class="hl-body">' +
      '<div class="hl-name">' + esc(info.p.name) + '</div>' +
      (info.medida ? '<div class="hl-measure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h14M7 5v14M3 19h14M13 12h7M17 9l3 3-3 3"/></svg>' + esc(info.medida) + '</div>' : '') +
      '<div class="hl-price">' + fmt(info.price) + '</div>' +
      '<div class="hl-foot">Escaneá y llevá este producto</div>' +
    '</div>' +
    '<div class="hl-qr-wrap"><img src="' + esc(info.qrUrl) + '" alt="QR"></div>' +
  '</div>';
}
function openInventoryLabel(pid){
  const p = products.find(x=>x.id===pid);
  if(!p) return;
  labelPreviewPid = pid;
  labelFromInventory = true;
  const vActs = p.hasVariants ? activeVariants(p) : [];
  const sel = document.getElementById('labelMeasureSel');
  sel.innerHTML = '<option value="-1">Sin medida</option>' +
    vActs.map((v,i)=>'<option value="'+i+'">' + esc(v.name||('Opción '+(i+1))) + ' — ' + fmt(v.price) + '</option>').join('');
  sel.value = (vActs.length ? '0' : '-1');
  renderLabelPreview();
  document.getElementById('labelPreviewHint').textContent = p.hasVariants
    ? 'Elegí la medida/presentación: cada QR lleva al producto y a esa variante exacta.'
    : 'Etiqueta lista en 4 cm × 3 cm. El QR lleva a esta ficha de producto.';
  document.getElementById('labelPreviewModal').classList.add('show');
}
function openLabelPreview(){
  const pid = document.getElementById('pId').value.trim();
  labelPreviewPid = pid || ('TMP' + Date.now().toString(36).toUpperCase());
  labelFromInventory = false;
  const existing = !!pid;
  const vActs = (pmVariants||[]).filter(v=>!v.removed);
  const sel = document.getElementById('labelMeasureSel');
  sel.innerHTML = '<option value="-1">Sin medida</option>' +
    vActs.map((v,i)=>'<option value="'+i+'">' + esc(v.name||('Opción '+(i+1))) + ' — ' + fmt(v.price) + '</option>').join('');
  sel.value = (vActs.length ? '0' : '-1');
  renderLabelPreview();
  document.getElementById('labelPreviewHint').textContent = existing
    ? 'Usás la medida/precio de una opción para la etiqueta. El QR en el POS reconoce este producto.'
    : 'Este es un producto nuevo: el QR queda definitivo cuando lo guardes y abras esta vista de nuevo.';
  document.getElementById('labelPreviewModal').classList.add('show');
}
function closeLabelPreview(){
  document.getElementById('labelPreviewModal').classList.remove('show');
}
function renderLabelPreview(){
  const info = labelPreviewInfo();
  if(!info) return;
  document.getElementById('labelPreviewBox').innerHTML = hlabelHTML(info);
}
function sheetLabelHTML(info, n){
  return '<div class="sl-wrap"><div class="sl-qr"><img src="' + esc(info.qrUrl) + '" alt="QR"></div>' +
    '<div class="sl-body">' +
      '<div class="sl-store">' + esc(settings.storeName || '') + '</div>' +
      '<div class="sl-name">' + esc(info.p.name) + '</div>' +
      (info.medida ? '<div class="sl-measure">' + esc(info.medida) + '</div>' : '') +
      '<div class="sl-price">' + fmt(info.price) + '</div>' +
      '<div class="sl-foot">Escaneá y llevá</div>' +
    '</div>' +
    '<span class="sl-n">' + n + '</span>' +
    '<span class="sl-tag"></span></div>';
}
function printProductLabelPreview(){
  const info = labelPreviewInfo();
  if(!info){ toast('No hay producto para imprimir', 'err'); return; }
  const copies = Math.max(1, parseInt(document.getElementById('labelCopies').value)||5);
  let labels = '';
  for(let i=1;i<=copies;i++) labels += '<div class="sheet-label">' + sheetLabelHTML(info, i) + '</div>';
  document.getElementById('printArea').innerHTML = '<div class="label-sheet">' + labels + '</div>';
  window.print();
  document.getElementById('printArea').innerHTML = '';
}
function saveLabelPreviewPNG(){
  const info = labelPreviewInfo();
  if(!info){ toast('No hay producto para guardar', 'err'); return; }
  toast('Generando imagen…', 'ok');
  const W = 900, H = 300;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#0F5A30'; ctx.lineWidth = 8; ctx.strokeRect(8,8,W-16,H-16);
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = finish; img.onerror = finish;
  img.src = info.qrUrl + '&color=0F5A30';
  function finish(){
    try{
      const s = 224, qx = 32, qy = (H - s)/2;
      if(img.width) ctx.drawImage(img, qx, qy, s, s);
      ctx.textBaseline = 'middle';
      const x = 300;
      ctx.fillStyle = '#0F5A30'; ctx.font = 'bold 22px Arial';
      ctx.fillText((settings.storeName || '').toUpperCase(), x, 34);
      ctx.fillStyle = '#111'; ctx.font = 'bold 36px Arial';
      const wrapLines = [];
      let line = '';
      String(info.p.name).split(/\s+/).forEach(w => {
        const test = line ? line + ' ' + w : w;
        if(line && ctx.measureText(test).width > W - x - 40){ wrapLines.push(line); line = w; }
        else line = test;
      });
      if(line) wrapLines.push(line);
      let ly = 92;
      wrapLines.slice(0,2).forEach(ln => { ctx.fillText(ln, x, ly); ly += 40; });
      if(wrapLines.length > 2){ ctx.fillStyle = '#999'; ctx.font = 'bold 18px Arial'; ctx.fillText('…', x, ly); ly += 26; }
      if(info.medida){ ctx.fillStyle = '#555'; ctx.font = 'bold 22px Arial'; ctx.fillText('Medida: ' + info.medida, x, ly + 6); ly += 36; }
      ctx.fillStyle = '#0F5A30'; ctx.font = 'bold 44px Arial';
      ctx.fillText(fmt(info.price), x, H - 34);
      const dataUrl = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'etiqueta-' + String(info.p.name||'producto').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'') + '.png';
      document.body.appendChild(a); a.click(); setTimeout(()=>{ a.remove(); }, 400);
      toast('Imagen de etiqueta guardada', 'ok');
    }catch(e){
      toast('No se pudo generar la imagen: ' + (e && e.message ? e.message : 'error'), 'err');
    }
  }
}
function pvSelectThumb(i){
  pvShowMedia(pvCurrentMedia, i);
  renderPvThumbs(pvCurrentMedia, i);
}
function renderPvMeta(p){
  const box = document.getElementById('pvMetaRow');
  const rs = reviewStats(p);
  const st = stockInfo(p);
  const parts = [];
  if(rs.count) parts.push('<span class="stars">' + starsHTML(rs.avg,13) + '</span><b>' + rs.avg + '</b>·' + rs.count + ' reseñas');
  if(p.soldCount) parts.push('<b>' + p.soldCount + '</b> vendidos');
  parts.push('<span class="' + (st.cls==='out'?'':'') + '">' + esc(st.label) + '</span>');
  box.innerHTML = parts.join(' &nbsp;·&nbsp; ');
}
function renderPvDealBar(p){
  const box = document.getElementById('pvDealBarWrap');
  const deal = dealInfo(p);
  if(!deal.active){ box.innerHTML = ''; return; }
  const savings = deal.compareAt - deal.base;
  box.innerHTML =
    '<div class="deal-bar"><span class="lbl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>Gran venta</span>' +
      '<div class="deal-timer" id="pvDealTimer"><span>--</span>:<span>--</span>:<span>--</span></div></div>' +
    '<div class="deal-price-block"><span class="now">' + fmt(deal.base) + '</span><span class="was">' + fmt(deal.compareAt) + '</span><span class="pct">-' + deal.pct + '%</span></div>' +
    '<div class="deal-savings">💰 Ahorrás ' + fmt(savings) + ' comprando ahora</div>';
  tickDealTimers();
}
function renderPvStockUrgency(p){
  const box = document.getElementById('pvStockUrgencyWrap');
  const left = stockUnitsLeft(p);
  if(left === Infinity || left <= 0 || left > 8){ box.innerHTML = ''; return; }
  const pct = Math.max(8, Math.min(100, Math.round((left/8)*100)));
  box.innerHTML =
    '<div class="stock-urgency"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 9v4M12 17h.01M10.3 3.9 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>¡Solo quedan ' + left + ' unidades — casi agotado!</div>' +
    '<div class="stock-bar"><div class="stock-bar-fill" style="width:' + pct + '%"></div></div>';
}
function renderPvReviews(p){
  const box = document.getElementById('pvReviewsWrap');
  const revs = p.reviews || [];
  const rs = reviewStats(p);
  const canReview = getOrderedProducts().includes(p.id);
  const headHTML = revs.length ?
    '<div class="pv-reviews-head">' +
      '<div class="pv-rating-big">' + rs.avg + '</div>' +
      '<div><div class="stars">' + starsHTML(rs.avg,16) + '</div><div class="pv-reviews-count">' + rs.count + ' reseña' + (rs.count===1?'':'s') + ' de compras verificadas</div></div>' +
    '</div>' :
    '<h4 style="font-size:14px;margin-bottom:6px">Reseñas de clientes</h4>';
  const listHTML = revs.map(r =>
    '<div class="review-card"><div class="rh"><span class="rname">' + esc(r.name||'Cliente') + '<span class="review-verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>Compra verificada</span></span><span class="rstars">' + starsHTML(r.rating,13) + '</span></div>' +
    (r.text ? '<div class="rtext">' + esc(r.text) + '</div>' : '') +
    (r.photo ? '<div class="rphoto"><img src="' + r.photo + '"></div>' : '') +
    '</div>'
  ).join('');
  const ctaHTML = '<div class="review-cta' + (canReview?' can-review':'') + '">' +
    '<div class="msg">' + (canReview ? '¿Cómo te pareció tu compra? Dejá tu reseña de este producto' : 'Podés dejar tu reseña de este producto después de pedirlo') + '</div>' +
    (canReview ? '<button type="button" class="btn-ghost" style="width:auto;padding:9px 18px" onclick="openReviewForm(\'' + p.id + '\')">Escribir mi reseña ✍️</button>' : '') +
  '</div>';
  box.innerHTML = '<div class="pv-reviews">' + headHTML + listHTML + ctaHTML + '</div>';
}
function renderPvRelated(p){
  const box = document.getElementById('pvRelatedWrap');
  const rel = products.filter(x => x.id!==p.id && x.active!==false && x.cat===p.cat);
  const pool = rel.length >= 3 ? rel : products.filter(x => x.id!==p.id && x.active!==false);
  const list = pool.slice(0, 4);
  if(!list.length){ box.innerHTML = ''; return; }
  box.innerHTML = '<div class="related-wrap"><h4>También te podría interesar</h4><div class="related-strip">' +
    list.map(r => {
      const img = firstThumb(r);
      const g = gradFor(r.id);
      const media = img ? '<img src="' + esc(img) + '" alt="">' : svgIcon(r.icon, 40);
      return '<div class="rel-card" onclick="openProductView(\'' + r.id + '\')"><div class="ri" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + media + '</div>' +
        '<div class="rb"><div class="rn">' + esc(r.name) + '</div><div class="rp">' + displayPrice(r) + '</div></div></div>';
    }).join('') + '</div></div>';
}
function closeProductView(){ document.getElementById('productViewModal').classList.remove('show'); }
/* Hook adicional: rastrear vista de producto */
const _origOpenProductView = openProductView;
openProductView = function(id, preselectVi){
  _origOpenProductView(id, preselectVi);
  trackProductView();
};
