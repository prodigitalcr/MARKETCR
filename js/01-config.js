  /* Este es el ÚNICO proyecto Firebase de TODA la plataforma. Las 5 (o más)
     tiendas viven en el mismo proyecto, separadas por documento dentro de
     la colección "tenants" (ver más abajo). No hay que crear un proyecto
     Firebase nuevo por cada negocio. */
  const firebaseConfig = {
    apiKey: "AIzaSyBOb3nCj4YS7Dmi6zic_yB3KCS-UHVVgpc",
    authDomain: "canaan-24688.firebaseapp.com",
    projectId: "canaan-24688",
    storageBucket: "canaan-24688.firebasestorage.app",
    messagingSenderId: "952571784784",
    appId: "1:952571784784:web:258ce5e88c17e7a353ab55",
    measurementId: "G-C2PKV0EFNW"
  };
  firebase.initializeApp(firebaseConfig);
  /* App Check (seguridad): valida que quien llama sea tu app real, no un bot.
     Si el script o la clave fallan, las llamadas igual siguen con auth normal.
     NOTA: App Check requiere que esté habilitado en Firebase Console con un
     proveedor de reCAPTCHA registrado. Si no está configurado, activarlo aquí
     HACE FALLAR las Cloud Functions (aiStatus, aiModels, etc.). Por eso se
     deja desactivado: las funciones usan solo autenticación de Firebase. */
  const RECAPTCHA_SITE_KEY = '6LdrmY4tAAAAAHt27QkcdnCVrdV93PMK5iQrieL5';
  try{
    if(window.firebase && firebase.appCheck && RECAPTCHA_SITE_KEY && window.location.hostname.includes('localhost')){
      firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), true);
    }
  }catch(e){ console.warn('App Check no se pudo inicializar:', e); }
  const auth = firebase.auth();
  const db = firebase.firestore();
  /* Cloud Functions (backend seguro de IA): el navegador NUNCA usa las API
     keys directamente. Todas las llamadas a proveedores de IA pasan por acá. */
