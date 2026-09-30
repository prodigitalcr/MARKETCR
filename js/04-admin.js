/* ---------- autenticación admin (Firebase Auth — control maestro) ---------- */
function openLogin(){
  if(isAdminSession){ enterAdmin(); return; }
  document.getElementById('loginStep1').style.display = '';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginModal').classList.add('show');
  setTimeout(()=>document.getElementById('adminEmail').focus(), 100);
}
function closeLogin(){ document.getElementById('loginModal').classList.remove('show'); }
function cancelStorePasswordStep(){
  auth.signOut();
  storePasswordVerified = false;
  document.getElementById('storePass').value = '';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginStep1').style.display = '';
  setTimeout(()=>document.getElementById('adminEmail').focus(), 100);
}
async function doLogin(){
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPass').value;
  if(!email || !pass){ toast('Ingresá correo y contraseña', 'err'); return; }
  try{
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    if(!ADMIN_EMAILS.includes(cred.user.email) && !SUPERADMIN_EMAILS.includes(cred.user.email)){
      await auth.signOut();
      toast('Esta cuenta no tiene permisos de administrador', 'err');
      return;
    }
    document.getElementById('adminPass').value = '';
    if(TENANT_DATA && TENANT_DATA.adminPasswordHash && !SUPERADMIN_EMAILS.includes(cred.user.email)){
      // esta tienda tiene una clave extra configurada: pedirla antes de entrar
      document.getElementById('loginStep1').style.display = 'none';
      document.getElementById('loginStep2').style.display = '';
      setTimeout(()=>document.getElementById('storePass').focus(), 100);
      return;
    }
    closeLogin(); enterAdmin();
    toast('Bienvenido, administrador', 'ok');
  }catch(e){
    toast('Correo o contraseña incorrectos', 'err');
  }
}
async function verifyStorePassword(){
  const val = document.getElementById('storePass').value;
  if(!val){ toast('Ingresá la clave de tienda', 'err'); return; }
  try{
    const hash = await hashStorePassword(val);
    if(hash !== TENANT_DATA.adminPasswordHash){
      toast('Clave de tienda incorrecta', 'err');
      return;
    }
    storePasswordVerified = true;
    refreshAdminSession();
    document.getElementById('storePass').value = '';
    closeLogin(); enterAdmin();
    toast('Bienvenido, administrador', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo verificar la clave', 'err');
  }
}
async function doLogout(){
  await auth.signOut();
  storePasswordVerified = false;
  document.body.classList.remove('in-admin');
  toast('Sesión cerrada');
}

/* ================= PUNTO DE VENTA PARA EMPLEADOS =================
   Cada empleado vive en tenants/{slug}/employees/{codigo}. El PIN se
   guarda con hash (igual que la clave de tienda) y el administrador lo
   administra desde el panel Empleados. El empleado entra con su código
   y PIN, vende y factura, y cada venta queda marcada con su nombre. */
let employees = [];
let employeeSession = null;

function employeeCol(){ return tenantCol('employees'); }
function hashEmployeePin(code, pin){
  return sha256Hex('emp:' + (TENANT_ID||'') + ':' + String(code).trim().toUpperCase() + ':' + pin);
}
function listenEmployees(){
  employeeCol().onSnapshot(snap=>{
    employees = snap.docs.map(d=>Object.assign({ id: d.id }, d.data()));
    if(document.body.classList.contains('in-admin') && !employeeSession){
      renderEmployees();
      populatePOSSellerFilter();
    }
  }, err=>{ console.error(err); });
}
/* ---------- Sesiom: acceso de empleado ---------- */
function openEmployeeLogin(){
  if(employeeSession){ enterEmployeePOS(); return; }
  document.getElementById('empCode').value = '';
  document.getElementById('empPin').value = '';
  document.getElementById('employeeLoginModal').classList.add('show');
  setTimeout(()=>document.getElementById('empCode').focus(), 100);
}
function closeEmployeeLogin(){
  document.getElementById('employeeLoginModal').classList.remove('show');
}
async function doEmployeeLogin(){
  const code = document.getElementById('empCode').value.trim().toUpperCase();
  const pin = document.getElementById('empPin').value;
  if(!code || !pin){ toast('Ingresá tu código y PIN', 'err'); return; }
  const emp = employees.find(e => String(e.code||'').toUpperCase() === code);
  if(!emp || emp.enabled === false){
    toast('Empleado no encontrado o desactivado. Consultá al administrador.', 'err');
    return;
  }
  const hash = await hashEmployeePin(code, pin);
  if(hash !== emp.pinHash){
    toast('PIN incorrecto', 'err');
    return;
  }
  employeeSession = emp;
  closeEmployeeLogin();
  enterEmployeePOS();
  toast('Bienvenido/a, ' + emp.name, 'ok');
}
function updateEmployeeTopbar(){
  const s = document.getElementById('empStoreName');
  if(s) s.textContent = settings.storeName || TENANT_DATA.nombre || 'Tienda';
  const op = document.getElementById('empOperatorName');
  if(op) op.textContent = (employeeSession ? employeeSession.name : 'Administrador');
  const po = document.getElementById('posOperatorName');
  if(po) po.textContent = employeeSession ? employeeSession.name : (auth.currentUser ? auth.currentUser.email : 'Administrador');
}
function enterEmployeePOS(){
  employeeSession = employeeSession || { name:'Cajero' };
  document.body.classList.add('in-admin');
  document.body.classList.remove('is-admin-view');
  document.body.classList.add('employee-view');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.adm-link[data-panel]').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-pos').classList.add('active');
  updateEmployeeTopbar();
  renderHeader();
  renderPOSCatalog(); renderPOSCart();
  document.getElementById('posSellerFilter') && (document.getElementById('posSellerFilter').value = '');
  toast('Caja lista. Vende escaneando, buscando o tocando un producto.', 'ok');
}
function employeeLogout(){
  employeeSession = null;
  document.body.classList.remove('employee-view','in-admin');
  toast('Sesión de caja cerrada');
  renderHeader();
}
/* ---------- Panel Empleados (CRUD del administrador) ---------- */
function employeesRef(){ return employeeCol(); }
function genEmpCode(){
  let n = 1;
  const used = new Set(employees.map(e=>e.code));
  while(used.has('EMP-' + String(n).padStart(3,'0'))) n++;
  return 'EMP-' + String(n).padStart(3,'0');
}
function openEmployeeModal(id){
  const em = id ? employees.find(e=>e.id===id) : null;
  document.getElementById('emModalTitle').textContent = em ? 'Editar empleado' : 'Nuevo empleado';
  document.getElementById('emId').value = (em && em.id) || '';
  document.getElementById('emName').value = (em && em.name) || '';
  document.getElementById('emCode').value = (em && em.code) || (id ? '' : genEmpCode());
  document.getElementById('emCode').disabled = !!em;
  document.getElementById('emPin').value = '';
  document.getElementById('emPin').placeholder = em ? 'Dejalo vacío para no cambiarlo' : 'Mínimo 4 dígitos';
  document.getElementById('employeeModal').classList.add('show');
  setTimeout(()=>document.getElementById('emName').focus(), 100);
}
function closeEmployeeModal(){
  document.getElementById('employeeModal').classList.remove('show');
}
async function saveEmployee(){
  const id = document.getElementById('emId').value;
  const name = document.getElementById('emName').value.trim();
  const code = (document.getElementById('emCode').value.trim().toUpperCase() || genEmpCode());
  const pin = document.getElementById('emPin').value;
  if(!name){ toast('Poné el nombre del empleado', 'err'); return; }
  if(!id && !code){ toast('Falta el código del empleado', 'err'); return; }
  if(employees.some(e => e.id !== id && String(e.code||'').toUpperCase() === code)){
    toast('Ya existe un empleado con el código ' + code, 'err');
    return;
  }
  if(!id && String(pin).length < 4){
    toast('El PIN debe tener al menos 4 caracteres', 'err');
    return;
  }
  const payload = { name, code, enabled: true };
  if(pin) payload.pinHash = await hashEmployeePin(code, pin);
  const docRef = id ? employeesRef().doc(id) : employeesRef().doc(code);
  await docRef.set(payload, { merge: true });
  closeEmployeeModal();
  toast(id ? 'Empleado actualizado' : 'Empleado creado. Compartí su código y PIN con él.', 'ok');
}
async function deleteEmployee(id){
  const em = employees.find(e=>e.id===id);
  if(!em) return;
  if(!confirm('¿Eliminar a "' + em.name + '" del punto de venta? Podrás volver a crearlo después.')) return;
  await employeeCol().doc(id).delete();
  toast(em.name + ' eliminado', 'ok');
}
async function toggleEmployee(id){
  const em = employees.find(e=>e.id===id);
  if(!em) return;
  const next = em.enabled === false;
  await employeeCol().doc(id).set({ enabled: next }, { merge: true });
  toast((next ? 'Empleado activado' : 'Empleado desactivado') + ' — ' + em.name, 'ok');
}
function resetEmployeePin(id){
  const em = employees.find(e=>e.id===id);
  if(!em) return;
  openEmployeeModal(id);
  document.getElementById('emModalTitle').textContent = 'Cambiar PIN — ' + em.name;
  toast('Escribí el nuevo PIN para ' + em.name, 'ok');
}
function renderEmployees(){
  const body = document.getElementById('empBody');
  if(!body) return;
  if(!employees.length){
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Todavía no hay empleados. Creá el primero con "Agregar empleado".</td></tr>';
    return;
  }
  body.innerHTML = employees.map(em => {
    const sales = posSales.filter(s => (s.sellerId||'') === em.code);
    const total = sales.reduce((s,x)=>s+(x.total||0),0);
    const on = em.enabled !== false;
    return '<tr>' +
      '<td><b>' + esc(em.code||'') + '</b></td>' +
      '<td>' + esc(em.name) + '</td>' +
      '<td class="pin-mask">••••••</td>' +
      '<td><span class="emp-badge ' + (on?'on':'off') + '">' + (on?'Activo':'Inactivo') + '</span></td>' +
      '<td>' + sales.length + '</td>' +
      '<td><b>' + fmt(total) + '</b></td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        '<button class="icon-btn" title="Ver ventas de ' + esc(em.name) + '" onclick="showSellerSales(\'' + esc(em.code) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
        '<button class="icon-btn" title="Cambiar PIN" onclick="resetEmployeePin(\'' + esc(em.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/><path d="M12 12v4"/></svg></button>' +
        '<button class="icon-btn" title="' + (on?'Desactivar':'Activar') + '" onclick="toggleEmployee(\'' + esc(em.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg></button>' +
        '<button class="icon-btn danger" title="Eliminar" onclick="deleteEmployee(\'' + esc(em.id) + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0-1 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 6"/></svg></button>' +
      '</td></tr>';
  }).join('');
}
/* Ver las ventas de un vendedor: abre POS y filtra el historial del día */
function showSellerSales(code){
  switchPanel('pos');
  const sel = document.getElementById('posSellerFilter');
  if(sel){ sel.value = code; }
  renderPOSDashboard();
  toast('Mostrando ventas del vendedor ' + code, 'ok');
}
function populatePOSSellerFilter(){
  const sel = document.getElementById('posSellerFilter');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos los vendedores</option>' +
    (employeeSession ? '<option value="' + esc(employeeSession.code||'') + '">' + esc(employeeSession.name) + '</option>' : '') +
    employees.map(e => '<option value="' + esc(e.code) + '">' + esc(e.name) + '</option>').join('');
  sel.value = cur;
}
/* Compartir la ventana del POS con el personal (link + WhatsApp) */
function sharePOSLink(){
  if(!TENANT_ID){ toast('Falta el identificador del negocio', 'err'); return; }
  const url = location.origin + location.pathname + '?tienda=' + TENANT_ID + '&pos=1';
  const msg = 'Hola 👋 Te comparto el acceso al PUNTO DE VENTA de ' + (settings.storeName || TENANT_ID) + '.\n\nAbrí este enlace e ingresá con tu código y PIN de empleado:\n' + url;
  const copyDone = () => { toast('Enlace copiado. Envialo a tu personal por WhatsApp.', 'ok'); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(copyDone).catch(copyDone);
  } else { copyDone(); }
  if(settings.whatsapp){
    window.open('https://wa.me/' + waDigits(settings.whatsapp) + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  }
}
function enterAdmin(){
  document.body.classList.remove('employee-view');
  employeeSession = null;
  document.body.classList.add('in-admin');
  renderHeader(); listenOrdersIfAdmin(); renderInventory(); loadSettingsForm();
  listenPOSIfAdmin(); listenFinanceIfAdmin();
  loadAnalytics();
  populatePOSSellerFilter();
  updateEmployeeTopbar();
  messagesColInit();
  // Verificar expiración completa: recordatorio 24h, suspensión y revertir plan
  checkMembershipExpiry().then(()=>{
    checkAndRevertExpiredPlan().then(()=>{ updatePlanLockBanner(); });
  });
  // Aplicar restricciones visuales basadas en el plan
  applyPlanRestrictions();
}

/* Aplica restricciones visuales al panel según el plan activo */
function applyPlanRestrictions(){
  const activePlan = getActivePlanId();
  const rank = PLAN_RANK[activePlan]||1;
  // Marcar pestañas bloqueadas visualmente
  document.querySelectorAll('.adm-link[data-panel]').forEach(btn => {
    const panel = btn.dataset.panel;
    const featureKey = panel === 'orders' ? 'panel-orders' : panel === 'stats' ? 'panel-analytics' :
      panel === 'pos' ? 'pos-panel' : panel === 'finance' ? 'finance-panel' : panel === 'employees' ? 'employees-panel' : null;
    if(featureKey && !planAllows(featureKey)){
      btn.style.opacity = '0.5';
      btn.title = 'Requiere plan superior';
      // Añadir ícono de candado si no tiene uno
      if(!btn.querySelector('.lock-indicator')){
        const lockSpan = document.createElement('span');
        lockSpan.className = 'lock-indicator';
        lockSpan.textContent = '🔒';
        lockSpan.style.cssText = 'font-size:11px;margin-left:4px';
        btn.appendChild(lockSpan);
      }
    } else {
      btn.style.opacity = '';
      btn.title = '';
      const li = btn.querySelector('.lock-indicator');
      if(li) li.remove();
    }
  });
}
function viewStore(){ document.body.classList.remove('in-admin'); renderHeader(); renderChips(); renderGrid(); updateCartUI(); }

/* Si esta tienda tiene una clave extra (TENANT_DATA.adminPasswordHash),
   el correo/contraseña de Firebase ya NO alcanza por sí solo: hace falta
   además haber verificado esa clave en esta sesión del navegador
   (storePasswordVerified). Así el cliente puede navegar la tienda
   libremente pero no puede entrar a las funciones de administrador. */
let storePasswordVerified = false;
/* El superadministrador (SUPERADMIN_EMAILS) tiene permisos totales sobre
   CUALQUIER negocio: cuenta como admin de la tienda aunque su correo no
   esté en adminEmails, y no necesita la clave extra de tienda
   (adminPasswordHash) porque esa clave es un secreto de cada dueño de
   negocio que el superadmin no tiene por qué conocer. */
function isSuperAdminUser(user){
  return !!(user && SUPERADMIN_EMAILS.includes(user.email));
}
function refreshAdminSession(){
  const user = auth.currentUser;
  const superAdmin = isSuperAdminUser(user);
  const emailOk = !!(user && (ADMIN_EMAILS.includes(user.email) || superAdmin));
  const needsStorePass = !!(TENANT_DATA && TENANT_DATA.adminPasswordHash) && !superAdmin;
  isAdminSession = emailOk && (!needsStorePass || storePasswordVerified);
  // Marca el body: admin de tienda (no superadmin) → oculta la config avanzada de IA por CSS
  document.body.classList.toggle('is-admin-view', !superAdmin);
  if(!isAdminSession && !employeeSession && document.body.classList.contains('in-admin')){
    document.body.classList.remove('in-admin');
  }
}
/* Se re-evalúa tanto cuando cambia el login de Firebase Auth como cuando
   termina de cargar el tenant (ADMIN_EMAILS llega un poco después, ya que
   depende de la tienda que se está mostrando en la URL). */
auth.onAuthStateChanged(user => { refreshAdminSession(); });
function showPanel(name, btn){
  // Salir del modo "editar en vivo" si se navega a otro panel
  if(name !== 'site' && document.body.classList.contains('site-live-edit')){
    document.body.classList.remove('site-live-edit');
    const lp = document.getElementById('svLivePill');
    if(lp) lp.remove();
  }
  // Verificar acceso al panel según plan activo
  const PANEL_FEATURE = {orders:'panel-orders', stats:'panel-analytics', pos:'pos-panel', finance:'finance-panel', employees:'employees-panel'};
  const featureKey = PANEL_FEATURE[name];
  if(featureKey && !planAllows(featureKey)){
    showPlanWall(featureKey);
    return; // bloquear navegación
  }
document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
  document.querySelectorAll('.adm-link[data-panel]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(name!=='pos' && laserModeOn && typeof toggleLaserMode === 'function'){
    laserModeOn = false; laserBuf = '';
    const b = document.getElementById('laserModeBtn');
    if(b){ b.textContent = '🔦 Láser'; b.style.background = ''; b.style.color = ''; }
  }
  if(name==='stats'){ renderStats(); loadAnalytics(); }
  if(name==='inventory') renderInventory();
  if(name==='orders') renderOrders();
  if(name==='messages') renderMessages();
  if(name==='settings') loadSettingsForm();
  if(name==='site'){ loadSiteEditor(); ensureSiteLive(); }
  if(name==='membership') loadMembershipPanel();
if(name==='pos'){ renderPOSCatalog(); renderPOSCart(); renderPOSDashboard(); listenFinanceIfAdmin(); }
  if(name==='finance'){ listenFinanceIfAdmin(); renderFinancePanel(); }
  if(name==='employees') renderEmployees();
}
/* Helper para cambiar panel desde código (sin botón) */
function switchPanel(panelId){
  const btn = document.querySelector('.adm-link[data-panel="' + panelId.replace('panel-','') + '"]');
  if(btn) showPanel(panelId.replace('panel-',''), btn);
}

/* ---------- estadísticas ---------- */
function activeOrders(){ return orders.filter(o=>o.status!=='cancelado'); }
/* Muestra estadísticas básicas (Emprendedor) o completas (Profesional/Destacado) */
function applyStatsPlanView(){
  const isBasic = getActivePlanId() === 'emprendedor';
  document.querySelectorAll('.stats-advanced-item').forEach(el => {
    el.style.display = isBasic ? 'none' : '';
  });
  const notice = document.getElementById('statsBasicNotice');
  if(notice) notice.style.display = isBasic ? 'flex' : 'none';
}
function renderStats(){
  applyStatsPlanView();
  const act = activeOrders();
  const total = act.reduce((s,o)=>s+o.total,0);
  document.getElementById('stSales').textContent = fmt(total);
  document.getElementById('stSalesSub').textContent = act.length + ' pedido' + (act.length===1?'':'s');
  document.getElementById('stPend').textContent = orders.filter(o=>o.status==='recibido').length;
  document.getElementById('stDone').textContent = orders.filter(o=>o.status==='entregado').length;
  document.getElementById('stAvg').textContent = act.length ? fmt(total/act.length) : fmt(0);
  drawChart();
  // top productos
  const agg = {};
  act.forEach(o => o.items.forEach(it => {
    if(!agg[it.name]) agg[it.name] = {qty:0, amt:0};
    agg[it.name].qty += it.qty; agg[it.name].amt += it.qty*it.price;
  }));
  const top = Object.entries(agg).sort((a,b)=>b[1].qty-a[1].qty).slice(0,6);
  document.getElementById('topProducts').innerHTML = top.length ?
    '<table class="mini-table"><thead><tr><th>Producto</th><th class="r">Unidades</th><th class="r">Vendido</th></tr></thead><tbody>' +
    top.map(([n,v])=>'<tr><td>'+esc(n)+'</td><td class="r">'+v.qty+'</td><td class="r">'+fmt(v.amt)+'</td></tr>').join('') +
    '</tbody></table>' :
    '<p style="color:var(--muted);font-size:13px">Aún no hay ventas registradas. Los pedidos de la tienda aparecerán aquí.</p>';
}
function drawChart(){
  const cv = document.getElementById('salesChart');
  const dpr = window.devicePixelRatio||1;
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    days.push({ key:d.toISOString().slice(0,10), lbl:d.toLocaleDateString('es-CR',{weekday:'short'}), total:0 });
  }
  activeOrders().forEach(o=>{
    const k = o.date.slice(0,10);
    const d = days.find(x=>x.key===k);
    if(d) d.total += o.total;
  });
  const max = Math.max(...days.map(d=>d.total), 1);
  const padL = 8, padB = 26, padT = 14;
  const bw = (W - padL*2) / 7 * 0.52;
  days.forEach((d,i)=>{
    const x = padL + (W - padL*2) * (i + 0.24) / 7;
    const h = (H - padB - padT) * (d.total / max);
    const y = H - padB - h;
    ctx.fillStyle = d.total ? '#1B7A43' : '#EEF2F5';
    const r = 6;
    ctx.beginPath();
    ctx.roundRect(x, d.total? y : H-padB-4, bw, d.total? Math.max(h,4) : 4, [r,r,0,0]);
    ctx.fill();
    ctx.fillStyle = '#6B7280'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.lbl, x + bw/2, H - 8);
    if(d.total){ ctx.fillStyle = '#111827'; ctx.font = 'bold 10.5px Inter, sans-serif'; ctx.fillText(fmt(d.total), x + bw/2, y - 5); }
  });
}
window.addEventListener('resize', ()=>{ if(document.body.classList.contains('in-admin')) drawChart(); });

/* ---------- reportes en PDF (jsPDF + autoTable) ---------- */
/* Los fonts base de jsPDF no incluyen el símbolo ₡ ni el espacio fino que usa fmt(),
   así que para los PDF se usa un formateo de moneda aparte, 100% compatible. */
function fmtPdf(n){ return 'CRC ' + Math.round(n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function displayPricePdf(p){
  if(p.hasVariants){
    const av = activeVariants(p);
    if(!av.length) return fmtPdf(0);
    const min = Math.min(...av.map(v=>v.price));
    const max = Math.max(...av.map(v=>v.price));
    return min===max ? fmtPdf(min) : ('Desde ' + fmtPdf(min));
  }
  return fmtPdf(p.price);
}
function todayFileStamp(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function pdfNewDoc(subtitle){
  const doc = new window.jspdf.jsPDF({ unit:'pt', format:'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(27,122,67);
  doc.rect(0,0,pageW,72,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text(settings.storeName || 'Mi Tienda', 40, 32);
  doc.setFont('helvetica','normal');
  doc.setFontSize(11);
  doc.text(subtitle, 40, 50);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString('es-CR'), pageW-40, 50, { align:'right' });
  doc.setTextColor(17,32,42);
  return doc;
}
function pdfFooter(doc){
  const pages = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    doc.setFontSize(8.5);
    doc.setTextColor(150,150,150);
    doc.text((settings.storeName||'Mi Tienda') + ' - reporte generado desde el panel de administrador', 40, pageH-20);
    doc.text('Pagina ' + i + ' de ' + pages, pageW-40, pageH-20, { align:'right' });
  }
}
function pdfReady(){
  if(window.jspdf && window.jspdf.jsPDF) return true;
  toast('No se pudo cargar el generador de PDF. Revisá tu conexión e intentá de nuevo.', 'err');
  return false;
}
/* Carga jsPDF + autoTable solo la primera vez que el admin exporta un reporte,
   en vez de descargarlos en cada visita de cada cliente a la tienda. */
let _pdfLibsPromise = null;
function _loadScriptOnce(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src; s.onload = ()=>resolve(); s.onerror = ()=>reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
function ensurePdfLibs(){
  if(window.jspdf && window.jspdf.jsPDF) return Promise.resolve(true);
  if(!_pdfLibsPromise){
    _pdfLibsPromise = _loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      .then(()=> _loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'))
      .then(()=> true)
      .catch(()=>{ _pdfLibsPromise = null; return false; });
  }
  return _pdfLibsPromise;
}
async function exportStatsPDF(){
  toast('Preparando el PDF…', 'ok');
  if(!(await ensurePdfLibs()) || !pdfReady()) return;
  const doc = pdfNewDoc('Reporte de estadisticas');
  const act = activeOrders();
  const total = act.reduce((s,o)=>s+o.total,0);
  doc.autoTable({
    startY: 92,
    head: [['Resumen','Valor']],
    body: [
      ['Total de ventas', fmtPdf(total)],
      ['Pedidos activos', String(act.length)],
      ['Pendientes por confirmar', String(orders.filter(o=>o.status==='recibido').length)],
      ['Entregados', String(orders.filter(o=>o.status==='entregado').length)],
      ['Cancelados', String(orders.filter(o=>o.status==='cancelado').length)],
      ['Ticket promedio', act.length ? fmtPdf(total/act.length) : fmtPdf(0)]
    ],
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:10, cellPadding:6 }
  });
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    days.push({ key:d.toISOString().slice(0,10), lbl:d.toLocaleDateString('es-CR',{weekday:'long', day:'2-digit', month:'2-digit'}), total:0 });
  }
  act.forEach(o=>{
    const k = o.date.slice(0,10);
    const d = days.find(x=>x.key===k);
    if(d) d.total += o.total;
  });
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 24,
    head: [['Ventas de los ultimos 7 dias','Total']],
    body: days.map(d=>[d.lbl, fmtPdf(d.total)]),
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:10, cellPadding:6 }
  });
  const agg = {};
  act.forEach(o => o.items.forEach(it => {
    if(!agg[it.name]) agg[it.name] = {qty:0, amt:0};
    agg[it.name].qty += it.qty; agg[it.name].amt += it.qty*it.price;
  }));
  const top = Object.entries(agg).sort((a,b)=>b[1].qty-a[1].qty).slice(0,10);
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 24,
    head: [['Producto mas vendido','Unidades','Vendido']],
    body: top.length ? top.map(([n,v])=>[n, String(v.qty), fmtPdf(v.amt)]) : [['Aun no hay ventas registradas','','']],
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:10, cellPadding:6 }
  });
  pdfFooter(doc);
  doc.save((TENANT_ID||'tienda') + '-estadisticas-' + todayFileStamp() + '.pdf');
  toast('Reporte de estadisticas descargado', 'ok');
}
async function exportInventoryPDF(){
  toast('Preparando el PDF…', 'ok');
  if(!(await ensurePdfLibs()) || !pdfReady()) return;
  const doc = pdfNewDoc('Reporte de inventario');
  const body = products.map(p=>{
    const st = stockInfo(p);
    const totalStock = p.hasVariants ? activeVariants(p).reduce((s,v)=>s+(v.stock||0),0) : p.stock;
    return [p.name, p.cat, displayPricePdf(p), p.unlimited ? 'Servicio' : String(totalStock), st.label];
  });
  doc.autoTable({
    startY: 92,
    head: [['Producto','Categoria','Precio','Stock','Estado']],
    body: body.length ? body : [['Sin productos registrados','','','','']],
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:9.5, cellPadding:5 },
    columnStyles:{ 2:{ halign:'right' }, 3:{ halign:'right' } }
  });
  doc.setFontSize(9.5);
  doc.setTextColor(107,114,128);
  doc.text(products.length + ' referencias - ' + products.filter(p=>{const c=stockInfo(p).cls; return c==='low'||c==='out';}).length + ' con stock bajo o agotado', 40, doc.lastAutoTable.finalY + 20);
  pdfFooter(doc);
  doc.save((TENANT_ID||'tienda') + '-inventario-' + todayFileStamp() + '.pdf');
  toast('Reporte de inventario descargado', 'ok');
}
async function exportOrdersPDF(){
  toast('Preparando el PDF…', 'ok');
  if(!(await ensurePdfLibs()) || !pdfReady()) return;
  const f = document.getElementById('orderFilter').value;
  const list = orders.filter(o=>!f || o.status===f);
  const doc = pdfNewDoc('Reporte de pedidos' + (f ? ' - ' + (STATUS[f]?STATUS[f].lbl:f) : ''));
  const body = list.map(o=>{
    const d = new Date(o.date);
    const itemsTxt = o.items.map(it=>it.qty+'x '+it.name).join(', ');
    const st = STATUS[o.status]||STATUS.recibido;
    return [o.number, d.toLocaleDateString('es-CR'), o.customer.name, o.customer.phone, itemsTxt, fmtPdf(o.total), st.lbl];
  });
  doc.autoTable({
    startY: 92,
    head: [['Factura','Fecha','Cliente','Telefono','Detalle','Total','Estado']],
    body: body.length ? body : [['Sin pedidos registrados','','','','','','']],
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:8.5, cellPadding:5 },
    columnStyles:{ 4:{ cellWidth:150 }, 5:{ halign:'right' } }
  });
  pdfFooter(doc);
  doc.save((TENANT_ID||'tienda') + '-pedidos-' + todayFileStamp() + '.pdf');
  toast('Reporte de pedidos descargado', 'ok');
}
async function exportCategoriesPDF(){
  toast('Preparando el PDF…', 'ok');
  if(!(await ensurePdfLibs()) || !pdfReady()) return;
  const doc = pdfNewDoc('Reporte de categorias');
  const cats = settings.categories||[];
  const body = cats.map(cat=>{
    const list = products.filter(p=>p.cat===cat);
    const units = list.reduce((s,p)=> s + (p.unlimited ? 0 : (p.hasVariants ? activeVariants(p).reduce((a,v)=>a+(v.stock||0),0) : (p.stock||0))), 0);
    const value = list.reduce((s,p)=>{
      if(p.unlimited) return s;
      if(p.hasVariants) return s + activeVariants(p).reduce((a,v)=>a+(v.price*(v.stock||0)),0);
      return s + (p.price*(p.stock||0));
    }, 0);
    return [cat, String(list.length), String(units), fmtPdf(value)];
  });
  doc.autoTable({
    startY: 92,
    head: [['Categoria','Productos','Unidades en stock','Valor de inventario']],
    body: body.length ? body : [['Sin categorias configuradas','','','']],
    theme:'grid', headStyles:{ fillColor:[27,122,67] }, styles:{ fontSize:10, cellPadding:6 },
    columnStyles:{ 1:{ halign:'right' }, 2:{ halign:'right' }, 3:{ halign:'right' } }
  });
  pdfFooter(doc);
  doc.save((TENANT_ID||'tienda') + '-categorias-' + todayFileStamp() + '.pdf');
  toast('Reporte de categorias descargado', 'ok');
}