const cloudFns = firebase.functions();
  async function cloudCall(name, data){
    try{
      const user = (auth && auth.currentUser) ? auth.currentUser : null;
      if(!user){ toast('Iniciá sesión primero para usar funciones de IA', 'err'); return null; }
      const isSuper = user && SUPERADMIN_EMAILS?.includes(user.email);
      const isAdmin = user && (ADMIN_EMAILS?.includes(user.email) || isSuper);
      const readOnlyCalls = ['aiStatus', 'aiModels'];
      if(!isSuper && !readOnlyCalls.includes(name)){
        toast('Solo el superadmin puede invocar esta función de IA', 'err'); return null;
      }
      if(!isAdmin){ toast('Se requieren permisos de administrador', 'err'); return null; }
      const fn = cloudFns.httpsCallable(name);
      const res = await fn(data || {});
      return res.data;
    }catch(e){
      let msg = e.message || 'error desconocido';
      if(e.code === 'internal' || msg.includes('INTERNAL')){
        msg = 'Error interno del servidor (Cloud Function). Revisa logs en Firebase Console → Functions → Logs.';
      }else if(e.code === 'permission-denied' || msg.includes('PERMISSION')){
        const myEmail = (auth.currentUser && auth.currentUser.email) || 'sin sesión';
        msg = 'Permiso denegado. ' + msg + ' | Tu sesión actual: ' + myEmail;
      }else if(e.code === 'unauthenticated'){
        msg = 'Sesión expirada. Vuelve a iniciar sesión.';
      }else if(e.code === 'unavailable'){
        msg = 'Servicio no disponible. Intenta de nuevo en unos segundos.';
      }else if(e.code === 'not-found'){
        msg = 'Tienda no encontrada en Firestore. Verificá el slug.';
      }
      toast('Error al invocar "' + name + '": ' + msg, 'err');
      console.error('cloudCall error [' + name + ']:', e);
      return null;
    }
  }
  /* Diagnóstico: si una callable falla, hace un segundo intento MANUAL (con
     el token del usuario) y devuelve el status HTTP crudo para saber si el
     bloqueo es del gateway (CORS/IAM) o de la función misma. */
  async function cloudCallDiag(name, data){
    try{
      const user = (auth && auth.currentUser) ? auth.currentUser : null;
      let tok = null;
      if(user) tok = await user.getIdToken(true);
      const url = 'https://us-central1-canaan-24688.cloudfunctions.net/' + name;
      const opts = { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ data: data || {} }) };
      if(tok) opts.headers['Authorization'] = 'Bearer ' + tok;
      const r = await fetch(url, opts);
      let body = '';
      try{ body = await r.text(); }catch(_e){}
      let parsed = null;
      try{ parsed = JSON.parse(body); }catch(_e){}
      return { status: r.status, contentType: r.headers.get('content-type'), session: !!user, hasToken: !!tok,
               body, parsed };
    }catch(e){
      return { diagError: (e && e.message ? e.message : String(e)), session: false };
    }
  }
  /* Cache local (IndexedDB): la info de la tienda (settings) y el catálogo
     (products) quedan guardados en el navegador del cliente. La próxima vez
     que entre a la misma tienda (o navegue entre tiendas ya visitadas), la
     grilla y el banner pintan CASI instantáneo desde este cache mientras
     Firestore confirma en segundo plano si hay cambios — en vez de esperar
     siempre a la red. synchronizeTabs permite tener la tienda abierta en
     varias pestañas sin que compitan por el mismo cache. Si el navegador no
     lo soporta (modo privado, Safari viejo, etc.) simplemente se ignora y
     la tienda sigue funcionando igual que antes, solo sin este acelerador. */
  try{
    db.enablePersistence({ synchronizeTabs:true }).catch(err=>{
      if(err && (err.code==='failed-precondition' || err.code==='unimplemented')){
        console.warn('Cache local de Firestore no disponible en este navegador/pestaña:', err.code);
      } else {
        console.warn('No se pudo activar el cache local de Firestore:', err);
      }
    });
  }catch(e){ console.warn('enablePersistence no soportado:', e); }
  /* Los correos admin YA NO se escriben aquí en el código: cada negocio
     tiene su propia lista de correos autorizados dentro de su documento
     en la colección "tenants" de Firestore (campo adminEmails). Esta
     variable se llena en tiempo real cuando la app detecta qué tienda
     (?tienda=slug) se está mostrando. */
  let ADMIN_EMAILS = [];
  window.ADMIN_EMAILS = ADMIN_EMAILS;
  /* Correos autorizados como SUPERADMINISTRADOR de TODA la plataforma
     (todas las tiendas y todos los profesionales, sin importar el
     negocio). Se accede agregando ?superadmin=1 a la URL. Cambiá esta
     lista por los correos reales que deban tener este acceso maestro. */
  /* ⚠️  IMPORTANTE ANTES DE DEPLOY: cambiá "admin@prodigital.com" por el
     correo REAL de tu cuenta de Firebase. Si alguien registra ese correo
     antes que vos, obtiene acceso total a toda la plataforma. */
  // Superadmin emails - se cargan desde platform/config en Firestore
// Fallback hardcodeado solo para compatibilidad inicial
const SUPERADMIN_EMAILS = ["admin@prodigital.com"];
  window.SUPERADMIN_EMAILS = SUPERADMIN_EMAILS;
  /* Clave maestra para poder CREAR negocios nuevos desde la página de
     inicio (el selector de negocios). Solo protege quién puede crear un
     negocio nuevo desde la interfaz; es una capa de conveniencia, no
     seguridad de servidor. Para una protección real, agregá también una
     regla en Firestore Security Rules que limite quién puede escribir
     documentos nuevos en la colección "tenants". Cambiá este valor por
     el tuyo. */
  /* PLATFORM_MASTER_KEY eliminada: estaba declarada pero nunca se usaba en
     el código. Si en el futuro querés proteger la creación de tenants desde
     la landing, reintroducila y validala en saCreateTenant(). */