/* ---------- inventario ---------- */
function inventoryTotals(){
  let value = 0, cost = 0, units = 0;
  for(const p of products){
    if(p.active === false) continue;
    if(p.hasVariants){
      const av = activeVariants(p) || [];
      for(const v of av){
        const q = +(v.stock||0);
        units += q;
        value += (+(v.price!=null?v.price:p.price)||0) * q;
        cost += (+(v.cost!=null?v.cost:p.cost)||0) * q;
      }
    } else {
      if(p.unlimited) continue;
      const q = +(p.stock||0);
      units += q;
      value += (+(p.price)||0) * q;
      cost += (+(p.cost)||0) * q;
    }
  }
  return { value, cost, units };
}
function renderInventory(){
  const q = (document.getElementById('invSearch').value||'').toLowerCase().trim();
  const list = products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.tag||'').toLowerCase().includes(q) || (p.cat||'').toLowerCase().includes(q));
  const invTot = inventoryTotals();
  const lowCount = products.filter(p=>{const c=stockInfo(p).cls; return c==='low'||c==='out';}).length;
  document.getElementById('invSummary').innerHTML =
    '<div>' + products.length + ' referencias · ' + lowCount + ' con stock bajo o agotado</div>' +
    '<div class="inv-totals-line">' +
      '<span>Valor de venta: <b id="invTotalValue">' + fmt(invTot.value) + '</b></span>' +
      '<span>Costo total: <b id="invTotalCost">' + fmt(invTot.cost) + '</b></span>' +
      '<span>Ganancia potencial: <b id="invTotalMargin" style="color:var(--green)">' + fmt(invTot.value - invTot.cost) + '</b></span>' +
    '</div>';
  document.getElementById('invBody').innerHTML = list.map(p => {
    const st = stockInfo(p);
    const g = gradFor(p.id);
    const cover = firstThumb(p);
    const thumb = cover ?
      '<span class="tbl-thumb"><img src="' + esc(cover) + '" alt="' + esc(p.name) + '" loading="lazy"></span>' :
      '<span class="tbl-thumb" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + svgIcon(p.icon,22) + '</span>';
    const totalStock = p.hasVariants ? activeVariants(p).reduce((s,v)=>s+(v.stock||0),0) : p.stock;
    const manual = p.status || 'disponible';
    const statusSel = '<select class="prod-status-sel st-' + manual + '" title="Estado del producto" onchange="setProductStatus(\'' + p.id + '\', this.value)">' +
      Object.keys(PROD_STATUS).map(k=>'<option value="'+k+'"'+(manual===k?' selected':'')+'>'+PROD_STATUS[k].lbl+'</option>').join('') +
      '</select>';
return '<tr>' +
      '<td><div class="tbl-prod">' + thumb + '<span>' + esc(p.name) + (p.tag ? ' <span class="prod-tag">' + esc(p.tag) + '</span>' : '') + '<div class="tbl-cat">' + esc(p.cat) + (p.hasVariants ? ' · ' + activeVariants(p).length + ' ' + esc((p.variantGroupName||'variantes').toLowerCase()) : '') + '</div></span></div></td>' +
      '<td><b>' + displayPrice(p) + '</b></td>' +
      '<td>' + (p.unlimited ? '<span class="pill blue">Servicio</span>' : totalStock) + '</td>' +
      '<td>' + statusSel + (st.cls==='low' ? '<div class="tbl-cat" style="margin-top:4px;color:#B45309">Pocas unidades</div>' : '') + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        '<button class="icon-btn" title="Ver etiqueta con QR (trae al producto y a su variante)" onclick="openInventoryLabel(\'' + p.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12h6M9 16h6"/><rect x="4" y="2" width="16" height="20" rx="2"/></svg></button>' +
        '<button class="icon-btn" title="Compartir QR" onclick="shareProductQR(\'' + p.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v7M14 21h1"/></svg></button>' +
        '<button class="icon-btn" title="Editar" onclick="openProductModal(\'' + p.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>' +
        '<button class="icon-btn danger" title="Eliminar" onclick="deleteProduct(\'' + p.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0-1 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 6"/></svg></button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Sin productos</td></tr>';
  syncThumbButtons();
}

/* ---------- multimedia del producto (fotos subidas como archivo, comprimidas a base64) ---------- */
let pmImages = [];
let imgFileSlot = null;
function renderImageGrid(){
  const grid = document.getElementById('pImgGrid');
  grid.innerHTML = pmImages.map((url,i) => {
    const preview = url ?
      '<img src="' + url + '">' :
      '<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg><span>Subir foto</span></div>';
    return '<div class="media-item' + (url?' filled':' upload') + '" onclick="triggerImageUpload(' + i + ')" title="' + (url?'Cambiar foto':'Subir foto') + '">' +
      (i===0 ? '<span class="cover-tag">Portada</span>' : '') +
      preview +
      (url ? '<button type="button" class="rm-btn" onclick="event.stopPropagation();removeImageField(' + i + ')" title="Quitar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' : '') +
    '</div>';
  }).join('');
}
function triggerImageUpload(i){ imgFileSlot = i; document.getElementById('imgFileInput').click(); }
/* Sube la imagen comprimida a Firebase Storage (carpeta products/{tenant} o
   variantes) y devuelve la URL pública de descarga. Así las fotos NO pesan
   en el documento de Firestore (sin límite de 1MB) y se ven nítidas en la tienda.
   Devuelve {url, blob} o lanza error si Storage no está disponible. */
async function storageUploadImage(file, folder, maxDim, quality){
  const blob = await resizeSiteImage(file, maxDim || 1600, quality || 0.86);
  if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
  const ext = (blob.type === 'image/png') ? '.png' : '.jpg';
  const base = folder || ('products/' + (TENANT_ID || 'x'));
  const name = base + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
  const ref = firebase.storage().ref(name);
  await ref.put(blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
  const url = await ref.getDownloadURL();
  return { url, blob };
}
function onImageFileChosen(input){
  const file = input.files && input.files[0];
  const slot = imgFileSlot;
  if(!file || slot===null){ input.value=''; return; }
  /* Fotos del producto: se comprimen y suben a Firebase Storage (products/{tenant}).
     La URL pública se guarda en el producto — el documento de Firestore queda liviano. */
  storageUploadImage(file, 'products/' + (TENANT_ID || 'x'), 1600, 0.86).then(r => {
    pmImages[slot] = r.url;
    renderImageGrid();
    toast('Foto subida a Storage ✓', 'ok');
  }).catch(e => {
    console.error('Storage upload error:', e);
    /* Si Storage falla (sin permisos), caemos a base64 como respaldo */
    compressImageFile(file, 1600, 0.86).then(dataUrl => {
      pmImages[slot] = dataUrl;
      renderImageGrid();
      toast('Foto guardada (sin Storage) — se copió al documento', 'warn');
    }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  });
  input.value = '';
}
function addImageField(){
  if(pmImages.length >= 7){ toast('Máximo 7 fotos principales por producto', 'err'); return; }
  pmImages.push('');
  renderImageGrid();
}
function removeImageField(i){ pmImages.splice(i,1); if(!pmImages.length) pmImages.push(''); renderImageGrid(); }

/* Visor de fotos a pantalla completa del editor: muestra la foto en su
   resolución real (la que se va a guardar), para verificar nitidez antes
   de publicar. Funciona igual para fotos de producto y de variantes. */
let _adminViewerEl = null, _adminViewerImg = null;
function openAdminViewer(url){
  if(!url) return;
  if(!_adminViewerEl){
    _adminViewerEl = document.getElementById('adminViewer');
    _adminViewerImg = document.getElementById('adminViewerImg');
  }
  _adminViewerImg.src = url;
  _adminViewerEl.classList.add('show');
}
function closeAdminViewer(ev){
  if(ev && ev.target && ev.target !== document.getElementById('adminViewer')) return;
  const el = _adminViewerEl || document.getElementById('adminViewer');
  if(el) el.classList.remove('show');
}
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' || e.key === 'Esc') closeAdminViewer();
});

/* ---------- fotos del negocio para el carrusel del landing (subidas como archivo, comprimidas a base64) ---------- */
let bizImages = ['','',''];
let bizImgSlot = null;
/* Sin límite de peso - las fotos se guardan en Firebase Storage, no en Firestore documentos */
function renderBizImageGrid(){
  const grid = document.getElementById('bizImgGrid');
  if(!grid) return;
  grid.innerHTML = bizImages.map((url,i) => {
    const preview = url ?
      '<img src="' + url + '">' :
      '<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg><span>Subir foto</span></div>';
    return '<div class="media-item' + (url?' filled':' upload') + '" onclick="triggerBizImageUpload(' + i + ')" title="' + (url?'Cambiar foto':'Subir foto') + '">' +
      preview +
      (url ? '<button type="button" class="rm-btn" onclick="event.stopPropagation();removeBizImageField(' + i + ')" title="Quitar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' : '') +
    '</div>';
  }).join('');
}
function triggerBizImageUpload(i){ bizImgSlot = i; document.getElementById('bizImgFileInput').click(); }
function onBizImageFileChosen(input){
  const file = input.files && input.files[0];
  const slot = bizImgSlot;
  if(!file || slot===null){ input.value=''; return; }
  compressImageFile(file, 1600, 0.82).then(dataUrl => {
    bizImages[slot] = dataUrl;
    renderBizImageGrid();
    settingsFormDirty = true;
    toast('Foto cargada, recordá presionar "Guardar cambios"', 'ok');
  }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  input.value = '';
}
function addBizImageField(){ bizImages.push(''); renderBizImageGrid(); }
function removeBizImageField(i){
  bizImages.splice(i,1);
  while(bizImages.length < 3) bizImages.push('');
  renderBizImageGrid();
  settingsFormDirty = true;
}

/* ---------- variantes (opciones con precio y stock propios, ej. tamaños) ---------- */
let pmVariants = [];
function toggleVariantsUI(){
  const on = document.getElementById('pHasVariants').checked;
  document.getElementById('simplePricingBlock').style.display = on ? 'none' : 'block';
  document.getElementById('variantsBlock').style.display = on ? 'block' : 'none';
  if(on && !pmVariants.length){ addVariant(); addVariant(); }
}
function addVariant(){
  if(pmVariants.length >= 5){ toast('Máximo 5 variantes por producto', 'err'); return; }
  pmVariants.push({ id: rid(), name:'', price:0, stock:0, removed:false, image:'', images:[''] });
  renderVariantsPanel();
}
function removeVariant(id){
  const v = pmVariants.find(x=>x.id===id);
  if(v) v.removed = true;
  renderVariantsPanel();
}
function restoreVariant(id){
  const v = pmVariants.find(x=>x.id===id);
  if(v) v.removed = false;
  renderVariantsPanel();
}
function variantField(id, field, val){
  const v = pmVariants.find(x=>x.id===id);
  if(!v) return;
  v[field] = field==='name' ? val : Math.max(0, parseFloat(val)||0);
}
function variantImagesPadded(v){
  const src = (Array.isArray(v.images) ? v.images.filter(Boolean) : (v.image ? [v.image] : [])).slice(0,4);
  while(src.length<4) src.push('');
  return src;
}
function renderVariantsPanel(){
  const active = pmVariants.filter(v=>!v.removed);
  const removed = pmVariants.filter(v=>v.removed);
  document.getElementById('variantsList').innerHTML = active.length ? active.map(v =>
    '<div class="variant-row">' +
      '<div class="vr-main">' +
        '<div class="vr-imgs">' + variantImagesPadded(v).map((img,i) =>
          (img
            ? '<span class="vr-slot has" title="Ver la foto ampliada en alta resolución">' +
                '<img src="' + img + '" onclick="event.stopPropagation();openAdminViewer(this.src)" alt="Foto ' + (i+1) + '">' +
                (i===0 ? '<span class="tag">1º</span>' : '') +
                '<button type="button" class="vr-cam" title="Cambiar esta foto" onclick="event.stopPropagation();triggerVariantImageUpload(\'' + v.id + '\',' + i + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>' +
                '<button type="button" class="rm" title="Quitar foto" onclick="event.stopPropagation();removeVariantImage(\'' + v.id + '\',' + i + ')">✕</button>' +
              '</span>'
            : '<span class="vr-slot" title="Subir foto ' + (i+1) + '" onclick="triggerVariantImageUpload(\'' + v.id + '\',' + i + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span>')
        ).join('') + '</div>' +
        '<div class="vr-fields">' +
          '<input class="f-input" placeholder="Nombre (Ej: M)" value="' + esc(v.name) + '" oninput="variantField(\'' + v.id + '\',\'name\',this.value)">' +
          '<input class="f-input" type="number" min="0" step="100" placeholder="Precio ₡" value="' + (v.price||'') + '" oninput="variantField(\'' + v.id + '\',\'price\',this.value)">' +
          '<input class="f-input" type="number" min="0" placeholder="Unidades" value="' + (v.stock||'') + '" oninput="variantField(\'' + v.id + '\',\'stock\',this.value)">' +
        '</div>' +
        '<button type="button" class="vr-del" title="Eliminar" onclick="removeVariant(\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
      '</div>' +
    '</div>'
  ).join('') : '<div class="vr-empty">Agregá al menos una opción (ej: M, S, XL).</div>';

  document.getElementById('variantsRemovedWrap').style.display = removed.length ? 'block' : 'none';
  document.getElementById('variantsRemovedList').innerHTML = removed.map(v =>
    '<div class="variant-row removed">' +
      '<div class="vr-main">' +
        '<span class="vr-icon">' + (variantImagesPadded(v)[0] ? '<img src="' + variantImagesPadded(v)[0] + '">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-8"/><path d="M12 14c0-4.5-3.5-7.5-8-7.5 0 4.5 3.5 7.5 8 7.5zm0-3c0-4.5 3.5-7.5 8-7.5 0 4.5-3.5 7.5-8 7.5z"/></svg>') + '</span>' +
        '<div class="vr-fields"><span style="align-self:center;font-size:13px;font-weight:600">' + esc(v.name||'(sin nombre)') + '</span><span style="align-self:center;font-size:12.5px;color:var(--muted)">' + fmt(v.price) + '</span><span style="align-self:center;font-size:12.5px;color:var(--muted)">' + v.stock + ' uds</span></div>' +
        '<button type="button" class="vr-restore" title="Restaurar" onclick="restoreVariant(\'' + v.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '</div>' +
    '</div>'
  ).join('');
}
let variantImgSlot = null;
function triggerVariantImageUpload(vid, idx){
  variantImgSlot = { id: vid, idx: (idx==null ? 0 : idx) };
  document.getElementById('variantImgFileInput').click();
}
function removeVariantImage(vid, idx){
  const v = pmVariants.find(x=>x.id===vid);
  if(!v) return;
  v.images = variantImagesPadded(v);
  v.images[idx] = '';
  const filled = v.images.filter(Boolean);
  v.images = filled.length ? filled : [''];
  v.image = filled[0] || '';
  renderVariantsPanel();
}
function onVariantImageFileChosen(input){
  const file = input.files && input.files[0];
  const slot = variantImgSlot;
  if(!file || !slot){ input.value=''; return; }
  /* Fotos de los tamaños → ALTA RESOLUCIÓN (2048 px) y subidas a Firebase
     Storage (products/{tenant}/variants). La URL pública va en la variante —
     el documento de Firestore queda liviano y sin error de tamaño. */
  storageUploadImage(file, 'products/' + (TENANT_ID || 'x') + '/variants', 2048, 0.9).then(r => {
    const v = pmVariants.find(x=>x.id===slot.id);
    if(!v){ input.value=''; return; }
    const arr = variantImagesPadded(v);
    if(arr.filter(Boolean).length >= 4){
      toast('Máximo 4 fotos por variante', 'err');
      input.value=''; return;
    }
    arr[slot.idx] = r.url;
    v.images = arr.filter(Boolean);
    v.image = v.images[0] || '';
    renderVariantsPanel();
    toast('Foto de variante subida a Storage ✓', 'ok');
  }).catch(e => {
    console.error('Storage upload error (variante):', e);
    /* Respaldo: base64 si Storage no está disponible */
    compressImageFile(file, 2048, 0.9).then(dataUrl => {
      const v = pmVariants.find(x=>x.id===slot.id);
      if(!v){ input.value=''; return; }
      const arr = variantImagesPadded(v);
      if(arr.filter(Boolean).length >= 4){
        toast('Máximo 4 fotos por variante', 'err');
        input.value=''; return;
      }
      arr[slot.idx] = dataUrl;
      v.images = arr.filter(Boolean);
      v.image = v.images[0] || '';
      renderVariantsPanel();
      toast('Foto guardada (sin Storage) — se copió al documento', 'warn');
    }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  });
  input.value = '';
}

/* ---------- reseñas de clientes (nombre, estrellas, texto, foto opcional) ---------- */
let pmReviews = [];
function addReview(){
  pmReviews.push({ id: rid(), name:'', rating:5, text:'', photo:'', date: todayStr() });
  renderReviewsPanel();
}
function removeReview(id){ pmReviews = pmReviews.filter(r=>r.id!==id); renderReviewsPanel(); }
function reviewField(id, field, val){
  const r = pmReviews.find(x=>x.id===id);
  if(!r) return;
  r[field] = field==='rating' ? Math.min(5,Math.max(1,parseInt(val)||5)) : val;
  if(field==='rating') renderReviewsPanel();
}
function starPickerHTML(id, rating){
  let out = '';
  for(let i=1;i<=5;i++){
    out += '<button type="button" class="star-pick' + (i<=rating?' on':'') + '" onclick="reviewField(\'' + id + '\',\'rating\',' + i + ')">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1z"/></svg></button>';
  }
  return out;
}
function renderReviewsPanel(){
  const box = document.getElementById('reviewsList');
  box.innerHTML = pmReviews.length ? pmReviews.map(r =>
    '<div class="variant-row" style="align-items:flex-start">' +
      '<span class="vr-icon" title="Subir foto de la reseña" onclick="triggerReviewImageUpload(\'' + r.id + '\')">' +
        (r.photo ? '<img src="' + r.photo + '">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-8"/><path d="M12 14c0-4.5-3.5-7.5-8-7.5 0 4.5 3.5 7.5 8 7.5zm0-3c0-4.5 3.5-7.5 8-7.5 0 4.5-3.5 7.5-8 7.5z"/></svg>') +
      '</span>' +
      '<div class="vr-fields" style="grid-template-columns:1fr">' +
        '<input class="f-input" placeholder="Nombre del cliente" value="' + esc(r.name) + '" oninput="reviewField(\'' + r.id + '\',\'name\',this.value)">' +
        '<div class="star-picker">' + starPickerHTML(r.id, r.rating) + '</div>' +
        '<textarea class="f-input" placeholder="Comentario de la reseña" style="min-height:52px" oninput="reviewField(\'' + r.id + '\',\'text\',this.value)">' + esc(r.text) + '</textarea>' +
      '</div>' +
      '<button type="button" class="vr-del" title="Eliminar" onclick="removeReview(\'' + r.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    '</div>'
  ).join('') : '<div class="vr-empty">Sin reseñas todavía. Agregá alguna para mostrar calificación y comentarios a tus clientes.</div>';
}
let reviewImgSlot = null;
function triggerReviewImageUpload(id){ reviewImgSlot = id; document.getElementById('reviewImgFileInput').click(); }
function onReviewImageFileChosen(input){
  const file = input.files && input.files[0];
  const id = reviewImgSlot;
  if(!file || id===null){ input.value=''; return; }
  compressImageFile(file, 700, 0.72).then(dataUrl => {
    const r = pmReviews.find(x=>x.id===id);
    if(r){ r.photo = dataUrl; renderReviewsPanel(); }
  }).catch(()=> toast('No se pudo procesar esa foto', 'err'));
  input.value = '';
}

function openProductModal(id){
  if(!id){
    const limit = getProductLimit();
    if(products.length >= limit){
      toast('Alcanzaste el límite de ' + limit + ' productos de tu plan actual (' + (PLAN_NAMES_MAP[getActivePlanId()]||getActivePlanId()) + '). Subí de plan para agregar más.', 'err');
      return;
    }
  }
  const modal = document.getElementById('productModal');
  const catSel = document.getElementById('pCat');
  catSel.innerHTML = settings.categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
  if(id){
    const p = products.find(x=>x.id===id);
    if(!p) return;
    document.getElementById('pmTitle').textContent = 'Editar producto';
    document.getElementById('pId').value = p.id;
document.getElementById('pName').value = p.name;
    document.getElementById('pDesc').value = p.desc||'';
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pTag').value = p.tag||'';
    document.getElementById('pCost').value = p.cost || '';
    document.getElementById('pStock').value = p.unlimited ? '' : p.stock;
    catSel.value = p.cat;
    document.getElementById('pIcon').value = p.icon||'leaf';
    document.getElementById('pUnlimited').checked = !!p.unlimited;
    document.getElementById('pActive').checked = p.active !== false;
    document.getElementById('pVideoUrl').value = p.videoUrl||'';
    document.getElementById('pVideoLink').value = p.videoLink||'';
    document.getElementById('pTiktokUrl').value = p.tiktokUrl||'';
    pmImages = (p.images && p.images.length) ? p.images.slice() : [''];
    document.getElementById('pHasVariants').checked = !!p.hasVariants;
    document.getElementById('pVariantGroup').value = p.variantGroupName || 'Tamaños';
    pmVariants = (p.variants && p.variants.length) ? p.variants.map(v=>{
      const o = Object.assign({}, v);
      const padded = variantImagesPadded(o);
      o.images = padded;
      o.image = padded[0] || '';
      return o;
    }) : [];
    document.getElementById('pCompareAt').value = p.compareAtPrice || '';
    document.getElementById('pSoldCount').value = p.soldCount || '';
    document.getElementById('pDealHours').value = '';
    pmReviews = (p.reviews && p.reviews.length) ? p.reviews.map(r=>Object.assign({},r)) : [];
  } else {
document.getElementById('pmTitle').textContent = 'Crear producto';
    ['pId','pName','pDesc','pPrice','pTag','pCost','pStock','pVideoUrl','pVideoLink','pTiktokUrl'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('pIcon').value = 'leaf';
    document.getElementById('pUnlimited').checked = false;
    document.getElementById('pActive').checked = true;
    pmImages = [''];
    document.getElementById('pHasVariants').checked = false;
    document.getElementById('pVariantGroup').value = 'Tamaños';
    pmVariants = [];
    document.getElementById('pCompareAt').value = '';
    document.getElementById('pSoldCount').value = '';
    document.getElementById('pDealHours').value = '';
    pmReviews = [];
  }
  renderImageGrid();
  toggleVariantsUI();
  renderVariantsPanel();
  renderReviewsPanel();
  modal.classList.add('show');
}
function closeProductModal(){ document.getElementById('productModal').classList.remove('show'); }

async function saveProduct(){
  const id = document.getElementById('pId').value;
  const name = document.getElementById('pName').value.trim();
  const hasVariants = document.getElementById('pHasVariants').checked;
  const images = pmImages.map(u=>u.trim()).filter(Boolean);
  if(!name){ toast('El nombre es obligatorio', 'err'); return; }
  if(images.length < 1){ toast('Agregá al menos 1 foto del producto', 'err'); return; }
  if(!id){
    const limit = getProductLimit();
    if(products.length >= limit){
      toast('Alcanzaste el límite de ' + limit + ' productos de tu plan actual (' + (PLAN_NAMES_MAP[getActivePlanId()]||getActivePlanId()) + '). Subí de plan para agregar más.', 'err');
      return;
    }
  }

  let price, stock, unlimited, variants = [], variantGroupName = '';
if(hasVariants){
    variantGroupName = document.getElementById('pVariantGroup').value.trim() || 'Tamaños';
    variants = [];
    for(const v of pmVariants){
      const imgs = variantImagesPadded(v).filter(Boolean);
      variants.push({ id:v.id, name:(v.name||'').trim(), price:Math.max(0,+v.price||0), stock:Math.max(0,Math.round(+v.stock||0)), removed:!!v.removed, image: imgs[0] || '', images: imgs, thumbs: imgs.length ? await buildThumbsFor(imgs) : [] });
    }
    variants = variants.filter(v => v.name || v.removed);
    const activeV = variants.filter(v=>!v.removed);
    if(!activeV.length){ toast('Agregá al menos una opción de variante (ej: M, S, XL)', 'err'); return; }
    if(activeV.some(v=>!v.name)){ toast('Todas las opciones activas necesitan un nombre', 'err'); return; }
    price = Math.min(...activeV.map(v=>v.price));
    stock = activeV.reduce((s,v)=>s+v.stock, 0);
    unlimited = false;
  } else {
    price = parseFloat(document.getElementById('pPrice').value);
    unlimited = document.getElementById('pUnlimited').checked;
    stock = unlimited ? 0 : Math.max(0, parseInt(document.getElementById('pStock').value)||0);
    if(isNaN(price) || price < 0){ toast('Ingresá un precio válido', 'err'); return; }
  }

  const compareAtPrice = Math.max(0, parseFloat(document.getElementById('pCompareAt').value)||0);
  const soldCount = Math.max(0, parseInt(document.getElementById('pSoldCount').value)||0);
  const dealHoursRaw = document.getElementById('pDealHours').value;
  const existing = id ? products.find(x=>x.id===id) : null;
  let dealEndsAt = existing ? (existing.dealEndsAt||0) : 0;
  if(dealHoursRaw !== ''){
    const h = Math.max(0, parseFloat(dealHoursRaw)||0);
    dealEndsAt = h > 0 ? (Date.now() + h*3600000) : 0;
  }
  const reviews = pmReviews
    .map(r => ({ id:r.id, name:(r.name||'').trim(), rating:Math.min(5,Math.max(1,parseInt(r.rating)||5)), text:(r.text||'').trim(), photo:r.photo||'', date:r.date||todayStr() }))
    .filter(r => r.name || r.text);

  // Miniaturas livianas para que la grilla del catálogo cargue más rápido
  // (ver firstThumb). Se generan siempre al guardar, así que con solo volver
  // a guardar un producto viejo (aunque no le cambies nada) ya gana el
  // acelerador de carga.
  let thumbs = images.length ? await buildThumbsFor(images) : [];

  // Red de seguridad de tamaño (límite 1 MiB por documento de Firestore):
  // mientras el total de fotos (portada + fotos + tamaños) quepa, se guardan
  // completas a 1600 px para que el cliente las vea nítidas y grandes. Si el
  // documento quedaría muy pesado, se reducen en pasos las fotos menos
  // importantes (tamaños y fotos adicionales primero) para que el guardado
  // nunca falle ni se pierdan fotos por error de Firestore.
  let totalMediaChars = images.reduce((s,u)=>s+imageCharSize(u),0)
    + variants.reduce((s,v)=>s+(v.images||[]).reduce((t,u)=>t+imageCharSize(u),0),0);
  if(totalMediaChars > PRODUCT_MEDIA_BUDGET){
    const cells = [];
    for(const v of variants){
      (v.images||[]).forEach((u,i)=>{ if(u){ cells.push({ arr: v.images, i }); } });
    }
    images.forEach((u,i)=>{ if(u){ cells.push({ arr: images, i }); } });
    const perCell = Math.max(12000, Math.floor(PRODUCT_MEDIA_BUDGET / Math.max(1, cells.length)));
    for(const c of cells){
      try{ c.arr[c.i] = await fitImageChars(c.arr[c.i], perCell); }
      catch(e){ console.warn('No se pudo ajustar el peso de una foto:', e); }
    }
    thumbs = images.length ? await buildThumbsFor(images) : [];
    for(const v of variants){
      const imgs = (v.images||[]).filter(Boolean);
      if(imgs.length){ try{ v.thumbs = await buildThumbsFor(imgs); } catch(e){ v.thumbs = []; } }
    }
  }

const data = {
    name, desc:document.getElementById('pDesc').value.trim(), price,
    tag:(document.getElementById('pTag').value||'').trim(),
    cost:Math.max(0, parseFloat(document.getElementById('pCost').value)||0),
    stock, unlimited, cat:document.getElementById('pCat').value,
    icon:document.getElementById('pIcon').value, active:document.getElementById('pActive').checked,
    images, thumbs,
    videoUrl:document.getElementById('pVideoUrl').value.trim(),
    videoLink:document.getElementById('pVideoLink').value.trim(),
    tiktokUrl:document.getElementById('pTiktokUrl').value.trim(),
    hasVariants, variantGroupName, variants,
    compareAtPrice, soldCount, dealEndsAt, reviews
  };
  try{
    await saveProductToDB(id||null, data);
    toast(id ? 'Producto actualizado' : 'Producto creado', 'ok');
    closeProductModal();
  }catch(e){
    toast('No se pudo guardar el producto: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}

async function deleteProduct(id){
  const p = products.find(x=>x.id===id);
  if(!p) return;
  if(!confirm('¿Eliminar "' + p.name + '" del inventario?')) return;
  try{
    await deleteProductFromDB(id);
    toast('Producto eliminado', 'ok');
  }catch(e){
    toast('No se pudo eliminar el producto: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}

/* ---------- pedidos ---------- */
const STATUS = {
  en_espera:{lbl:'En espera', cls:'amber'},
  recibido:{lbl:'Recibido', cls:'gray'},
  confirmado:{lbl:'Pago confirmado', cls:'blue'},
  preparando:{lbl:'Preparando', cls:'amber'},
  en_camino:{lbl:'En camino', cls:'amber'},
  entregado:{lbl:'Entregado', cls:'green'},
  cancelado:{lbl:'Cancelado', cls:'red'}
};
function renderOrders(){
  const f = document.getElementById('orderFilter').value;
  const list = orders.filter(o=>!f || o.status===f);
  document.getElementById('ordersBody').innerHTML = list.map(o => {
    const d = new Date(o.date);
    const itemsTxt = o.items.map(it=>it.qty+'× '+it.name).join(', ');
    const st = STATUS[o.status]||STATUS.recibido;
    return '<tr>' +
      '<td><b>' + o.number + '</b><div class="order-meta">' + d.toLocaleDateString('es-CR') + ' ' + d.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) + '</div></td>' +
      '<td><span class="order-client">' + esc(o.customer.name) + '</span><div class="order-meta">' + esc(o.customer.phone) + '</div></td>' +
      '<td><div class="order-items-list" title="' + esc(itemsTxt) + '">' + esc(itemsTxt.length>70 ? itemsTxt.slice(0,70)+'…' : itemsTxt) + '</div></td>' +
      '<td><b>' + fmt(o.total) + '</b></td>' +
      '<td><select class="status-sel" onchange="setOrderStatus(\'' + o.number + '\', this.value)">' +
        Object.keys(STATUS).map(k=>'<option value="'+k+'"'+(o.status===k?' selected':'')+'>'+STATUS[k].lbl+'</option>').join('') +
      '</select></td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        (o.proofImage ? '<button class="icon-btn" title="Ver comprobante" onclick="viewOrderProof(\'' + o.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></button>' : '') +
        '<button class="icon-btn" title="Ver factura" onclick="viewOrder(\'' + o.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
        '<a class="icon-btn" title="WhatsApp del cliente" target="_blank" href="https://wa.me/' + waDigits(o.customer.phone) + '?text=' + encodeURIComponent('Hola ' + o.customer.name + ', te contactamos de ' + settings.storeName + ' por tu pedido ' + o.number + '.') + '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z"/></svg></a>' +
        '<button class="icon-btn danger" title="Eliminar" onclick="deleteOrder(\'' + o.number + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0-1 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 6"/></svg></button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Aún no hay pedidos. Cuando un cliente compre en la tienda, aparecerá aquí.</td></tr>';
}
async function setOrderStatus(num, status){
  const o = orders.find(x=>x.number===num);
  if(!o) return;
  try{
    const timeline = (o.timeline||[]).concat([{status, at:new Date().toISOString()}]);
    await ordersCol.doc(num).update({ status, timeline });
    toast('Pedido ' + num + ' → ' + STATUS[status].lbl, 'ok');
  }catch(e){
    toast('No se pudo actualizar el estado: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}
async function deleteOrder(num){
  if(!confirm('¿Eliminar el pedido ' + num + '?')) return;
  try{
    await ordersCol.doc(num).delete();
    toast('Pedido eliminado', 'ok');
  }catch(e){
    toast('No se pudo eliminar el pedido: ' + (e && e.message ? e.message : 'error desconocido'), 'err');
    console.error(e);
  }
}
/* ---------- HISTORIAL DE MENSAJES DEL FORMULARIO (landing) ----------
   Cada envío del formulario de contacto queda en
   tenants/{slug}/siteMessages y se muestra acá con opción de marcar
   leído o eliminar. El badge del nav muestra los no leídos. */
let messagesCol = null;
function messagesRef(){
  if(!messagesCol) messagesCol = db.collection('tenants').doc(TENANT_ID).collection('siteMessages');
  return messagesCol;
}
async function renderMessages(){
  const box = document.getElementById('messagesList');
  if(!box) return;
  box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:24px">Cargando mensajes…</div>';
  try{
    const q = await messagesRef().orderBy('createdAt', 'desc').limit(200).get();
    const list = q.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
    if(!list.length){
      box.innerHTML = '<div style="text-align:center;color:var(--muted);padding:40px;background:#F7F9FB;border:1.5px dashed #E8EDF2;border-radius:14px">Aún no hay mensajes del formulario de contacto. Cuando un visitante escriba en "Contacto", aparecerá aquí.</div>';
      updateMessagesBadge();
      return;
    }
    box.innerHTML = list.map(function(m){
      const d = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
      const dt = (isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-CR') + ' · ' + d.toLocaleTimeString('es-CR', {hour:'2-digit',minute:'2-digit'}));
      const wa = m.phone ? '<a class="icon-btn" target="_blank" href="https://wa.me/' + waDigits(m.phone) + '?text=' + encodeURIComponent('Hola ' + (m.name||'') + ', te escribimos de ' + (settings && settings.storeName ? settings.storeName : 'nuestro negocio') + '.') + '" title="Responder por WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2z"/></svg></a>' : '';
      return '<div class="msg-card' + (m.leido ? '' : ' unread') + '">' +
        '<div class="msg-head"><b>' + esc(m.name || 'Anónimo') + '</b><span class="msg-date">' + dt + '</span></div>' +
        (m.email ? '<div class="msg-meta">📧 ' + esc(m.email) + '</div>' : '') +
        (m.phone ? '<div class="msg-meta">📱 ' + esc(m.phone) + '</div>' : '') +
        (m.message ? '<div class="msg-body">' + esc(m.message) + '</div>' : '') +
        '<div class="msg-actions">' +
          '<button class="icon-btn" title="Marcar leído/no leído" onclick="toggleMessageRead(\'' + m.id + '\', ' + (m.leido ? 'true' : 'false') + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></button>' +
          wa +
          '<button class="icon-btn danger" title="Eliminar" onclick="deleteMessage(\'' + m.id + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m1 0-1 15a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 6"/></svg></button>' +
        '</div></div>';
    }).join('');
    updateMessagesBadge();
  }catch(e){
    console.error(e);
    box.innerHTML = '<div style="text-align:center;color:var(--danger);padding:24px">No se pudieron cargar los mensajes: ' + esc(e && e.message ? e.message : 'error') + '</div>';
  }
}
async function toggleMessageRead(id, current){
  try{
    await messagesRef().doc(id).update({ leido: !current });
    renderMessages();
  }catch(e){ toast('No se pudo actualizar: ' + (e && e.message ? e.message : 'error'), 'err'); }
}
async function deleteMessage(id){
  if(!confirm('¿Eliminar este mensaje definitivamente?')) return;
  try{
    await messagesRef().doc(id).delete();
    toast('Mensaje eliminado', 'ok');
    renderMessages();
  }catch(e){ toast('No se pudo eliminar: ' + (e && e.message ? e.message : 'error'), 'err'); }
}
/* Badge del nav con la cantidad de mensajes no leídos */
async function updateMessagesBadge(){
  const b = document.getElementById('messagesNavBadge');
  if(!b) return;
  try{
    const snap = await messagesRef().where('leido', '==', false).limit(50).get();
    const n = snap.size;
    if(n > 0){ b.textContent = n > 50 ? '50+' : n; b.style.display = ''; }
    else b.style.display = 'none';
  }catch(e){ b.style.display = 'none'; }
}
function messagesColInit(){
  updateMessagesBadge();
  setInterval(updateMessagesBadge, 60000);
}
function viewOrder(num){
  const o = orders.find(x=>x.number===num);
  if(!o) return;
  lastOrder = o;
  const st = STATUS[o.status]||STATUS.recibido;  const quickBtns = o.status==='cancelado' ? '' :
    '<div class="inv-actions" style="padding:0 0 16px;gap:8px;flex-wrap:wrap">' +
      (o.status!=='entregado' ? '<button class="btn-primary" style="width:auto;padding:9px 16px" onclick="setOrderStatus(\'' + o.number + '\',\'entregado\')">Marcar como entregado</button>' : '') +
      (o.status==='recibido' || o.status==='en_espera' ? '<button class="btn-ghost" style="width:auto;padding:9px 16px" onclick="setOrderStatus(\'' + o.number + '\',\'confirmado\')">Confirmar pago</button>' : '') +
    '</div>';
document.getElementById('orderDetail').innerHTML =
    '<div style="margin-bottom:12px"><span class="pill ' + st.cls + '">' + st.lbl + '</span></div>' +
    '<div class="invoice" id="orderDetailInvoice">' + invoiceHTML(o) + '</div>' +
    '<div class="inv-actions" style="padding:16px 0 0">' +
      '<button class="btn-ghost" onclick="printInvoice()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimir factura</button>' +
    '</div>' +
    quickBtns +
    '<div class="uber-track-admin">' + orderStepsHTML(o) + '</div>';
  document.getElementById('orderModal').classList.add('show');
  setTimeout(()=>{
    const inv = document.getElementById('orderDetailInvoice');
    if(inv){ inv.scrollIntoView({behavior:'smooth', block:'center'}); }
  }, 80);
}
/* Abre el comprobante de pago de un pedido en una ventana modal */
function viewOrderProof(num){
  const o = orders.find(x=>x.number===num);
  if(!o || !o.proofImage){ toast('Este pedido no tiene comprobante adjunto', 'warn'); return; }
  const st = STATUS[o.status]||STATUS.recibido;
  const name = (o.customer && o.customer.name) || 'cliente';
  document.getElementById('orderDetail').innerHTML =
    '<div style="margin-bottom:12px"><span class="pill ' + st.cls + '">' + st.lbl + '</span></div>' +
    '<div style="font-size:14px;font-weight:700;margin-bottom:6px">Comprobante de pago — ' + esc(o.number) + '</div>' +
    '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">Cliente: ' + esc(name) + ' · Total: ' + fmt(o.total) + '</div>' +
    '<div style="background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;justify-content:center">' +
      '<img src="' + esc(o.proofImage) + '" alt="Comprobante" style="max-width:100%;max-height:70vh;border-radius:8px;object-fit:contain">' +
    '</div>' +
    '<div class="inv-actions" style="padding:14px 0 0"><button class="btn-ghost" onclick="viewOrder(\'' + o.number + '\')">← Volver al pedido</button></div>';
  document.getElementById('orderModal').classList.add('show');
}
