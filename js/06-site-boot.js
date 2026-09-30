/* ==========================================================================
   SITIO WEB PROFESIONAL — plantilla multi-negocio de MARKET CR
   -------------------------------------------------------------
   Toda la información del sitio vive en siteConfig (un solo objeto), que se
   guarda en tenants/{slug}/sites/corporate. El render NO tiene textos fijos:
   cambia el objeto y cambia el sitio completo. Para un negocio nuevo solo hay
   que darle su propio siteConfig → plantilla 100% reutilizable.
   Referencias a MARKET CR: botones "Ver catálogo"/categorías/CTA llevan al
   catálogo real de la tienda (siteStoreUrl()).
   ========================================================================== */
let siteConfig = null, siteUnsub = null, siteSectionTab = 'plantillas', siteViewOverride = null, siteDemoActive = false;

const SITE_DEFAULTS = {
  active: false,
  businessName: '', tagline: '', logoUrl: '',
  primaryColor: '#1B7A43', secondaryColor: '#0F5A30', accentColor: '#FFD100',
  seoTitle: '', seoDesc: '',
  /* Videos por enlace (YouTube o directo):
     - videoVertical: formato historia (9:16) grande, para el hero de la landing.
     - videoHorizontal: alta calidad (16:9) para la sección de presentación. */
  videoVertical: '',
  videoHorizontal: '',
  hero: {
    badge: 'Catálogo y venta directa · MARKET CR',
    title: 'Plantas que transforman tu espacio y llegan hasta tu puerta',
    sub: 'Escribinos y llevamos tu pedido donde lo necesitás. Atención personalizada, calidad garantizada y compra fácil desde tu celular.',
    image: 'https://picsum.photos/seed/vivero-hero/900/720'
  },
  benefits: [
    { icon: 'leaf', title: 'Calidad garantizada', desc: 'Revisamos cada producto antes de entregarlo para que recibas solo lo mejor.' },
    { icon: 'truck', title: 'Entregas rápidas', desc: 'Coordina la entrega a domicilio o retiro en tienda, cuando te quede mejor.' },
    { icon: 'chat', title: 'Atención personalizada', desc: 'Te asesoramos por WhatsApp antes de comprar, sin compromiso.' },
    { icon: 'cart', title: 'Compra fácil y segura', desc: 'Pedís por WhatsApp y confirmás el pago de forma simple y segura.' }
  ],
  categories: [
    { name: 'Plantas de interior', desc: 'Verdes que llenan de vida cualquier espacio de tu casa u oficina.', image: 'https://picsum.photos/seed/vc-cat1/640/480', tag: '' },
    { name: 'Suculentas', desc: 'Fáciles de cuidar, perfectas para empezar tu colección.', image: 'https://picsum.photos/seed/vc-cat2/640/480', tag: '' },
    { name: 'Macetas y diseños', desc: 'Recipientes y jardines que decoran y enamoran.', image: 'https://picsum.photos/seed/vc-cat3/640/480', tag: '' },
    { name: 'Ofertas', desc: 'Promociones de la semana: no te las pierdas.', image: 'https://picsum.photos/seed/vc-cat4/640/480', tag: 'descuento' },
    { name: 'Nuevos ingresos', desc: 'Lo último que llegó a la tienda.', image: 'https://picsum.photos/seed/vc-cat5/640/480', tag: 'nuevo' },
    { name: 'Regalos y detalles', desc: 'Ideas verdes para regalar y sorprender.', image: 'https://picsum.photos/seed/vc-cat6/640/480', tag: '' }
  ],
  featured: [
    { name: 'Ficus Lyrata 1.40 m', desc: 'Una figura viva para tu living, fácil de mantener.', price: '¢22.000', old: '', image: 'https://picsum.photos/seed/vc-p1/800/800', tag: 'Popular', productId: '' },
    { name: 'Set de 3 Suculentas', desc: 'Mini jardín de suculentas en macetas de cerámica.', price: '¢9.500', old: '¢12.500', image: 'https://picsum.photos/seed/vc-p2/800/800', tag: '-24%', productId: '' },
    { name: 'Maceta Artesanal XXL', desc: 'Diseño único hecho a mano para tus plantas grandes.', price: '¢15.000', old: '', image: 'https://picsum.photos/seed/vc-p3/800/800', tag: '', productId: '' },
    { name: 'Lavanda en Maceta', desc: 'Aroma natural y un toque de color para ventanas.', price: '¢6.800', old: '', image: 'https://picsum.photos/seed/vc-p4/800/800', tag: 'Nuevo', productId: '' },
    { name: 'Kokedama de Pothos', desc: 'Planta decorativa sin maceta: la tendencia más fácil.', price: '¢12.000', old: '¢15.000', image: 'https://picsum.photos/seed/vc-p5/800/800', tag: '-20%', productId: '' },
    { name: 'Kit Huerta en Casa', desc: 'Todo lo necesario para tu huerta urbana.', price: '¢18.500', old: '¢23.000', image: 'https://picsum.photos/seed/vc-p6/800/800', tag: '-20%', productId: '' }
  ],
  offer: {
    name: 'Set Jardín Premium', percent: '-25%', old: '¢20.000', price: '¢15.000',
    message: 'Válido por tiempo limitado. Pedí el tuyo hoy y te lo llevamos a domicilio.',
    image: 'https://picsum.photos/seed/vc-oferta/800/600', ends: ''
  },
  about: {
    title: 'Un negocio con raíces: conocé quién está detrás',
    text: 'Empezamos vendiendo plantas en nuestro corredor y hoy somos un espacio querido en la comunidad. Creemos que una planta llena de vida cualquier rincón, y por eso cuidamos cada detalle: selección, cuidado y entrega.',
    mission: 'Llevar naturaleza y bienestar a cada hogar, con atención cercana, honesta y precios justos.',
    values: ['Calidad garantizada', 'Atención cercana', 'Entrega a domicilio'],
    experience: '8',
    image: 'https://picsum.photos/seed/vc-about/800/620'
  },
  whyUs: [
    { icon: 'leaf', title: 'Calidad garantizada', desc: 'Seleccionamos y revisamos cada pieza antes de entregarla.' },
    { icon: 'heart', title: 'Atención personalizada', desc: 'Te asesoramos por WhatsApp paso a paso, sin tecnicismos.' },
    { icon: 'tag', title: 'Precios competitivos', desc: 'Muy buen precio sin sacrificar la calidad de lo que vendés.' },
    { icon: 'award', title: 'Experiencia de confianza', desc: 'Años de experiencia al servicio de nuestros clientes.' },
    { icon: 'truck', title: 'Entrega a domicilio', desc: 'Coordinamos la entrega para que recibas todo en perfectas condiciones.' },
    { icon: 'cart', title: 'Facilidad de compra', desc: 'Pedís desde tu celular en minutos y confirmás el pago sin trámites.' }
  ],
  testimonials: [
    { name: 'María Fernanda Q.', photo: '', comment: 'Compré una planta para regalar y la atención fue increíble. Me la entregaron el mismo día, impecable. Muy recomendados.', stars: 5 },
    { name: 'Andrés Villalobos', photo: '', comment: 'Excelente calidad y precios justos. Ya soy cliente de varias veces, 100% confiables.', stars: 5 },
    { name: 'Karla Solano', photo: '', comment: 'Me asesoraron por WhatsApp para elegir las plantas de mi oficina. ¡Quedó hermosa! Gracias por el detalle.', stars: 5 }
  ],
  gallery: [
    'https://picsum.photos/seed/vc-g1/700/700', 'https://picsum.photos/seed/vc-g2/700/700',
    'https://picsum.photos/seed/vc-g3/700/700', 'https://picsum.photos/seed/vc-g4/700/700',
    'https://picsum.photos/seed/vc-g5/700/700', 'https://picsum.photos/seed/vc-g6/700/700',
    'https://picsum.photos/seed/vc-g7/700/700', 'https://picsum.photos/seed/vc-g8/700/700'
  ],
  cta: {
    title: '¿Encontraste lo que buscabas?',
    sub: 'Estamos listos para atenderte. Escribinos por WhatsApp y en minutos te enviamos tu pedido.'
  },
  contact: {
    whatsapp: '', phone: '', email: 'hola@micomercio.com', address: 'San José, Costa Rica',
    hours: 'Lunes a Sábado · 8:00 am - 6:00 pm', mapQuery: 'San José, Costa Rica',
    facebook: '', instagram: '', tiktok: ''
  },
  footer: {
    about: 'Tu espacio a un mensaje de distancia. Productos de calidad, entrega a domicilio y atención personalizada.',
    notice: 'Comercio asociado a MARKET CR',
    bg: '#0E1420', text: '#9AA6B5', strong: '#D7DEE8', accent: '#FFD100'
  }
};
/* ==================== TEMAS PREESTABLECIDOS (5 plantillas) ====================
   El admin puede empezar la landing con una de estas plantillas: cambia
   colores, fuentes, estilos del hero y textos sugeridos. Se aplican con
   "Usar este tema" (aplica los colores/estilos al editor y vista previa). */
/* ==================== PLANTILLAS PREDEFINIDAS ====================
   En lugar de simples temas de colores, cada plantilla es una landing
   COMPLETA lista para editar: textos reales, imágenes, colores y secciones
   armadas. Se aplican con un clic y se guardan igual que todo lo demás. */
 const SITE_TEMPLATES = [
  {id:'tpl-verde', name:'🌿 Verde Natural', desc:'Plantas, jardín o naturales', thumbnail:'tpl-verde', seed:{primaryColor:'#1B7A43', secondaryColor:'#0F5A30', accentColor:'#FFD100', heroBadge:'Catálogo y venta directa · MARKET CR', heroTitle:'Naturaleza que transforma tu espacio', heroSub:'Productos seleccionados con calidad garantizada y entrega a domicilio.', heroLayout:'left', benefitsCols:4, productStyle:'grid', galleryStyle:'grid', rounded:18, heroMediaShape:'rounded', heroStyle:'split', cardStyle:'soft', benefitStyle:'icon', categoryStyle:'card', typography:'modern', decor:'blob', ctaStyle:'gradient', footerStyle:'dark', animTheme:'slide', bgTheme:'wave'}},
  {id:'tpl-ruby', name:'💜 Rubí Premium', desc:'Marca premium o servicios', thumbnail:'tpl-ruby', seed:{primaryColor:'#7C3AED', secondaryColor:'#5B21B6', accentColor:'#FDE047', heroBadge:'Experiencia premium · MARKET CR', heroTitle:'Calidad premium que se nota', heroSub:'Cuidamos cada detalle para que tu experiencia sea única.', heroLayout:'right', benefitsCols:3, productStyle:'rows', galleryStyle:'carousel', rounded:24, heroMediaShape:'circle', heroStyle:'split', cardStyle:'shadow', benefitStyle:'numbered', categoryStyle:'card', typography:'serif', decor:'blob', ctaStyle:'gradient', footerStyle:'brand', animTheme:'float', bgTheme:'aurora'}},
  {id:'tpl-sol', name:'🌞 Sol Dorado', desc:'Café, repostería o moda', thumbnail:'tpl-sol', seed:{primaryColor:'#D97706', secondaryColor:'#92400E', accentColor:'#FDE68A', heroBadge:'Frescura y sabor · MARKET CR', heroTitle:'Lo mejor llega con calor humano', heroSub:'Preparado con dedicación y entregado con amor a tu puerta.', heroLayout:'center', benefitsCols:2, productStyle:'grid', galleryStyle:'grid', rounded:16, heroMediaShape:'rounded', heroStyle:'stacked', cardStyle:'soft', benefitStyle:'icon', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'gradient', footerStyle:'dark', animTheme:'pop', bgTheme:'light'}},
  {id:'tpl-oceano', name:'🌊 Océano Azul', desc:'Tecnología, salud o servicios', thumbnail:'tpl-oceano', seed:{primaryColor:'#2563EB', secondaryColor:'#1D4ED8', accentColor:'#93C5FD', heroBadge:'Confianza y seguridad · MARKET CR', heroTitle:'Soluciones claras, resultados reales', heroSub:'Confiá en nuestro equipo: calidad y atención en cada paso.', heroLayout:'left', benefitsCols:3, productStyle:'grid', galleryStyle:'masonry', rounded:20, heroMediaShape:'rounded', heroStyle:'split', cardStyle:'bordered', benefitStyle:'icon', categoryStyle:'card', typography:'modern', decor:'grid', ctaStyle:'gradient', footerStyle:'dark', animTheme:'wave', bgTheme:'dark'}},
  {id:'tpl-rojo', name:'🔴 Rojo Energía', desc:'Deporte, comida o promos', thumbnail:'tpl-rojo', seed:{primaryColor:'#DC2626', secondaryColor:'#991B1B', accentColor:'#FCA5A5', heroBadge:'Energía y pasión · MARKET CR', heroTitle:'Viví la diferencia hoy', heroSub:'Productos con carácter y promociones que no podés ignorar.', heroLayout:'right', benefitsCols:4, productStyle:'rows', galleryStyle:'carousel', rounded:12, heroMediaShape:'sharp', heroStyle:'full', cardStyle:'flat', benefitStyle:'image', categoryStyle:'pill', typography:'bold', decor:'none', ctaStyle:'gradient', footerStyle:'dark', animTheme:'bounce', bgTheme:'wave'}},
  {id:'tpl-minimal', name:'◻️ Minimalista', desc:'Negocios modernos y limpios', thumbnail:'tpl-minimal', seed:{primaryColor:'#111827', secondaryColor:'#374151', accentColor:'#22D3EE', heroBadge:'Nuevo en la plataforma · MARKET CR', heroTitle:'Simple, directo y moderno', heroSub:'Menos ruido, más producto. Una experiencia clara para tus clientes.', heroLayout:'center', benefitsCols:2, productStyle:'grid', galleryStyle:'carousel', rounded:8, heroMediaShape:'sharp', heroStyle:'minimal', cardStyle:'flat', benefitStyle:'icon', categoryStyle:'pill', typography:'modern', decor:'none', ctaStyle:'minimal', footerStyle:'light', animTheme:'slide', bgTheme:'aurora'}},
  {id:'tpl-terra', name:'🟤 Terra', desc:'Artesanal, café o vintage', thumbnail:'tpl-terra', seed:{primaryColor:'#78350F', secondaryColor:'#92400E', accentColor:'#FBBF24', heroBadge:'Hecho a mano · MARKET CR', heroTitle:'Cálido, artesanal y cercano', heroSub:'Productos con historia y sabor, hechos con dedicación.', heroLayout:'left', benefitsCols:3, productStyle:'grid', galleryStyle:'grid', rounded:22, heroMediaShape:'rounded', heroStyle:'split', cardStyle:'soft', benefitStyle:'numbered', categoryStyle:'card', typography:'serif', decor:'blob', ctaStyle:'gradient', footerStyle:'dark', animTheme:'float', bgTheme:'light'}},
  {id:'tpl-rosa', name:'🌸 Rosa Bloom', desc:'Belleza, skincare o moda', thumbnail:'tpl-rosa', seed:{primaryColor:'#DB2777', secondaryColor:'#9D174D', accentColor:'#F9A8D4', heroBadge:'Belleza y cuidado · MARKET CR', heroTitle:'Cuidate, brillá, sentite bien', heroSub:'Productos seleccionados para tu rutina de belleza y bienestar.', heroLayout:'right', benefitsCols:4, productStyle:'rows', galleryStyle:'carousel', rounded:18, heroMediaShape:'circle', heroStyle:'split', cardStyle:'glass', benefitStyle:'image', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'gradient', footerStyle:'brand', animTheme:'pop', bgTheme:'dark'}},
  {id:'tpl-noche', name:'🌌 Noche Moderna', desc:'Tech, apps o diseño oscuro', thumbnail:'tpl-noche', seed:{primaryColor:'#0F172A', secondaryColor:'#1E293B', accentColor:'#38BDF8', heroBadge:'Innovación que inspira · MARKET CR', heroTitle:'Diseño y tecnología para crecer', heroSub:'Soluciones modernas para tu negocio, con una experiencia impecable.', heroLayout:'center', benefitsCols:3, productStyle:'grid', galleryStyle:'masonry', rounded:14, heroMediaShape:'sharp', heroStyle:'full', cardStyle:'bordered', benefitStyle:'icon', categoryStyle:'card', typography:'modern', decor:'grid', ctaStyle:'gradient', footerStyle:'brand', animTheme:'wave', bgTheme:'wave'}},
  {id:'tpl-citrico', name:'🍋 Cítrico', desc:'Jugos, frescos o salud', thumbnail:'tpl-citrico', seed:{primaryColor:'#65A30D', secondaryColor:'#3F6212', accentColor:'#FACC15', heroBadge:'Frescura en cada entrega · MARKET CR', heroTitle:'Viví lo fresco, viví lo natural', heroSub:'Productos frescos y saludables, directo a tu mesa.', heroLayout:'left', benefitsCols:2, productStyle:'rows', galleryStyle:'grid', rounded:26, heroMediaShape:'circle', heroStyle:'stacked', cardStyle:'soft', benefitStyle:'numbered', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'gradient', footerStyle:'light', animTheme:'bounce', bgTheme:'aurora'}},
  {id:'tpl-lavanda', name:'🪻 Lavanda', desc:'Relax, spa o cuidado personal', thumbnail:'tpl-lavanda', seed:{primaryColor:'#7C3AED', secondaryColor:'#4C1D95', accentColor:'#E9D5FF', heroBadge:'Bienestar y equilibrio · MARKET CR', heroTitle:'Tu momento de calma', heroSub:'Cuidado personal y bienestar para sentirse en paz.', heroLayout:'right', benefitsCols:3, productStyle:'grid', galleryStyle:'carousel', rounded:20, heroMediaShape:'rounded', heroStyle:'split', cardStyle:'glass', benefitStyle:'numbered', categoryStyle:'card', typography:'serif', decor:'blob', ctaStyle:'card', footerStyle:'light', animTheme:'slide', bgTheme:'light'}},
  {id:'tpl-mar', name:'🏝️ Mar Caribe', desc:'Vacaciones, turismo o moda', thumbnail:'tpl-mar', seed:{primaryColor:'#0891B2', secondaryColor:'#155E75', accentColor:'#67E8F9', heroBadge:'Escapate con nosotros · MARKET CR', heroTitle:'Vibrá el paraíso', heroSub:'Experiencias y productos que te conectan con el mar.', heroLayout:'center', benefitsCols:4, productStyle:'rows', galleryStyle:'carousel', rounded:18, heroMediaShape:'circle', heroStyle:'full', cardStyle:'glass', benefitStyle:'icon', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'gradient', footerStyle:'dark', animTheme:'float', bgTheme:'dark'}},
  {id:'tpl-oro', name:'🥇 Oro Clásico', desc:'Joyas, lujo o inversión', thumbnail:'tpl-oro', seed:{primaryColor:'#A16207', secondaryColor:'#713F12', accentColor:'#FDE68A', heroBadge:'Elegancia atemporal · MARKET CR', heroTitle:'Detalles que perduran', heroSub:'Productos exclusivos con calidad y refinamiento.', heroLayout:'left', benefitsCols:3, productStyle:'grid', galleryStyle:'grid', rounded:24, heroMediaShape:'rounded', heroStyle:'split', cardStyle:'shadow', benefitStyle:'numbered', categoryStyle:'card', typography:'serif', decor:'none', ctaStyle:'gradient', footerStyle:'dark', animTheme:'pop', bgTheme:'wave'}},
  {id:'tpl-bambu', name:'🎋 Bambú', desc:'Eco, hogar o sostenible', thumbnail:'tpl-bambu', seed:{primaryColor:'#3F6212', secondaryColor:'#1A2E05', accentColor:'#BEF264', heroBadge:'Vida sostenible · MARKET CR', heroTitle:'Eco-amigable por naturaleza', heroSub:'Productos sostenibles para un hogar más verde.', heroLayout:'right', benefitsCols:2, productStyle:'rows', galleryStyle:'masonry', rounded:12, heroMediaShape:'sharp', heroStyle:'stacked', cardStyle:'flat', benefitStyle:'icon', categoryStyle:'pill', typography:'modern', decor:'grid', ctaStyle:'minimal', footerStyle:'light', animTheme:'wave', bgTheme:'aurora'}},
  {id:'tpl-coco', name:'🥥 Coco Café', desc:'Café, bakery o cozy', thumbnail:'tpl-coco', seed:{primaryColor:'#9A3412', secondaryColor:'#7C2D12', accentColor:'#FDBA74', heroBadge:'Café y antojos · MARKET CR', heroTitle:'Un rincón cálido para vos', heroSub:'Café, repostería y productos con sabor a hogar.', heroLayout:'left', benefitsCols:3, productStyle:'grid', galleryStyle:'carousel', rounded:28, heroMediaShape:'circle', heroStyle:'stacked', cardStyle:'soft', benefitStyle:'icon', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'gradient', footerStyle:'dark', animTheme:'bounce', bgTheme:'light'}},
  {id:'tpl-ladrillo', name:'🧱 Urban Brick', desc:'Moda urbana o callejera', thumbnail:'tpl-ladrillo', seed:{primaryColor:'#B91C1C', secondaryColor:'#7F1D1D', accentColor:'#FCA5A5', heroBadge:'Estilo y actitud · MARKET CR', heroTitle:'Vestí tu identidad', heroSub:'Prendas y accesorios con actitud urbana.', heroLayout:'right', benefitsCols:4, productStyle:'rows', galleryStyle:'masonry', rounded:10, heroMediaShape:'sharp', heroStyle:'full', cardStyle:'flat', benefitStyle:'numbered', categoryStyle:'pill', typography:'bold', decor:'none', ctaStyle:'gradient', footerStyle:'dark', animTheme:'slide', bgTheme:'dark'}},
  {id:'tpl-cielo', name:'☁️ Cielo', desc:'Baby, hogar o suave', thumbnail:'tpl-cielo', seed:{primaryColor:'#0284C7', secondaryColor:'#075985', accentColor:'#BAE6FD', heroBadge:'Suavidad y cuidado · MARKET CR', heroTitle:'Lo más tierno para los tuyos', heroSub:'Productos suaves y cuidados para toda la familia.', heroLayout:'center', benefitsCols:2, productStyle:'grid', galleryStyle:'grid', rounded:24, heroMediaShape:'circle', heroStyle:'stacked', cardStyle:'glass', benefitStyle:'image', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'card', footerStyle:'light', animTheme:'float', bgTheme:'wave'}},
  {id:'tpl-vintage', name:'📻 Vintage', desc:'Antigüedades o retro', thumbnail:'tpl-vintage', seed:{primaryColor:'#92400E', secondaryColor:'#78350F', accentColor:'#FBBF24', heroBadge:'Clásicos que perduran · MARKET CR', heroTitle:'Un viaje al pasado', heroSub:'Piezas únicas con historia y encanto.', heroLayout:'left', benefitsCols:3, productStyle:'rows', galleryStyle:'masonry', rounded:16, heroMediaShape:'rounded', heroStyle:'split', cardStyle:'soft', benefitStyle:'numbered', categoryStyle:'card', typography:'serif', decor:'grid', ctaStyle:'gradient', footerStyle:'dark', animTheme:'pop', bgTheme:'aurora'}},
  {id:'tpl-neon', name:'💡 Neon', desc:'Gaming, estudio o creativo', thumbnail:'tpl-neon', seed:{primaryColor:'#4F46E5', secondaryColor:'#312E81', accentColor:'#22D3EE', heroBadge:'Creatividad sin límites · MARKET CR', heroTitle:'Tu estilo, tu energía', heroSub:'Productos para estudios creativos y gamers.', heroLayout:'center', benefitsCols:4, productStyle:'grid', galleryStyle:'carousel', rounded:10, heroMediaShape:'sharp', heroStyle:'full', cardStyle:'shadow', benefitStyle:'numbered', categoryStyle:'card', typography:'bold', decor:'grid', ctaStyle:'gradient', footerStyle:'dark', animTheme:'wave', bgTheme:'light'}},
  {id:'tpl-bosque', name:'🌲 Bosque', desc:'Camping, outdoor o aventura', thumbnail:'tpl-bosque', seed:{primaryColor:'#166534', secondaryColor:'#14532D', accentColor:'#86EFAC', heroBadge:'Aventura natural · MARKET CR', heroTitle:'Salí a explorar', heroSub:'Equipo y productos para tu próxima aventura.', heroLayout:'left', benefitsCols:3, productStyle:'grid', galleryStyle:'grid', rounded:14, heroMediaShape:'sharp', heroStyle:'split', cardStyle:'soft', benefitStyle:'icon', categoryStyle:'card', typography:'modern', decor:'none', ctaStyle:'gradient', footerStyle:'dark', animTheme:'bounce', bgTheme:'dark'}},
  {id:'tpl-perla', name:'🫧 Perla', desc:'Cosmética, cuidado o salud', thumbnail:'tpl-perla', seed:{primaryColor:'#DB2777', secondaryColor:'#9D174D', accentColor:'#FBCFE8', heroBadge:'Brillo y cuidado · MARKET CR', heroTitle:'Radiá con tu piel', heroSub:'Cosmética y cuidado personal de alta calidad.', heroLayout:'right', benefitsCols:2, productStyle:'rows', galleryStyle:'carousel', rounded:28, heroMediaShape:'circle', heroStyle:'stacked', cardStyle:'glass', benefitStyle:'image', categoryStyle:'card', typography:'rounded', decor:'blob', ctaStyle:'gradient', footerStyle:'light', animTheme:'slide', bgTheme:'wave'}},
  {id:'tpl-grafito', name:'✏️ Grafito', desc:'Papelería, arte o diseño', thumbnail:'tpl-grafito', seed:{primaryColor:'#334155', secondaryColor:'#1E293B', accentColor:'#94A3B8', heroBadge:'Creatividad en cada trazo · MARKET CR', heroTitle:'Herramientas para crear', heroSub:'Materiales y productos para tu arte y oficina.', heroLayout:'left', benefitsCols:3, productStyle:'grid', galleryStyle:'masonry', rounded:12, heroMediaShape:'sharp', heroStyle:'minimal', cardStyle:'flat', benefitStyle:'numbered', categoryStyle:'pill', typography:'modern', decor:'grid', ctaStyle:'minimal', footerStyle:'light', animTheme:'float', bgTheme:'aurora'}},
  {id:'tpl-selva', name:'🦜 Selva', desc:'Tropical, exótico o plantas', thumbnail:'tpl-selva', seed:{primaryColor:'#15803D', secondaryColor:'#166534', accentColor:'#FACC15', heroBadge:'Naturaleza exótica · MARKET CR', heroTitle:'Verde y vida tropical', heroSub:'Plantas exóticas y productos de la selva urbana.', heroLayout:'left', benefitsCols:4, productStyle:'rows', galleryStyle:'carousel', rounded:18, heroMediaShape:'circle', heroStyle:'full', cardStyle:'soft', benefitStyle:'icon', categoryStyle:'card', typography:'bold', decor:'blob', ctaStyle:'gradient', footerStyle:'dark', animTheme:'pop', bgTheme:'light'}},
  {id:'tpl-aire', name:'🏔️ Aire Libre', desc:'Fitness, yoga o salud', thumbnail:'tpl-aire', seed:{primaryColor:'#0D9488', secondaryColor:'#115E59', accentColor:'#5EEAD4', heroBadge:'Bienestar y movimiento · MARKET CR', heroTitle:'Tu mejor versión', heroSub:'Productos para tu rutina de bienestar y fitness.', heroLayout:'center', benefitsCols:2, productStyle:'grid', galleryStyle:'masonry', rounded:20, heroMediaShape:'circle', heroStyle:'full', cardStyle:'glass', benefitStyle:'icon', categoryStyle:'card', typography:'modern', decor:'grid', ctaStyle:'gradient', footerStyle:'dark', animTheme:'wave', bgTheme:'dark'}}
];
/* Arma una plantilla completa (copia de SITE_DEFAULTS con nuevos textos,
   colores y semillas de imágenes para diferenciar cada plantilla). */
function siteBuildTemplate(s){
  const t = siteDeep(SITE_DEFAULTS);
  t.primaryColor = s.primaryColor; t.secondaryColor = s.secondaryColor; t.accentColor = s.accentColor;
  t.hero = Object.assign({}, t.hero, { badge: s.heroBadge, title: s.heroTitle, sub: s.heroSub });
  /* Opciones de DISEÑO (organización y formas), no solo color */
  t.layout = {
    heroLayout: s.heroLayout || 'left',
    benefitsCols: s.benefitsCols || 4,
    productStyle: s.productStyle || 'grid',
    galleryStyle: s.galleryStyle || 'grid',   // grid | masonry | carousel
    secOrder: s.secOrder || ['hero','videos','benefits','cats','products','offer','about','whyus','testimonials','gallery','cta','contact'],
    rounded: s.rounded === undefined ? 18 : s.rounded,
    heroMediaShape: s.heroMediaShape || 'rounded', // rounded | circle | sharp
    heroStyle: s.heroStyle || 'split',             // split | full | stacked | minimalist
    cardStyle: s.cardStyle || 'soft',              // soft | glass | bordered | flat | shadow
    sectionStyle: s.sectionStyle || 'alt',         // alt | plain | tinted
    benefitStyle: s.benefitStyle || 'icon',        // icon | numbered | image
    categoryStyle: s.categoryStyle || 'card',      // card | pill
    typography: s.typography || 'modern',          // modern | serif | rounded | bold
    decor: s.decor || 'blob',                      // decor | grid | none
    footerStyle: s.footerStyle || 'dark',          // dark | light | brand
    ctaStyle: s.ctaStyle || 'gradient',            // gradient | card | minimal
    animTheme: s.animTheme || 'slide',             // slide | float | pop | wave | none (animaciones de la plantilla)
    bgTheme: s.bgTheme || 'wave'                   // wave | aurora | light | dark (fondo dinámico)
  };
  t.hero.decor = s.heroDecor || ''; // decoración del hero (canvas, etc.)
  return t;
}
/* Aplica una plantilla predefinida completa al editor (se puede guardar) */
function siteTemplateApply(tplId){
  const s = (SITE_TEMPLATES || []).find(x => x.id === tplId);
  if(!s){ toast('Plantilla no encontrada', 'err'); return; }
  if(!siteConfig) siteConfig = {};
  const c = siteCurrent();
  const replaced = siteBuildTemplate(s.seed);
  /* Conservar datos del negocio ya cargados (nombre, contacto, redes) */
  siteConfig = deepMerge(siteDeep(replaced), siteDeep(siteConfig || {}));
  siteConfig.primaryColor = s.seed.primaryColor;
  siteConfig.secondaryColor = s.seed.secondaryColor;
  siteConfig.accentColor = s.seed.accentColor;
  siteConfig.layout = replaced.layout;
  /* Limpiar estilos de canvas/overlays antiguos: al cambiar la estructura de
     una plantilla, los estilos por posición (canvas[cvN]) quedarían pegados a
     elementos equivocados. Se regeneran al re-entrar a editar. */
  delete siteConfig.canvas;
  delete siteConfig.overlays;
  siteDirty = true;
  renderSiteFull();
  siteLiveAutoSave();
  toast('Plantilla "' + s.name.replace(/^[^ ]+ /, '') + '" aplicada ✓', 'ok');
  /* Pasar a la vista previa en modo edición para que se pueda editar todo */
  if(siteLiveEdit){ renderSiteFull(); enableSiteInlineEditing(); }
  else ensureSiteLive();
}
/* Selector de plantillas (se muestra en el panel de landing) - estilo Canva */
function siteThemesHTML(){
  return '<div class="site-grp">' +
    '<div class="sv-tpl-head"><h4>🧩 Plantillas predefinidas</h4><span class="sv-tpl-count">' + SITE_TEMPLATES.length + ' diseños</span></div>' +
    '<div class="hint">Elegí una plantilla completa: cada una tiene una estructura, forma y diseño distinto (no solo colores). Se aplica al instante y después personalizás todo con clic directo en la vista previa.</div>' +
    '<div class="sv-tpl-grid">' +
      SITE_TEMPLATES.map(t => siteTemplateThumb(t)).join('') +
    '</div></div>';
}
/* Paleta de ELEMENTOS y FORMAS para agregar al landing (se superponen en la
   vista previa y se pueden mover, redimensionar, rotar y estilizar). */
function siteElementsHTML(){
  const shapes = [
    {k:'rect', n:'Rectángulo', v:'▭', c:'#7C3AED'},
    {k:'ellipse', n:'Círculo', v:'●', c:'#BE185D'},
    {k:'line', n:'Línea', v:'─', c:'#334155'},
    {k:'star', n:'Estrella', v:'★', c:'#F59E0B'},
    {k:'heart', n:'Corazón', v:'♥', c:'#DC2626'},
    {k:'bolt', n:'Rayo', v:'⚡', c:'#F59E0B'},
  ];
  const elems = [
    {k:'text', n:'Título', v:'A', c:'#7C3AED'},
    {k:'subtext', n:'Subtítulo', v:'Aa', c:'#64748B'},
    {k:'button', n:'Botón', v:'[ ]', c:'#1B7A43'},
    {k:'link', n:'Enlace', v:'🔗', c:'#2563EB'},
    {k:'image', n:'Imagen', v:'📷', c:'#0891B2'},
    {k:'icon', n:'Ícono', v:'✳', c:'#DB2777'},
  ];
  return '<div class="site-grp">' +
    '<div class="sv-tpl-head"><h4>➕ Elementos para tu landing</h4><span class="sv-tpl-count">agregar</span></div>' +
    '<div class="hint">Hacé clic en un elemento para agregarlo a la vista previa. Después lo movés, redimensionás, rotás y estilizás desde el panel flotante. Se guarda al pulsar "Guardar cambios".</div>' +
    '<h5 style="font-size:13px;font-weight:800;margin:14px 0 8px">🔷 Formas</h5>' +
    '<div class="sv-el-grid">' +
      shapes.map(function(s){ return '<button type="button" class="sv-el-btn" onclick="cvAddOverlay(\'' + esc(s.k) + '\')"><span class="sv-el-ico" style="color:' + esc(s.c) + '">' + esc(s.v) + '</span><span>' + esc(s.n) + '</span></button>'; }).join('') +
    '</div>' +
    '<h5 style="font-size:13px;font-weight:800;margin:16px 0 8px">📄 Elementos de contenido</h5>' +
    '<div class="sv-el-grid">' +
      elems.map(function(e){ return '<button type="button" class="sv-el-btn" onclick="cvAddOverlay(\'' + esc(e.k) + '\')"><span class="sv-el-ico" style="color:' + esc(e.c) + '">' + esc(e.v) + '</span><span>' + esc(e.n) + '</span></button>'; }).join('') +
    '</div>' +
  '</div>';
}
/* Miniatura visual de una plantilla: mockup CSS que refleja su estructura */
function siteTemplateThumb(t){
  const s = t.seed;
  const hl = s.heroLayout || 'left';
  const hs = s.heroStyle || 'split';
  const layoutName = hl==='left'?'Texto↔Imagen':hl==='right'?'Imagen↔Texto':hl==='center'?'Centrado':'Pantalla completa';
  const heroName = hs==='full'?'Full':hs==='stacked'?'Apilado':hs==='minimal'?'Minimal':'Split';
  const gal = s.galleryStyle==='carousel'?'Carrusel':(s.galleryStyle==='masonry'?'Mosaico':'');
  const pStyle = s.productStyle==='rows'?'Filas':'Tarjetas';
  const card = s.cardStyle||'soft';
  const typ = s.typography||'modern';
  const tags = [layoutName, heroName, pStyle, gal, card]; if(typ!=='modern') tags.push(typ);
  return '<button type="button" class="sv-tpl-card" data-theme="'+esc(t.id)+'" onclick="siteTemplateApply(\''+esc(t.id)+'\')">' +
    '<div class="sv-tpl-preview sv-tpl-p-'+esc(hs)+'" style="--tp:'+esc(s.primaryColor)+';--ts:'+esc(s.secondaryColor)+';--ta:'+esc(s.accentColor)+';--tr:'+(s.rounded||18)+'px">' +
      '<div class="sv-tpl-nav"><span class="sv-tpl-dot"></span><span class="sv-tpl-dot"></span><span class="sv-tpl-dot"></span></div>' +
      '<div class="sv-tpl-hero sv-tpl-hero-'+esc(hl)+(hs==='full'?' sv-tpl-hero-full':'')+'">' +
        '<div class="sv-tpl-hcol"><span class="sv-tpl-line w70"></span><span class="sv-tpl-line w50"></span><span class="sv-tpl-btn"></span></div>' +
        '<div class="sv-tpl-box'+(s.heroMediaShape==='circle'?' sv-tpl-circle':'')+(s.heroMediaShape==='sharp'?' sv-tpl-sharp':'')+'"></div>' +
      '</div>' +
      '<div class="sv-tpl-benefits" style="grid-template-columns:repeat('+(s.benefitsCols||3)+',1fr)">' +
        Array.from({length:Math.min(s.benefitsCols||3,4)}).map(function(_,i){ return '<span class="sv-tpl-b"></span>'; }).join('') +
      '</div>' +
      '<div class="sv-tpl-prod'+(s.productStyle==='rows'?' sv-tpl-prod-rows':'')+'"><span class="sv-tpl-p"></span><span class="sv-tpl-p"></span><span class="sv-tpl-p"></span></div>' +
    '</div>' +
    '<div class="sv-tpl-meta">' +
      '<div class="sv-tpl-name">'+esc(t.name)+'</div>' +
      '<div class="sv-tpl-tags">'+tags.map(function(tg){ return '<span>'+esc(tg)+'</span>'; }).join('')+'</div>' +
    '</div></button>';
}
/* Ejemplo terminado: un negocio distinto (café + plantas) para que el admin
   vea "cómo se ve" la landing y pueda usarlo como punto de partida. */
/* Carga plantillas custom desde Storage (sites/templates/*.json) y las
   agrega a la lista SITE_TEMPLATES. Se llaman al abrir el editor de landing.
   Cada JSON tiene la forma: {id, name, desc, thumbnail, seed:{...}}. */
let _templatesLoaded = false;
async function loadTemplatesFromStorage(){
  if(_templatesLoaded) return;
  _templatesLoaded = true;
  try{
    if(typeof firebase === 'undefined' || !firebase.storage) return;
    const list = await firebase.storage().ref('sites/templates').list({ maxResults: 200 });
    if(!list.items || !list.items.length) return;
    let added = 0;
    for(const item of list.items){
      const id = (item.name || '').replace(/\.json$/,'');
      if(!id || SITE_TEMPLATES.some(function(x){ return x.id === id; })) continue;
      try{
        const url = await item.getDownloadURL();
        const res = await fetch(url);
        if(!res.ok) continue;
        const j = await res.json();
        if(j && j.seed && j.name){
          SITE_TEMPLATES.push({ id: j.id || id, name: j.name, desc: j.desc || '', thumbnail: j.thumbnail || '', seed: j.seed });
          added++;
        }
      }catch(_e){ /* saltar este item */ }
    }
    if(added) console.info('Plantillas cargadas desde Storage:', added);
    return added;
  }catch(e){ console.warn('No se pudieron cargar plantillas de Storage:', e && e.message); return 0; }
}
const SITE_DEMO = {
  active: true,
  businessName: 'El Jardín Café y Plantas', tagline: 'Café de especialidad y plantas vivas en un mismo lugar',
  logoUrl: '', primaryColor: '#2E7D46', secondaryColor: '#1D4F2B', accentColor: '#F5B301',
  seoTitle: 'El Jardín Café y Plantas — Café de especialidad y plantas en Heredia',
  seoDesc: 'Café de especialidad, repostería y plantas vivas. Pedí por WhatsApp con entrega a domicilio en el GAM.',
  hero: {
    badge: 'Café de especialidad · Plantas · MARKET CR',
    title: 'Un respiro verde y una taza perfecta, en tu casa',
    sub: 'Vendemos café de especialidad tostado localmente y plantas que llenan de vida tu espacio. Pedís por WhatsApp y te lo llevamos hasta la puerta.',
    image: 'https://picsum.photos/seed/demo-hero/900/720'
  },
  benefits: [
    { icon: 'leaf', title: 'Productos de calidad', desc: 'Tueste local y plantas seleccionadas a mano cada semana.' },
    { icon: 'heart', title: 'Trato cercano', desc: 'Te recomendamos con honestidad, como a un vecino de confianza.' },
    { icon: 'truck', title: 'Entrega a domicilio', desc: 'Llegamos al GAM en el día con tu pedido en perfecto estado.' },
    { icon: 'cart', title: 'Pedido en 2 minutos', desc: 'Escribís por WhatsApp, confirmás y listo. Simple y seguro.' }
  ],
  categories: [
    { name: 'Café de especialidad', desc: 'Orígenes locales, molido a tu medida.', image: 'https://picsum.photos/seed/demo-c1/640/480', tag: '' },
    { name: 'Repostería artesanal', desc: 'Bien hecha, sin preservantes.', image: 'https://picsum.photos/seed/demo-c2/640/480', tag: '' },
    { name: 'Plantas de interior', desc: 'Las mejores especias para tu hogar.', image: 'https://picsum.photos/seed/demo-c3/640/480', tag: '' },
    { name: 'Suculentas', desc: 'Fáciles de cuidar y decorativas.', image: 'https://picsum.photos/seed/demo-c4/640/480', tag: '' },
    { name: 'Macetas y accesorios', desc: 'Cerámica artesanal para tus plantas.', image: 'https://picsum.photos/seed/demo-c5/640/480', tag: '' },
    { name: 'Regalos', desc: 'Cajas armadas para sorprender.', image: 'https://picsum.photos/seed/demo-c6/640/480', tag: '' }
  ],
  featured: [
    { name: 'Café Tarrazú 1 kg', desc: 'Tueste medio, notas a chocolate y caramelo.', price: '¢15.000', old: '¢18.000', image: 'https://picsum.photos/seed/demo-p1/800/800', tag: '-17%', productId: '' },
    { name: 'Set Café + Taza', desc: 'Café de origen + taza cerámica pintada a mano.', price: '¢22.500', old: '', image: 'https://picsum.photos/seed/demo-p2/800/800', tag: 'Popular', productId: '' },
    { name: 'Ficus Lyrata', desc: 'Planta viva de 1.2 m para interiores luminosos.', price: '¢24.000', old: '', image: 'https://picsum.photos/seed/demo-p3/800/800', tag: '', productId: '' },
    { name: 'Suculenta en maceta', desc: 'Pequeña, resistente y perfecta para escritorios.', price: '¢6.500', old: '¢8.000', image: 'https://picsum.photos/seed/demo-p4/800/800', tag: '-19%', productId: '' },
    { name: 'Box cheescake', desc: 'Cheesecake artesanal de 6 porciones.', price: '¢12.000', old: '', image: 'https://picsum.photos/seed/demo-p5/800/800', tag: 'Nuevo', productId: '' },
    { name: 'Set plantas + maceta', desc: '3 suculentas con maceta de cerámica.', price: '¢14.500', old: '¢17.000', image: 'https://picsum.photos/seed/demo-p6/800/800', tag: '-15%', productId: '' }
  ],
  offer: {
    name: 'Combo Desayuno del Jardín', percent: '-20%', old: '¢10.000', price: '¢8.000',
    message: 'Café de especialidad + pan artesanal + planta de regalo. Válido por tiempo limitado.',
    image: 'https://picsum.photos/seed/demo-oferta/800/600', ends: 'Válido hasta agotar existencias.'
  },
  about: {
    title: 'Café con alma y plantas que cuentan historias',
    text: 'El Jardín nació de un sueño sencillo: juntar lo que más nos apasiona: un buen café de especialidad y plantas que dan vida a los espacios. Hoy armamos cada pedido con el mismo cuidado del primer día.',
    mission: 'Que cada taza y cada planta lleguen a tu casa con la frescura y el detalle del primer día.',
    values: ['Calidad local', 'Trato cercano', 'Envíos en el día'],
    experience: '6',
    image: 'https://picsum.photos/seed/demo-about/800/620'
  },
  whyUs: [
    { icon: 'leaf', title: 'Tueste local', desc: 'Café tostado en Costa Rica, fresco cada semana.' },
    { icon: 'heart', title: 'Atención de cerca', desc: 'Te asesoramos por WhatsApp para elegir bien.' },
    { icon: 'tag', title: 'Precios honestos', desc: 'Buen producto a precio justo.' },
    { icon: 'award', title: 'Calidad garantizada', desc: 'Todo lo que llega lo probamos y revisamos antes.' },
    { icon: 'truck', title: 'Entrega en el día', desc: 'En el GAM llegamos el mismo día de tu pedido.' },
    { icon: 'cart', title: 'Pedido fácil', desc: 'Escribís, confirmás y listo.' }
  ],
  testimonials: [
    { name: 'Lucía Mora', photo: '', comment: 'El café es otro nivel y las plantas llegaron en perfecto estado. ¡La entrega fue el mismo día!', stars: 5 },
    { name: 'Fabián Rojas', photo: '', comment: 'Pedí un regalo sorpresa y armaron una caja hermosa. Atención de 10, totalmente recomendados.', stars: 5 },
    { name: 'Amanda Prado', photo: '', comment: 'Me ayudaron a elegir las plantas para mi oficina y quedó preciosa. Muy buen precio.', stars: 5 }
  ],
  gallery: [
    'https://picsum.photos/seed/demo-g1/700/700', 'https://picsum.photos/seed/demo-g2/700/700',
    'https://picsum.photos/seed/demo-g3/700/700', 'https://picsum.photos/seed/demo-g4/700/700',
    'https://picsum.photos/seed/demo-g5/700/700', 'https://picsum.photos/seed/demo-g6/700/700',
    'https://picsum.photos/seed/demo-g7/700/700', 'https://picsum.photos/seed/demo-g8/700/700'
  ],
  cta: {
    title: '¿Se te antojó algo?',
    sub: 'Estamos listos para atenderte. Escribinos por WhatsApp y armamos tu pedido en minutos.'
  },
  contact: {
    whatsapp: '', phone: '', email: 'hola@eljardincr.com', address: 'Heredia, Costa Rica',
    hours: 'Martes a Domingo · 9:00 am - 6:00 pm', mapQuery: 'Heredia, Costa Rica',
    facebook: '', instagram: '', tiktok: ''
  },
  footer: {
    about: 'Café de especialidad, repostería y plantas vivas. Hecho con amor en Costa Rica.',
    notice: 'Comercio asociado a MARKET CR'
  }
};
function deepMerge(base, over){
  const o = {};
  /* Incluir claves BOTH de base y de over, para que campos nuevos agregados
     por las plantillas (como `layout`) no se pierdan al fusionar. */
  const keys = new Set(Object.keys(base||{}).concat(Object.keys(over||{})));
  keys.forEach(k => {
    const b = (base||{})[k], v = (over||{})[k];
    o[k] = (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v))
      ? deepMerge(b, v)
      : (v === undefined ? b : v);
  });
  return o;
}
function siteGet(c, path){ return path.split('.').reduce((x,k)=> (x && x[k]!==undefined ? x[k] : undefined), c); }
function siteSetPath(o, path, value){
  const parts = path.split('.'); let cur = o;
  for(let i=0;i<parts.length-1;i++){ if(!cur[parts[i]] || typeof cur[parts[i]]!=='object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
  cur[parts[parts.length-1]] = value;
}
function siteDeep(v){ return JSON.parse(JSON.stringify(v)); }
function siteCurrent(){ return deepMerge(siteDeep(SITE_DEFAULTS), siteViewOverride || siteConfig || {}); }
/* Atributos de edición en vivo: cuando siteLiveEdit está activo, los textos e
   imágenes de la landing se marcan como editables (contenteditable / data-path)
   para que se puedan modificar dando clic directo en la vista previa. */
function svEdText(path, extra){
  return siteLiveEdit ? (' contenteditable="true" spellcheck="false" data-path="' + esc(path) + '" style="outline:2px dashed rgba(124,58,237,.55);outline-offset:3px;border-radius:6px;cursor:text"' + (extra||'')) : '';
}
function svEdImg(path, cls){
  return (cls||'') + (siteLiveEdit ? (' data-path="' + esc(path) + '" style="outline:2px dashed rgba(124,58,237,.55);outline-offset:3px;border-radius:8px;cursor:pointer"' + ' title="Clic para cambiar esta foto"') : '');
}
function siteName(){ const sc = siteViewOverride || siteConfig || {}; return (sc.businessName && String(sc.businessName).trim()) ? String(sc.businessName).trim() : (settings && settings.storeName ? settings.storeName : 'Mi negocio'); }
function siteTag(){ const sc = siteViewOverride || siteConfig || {}; return (sc.tagline && String(sc.tagline).trim()) ? String(sc.tagline).trim() : (settings && settings.tagline ? settings.tagline : (TENANT_DATA && TENANT_DATA.tagline) || ''); }
function siteLogo(){ const u = (siteViewOverride && siteViewOverride.logoUrl) || (siteConfig && siteConfig.logoUrl) || (TENANT_DATA && TENANT_DATA.logoUrl) || (settings && settings.logoUrl) || ''; return String(u||'').trim(); }
function siteWa(){ const sc = siteViewOverride || siteConfig || {}; const w = (sc.contact && sc.contact.whatsapp) ? sc.contact.whatsapp : (settings && settings.whatsapp) || ''; return String(w||'').trim(); }
function waSite(msg){ return 'https://wa.me/' + waDigits(siteWa()) + '?text=' + encodeURIComponent(msg); }
function siteStoreUrl(){ return location.origin + location.pathname + '?tienda=' + encodeURIComponent(TENANT_ID); }
function sitePublicUrl(){ return siteStoreUrl() + '&web=1'; }
function sk(icon){
  const I = {
    leaf:'<path d="M11 20A7 7 0 0 1 4 13c0-4 3-8 9-9 5-1 7 0 7 0s-1 2-2 4c-1 3-3 4-4 5 1 1 1 2 1 3a3 3 0 0 1-3 3z"/><path d="M4 21c5-6 9-10 12-13"/>',
    truck:'<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    cart:'<circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h3l2.6 12.5a2 2 0 0 0 2 1.5h8.8a2 2 0 0 0 2-1.6L23 7H6"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    tag:'<path d="M20.59 13.41 11 4H4v7l9.59 9.59a2 2 0 0 0 2.83 0l4.17-4.17a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    award:'<circle cx="12" cy="9" r="6"/><path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5"/>',
    wa:'<path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.5 0 .2 5.3.2 11.8c0 2.1.5 4.1 1.6 5.9L0 24l6.5-1.7a11.7 11.7 0 0 0 5.5 1.4h.1c6.5 0 11.8-5.3 11.8-11.9 0-3.2-1.2-6.2-3.4-8.3zM12 21.8h-.1c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.9 1 1-3.8-.2-.4a9.9 9.9 0 0 1-1.5-5.2C2.1 6 6.6 1.6 12.1 1.6c2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.6-4.5 10.4-9.9 10.4zM17.6 14.3c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.8-.2-.3 0-.4.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.2.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.3-1.2.2-1.4-.1-.1-.2-.2-.4-.3z"/>',
    phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9z"/>',
    mail:'<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 7-10 6L2 7"/>',
    pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    star:'<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',
    menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
    eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    fb:'<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    ig:'<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
    tik:'<path d="M9 12a4 4 0 1 0 4 4V4a7 7 0 0 0 7 7"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + (I[icon] || I.check) + '</svg>';
}
function si(icon){ return sk(icon); }
function siteStars(n){
  let out = '';
  for(let i=0;i<5;i++) out += '<svg viewBox="0 0 24 24" fill="' + (i<n?'currentColor':'none') + '" stroke="currentColor" stroke-width="1.6"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
  return out;
}
function simg(url, alt, cls){
  if(!url) return '';
  if(imgRemoved(url)) return '';
  return '<img class="' + (cls||'') + '" src="' + esc(url) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" onerror="var p=this.parentNode;if(p){p.classList.add(\'sv-img-broken\');this.style.display=\'none\';}">';
}
/* ------------------------- persistencia ------------------------- */
function listenSite(){
  if(!siteDoc || siteUnsub) return;
  siteUnsub = siteDoc.onSnapshot(function(snap){
    /* Al llegar un snapshot: solo se acepta la data si existe y no hay
       cambios locales sin guardar (así no se pisan las fotos recién
       subidas en el editor con la versión vieja del documento). */
    if(snap.exists){
      if(!siteDirty || !siteLiveEdit){
        siteConfig = snap.data();
        const panelOpen = document.getElementById('panel-site') && document.getElementById('panel-site').classList.contains('active');
        if(document.body.classList.contains('site-mode')) renderSiteFull();
        else if(document.body.classList.contains('in-admin') && panelOpen) loadSiteEditor();
      }
    }
  }, function(){});
  /* Refuerzo: la FUENTE DE VERDAD del público es el landing.json de
     Storage (siempre la última versión guardada). Si el snapshot de
     Firestore tarda o viene desactualizado, se fusiona encima. */
  try{
    if(typeof firebase !== 'undefined' && firebase.storage){
      firebase.storage().ref('sites-config/' + (TENANT_ID || 'x') + '/landing.json')
        .getDownloadURL().then(function(url){
          return fetch(url).then(function(r){ return r.ok ? r.json() : null; });
        }).then(function(storageCfg){
          if(storageCfg && storageCfg !== siteConfig){
            if(!siteDirty || !siteLiveEdit){
              siteConfig = deepMerge(siteDeep(storageCfg), siteDeep(siteConfig || {}));
              if(document.body.classList.contains('site-mode')) renderSiteFull();
              else if(document.body.classList.contains('in-admin') && document.getElementById('panel-site') && document.getElementById('panel-site').classList.contains('active')) loadSiteEditor();
            }
          }
        }).catch(function(){});
    }
  }catch(e){}
}
let siteDirty = false;
/* Guarda el JSON del landing en Firebase Storage con URL ESTABLE
   (sites-config/{tienda}/landing.json = SIEMPRE la última versión).
   Así el sitio siempre tiene su configuración completa respaldada y
   consultable en Storage con la misma URL. */
async function saveSiteToStorage(cfg){
  if(typeof firebase === 'undefined' || !firebase.storage) return null;
  try{
    const name = 'sites-config/' + (TENANT_ID || 'x') + '/landing.json';
    await firebase.storage().ref(name).put(
      new Blob([JSON.stringify(cfg)], { type: 'application/json' }),
      { contentType: 'application/json', cacheControl: 'public,max-age=31536000' }
    );
    const url = await firebase.storage().ref(name).getDownloadURL();
    console.info('Landing guardada en Storage (URL estable):', url);
    return url;
  }catch(e){
    console.warn('No se pudo copiar la landing a Storage (no crítico):', e && e.message);
    return null;
  }
}
async function saveSite(){
  if(!siteDoc){ toast('Aún no hay documento de sitio disponible', 'err'); return; }
  try{
    /* 1) Leer lo que hay en los inputs del editor lateral */
    const fromEditor = readSiteEditor();
    /* 2) Leer la vista previa real: textos e imágenes editados directamente
          (elementos con data-path dentro de #siteRoot). Si los editaste en la
          vista, esos valores SON los que se guardan. */
    const fromPreview = readSiteFromPreview();
    /* 3) Mezcla: editor (inputs) agrega/secciones; vista previa pisa los campos
          que editó el usuario en vivo. */
    let cfg = siteDeep(fromEditor);
    if(fromPreview){
      Object.keys(fromPreview).forEach(k => {
        const v = fromPreview[k];
        if(typeof v === 'object' && v && !Array.isArray(v)){
          cfg[k] = deepMerge(cfg[k] || {}, v);
        } else {
          cfg[k] = v;
        }
      });
    }
    /* 4) Los cambios guardados anteriormente en siteConfig (edición en vivo
          persistida) se conservan como base también. */
    cfg = deepMerge(cfg, siteDeep(siteConfig || {}));
    /* 5) GUARDAR EN FIRESTORE (firma del sitio para la app) */
    await siteDoc.set(JSON.parse(JSON.stringify(cfg)), { merge:true });
    siteConfig = cfg;
    siteDirty = false;
    /* 6) GUARDAR EN STORAGE: configuración completa con URL estable */
    await saveSiteToStorage(cfg);
    toast('Landing page guardada ✓ (Firestore + Storage)', 'ok');
  }catch(e){ console.error(e); toast('No se pudo guardar: ' + (e && e.message ? e.message : 'error'), 'err'); }
}
/* Lee los elementos editables del DOM de la vista previa (data-path) y arma
   un objeto parcial con los valores YOed aquí, para que "Guardar cambios"
   persista lo hecho con clic directo en la vista previa. */
function readSiteFromPreview(){
  const root = document.getElementById('siteRoot');
  if(!root) return null;
  const out = {};
  root.querySelectorAll('[data-path]').forEach(el => {
    const path = el.getAttribute('data-path');
    if(!path) return; // ignorar capas sin ruta (auto-detectadas sin ruta mapeada)
    /* Los data-path con varios puntos son rutas anidadas (hero.badge,
       hero.title...). Los que incluyen ".image" son imágenes. */
    const val = el.isContentEditable
      ? (el.innerText || '').trim()
      : (el.getAttribute('src') || el.innerText || '').trim();
    /* Las imágenes con data-path: si el siteConfig YA tiene una URL más
       reciente (ej: recién subida al Storage) no la pisen con el src del
       DOM que puede estar desactualizado tras una recarga del editor. */
    const isImg = /\.image$/.test(path) || el.getAttribute('src');
    if(isImg && siteConfig){
      const cur = siteGet(siteConfig, path);
      if(cur && /firebasestorage\.com/.test(String(cur)) && cur !== val){
        return; // el DOM trae la versión vieja; el config tiene la nueva
      }
    }
    /* Rutas con índices numéricos (gallery.0, categories.1.image…) se
       guardan como ARRAYS en el config, no como objetos: así el render
       sigue funcionando (length/indexOf). */
    const idxPath = path.match(/^([a-zA-Z]+)\.(\d+)(?:\.(\w+))?$/);
    if(idxPath){
      if(!out[idxPath[1]]) out[idxPath[1]] = [];
      const arr = out[idxPath[1]];
      const i = parseInt(idxPath[2], 10);
      if(idxPath[3]){
        if(!arr[i]) arr[i] = {};
        arr[i][idxPath[3]] = val;
      } else {
        arr[i] = val;
      }
      return;
    }
    siteSetPath(out, path, val);
  });
  return out;
}
/* ------------------------- vista pública ------------------------- */
function openSitePublic(){
  closeSiteLightbox();
  if(siteDemoActive) siteViewOverride = null;
  document.body.classList.add('site-mode');
  renderSiteFull();
  if(document.body.classList.contains('in-admin')){ ensureLivePill(); sitePillLabel(); }
}
function viewSiteDemo(){
  siteDemoActive = true;
  siteViewOverride = siteDeep(SITE_DEMO);
  document.body.classList.add('site-mode');
  closeSiteLightbox();
  renderSiteFull();
  if(document.body.classList.contains('in-admin')){ ensureLivePill(); sitePillLabel(); }
}
function closeSitePublic(){
  document.body.classList.remove('site-mode');
  if(document.body.classList.contains('in-admin') && document.getElementById('panel-site')) showPanel('site', document.querySelector('.adm-link[data-panel="site"]'));
}
function renderSiteFull(){
  const root = document.getElementById('siteRoot');
  if(!root) return;
  const c = siteCurrent();
  const name = siteName(), tag = siteTag(), logo = siteLogo(), wa = siteWa();
  /* Opciones de diseño elegidas por plantilla (organización y formas) */
  const L = (c && c.layout) || {};
  const heroLayout = L.heroLayout || 'left';
  const benefitsCols = L.benefitsCols || 4;
  const productStyle = L.productStyle || 'grid';
  const galleryStyle = L.galleryStyle || 'grid';
  const heroMediaShape = L.heroMediaShape || 'rounded';
  const heroStyle = L.heroStyle || 'split';
  const cardStyle = L.cardStyle || 'soft';
  const benefitStyle = L.benefitStyle || 'icon';
  const categoryStyle = L.categoryStyle || 'card';
  const typography = L.typography || 'modern';
  const decor = L.decor || 'blob';
  const ctaStyle = L.ctaStyle || 'gradient';
  const footerStyle = L.footerStyle || 'dark';
  const animTheme = L.animTheme || 'slide';
  const bgTheme = L.bgTheme || 'wave';
  const rounded = L.rounded || 18;
  const v = document.getElementById('siteView');
  root.classList.add('sv-site');
  root.setAttribute('data-typ', typography);
  root.setAttribute('data-anim', animTheme);
  /* Fondo dinámico de la página (gradiente animado acorde a los colores) */
  if(v){
    v.classList.remove('sv-bg-wave','sv-bg-aurora','sv-bg-light','sv-bg-dark');
    v.classList.add('sv-bg-' + (bgTheme || 'wave'));
  }
  if(v){
    v.style.setProperty('--site-p', c.primaryColor || '#1B7A43');
    v.style.setProperty('--site-pd', c.secondaryColor || '#0F5A30');
    v.style.setProperty('--site-acc', c.accentColor || '#FFD100');
    v.style.setProperty('--site-radius', rounded + 'px');
    v.style.setProperty('--site-font', typography==='serif' ? "'Georgia','Times New Roman',serif" : typography==='rounded' ? "'Nunito','Segoe UI',sans-serif" : typography==='bold' ? "'Archivo Black','Arial Black',sans-serif" : "'Inter','Segoe UI',sans-serif");
    /* Colores del pie de página (editables por el administrador) */
    if(c.footer && c.footer.bg) v.style.setProperty('--footer-bg', c.footer.bg);
    if(c.footer && c.footer.text) v.style.setProperty('--footer-text', c.footer.text);
    if(c.footer && c.footer.strong) v.style.setProperty('--footer-strong', c.footer.strong);
    if(c.footer && c.footer.accent) v.style.setProperty('--footer-accent', c.footer.accent);
  }
  const heroImg = c.hero.image;
  /* CARRUSEL del hero: si hay varias URLs (lista separada por coma) se arma
     un carrusel animado; si no, se muestra la imagen única (o placeholder). */
  const heroImages = (function(){
    const raw = (c.hero && c.hero.images) || '';
    const arr = String(raw).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if(arr.length >= 2) return arr;
    if(heroImg && !imgRemoved(heroImg)) return [heroImg];
    return [];
  })();
  const heroMediaHtml = heroImages.length
    ? (heroImages.length === 1
        ? '<img' + svEdImg('hero.image') + ' src="' + esc(heroImages[0]) + '" alt="' + esc(name) + '" loading="lazy">'
        : heroImages.map(function(u, i){ return '<img class="sv-hero-slide' + (i===0?' active':'') + '"' + (i===0?svEdImg('hero.image'):'') + ' data-idx="' + i + '" src="' + esc(u) + '" alt="' + esc(name) + '" loading="' + (i===0?'eager':'lazy') + '">'; }).join('')
          + '<div class="sv-hero-dots">' + heroImages.map(function(_, i){ return '<span class="sv-hero-dot' + (i===0?' active':'') + '"></span>'; }).join('') + '</div>')
    : '<div style="aspect-ratio:4/3.2;border-radius:26px;background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.3)"></div>';
  const nav = '<a href="#svHero">Inicio</a><a href="#svAbout">Nosotros</a><a href="#svProducts">Productos</a><a href="#svCats">Categorías</a><a href="#svContact">Contacto</a>';
  const catCta = ''; const store = siteStoreUrl();
  let html = '';
  html += '<header class="sv-header" id="svHeader"><div class="sv-header-inner">'
    + '<a class="sv-brand" href="#svHero">'
    + (logo && !imgRemoved(logo) ? '<img class="sv-logo" src="' + esc(logo) + '" alt="Logo ' + esc(name) + '">' : '<span class="sv-logo-ph">' + esc(name.charAt(0).toUpperCase()) + '</span>')
    + '<span><span class="sv-storename">' + esc(name) + '</span>' + (tag ? '<span class="sv-storetag">' + esc(tag) + '</span>' : '') + '</span></a>'
    + '<nav class="sv-nav">' + nav + '</nav>'
    + '<div class="sv-cta-group">'
    + (wa ? '<a class="sv-btn sv-btn-wa" href="' + esc(waSite('Hola, quisiera información sobre sus productos.')) + '" target="_blank" rel="noopener">' + si('wa') + 'WhatsApp</a>' : '')
    + '<a class="sv-btn sv-btn-primary" href="' + esc(store) + '">' + si('cart') + 'Ver catálogo</a>'
    + '</div>'
    + '<button class="sv-burger" onclick="siteMenuToggle()" aria-label="Abrir menú">' + si('menu') + '</button>'
    + '</div>'
    + '<div class="sv-mobile-nav" id="svMobileNav">' + nav
    + (wa ? '<a class="sv-btn sv-btn-wa" href="' + esc(waSite('Hola, quisiera información sobre sus productos.')) + '" target="_blank" rel="noopener">' + si('wa') + 'WhatsApp</a>' : '')
    + '<a class="sv-btn sv-btn-primary" href="' + esc(store) + '">' + si('cart') + 'Ver catálogo</a>'
    + '</div></header>';
  /* HERO (diseño automático: el layout fluye solo; en edición los textos e
     imágenes se resaltan y se editan con clic directo en la vista previa) */
  html += '<div class="sv-wrap"><section class="sv-hero sv-hero-' + esc(heroLayout) + ' sv-hero-s-' + esc(heroStyle) + ' sv-decor-' + esc(decor) + ' sv-card-' + esc(cardStyle) + '" id="svHero">'
    + (decor==='grid' ? '<div class="sv-grid-decor"></div>' : '')
    + (decor==='blob' || bgTheme!=='dark' ? '<div class="sv-anim-bg"><span style="width:260px;height:260px;top:8%;left:-60px;background:var(--site-p)"></span><span style="width:200px;height:200px;bottom:5%;right:-40px;background:var(--site-acc)"></span><span style="width:140px;height:140px;top:45%;right:30%;background:var(--site-pd)"></span></div>' : '')
    + (decor==='blob' ? '<div class="sv-blob-decor"></div>' : '')
    + '<span class="sv-hero-float">' + esc(name) + ' · ' + esc(tag) + '</span>'
    + '<div class="sv-hero-grid">'
    + '<div><span class="sv-hero-badge">' + si('cart') + '<span' + svEdText('hero.badge') + '>' + esc(c.hero.badge || '') + '</span></span>'
    + '<h1' + svEdText('hero.title') + '>' + esc(c.hero.title) + '</h1>'
    + '<p' + svEdText('hero.sub') + '>' + esc(c.hero.sub) + '</p>'
    + '<div class="sv-hero-actions">'
    + '<a class="sv-btn sv-btn-ghost" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff" href="#svProducts">Ver productos</a>'
    + (wa ? '<a class="sv-btn sv-btn-wa" href="' + esc(waSite('Hola, quisiera información sobre sus productos.')) + '" target="_blank" rel="noopener">' + si('wa') + 'Contactar por WhatsApp</a>' : '')
    + '</div></div>'
    + '<div class="sv-hero-media sv-shape-' + esc(heroMediaShape) + '"' + (heroImages.length > 1 ? ' id="svHeroCarousel"' : '') + '>' + heroMediaHtml
    + '</div>'
    + '</div></section>';
  /* VIDEOS: 1 vertical tipo historia (9:16) + hasta 2 horizontales (16:9).
     Cada uno acepta enlace de YouTube o video .mp4 subido a Storage sin
     perder calidad. Si no se cargan, no se muestra la sección. */
  const vvUrl = (c.videoVertical || '').trim();
  const vhUrl = (c.videoHorizontal || '').trim();
  const vh2Url = (c.videoHorizontal2 || '').trim();
  const vidCount = (vvUrl?1:0) + (vhUrl?1:0) + (vh2Url?1:0);
  if(vidCount){
    const vidEl = function(u, ratio, label, emoji){
      const embed = youtubeEmbedUrl(u);
      return '<div class="' + (ratio === '9/16' ? 'sv-video-v' : 'sv-video-h') + '" style="width:100%">'
        + '<div style="aspect-ratio:' + ratio + ';border-radius:18px;overflow:hidden;background:#111;box-shadow:0 18px 40px rgba(0,0,0,.25)">'
        + (embed
            ? '<iframe src="' + esc(embed) + '" style="width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>'
            : '<video src="' + esc(u) + '" controls playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>')
        + '</div>'
        + '<p style="text-align:center;font-size:12.5px;color:#64748B;margin-top:8px">' + emoji + ' ' + esc(label) + '</p></div>';
    };
    const gridCols = (vvUrl && (vhUrl || vh2Url)) ? '1fr 1.6fr' : '1fr';
    html += '<section class="sv-sec sv-sec-alt" id="svVideos"><div class="sv-inner">'
      + '<div class="sv-sec-head"><div class="sv-eyebrow">Videos</div><h2 class="sv-h2">Conocé más de nosotros</h2></div>'
      + '<div class="sv-videos-grid" style="display:grid;grid-template-columns:' + gridCols + ';gap:20px;align-items:start">';
    if(vvUrl) html += vidEl(vvUrl, '9/16', 'Video vertical', '📱');
    /* Los verticales y horizontales se apilan; si hay 2 horizontales sin vertical, van en 2 columnas */
    if(!vvUrl && vhUrl && vh2Url) html += '</div><div class="sv-videos-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;margin-top:20px">';
    if(vhUrl) html += vidEl(vhUrl, '16/9', 'Video horizontal 1', '🎬');
    if(vh2Url) html += vidEl(vh2Url, '16/9', 'Video horizontal 2', '🎬');
    html += '</div></div></section>';
  }
  /* BENEFICIOS */
  html += '<section class="sv-sec" id="svBenefits"><div class="sv-inner">'
    + '<div class="sv-sec-head"><div class="sv-eyebrow">Por qué comprar aquí</div><h2 class="sv-h2">Propuesta de valor</h2></div>'
    + '<div class="sv-benefits sv-bv-' + esc(benefitStyle) + ' sv-card-' + esc(cardStyle) + ' sv-grid sv-rv' + esc(benefitsCols) + ' sv-reveal">'
    + c.benefits.map(function(b, bi){ return '<div class="sv-benefit">' + (benefitStyle==='numbered' ? '<div class="sv-b-num">' + (bi+1) + '</div>' : benefitStyle==='image' ? '<div class="sv-b-img">' + si(b.icon || 'check') + '</div>' : '<div class="sv-b-icon">' + si(b.icon || 'check') + '</div>') + '<h3>' + esc(b.title) + '</h3><p>' + esc(b.desc) + '</p></div>'; }).join('')
    + '</div></div></section>';
  html += '<section class="sv-sec sv-sec-alt" id="svCats"><div class="sv-inner">'
    + '<div class="sv-sec-head"><div class="sv-eyebrow">Explorá</div><h2 class="sv-h2">Categorías</h2><p class="sv-lead">Elegí tu favorita y encontrá justo lo que buscás.</p></div>'
    + '<div class="sv-cat-wrap sv-cc-' + esc(categoryStyle) + ' sv-reveal">'
    + c.categories.map(function(cat){ const im = cat.image || ''; return '<a class="sv-cat' + (categoryStyle==='pill'?' sv-cat-pill':'') + '" href="' + esc(store) + '">' + simg(im, cat.name, '') + '<div class="sv-cat-overlay"><h3>' + esc(cat.name) + '</h3><p>' + esc(cat.desc) + '</p><span class="sv-link-mini" style="color:#fff">Explorar ' + si('arrow') + '</span></div></a>'; }).join('')
    + '</div></div></section>';
  /* PRODUCTOS DESTACADOS */
  html += '<section class="sv-sec" id="svProducts"><div class="sv-inner">'
    + '<div class="sv-sec-head"><div class="sv-eyebrow">Lo más solicitado</div><h2 class="sv-h2">Productos destacados</h2></div>'
    + '<div class="sv-prod-grid sv-ps-' + esc(productStyle) + ' sv-card-' + esc(cardStyle) + ' sv-reveal">'
    + c.featured.map(siteFeaturedCard).join('')
    + '</div>'
    + '<div class="sv-sec-footer"><a class="sv-link-pill" href="' + esc(store) + '">Ver todos los productos ' + si('arrow') + '</a></div>'
    + '</div></section>';
  /* OFERTA */
  if(c.offer && c.offer.name){
    html += '<section class="sv-sec sv-sec-alt"><div class="sv-inner"><div class="sv-offer sv-reveal"><div class="sv-offer-inner">'
      + '<div class="sv-offer-media">' + simg(c.offer.image, 'Oferta ' + c.offer.name, '') + '</div>'
      + '<div><span class="sv-offer-badge">OFERTA ESPECIAL ' + esc(c.offer.percent || '') + '</span>'
      + '<h3>' + esc(c.offer.name) + '</h3>'
      + (c.offer.ends ? '<p>' + esc(c.offer.ends) + '</p>' : '')
      + '<div class="sv-offer-price"><s>' + esc(c.offer.old || '') + '</s>' + esc(c.offer.price) + '</div>'
      + '<p>' + esc(c.offer.message || '') + '</p>'
      + '<div class="sv-hero-actions">'
      + (wa ? '<a class="sv-btn sv-btn-wa" href="' + esc(waSite('Hola, quiero aprovechar la oferta de "' + c.offer.name + '" (' + c.offer.price + ').')) + '" target="_blank" rel="noopener">' + si('wa') + 'Comprar esta oferta</a>' : '')
      + '<a class="sv-btn sv-btn-outline" href="' + esc(store) + '">Ver catálogo</a>'
      + '</div></div></div></div></div></section>';
  }
  /* NOSOTROS */
  html += '<section class="sv-sec" id="svAbout"><div class="sv-inner"><div class="sv-about-grid sv-reveal">'
    + '<div class="sv-about-media">' + simg(c.about.image, 'Nuestro negocio', '')
    + (c.about.experience ? '<div class="sv-exp-chip"><b>' + esc(c.about.experience) + '</b>años de experiencia</div>' : '')
    + '</div>'
    + '<div><div class="sv-eyebrow">Sobre nosotros</div><h2 class="sv-h2">' + esc(c.about.title) + '</h2>'
    + '<p class="sv-lead">' + esc(c.about.text) + '</p>'
    + (c.about.values && c.about.values.length ? '<ul class="sv-about-list">' + c.about.values.map(function(vm){ return '<li>' + si('check') + esc(vm) + '</li>'; }).join('') + '</ul>' : '')
    + (c.about.mission ? '<div class="sv-mission"><b>Nuestra misión: </b>' + esc(c.about.mission) + '</div>' : '')
    + '</div></div></div></section>';
  /* POR QUÉ ELEGIRNOS */
  html += '<section class="sv-sec sv-sec-alt"><div class="sv-inner">'
    + '<div class="sv-sec-head"><div class="sv-eyebrow">Confianza</div><h2 class="sv-h2">¿Por qué elegirnos?</h2></div>'
    + '<div class="sv-grid sv-b6 sv-reveal">'
    + c.whyUs.map(function(w){ return '<div class="sv-benefit"><div class="sv-b-icon">' + si(w.icon || 'check') + '</div><h3>' + esc(w.title) + '</h3><p>' + esc(w.desc) + '</p></div>'; }).join('')
    + '</div></div></section>';
  /* TESTIMONIOS */
  html += '<section class="sv-sec" id="svTestimonials"><div class="sv-inner">'
    + '<div class="sv-sec-head"><div class="sv-eyebrow">Clientes felices</div><h2 class="sv-h2">Testimonios</h2></div>'
    + '<div class="sv-test-grid sv-reveal">'
    + c.testimonials.map(function(t){
        const av = t.photo && !imgRemoved(t.photo) ? '<img class="sv-avatar" src="' + esc(t.photo) + '" alt="' + esc(t.name) + '">' : '<span class="sv-avatar">' + esc((t.name||'C').charAt(0).toUpperCase()) + '</span>';
        return '<div class="sv-test"><div class="sv-stars">' + siteStars(Number(t.stars)||5) + '</div><p>"' + esc(t.comment) + '"</p><div class="sv-test-who">' + av + '<span><b>' + esc(t.name) + '</b><span>Cliente verificado</span></span></div></div>';
      }).join('')
    + '</div></div></section>';
  /* GALERÍA (grid / masonry / carrusel según plantilla) */
  const galStyle = galleryStyle || L.galleryStyle || 'grid';
  let galInner = '';
  if(c.gallery && c.gallery.length){
    if(galStyle === 'carousel'){
      galInner = '<div class="sv-gal-carousel" id="svGalCarousel">'
        + c.gallery.map(function(g,i){ return '<div class="sv-gal-slide'+(i===0?' active':'')+'" onclick="openSiteLightbox(\'' + esc(g) + '\')">' + simg(g, 'Galería', '') + '</div>'; }).join('')
        + '<button class="sv-nav sv-gal-prev" onclick="siteGalNav(-1)" aria-label="Anterior">‹</button>'
        + '<button class="sv-nav sv-gal-next" onclick="siteGalNav(1)" aria-label="Siguiente">›</button>'
        + '<div class="sv-gal-dots">' + c.gallery.map(function(_,i){ return '<span class="'+(i===0?'active':'')+'" data-i="'+i+'"></span>'; }).join('') + '</div>'
        + '</div>';
    } else {
      galInner = '<div class="sv-gal-grid sv-reveal">'
        + c.gallery.map(function(g){ return '<div class="sv-gal" onclick="openSiteLightbox(\'' + esc(g) + '\')">' + simg(g, 'Galería', '') + '</div>'; }).join('')
        + '</div>';
    }
  } else {
    galInner = '<div class="sv-gal-ph" style="aspect-ratio:auto;padding:30px">Agregá imágenes en el editor</div>';
  }
  html += '<section class="sv-sec sv-sec-alt" id="svGallery"><div class="sv-inner">'
    + '<div class="sv-sec-head"><div class="sv-eyebrow">Nuestro trabajo</div><h2 class="sv-h2">Galería</h2></div>'
    + galInner
    + '</div></section>';
  /* CTA */
  html += '<section class="sv-sec" id="svCta"><div class="sv-inner"><div class="sv-cta sv-cta-' + esc(ctaStyle) + ' sv-reveal">'
    + '<h2>' + esc(c.cta.title) + '</h2><p>' + esc(c.cta.sub) + '</p>'
    + '<div class="sv-hero-actions">'
    + '<a class="sv-btn sv-btn-ghost" style="background:var(--site-acc);color:#17202A;border:none" href="' + esc(store) + '">Comprar ahora ' + si('arrow') + '</a>'
    + (wa ? '<a class="sv-btn sv-btn-wa" href="' + esc(waSite('Hola, quisiera realizar una compra.')) + '" target="_blank" rel="noopener">' + si('wa') + 'Escribir por WhatsApp</a>' : '')
    + '</div></div></div></section>';
  /* CONTACTO */
  html += '<section class="sv-sec" id="svContact"><div class="sv-inner"><div class="sv-sec-head"><div class="sv-eyebrow">Hablemos</div><h2 class="sv-h2">Contacto</h2></div>'
    + '<div class="sv-ct-grid sv-reveal">'
    + '<div>'
    + '<div class="sv-contact-card">'
    + (wa ? '<div class="sv-contact-row"><span class="sv-contact-ico">' + si('wa') + '</span><div><b>WhatsApp</b><br>' + esc(wa) + '</div></div>' : '')
    + (c.contact.phone ? '<div class="sv-contact-row"><span class="sv-contact-ico">' + si('phone') + '</span><div><b>Teléfono</b><br>' + esc(c.contact.phone) + '</div></div>' : '')
    + (c.contact.email ? '<div class="sv-contact-row"><span class="sv-contact-ico">' + si('mail') + '</span><div><b>Correo</b><br>' + esc(c.contact.email) + '</div></div>' : '')
    + (c.contact.address ? '<div class="sv-contact-row"><span class="sv-contact-ico">' + si('pin') + '</span><div><b>Dirección</b><br>' + esc(c.contact.address) + '</div></div>' : '')
    + (c.contact.hours ? '<div class="sv-contact-row"><span class="sv-contact-ico">' + si('clock') + '</span><div><b>Horarios</b><br>' + esc(c.contact.hours) + '</div></div>' : '')
    + '<div class="sv-social-row">'
    + (c.contact.whatsapp ? '<a class="sv-social" href="' + esc(waSite('hola')) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + si('wa') + '</a>' : '')
    + (c.contact.facebook ? '<a class="sv-social" href="' + esc(c.contact.facebook) + '" target="_blank" rel="noopener" aria-label="Facebook">' + si('fb') + '</a>' : '')
    + (c.contact.instagram ? '<a class="sv-social" href="' + esc(c.contact.instagram) + '" target="_blank" rel="noopener" aria-label="Instagram">' + si('ig') + '</a>' : '')
    + (c.contact.tiktok ? '<a class="sv-social" href="' + esc(c.contact.tiktok) + '" target="_blank" rel="noopener" aria-label="TikTok">' + si('tik') + '</a>' : '')
    + '</div>'
    + (c.contact.mapQuery ? '<div class="sv-map"><iframe src="https://maps.google.com/maps?q=' + encodeURIComponent(c.contact.mapQuery) + '&z=14&output=embed" loading="lazy" title="Mapa de ubicación"></iframe></div>' : '')
    + '</div>'
    + '</div>'
    + '<form class="sv-form" id="svForm" onsubmit="return submitSiteForm(this)">'
    + '<div><label for="svfName">Nombre</label></div><input id="svfName" name="name" required placeholder="Tu nombre">'
    + '<div><label for="svfEmail">Correo electrónico</label></div><input id="svfEmail" name="email" type="email" placeholder="tucorreo@ejemplo.com">'
    + '<div><label for="svfPhone">Teléfono</label></div><input id="svfPhone" name="phone" placeholder="+506 0000 0000">'
    + '<div><label for="svfMsg">Mensaje</label></div><textarea id="svfMsg" name="msg" required placeholder="Contanos qué buscás…"></textarea>'
    + '<button class="sv-btn sv-btn-primary" type="submit">Enviar por WhatsApp</button>'
    + '</form>'
    + '</div></div></section>';
  /* FOOTER */
  html += '<footer class="sv-footer sv-footer-' + esc(footerStyle) + '"><div class="sv-footer-inner">'
    + '<div><div class="sv-f-brand">' + (logo && !imgRemoved(logo) ? '<img class="sv-f-logo" src="' + esc(logo) + '" alt="Logo">' : '<span class="sv-f-logo-ph">' + esc(name.charAt(0).toUpperCase()) + '</span>') + esc(name) + '</div>'
    + '<p>' + esc(c.footer.about || c.about.text) + '</p></div>'
    + '<div class="sv-f-col"><h4>Navegación</h4><a href="#svHero">Inicio</a><a href="#svAbout">Nosotros</a><a href="#svProducts">Productos</a><a href="#svContact">Contacto</a></div>'
    + '<div class="sv-f-col"><h4>Contacto</h4>'
    + (wa ? '<a href="' + esc(waSite('Hola.')) + '" target="_blank" rel="noopener">' + esc(wa) + '</a>' : '')
    + (c.contact.phone ? '<a href="tel:' + esc(c.contact.phone) + '">' + esc(c.contact.phone) + '</a>' : '')
    + (c.contact.email ? '<a href="mailto:' + esc(c.contact.email) + '">' + esc(c.contact.email) + '</a>' : '')
    + (c.contact.address ? '<a href="#svContact">' + esc(c.contact.address) + '</a>' : '')
    + '</div>'
    + '</div>'
    + '<div class="sv-footer-inner" style="padding-top:0"><div class="sv-f-legal" style="width:100%">'
    + '<span><a href="javascript:openSiteLegal(0)">Política de privacidad</a> · <a href="javascript:openSiteLegal(1)">Términos y condiciones</a> · © ' + new Date().getFullYear() + ' ' + esc(name) + '</span>'
    + (c.footer.notice ? '<span class="sv-f-marketcr">' + esc(c.footer.notice) + '</span>' : '')
    + '</div></div></footer>';
  root.innerHTML = html;
  applySiteSEO(c);
  siteHeaderScroll();
  renderSiteDemoBanner();
  siteReveal();
  renderSiteOverlays();
  startHeroCarousel();
  startGalCarousel();
  /* En modo edición en vivo: convertir los objetos en capas Canva */
  if(siteLiveEdit) cvAutoDetectLayers();
  sitePillLabel();
}
/* Carrusel del hero (landing del administrador): rota las imágenes con un
   fundido suave + puntos indicadores, solo si hay más de una. */
let _heroCarouselTimer = null;
function startHeroCarousel(){
  if(_heroCarouselTimer){ clearInterval(_heroCarouselTimer); _heroCarouselTimer = null; }
  const box = document.getElementById('svHeroCarousel');
  if(!box) return;
  const slides = box.querySelectorAll('.sv-hero-slide');
  if(slides.length < 2) return;
  let idx = 0;
  _heroCarouselTimer = setInterval(function(){
    slides[idx].classList.remove('active');
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add('active');
    box.querySelectorAll('.sv-hero-dot').forEach(function(d, i){ d.classList.toggle('active', i === idx); });
  }, 4200);
}
let _galCarouselTimer = null;
function siteGalNav(dir){
  const box = document.getElementById('svGalCarousel');
  if(!box) return;
  const slides = box.querySelectorAll('.sv-gal-slide');
  if(slides.length < 2) return;
  let idx = 0;
  slides.forEach(function(s,i){ if(s.classList.contains('active')) idx = i; });
  slides[idx].classList.remove('active');
  idx = (idx + dir + slides.length) % slides.length;
  slides[idx].classList.add('active');
  box.querySelectorAll('.sv-gal-dots span').forEach(function(d,i){ d.classList.toggle('active', i === idx); });
  restartGalCarousel();
}
function startGalCarousel(){
  if(_galCarouselTimer){ clearInterval(_galCarouselTimer); _galCarouselTimer = null; }
  const box = document.getElementById('svGalCarousel');
  if(!box) return;
  const slides = box.querySelectorAll('.sv-gal-slide');
  if(slides.length < 2) return;
  _galCarouselTimer = setInterval(function(){ siteGalNav(1); }, 4200);
}
function restartGalCarousel(){
  if(_galCarouselTimer){ clearInterval(_galCarouselTimer); _galCarouselTimer = null; }
  startGalCarousel();
}
/* ---- AUTO-DETECCIÓN DE CAPAS: envuelve TODOS los objetos del landing. ----
   Corre justo después del render cuando el modo edición está activo.
   Marca títulos, párrafos, botones e imágenes con data-obj + data-path y les
   agrega los "tools" (4 esquinas + rotar). Así TODAS las secciones (hero,
   beneficios, categorías, productos, oferta, nosotros, testimonios, galería,
   CTA y contacto) se pueden mover/redimensionar/rotar/estilizar/animar. */
let _cvObjSeq = 0;
/* Genera un ID ESTABLE para una capa, para que los estilos (posición, tamaño,
   rotación, sombra) NO se pierdan al re-renderizar. Prefiere el data-path
   (ruta del config) o, si no, arma un selector de posición que sobrevive a
   recargas (tag + sección + índice entre hermanos). */
function cvStableId(el, prefix){
  const dp = el.getAttribute && el.getAttribute('data-path');
  if(dp) return (prefix || 'cv') + ':' + dp.replace(/[^a-zA-Z0-9_.-]/g, '_');
  /* índice entre hermanos del mismo tipo dentro de su contenedor */
  const parent = el.parentElement;
  let idx = 0;
  if(parent){
    const same = Array.prototype.filter.call(parent.children, function(ch){ return ch.tagName === el.tagName; });
    idx = Array.prototype.indexOf.call(same, el);
  }
  const tag = (el.tagName || 'div').toLowerCase();
  const cls = (el.className && String(el.className).split(' ')[0]) || '';
  return (prefix || 'cv') + ':' + tag + ':' + (cls||'') + ':' + idx;
}
function cvAutoDetectLayers(){
  const root = document.getElementById('siteRoot');
  if(!root) return;
  _cvObjSeq = 0;
  /* 1) Textos principales: h1,h2,h3, p, .sv-eyebrow, .sv-lead, .sv-storename,
        .sv-storetag, .sv-test p, nombres y comentarios de testimonios... */
  root.querySelectorAll('h1, h2, h3, h4, p, .sv-eyebrow, .sv-lead, .sv-storename, .sv-storetag, .sv-price, .sv-offer h3, .sv-benefit h3, .sv-benefit p, .sv-card-body h3, .sv-card-desc, .sv-test p, .sv-contact-row b').forEach(function(el){
    if(el.closest('[data-obj]')) return;
    if(el.isContentEditable) return;
    const id = cvStableId(el, 'cv');
    el.setAttribute('data-obj', id);
    el.setAttribute('data-way', 'text');
    el.classList.add('cv-editable-text');
    cvWrapTools(el, id);
  });
  /* 2) TODAS LAS IMÁGENES de la landing: se capturan de forma genérica para
        poder moverlas, redimensionarlas y rotarlas (logos, hero, productos,
        categorías, galería, oferta, nosotros, avatares, footer). */
  root.querySelectorAll('#siteRoot img').forEach(function(el){
    if(el.closest('[data-obj]')) return;
    if(el.closest('.sv-lightbox')) return;   // la lupa ampila aparte
    if(el.classList.contains('sv-hero-slide')) return; // las del carrusel se manejan aparte
    const id = cvStableId(el, 'cvimg');
    el.setAttribute('data-obj', id);
    el.setAttribute('data-way', 'image');
    el.setAttribute('data-cv', 'image');
    el.style.cursor = 'pointer';
    /* Rutas de array (galería/categorías/productos): el data-path permite
       reemplazar/borrar la foto y guardarla en el config correcto. */
    if(!el.getAttribute('data-path')){
      const gal = el.closest('.sv-gal');
      const cat = el.closest('.sv-cat');
      const card = el.closest('.sv-card');
      let idx = -1, arrKey = '';
      if(gal){ arrKey = 'gallery'; idx = Array.prototype.indexOf.call(gal.parentElement.children, gal); }
      else if(cat){ arrKey = 'categories'; idx = Array.prototype.indexOf.call(cat.parentElement.children, cat); }
      else if(card){ arrKey = 'featured'; idx = Array.prototype.indexOf.call(card.parentElement.children, card); }
      if(arrKey && idx > -1){
        el.setAttribute('data-path', arrKey + '.' + idx + (arrKey === 'gallery' ? '' : '.image'));
      }
    }
    cvWrapTools(el, id);
  });
  /* 3) Botones CTA: .sv-btn (excepto los del nav) */
  root.querySelectorAll('.sv-hero-actions .sv-btn, .sv-cta .sv-btn, .sv-btn-primary, .sv-hero-actions a').forEach(function(el){
    if(el.closest('[data-obj]')) return;
    const id = cvStableId(el, 'cv');
    el.setAttribute('data-obj', id);
    el.setAttribute('data-way', 'button');
    cvWrapTools(el, id);
  });
  /* 4) TODOS LOS ICONOS del landing (beneficios, por-qué-elegirnos, contacto,
        oferta, categorías, links, redes). Se capturan los SVG de iconos de
        las secciones para poder moverlos, redimensionarlos y editarlos. */
  root.querySelectorAll('.sv-b-icon, .sv-about-list li svg, .sv-contact-ico, .sv-footer .sv-social, .sv-social-row .sv-social, .sv-link-mini svg, .sv-f-col a svg, .sv-offer svg').forEach(function(el){
    if(el.closest('[data-obj]')) return;
    /* Evitar iconos dentro de botones ya marcados como objeto */
    if(el.closest('.sv-btn, [data-way="button"]')) return;
    const id = cvStableId(el, 'cvic');
    el.setAttribute('data-obj', id);
    el.setAttribute('data-way', 'icon');
    el.style.cursor = 'move';
    cvWrapTools(el, id);
  });
  /* Aplicar estilos guardados del canvas */
  root.querySelectorAll('[data-obj]').forEach(layer => {
    const st = siteCanvasGet(layer.dataset.obj);
    cvApply(layer, st);
  });
}
/* Envuelve un elemento con los tools (4 esquinas + rotar) y lo marca.
   Se reutiliza el propio elemento como capa (position:relative en modo edición). */
function cvWrapTools(el, objId){
  const wrap = document.createElement('span');
  wrap.className = 'cv-tool cv-t-r';
  wrap.setAttribute('onmousedown', 'event.preventDefault();event.stopPropagation();cvDragStartTool(event,"size")');
  el.appendChild(wrap);
  const w2 = document.createElement('span');
  w2.className = 'cv-tool cv-t-r2';
  w2.setAttribute('onmousedown', 'event.preventDefault();event.stopPropagation();cvDragStartTool(event,"size")');
  el.appendChild(w2);
  const w3 = document.createElement('span');
  w3.className = 'cv-tool cv-t-r3';
  w3.setAttribute('onmousedown', 'event.preventDefault();event.stopPropagation();cvDragStartTool(event,"size")');
  el.appendChild(w3);
  const rot = document.createElement('span');
  rot.className = 'cv-tool cv-t-rot';
  rot.setAttribute('onmousedown', 'event.preventDefault();event.stopPropagation();cvDragStartTool(event,"rotate")');
  el.appendChild(rot);
  /* IMÁGENES: botón ✕ para borrarla (solo visible en modo edición; en la
     vista pública NO aparece porque .cv-tool solo se muestra con .sel en
     body.site-live-edit). Al borrar se limpia el config y se re-renderiza. */
  if(el.getAttribute('data-way') === 'image'){
    const del = document.createElement('span');
    del.className = 'cv-tool cv-t-del';
    del.title = 'Borrar esta imagen';
    del.textContent = '✕';
    del.setAttribute('onmousedown', 'event.preventDefault();event.stopPropagation()');
    del.setAttribute('onclick', 'event.preventDefault();event.stopPropagation();cvImageDelete(\'' + objId + '\')');
    el.appendChild(del);
  }
  /* Para textos: marcar el contenido editable y con data-path */
  if(el.getAttribute('data-way') === 'text'){
    el.setAttribute('data-cv', 'text');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    /* Asocia la ruta si el texto es reconocible por el editor configurado */
    el.setAttribute('data-path', el.dataset.path || textPathFor(el));
  }
}
/* Borrar una imagen de la landing desde la vista previa de edición.
   La X solo existe en modo edición; en la publicación desaparece. */
function cvImageDelete(objId){
  const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(objId) + '"]');
  if(!layer) return;
  const path = layer.getAttribute('data-path');
  if(path){
    siteSetPath(siteConfig, path, '');
    if(siteConfig.canvas) delete siteConfig.canvas[objId];
    renderSiteFull();
    siteLiveAutoSave();
    toast('Imagen borrada ✓ (se guardará al publicar)', 'ok');
  } else {
    /* Sin data-path (categorías, galería, productos...): se marca por URL
       para que el re-render no la restaure. */
    const img = layer.tagName === 'IMG' ? layer : layer.querySelector('img');
    const src = img && img.getAttribute('src');
    if(!src){ layer.style.display = 'none'; toast('Imagen borrada ✓', 'ok'); return; }
    if(!siteConfig.removedUrls) siteConfig.removedUrls = [];
    siteConfig.removedUrls.push(src);
    renderSiteFull();
    siteLiveAutoSave();
    toast('Imagen borrada ✓ (se guardará al publicar)', 'ok');
  }
}
/* ¿La URL de esta imagen fue borrada en el editor? */
function imgRemoved(url){
  if(!url || !siteConfig || !siteConfig.removedUrls || !siteConfig.removedUrls.length) return false;
  return siteConfig.removedUrls.indexOf(url) !== -1;
}
/* Mejor esfuerzo: deducir la ruta del texto si es uno conocido */
function textPathFor(el){
  const html = el.outerHTML || '';
  if(html.indexOf('sv-hero-badge') !== -1) return 'hero.badge';
  if(html.indexOf('sv-hero') !== -1 && el.tagName === 'H1') return 'hero.title';
  if(html.indexOf('sv-hero') !== -1 && el.tagName === 'P') return 'hero.sub';
  if(html.indexOf('sv-eyebrow') !== -1) return 'eyebrow';
  if(html.indexOf('sv-h2') !== -1) return 'h2';
  return '';
}
function renderSiteDemoBanner(){
  const root = document.getElementById('siteView');
  if(!root) return;
  let b = document.getElementById('svDemoBanner');
  if(!siteDemoActive){ if(b) b.remove(); return; }
  if(b){ root.appendChild(b); return; }
  b = document.createElement('div');
  b.id = 'svDemoBanner';
  b.className = 'sv-demo-banner';
  b.innerHTML = '✨ Estás viendo un <b>ejemplo de landing page</b> (aún no es tu página). '
    + '&nbsp;<button class="site-demo-btn" onclick="loadSiteDemo()">Usar este ejemplo en mi negocio</button>'
    + '&nbsp;<button class="site-demo-btn ghost" onclick="closeSiteDemo()">Cerrar</button>';
  root.appendChild(b);
}
function closeSiteDemo(){
  siteDemoActive = false;
  siteViewOverride = null;
  renderSiteDemoBanner();
  if(document.body.classList.contains('site-mode') && document.body.classList.contains('in-admin')){
    document.body.classList.remove('site-mode');
    const btn = document.querySelector('.adm-link[data-panel="site"]');
    if(btn) showPanel('site', btn);
  }
}
function loadSiteDemo(){
  siteDemoActive = false;
  siteViewOverride = null;
  siteConfig = siteDeep(SITE_DEMO);
  renderSiteDemoBanner();
  document.body.classList.remove('site-mode');
  toast('Ejemplo cargado en el editor. Guardalo cuando quieras publicar.', 'ok');
  const btn = document.querySelector('.adm-link[data-panel="site"]');
  if(btn) showPanel('site', btn);
}
function siteFeaturedCard(p){
  /* Botón COMPRAR → WhatsApp con el pedido (o la tienda si hay productId) */
  const buy = p.productId ? '<a class="sv-btn sv-btn-dark" href="' + esc(siteStoreUrl() + '&p=' + encodeURIComponent(p.productId)) + '">Comprar</a>'
    : '<a class="sv-btn sv-btn-dark" href="' + esc(waSite('Hola, quiero comprar "' + p.name + '" (' + (p.price || '') + ').')) + '" target="_blank" rel="noopener">Comprar</a>';
  /* Botón VER EN TIENDA → lleva al catálogo de la tienda */
  const info = '<a class="sv-btn sv-btn-ghost" href="' + esc(siteStoreUrl() + (p.productId ? ('&p=' + encodeURIComponent(p.productId)) : '')) + '" target="_blank" rel="noopener">Ver en tienda</a>';
  /* Botón 3: ENLACE PERSONALIZABLE — el admin define la URL y el texto desde
     el editor en vivo (deja el campo p.link vacío para ocultarlo). */
  const linkBtn = (p.link && String(p.link).trim())
    ? '<a class="sv-btn sv-btn-ghost sv-btn-custom" href="' + esc(p.link) + '" target="_blank" rel="noopener" style="border-color:var(--site-acc);color:var(--site-pd)">' + esc(p.linkLabel || 'Descubrir') + '</a>'
    : '';
  return '<div class="sv-card"><div class="sv-card-media">' + (p.tag ? '<span class="sv-tag">' + esc(p.tag) + '</span>' : '') + simg(p.image, p.name, '') + '</div>'
    + '<div class="sv-card-body"><h3>' + esc(p.name) + '</h3><p class="sv-card-desc">' + esc(p.desc || '') + '</p>'
    + '<div class="sv-price-row">' + (p.old ? '<span class="sv-price-old">' + esc(p.old) + '</span>' : '') + '<span class="sv-price">' + esc(p.price || '') + '</span></div>'
    + '<div class="sv-card-actions">' + buy + info + linkBtn
    + '</div></div></div>';
}
function submitSiteForm(f){
  const gn = document.getElementById('svfName').value.trim();
  const ge = document.getElementById('svfEmail').value.trim();
  const gt = document.getElementById('svfPhone').value.trim();
  const gm = document.getElementById('svfMsg').value.trim();
  const lines = ['Hola, soy ' + (gn || 'un cliente'), gm, ''];
  if(gt) lines.push('Teléfono: ' + gt);
  if(ge) lines.push('Correo: ' + ge);
  if(!siteWa()){ toast('Configurá un WhatsApp para recibir mensajes', 'err'); return false; }
  /* HISTORIAL del formulario: cada envío queda guardado en Firestore
     (tenants/{tienda}/siteMessages) para verlo en el admin. */
  try{
    db.collection('tenants').doc(TENANT_ID).collection('siteMessages').add({
      name: gn || 'Anónimo',
      email: ge,
      phone: gt,
      message: gm,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      leido: false,
      url: location.href
    }).catch(function(e){ console.warn('No se pudo guardar el mensaje:', e); });
  }catch(e){ console.warn('No se pudo guardar el mensaje:', e); }
  window.open(waSite(lines.join('\n')), '_blank');
  toast('Mensaje enviado y guardado en el historial ✓', 'ok');
  return false;
}
function siteMenuToggle(){
  const m = document.getElementById('svMobileNav');
  if(m) m.classList.toggle('open');
}
function siteHeaderScroll(){
  const h = document.getElementById('svHeader');
  const fn = function(){ if(h) h.classList.toggle('scrolled', window.scrollY > 10); };
  fn();
  if(!window._svHeaderBound){ window._svHeaderBound = true; window.addEventListener('scroll', fn); }
}
function openSiteLightbox(url){
  const b = document.getElementById('svLightbox'), im = document.getElementById('svLightImg');
  if(!b || !im) return;
  im.style.display = '';
  const card = document.getElementById('svLegalCard'); if(card) card.style.display = 'none';
  im.src = url; b.classList.add('show');
}
function sitePrivText(){
  return 'Este sitio web es operado por el comercio ' + siteName() + ', asociado a MARKET CR. Los datos que el visitante comparte de forma voluntaria (nombre, correo, teléfono y mensaje) se usan únicamente para atender su consulta y nunca se venden ni se comparten con terceros. Al continuar navegando aceptás esta política.';
}
function siteTermsText(){
  return 'Al contactar a ' + siteName() + ' a través de WhatsApp, correo o el formulario del sitio, confirmás tu interés por los productos y servicios ofrecidos. Los precios y promociones mostrados pueden variar; el comercio confirmará vigencia y disponibilidad antes de concretar la venta. Este sitio pertenece a un comercio asociado a MARKET CR.';
}
function openSiteLegal(kind){
  const t = (kind === 1) ? siteTermsText() : sitePrivText();
  const box = document.getElementById('svLightbox');
  if(!box) return;
  document.getElementById('svLightImg').style.display = 'none';
  let card = document.getElementById('svLegalCard');
  if(!card){ card = document.createElement('div'); card.id = 'svLegalCard'; card.className = 'sv-legal-card'; box.appendChild(card); }
  card.style.display = 'block';
  card.innerHTML = '<h3>' + (kind === 1 ? 'Términos y condiciones' : 'Política de privacidad') + '</h3><p>' + esc(t) + '</p>';
  box.classList.add('show');
}
function closeSiteLightbox(){
  const b = document.getElementById('svLightbox');
  if(!b){ return; }
  b.classList.remove('show');
  const im = document.getElementById('svLightImg'); if(im) im.style.display = '';
  const card = document.getElementById('svLegalCard'); if(card) card.style.display = 'none';
}
function applySiteSEO(c){
  try{
    const name = siteName();
    const t = (c.seoTitle || (name + ' — Sitio web oficial')).replace('{negocio}', name);
    const d = c.seoDesc || c.hero.sub || 'Bienvenido al sitio de ' + name + ' · ' + (c.hero.badge || '') + '. Pedidos por WhatsApp.';
    let mt;
    mt = document.querySelector('meta[name="description"]'); if(mt) mt.setAttribute('content', d);
    mt = document.querySelector('meta[property="og:title"]'); if(mt) mt.setAttribute('content', t);
    mt = document.querySelector('meta[property="og:description"]'); if(mt) mt.setAttribute('content', d);
    mt = document.querySelector('meta[property="og:type"]'); if(mt) mt.setAttribute('content', 'website');
    mt = document.querySelector('meta[property="og:url"]'); if(mt) mt.setAttribute('content', location.href);
    if(settings && settings.logoUrl){ const og = document.querySelector('meta[property="og:image"]'); if(og) og.setAttribute('content', settings.logoUrl); }
    document.title = t;
  }catch(e){}
}
/* ------------------------- EDITOR (panel admin) ------------------------- */
const SITE_EDITOR_SIMPLE = [
  { g:'Negocio y colores', f:[
    { k:'businessName', l:'Nombre del negocio', t:'text', h:'Vacío = usa el nombre de Configuraciones' },
    { k:'tagline', l:'Eslogan / frase corta', t:'text' },
    { k:'logoUrl', l:'Logo (URL de imagen)', t:'url' },
    { k:'primaryColor', l:'Color principal', t:'color' },
    { k:'secondaryColor', l:'Color secundario', t:'color' },
    { k:'accentColor', l:'Color acento (CTA)', t:'color' },
    { k:'active', l:'Publicar el sitio para el público', t:'check', h:'Si está apagado, el enlace ?web=1 del público muestra la tienda normal.' }
  ]},
  { g:'Identidad y SEO', f:[
    { k:'seoTitle', l:'Título del sitio (SEO / pestaña)', t:'text', h:'Puede usar la palabra {negocio}' },
    { k:'seoDesc', l:'Descripción (SEO / compartir en redes)', t:'textarea' }
  ]},
  { g:'Hero (portada)', f:[
    { k:'hero.badge', l:'Etiqueta superior', t:'text' },
    { k:'hero.title', l:'Título principal', t:'text' },
    { k:'hero.sub', l:'Subtítulo', t:'textarea' },
    { k:'hero.image', l:'Imagen de portada (URL)', t:'url' },
    { k:'hero.images', l:'Carrusel del hero (URLs separadas por coma)', t:'textarea', h:'Pegá varias URLs separadas por coma (mín 2 ≈ carrusel animado). Si ponés una sola, se muestra como imagen fija.' }
  ]},
  { g:'🎬 Videos de la portada', f:[
    { k:'videoVertical', l:'Video VERTICAL (9:16) — YouTube o .mp4', t:'url', h:'Formato historia. Pegá un enlace de YouTube o el archivo .mp4 que subiste' },
    { k:'videoHorizontal', l:'Video HORIZONTAL 1 (16:9) — YouTube o .mp4', t:'url', h:'Formato HD. Pegá un enlace de YouTube o el archivo .mp4 que subiste' },
    { k:'videoHorizontal2', l:'Video HORIZONTAL 2 (16:9) — YouTube o .mp4', t:'url', h:'Segundo video horizontal. Pegá un enlace de YouTube o el archivo .mp4 que subiste' }
  ]},
  { g:'Oferta especial', f:[
    { k:'offer.name', l:'Producto en oferta', t:'text' },
    { k:'offer.percent', l:'Descuento (ej: -25%)', t:'text' },
    { k:'offer.old', l:'Precio anterior', t:'text' },
    { k:'offer.price', l:'Precio actual', t:'text' },
    { k:'offer.message', l:'Mensaje promocional', t:'text' },
    { k:'offer.ends', l:'Fecha / válido hasta', t:'text' },
    { k:'offer.image', l:'Imagen (URL)', t:'url' }
  ]},
  { g:'Nosotros', f:[
    { k:'about.title', l:'Título', t:'text' },
    { k:'about.text', l:'Historia breve', t:'textarea' },
    { k:'about.mission', l:'Misión', t:'textarea' },
    { k:'about.values', l:'Valores (con comas)', t:'text', h:'Ej: Calidad, Cercanía, Confianza' },
    { k:'about.experience', l:'Años de experiencia', t:'text', h:'Número, ej: 8' },
    { k:'about.image', l:'Foto del negocio / equipo (URL)', t:'url' }
  ]},
  { g:'Cierre (CTA y footer)', f:[
    { k:'cta.title', l:'Mensaje del CTA final', t:'text' },
    { k:'cta.sub', l:'Subtexto', t:'text' },
    { k:'footer.about', l:'Descripción del footer', t:'textarea' },
    { k:'footer.notice', l:'Nota de MARKET CR', t:'text' },
    { k:'footer.bg', l:'Color de fondo del pie', t:'color', h:'El fondo del pie de página (oscuro por defecto)' },
    { k:'footer.text', l:'Color del texto del pie', t:'color' },
    { k:'footer.strong', l:'Color de títulos / logo', t:'color' },
    { k:'footer.accent', l:'Color de acento del pie', t:'color' }
  ]},
  { g:'Contacto y redes', f:[
    { k:'contact.whatsapp', l:'WhatsApp (números, ej: 50688886666)', t:'text', h:'Vacío = usa el de Configuraciones' },
    { k:'contact.phone', l:'Teléfono', t:'text' },
    { k:'contact.email', l:'Correo electrónico', t:'text' },
    { k:'contact.address', l:'Dirección', t:'text' },
    { k:'contact.hours', l:'Horarios de atención', t:'text' },
    { k:'contact.mapQuery', l:'Dónde ubicar el mapa', t:'text', h:'Ej: Urbanización X, San José' },
    { k:'contact.facebook', l:'Facebook (URL)', t:'url' },
    { k:'contact.instagram', l:'Instagram (URL)', t:'url' },
    { k:'contact.tiktok', l:'TikTok (URL)', t:'url' }
  ]}
];
const SITE_EDITOR_ROWS = [
  { k:'benefits', l:'Beneficios (propuesta de valor)', about:'La sección que se ve bajo la portada', cols:['icon','title','desc'], heads:['Icono (leaf, truck, chat, cart…)','Título','Descripción'] },
  { k:'categories', l:'Categorías', about:'Se conectan al catálogo real de la tienda', cols:['name','desc','image','tag'], heads:['Nombre','Descripción','Imagen (URL)','Etiqueta (opcional)'] },
  { k:'featured', l:'Productos destacados', about:'Se muestran en el sitio. Si ponés el ID del producto real, los botones llevan a su ficha. En el botón ENLACE definís la URL y el texto que el admin personaliza', cols:['name','desc','price','old','image','tag','productId','link','linkLabel'], heads:['Nombre','Descripción','Precio','Precio anterior','Imagen (URL)','Etiqueta','ID de producto','Enlace personalizado (URL)','Texto del enlace'] },
  { k:'whyUs', l:'Por qué elegirnos', about:'Razones de confianza', cols:['icon','title','desc'], heads:['Icono','Título','Descripción'] },
  { k:'testimonials', l:'Testimonios', about:'Comentarios de clientes', cols:['name','photo','comment','stars'], heads:['Nombre','Foto (URL, opcional)','Comentario','Estrellas (1-5)'] }
];
const SITE_EDITOR_ICONS = ['leaf','truck','chat','cart','heart','tag','award','check','star'];
function siteEditorFieldHTML(f, val, pf){
  const id = 'sf_' + (f.k||pf).replace(/\./g,'__');
  const valS = esc(val === undefined || val === null ? '' : val);
  if(f.t === 'check') return '<div class="sf-field"><label class="sf-check"><input type="checkbox" id="' + id + '" ' + (val ? 'checked' : '') + '> ' + esc(f.l) + '</label>' + (f.h ? '<div class="sf-hint">' + esc(f.h) + '</div>' : '') + '</div>';
  if(f.t === 'textarea') return '<div class="sf-field"><label>' + esc(f.l) + '</label><textarea id="' + id + '">' + valS + '</textarea></div>';
  if(f.t === 'color') return '<div class="sf-field"><label>' + esc(f.l) + '</label><input type="color" id="' + id + '" value="' + valS + '"></div>';
  const isImg = f.t === 'url' && /(image|photo|logoUrl)$/.test(f.k || pf);
  const up = isImg ? '<div class="sf-img"><button class="sf-up" type="button" title="Subir foto (JPG o PNG)" onclick="sitePickImage(\'' + id + '\')">&#128247;</button><img class="sf-preview" src="' + valS + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></div>' : '';
  return '<div class="sf-field"><label>' + esc(f.l) + '</label>' + up + '<input type="' + (f.t||'text') + '" id="' + id + '" value="' + valS + '">' + (f.h ? '<div class="sf-hint">' + esc(f.h) + '</div>' : '') + '</div>';
}
/* Botón "Subir video" para los campos de video del editor del landing.
   Sube el archivo de video a Storage SIN perder calidad (se guarda tal cual)
   y deja la URL pública en el input correspondiente. */
function siteEditorVideoUploadBtn(key){
  if(!key || ['videoVertical','videoHorizontal','videoHorizontal2'].indexOf(key) === -1) return '';
  const id = 'sf_' + key.replace(/\./g,'__');
  return '<button type="button" class="btn-ghost" style="width:auto;padding:7px 12px;font-size:12.5px;margin-top:6px" onclick="siteUploadVideo(\'' + id + '\')">🎥 Subir video (.mp4)</button>';
}
function siteUploadVideo(target){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'video/mp4,video/webm,video/*';
  inp.onchange = async function(){
    const f = inp.files && inp.files[0];
    if(!f) return;
    if(!/video\/(mp4|webm|quicktime|mov)/i.test((f.type||'')) && !/\.(mp4|webm|mov)$/i.test((f.name||''))){
      toast('Subí un video en formato .mp4, .webm o .mov', 'err'); return;
    }
    if(f.size > 180 * 1024 * 1024){ toast('El video es muy pesado (máx 180 MB). Comprimilo antes o usá un enlace de YouTube.', 'err'); return; }
    toast('Subiendo video… (sin perder calidad)', 'ok');
    try{
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const ext = (f.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase();
      const name = 'sites/' + (TENANT_ID || 'x') + '/vid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + ext;
      const ref = firebase.storage().ref(name);
      /* Se sube el archivo ORIGINAL (sin recodificar) para no perder calidad */
      await ref.put(f, { contentType: f.type || 'video/mp4', cacheControl: 'public,max-age=31536000' });
      const url = await ref.getDownloadURL();
      const el = document.getElementById(target);
      if(el) el.value = url;
      siteConfig = sitePreserveLive(readSiteEditor());
      siteDirty = true;
      siteLiveAutoSave();
      toast('Video subido a Storage ✓ (guardando…)', 'ok');
    }catch(e){
      console.error(e);
      toast('No se pudo subir el video: ' + ((e && e.message) || 'error'), 'err');
    }
  };
  inp.click();
}
function loadSiteEditor(){
  /* ANTES de regenerar: volcar lo escrito en los inputs actuales a siteConfig
     para no perder nada al cambiar de pestaña o recargar el editor. */
  const prevRoot = document.getElementById('siteEditorRoot');
  if(prevRoot && prevRoot.children.length){
    try{ siteConfig = sitePreserveLive(readSiteEditor()); }catch(e){}
  }
  generateSiteTabs();
  const root = document.getElementById('siteEditorRoot');
  if(!root) return;
  const c = siteCurrent();
  let html = '';
  if(siteSectionTab === 'plantillas'){
    /* Selector de plantillas en su propia pestaña, con vista previa ampliada */
    html = siteThemesHTML();
  } else if(siteSectionTab === 'elementos'){
    /* Paleta de elementos/formas para agregar al landing */
    html = siteElementsHTML();
  } else if(siteSectionTab === 'negocio'){
    html = SITE_EDITOR_SIMPLE.map(function(grp){
      return '<div class="site-grp"><h4>' + esc(grp.g) + '</h4>'
        + '<div class="f-row" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' + grp.f.map(function(f){ return siteEditorFieldHTML(f, siteGet(c, f.k), f.k) + siteEditorVideoUploadBtn(f.k); }).join('') + '</div></div>';
    }).join('');
    html += '<div class="site-grp"><h4>Tipos de iconos disponibles</h4><div class="hint">Usalos en Beneficios y en “Por qué elegirnos”.</div><div style="display:flex;gap:8px;flex-wrap:wrap">' + SITE_EDITOR_ICONS.map(function(i){ return '<span style="display:inline-flex;align-items:center;gap:5px;background:#F7F9FB;border:1px solid #E8EDF2;border-radius:9px;padding:6px 10px;font-size:12px;font-weight:600">' + sk(i) + esc(i) + '</span>'; }).join('') + '</div></div>';
  } else if(siteSectionTab === 'listas'){
    html = SITE_EDITOR_ROWS.map(siteRowEditorHTML).join('');
  } else if(siteSectionTab === 'galeria'){
    html = '<div class="site-grp"><h4>Galería de imágenes</h4><div class="hint">Subí fotos (JPG o PNG) con el botón de cámara 📷 o pegá la URL de una imagen. Una fila por foto, se muestran como grid ampliable.</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
      + '<button class="btn-export" type="button" onclick="pickGalleryFolder()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;display:inline-block;vertical-align:-2px;margin-right:5px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Subir carpeta de fotos</button>'
      + '<button class="btn-ghost" type="button" onclick="pickGalleryPhotos()">Subir varias fotos</button>'
      + '</div>'
      + renderSiteUrlRows(c.gallery || [])
      + '<div class="sf-more"><button class="btn-ghost" type="button" style="width:auto;padding:9px 16px" onclick="addSiteUrlRow()">+ Más campos</button></div></div>';
  }
  root.innerHTML = html;
  /* Cargar plantillas custom desde Storage; si llegaron nuevas, regenerar */
  loadTemplatesFromStorage().then(function(count){
    if(count > 0) loadSiteEditor();
  }).catch(function(){});
}
function generateSiteTabs(){
  const tb = document.getElementById('siteTabs');
  if(!tb) return;
  const tabs = [ ['plantillas','🧩 Plantillas'], ['elementos','➕ Elementos'], ['negocio','Datos del sitio'], ['listas','Secciones y contenidos'], ['galeria','Galería'] ];
  tb.innerHTML = tabs.map(function(t){ return '<button class="site-tab-btn' + (siteSectionTab === t[0] ? ' on' : '') + '" onclick="siteSectionTab=\'' + t[0] + '\';loadSiteEditor()">' + esc(t[1]) + '</button>'; }).join('');
}
function siteRowEditorHTML(def){
  const rows = (siteGet(siteCurrent(), def.k)) || [];
  const extra = def.cols.length > 3;
  let h = '<div class="site-grp"><h4>' + esc(def.l) + '</h4><div class="hint">' + esc(def.about || '') + '</div>';
  h += '<div class="sf-row-head">' + def.heads.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join('') + '</div>';
  h += '<div id="sfList_' + def.k + '">' + rows.map(function(r, i){ return siteRowHTML(def, r, i); }).join('') + '</div>';
  h += '<div class="sf-more"><button class="btn-ghost" type="button" style="width:auto;padding:9px 16px" onclick="addSiteRow(\'' + def.k + '\')">+ Agregar ' + esc(def.l.toLowerCase()) + '</button></div>';
  h += '</div>';
  return h;
}
function siteRowHTML(def, r, i){
  return '<div class="sf-row" id="srow_' + def.k + '_' + i + '">'
    + def.cols.map(function(col){
        const id = 'srow_' + def.k + '_' + i + '_' + col;
        const v = r[col] === undefined ? '' : r[col];
        const inp = '<input type="' + (col === 'stars' ? 'number' : 'text') + '" ' + (col === 'stars' ? 'min="1" max="5" ' : '') + 'id="' + id + '" value="' + esc(v) + '" placeholder="' + esc(col) + '">';
        if(col === 'image' || col === 'photo'){
          return '<span class="sf-imgc">' + inp + '<span class="sf-img-mini"><button class="sf-up" type="button" title="Subir foto (JPG o PNG)" onclick="sitePickImage(\'' + id + '\')">&#128247;</button><img class="sf-preview" src="' + esc(v) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span></span>';
        }
        return inp;
      }).join('')
  + '<button class="btn-ghost" type="button" style="width:auto;padding:7px 11px;color:var(--danger);font-weight:700" onclick="document.getElementById(\'srow_' + def.k + '_' + i + '\').remove()">Quitar</button>'
  + '</div>';
}
function addSiteRow(kind){
  const def = SITE_EDITOR_ROWS.find(function(d){ return d.k === kind; });
  if(!def) return;
  const list = document.getElementById('sfList_' + kind);
  if(!list) return;
  const idx = Number((list.lastElementChild && list.lastElementChild.id || 'srow_' + kind + '_-1').split('_').pop()) + 1;
  const empty = {};
  def.cols.forEach(function(c){ empty[c] = ''; });
  empty.stars = 5;
  const el = document.createElement('div');
  el.innerHTML = siteRowHTML(def, empty, idx);
  list.appendChild(el.firstChild);
}
function addSiteUrlRow(){
  const box = document.getElementById('sfList_gallery');
  if(!box) return;
  const n = box.children.length;
  const el = document.createElement('div');
  el.innerHTML = '<div class="sf-row" id="grow_' + n + '" style="grid-template-columns:1fr auto;align-items:center"><span class="sf-imgc"><input type="url" id="grow_' + n + '_url" value="" placeholder="https://…/foto.jpg"><img class="sf-preview" src="" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span><span style="display:flex;gap:6px;align-items:center"><button class="sf-up" type="button" style="width:auto;padding:6px 10px;font-size:13px" title="Subir foto (JPG o PNG)" onclick="sitePickImage(\'grow_' + n + '_url\')">&#128247;</button><button class="btn-ghost" type="button" style="width:auto;padding:7px 11px;color:var(--danger);font-weight:700" onclick="document.getElementById(\'grow_' + n + '\').remove()">Quitar</button></span></div>';
  box.appendChild(el.firstChild);
}
function renderSiteUrlRows(urls){
  const boxStr = urls.map(function(u, n){ return '<div class="sf-row" id="grow_' + n + '" style="grid-template-columns:1fr auto;align-items:center"><span class="sf-imgc"><input type="url" id="grow_' + n + '_url" value="' + esc(u) + '" placeholder="https://…/foto.jpg"><img class="sf-preview" src="' + esc(u) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span><span style="display:flex;gap:6px;align-items:center"><button class="sf-up" type="button" style="width:auto;padding:6px 10px;font-size:13px" title="Subir foto (JPG o PNG)" onclick="sitePickImage(\'grow_' + n + '_url\')">&#128247;</button><button class="btn-ghost" type="button" style="width:auto;padding:7px 11px;color:var(--danger);font-weight:700" onclick="document.getElementById(\'grow_' + n + '\').remove()">Quitar</button></span></div>'; }).join('');
  return '<div id="sfList_gallery">' + boxStr + '</div>';
}
/* Seleccionar una CARPETA completa de fotos para la galería: se suben todas
   a Storage (cada una se comprime pero sin perder demasiada calidad) y se
   agregan automáticamente como filas. */
function pickGalleryFolder(){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/jpeg,image/png';
  inp.multiple = true;
  inp.webkitdirectory = true;
  inp.onchange = function(){ uploadGalleryFiles(inp.files, 'carpeta'); };
  inp.click();
}
function pickGalleryPhotos(){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/jpeg,image/png';
  inp.multiple = true;
  inp.onchange = function(){ uploadGalleryFiles(inp.files, 'fotos'); };
  inp.click();
}
async function uploadGalleryFiles(fileList, kind){
  if(!fileList || !fileList.length) return;
  const files = Array.prototype.slice.call(fileList).filter(function(f){ return /image\/(jpeg|png)/i.test((f.type||'')) || /\.(jpe?g|png)$/i.test(f.name||''); });
  if(!files.length){ toast('No se encontraron imágenes JPG o PNG', 'err'); return; }
  if(files.length > 40){ toast('Máximo 40 fotos por carga. Seleccioná una carpeta con menos archivos.', 'err'); return; }
  toast('Subiendo ' + files.length + ' foto' + (files.length > 1 ? 's' : '') + '…', 'ok');
  const created = [];
  for(let i = 0; i < files.length; i++){
    try{
      const blob = await resizeSiteImage(files[i], 1600, 0.88);
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const name = 'sites/' + (TENANT_ID || 'x') + '/gal-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2, 6) + (blob.type === 'image/png' ? '.png' : '.jpg');
      const ref = firebase.storage().ref(name);
      await ref.put(blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
      created.push(await ref.getDownloadURL());
    }catch(e){ console.warn('Foto ' + (i+1) + ' falló:', e); }
  }
  if(!created.length){ toast('Ninguna foto se pudo subir (revisá permisos de Storage)', 'err'); return; }
  /* Agregar cada una como fila nueva en la lista de galería */
  const gallery = siteDeep(siteConfig && siteConfig.gallery ? siteConfig.gallery : []);
  created.forEach(function(u){ gallery.push(u); });
  siteConfig.gallery = gallery;
  /* Regenerar las filas del editor (el contenedor es sfList_gallery) */
  const box = document.getElementById('sfList_gallery');
  if(box){ box.innerHTML = ''; gallery.forEach(function(u, n){ box.appendChild(siteGalleryRowEl(u, n)); }); }
  siteDirty = true;
  siteLiveAutoSave();
  toast('Agregadas ' + created.length + ' foto' + (created.length > 1 ? 's' : '') + ' a la galería ✓', 'ok');
}
/* Crea el elemento DOM de una fila de galería (reutilizable) */
function siteGalleryRowEl(u, n){
  const el = document.createElement('div');
  el.id = 'grow_' + n;
  el.className = 'sf-row';
  el.style.cssText = 'grid-template-columns:1fr auto;align-items:center';
  el.innerHTML = '<span class="sf-imgc"><input type="url" id="grow_' + n + '_url" value="' + esc(u) + '" placeholder="https://…/foto.jpg"><img class="sf-preview" src="' + esc(u) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span><span style="display:flex;gap:6px;align-items:center"><button class="sf-up" type="button" style="width:auto;padding:6px 10px;font-size:13px" title="Subir foto (JPG o PNG)" onclick="sitePickImage(\'grow_' + n + '_url\')">&#128247;</button><button class="btn-ghost" type="button" style="width:auto;padding:7px 11px;color:var(--danger);font-weight:700" onclick="document.getElementById(\'grow_' + n + '\').remove()">Quitar</button></span>';
  return el;
}
function readSiteEditor(){
  if(!siteConfig) siteConfig = {};
  /* BASE: lo que ya está guardado en siteConfig (fotos subidas en la vista
     previa, cambios ediciones, overlays, etc.). NO arrancar de SITE_DEFAULTS
     porque se borrarían todos los cambios anteriores. Los inputs del
     formulario solo PISAN los campos que realmente tienen. */
  const c = siteDeep(siteConfig || {});
  SITE_EDITOR_SIMPLE.forEach(function(grp){
    grp.f.forEach(function(f){
      const id = 'sf_' + f.k.replace(/\./g,'__');
      const el = document.getElementById(id);
      if(!el) return;
      if(f.k === 'about.values'){
        siteSetPath(c, f.k, el.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean));
        return;
      }
      if(f.t === 'check') siteSetPath(c, f.k, el.checked);
      else if(f.t === 'textarea') siteSetPath(c, f.k, el.value);
      else if(f.t === 'number') siteSetPath(c, f.k, parseFloat(el.value) || 0);
      else siteSetPath(c, f.k, el.value);
    });
  });
  SITE_EDITOR_ROWS.forEach(function(def){
    const list = document.getElementById('sfList_' + def.k);
    /* Si el tab de listas NO está montado en el DOM, conservar los valores
       ya guardados en siteConfig (si no, al guardar/auto-guardar se borran
       categorías, productos destacados y testimonios con sus fotos). */
    if(!list){
      if(siteConfig && siteConfig[def.k] && siteConfig[def.k].length){
        c[def.k] = siteDeep(siteConfig[def.k]);
      }
      return;
    }
    const arr = [];
    Array.prototype.forEach.call(list.children, function(div){
      const parts = (div.id || '').split('_');
      if(parts.length < 3) return;
      const item = {};
      def.cols.forEach(function(col){
        const el = document.getElementById('srow_' + def.k + '_' + parts[parts.length-1] + '_' + col);
        if(el){
          let v = el.value.trim();
          if(col === 'stars') v = Number(v) || 5;
          item[col] = v;
        } else item[col] = '';
      });
      const has = def.cols.slice(0,2).some(function(col){ return String(item[col]||'').trim() !== ''; });
      if(has) arr.push(item);
    });
    c[def.k] = arr;
  });
  const gal = [];
  const gList = document.getElementById('sfList_gallery');
  if(gList){
    Array.prototype.forEach.call(gList.children, function(div){
      const p = (div.id || '').split('_');
      const el = document.getElementById(p[0] + '_' + p[1] + '_url');
      const u = el && el.value.trim();
      if(u) gal.push(u);
    });
    c.gallery = gal;
  } else if(siteConfig && siteConfig.gallery && siteConfig.gallery.length){
    /* Tab de galería no montado: conservar lo guardado */
    c.gallery = siteDeep(siteConfig.gallery);
  }
  return c;
}
function shareSite(){
  const url = sitePublicUrl();
  const input = document.createElement('textarea'); input.value = url; document.body.appendChild(input); input.select();
  try{ document.execCommand('copy'); toast('Enlace copiado', 'ok'); }catch(e){}
  input.remove();
  if(siteWa()) window.open('https://wa.me/' + waDigits(siteWa()) + '?text=' + encodeURIComponent('Mirá la landing page de ' + siteName() + ': ' + url), '_blank');
}
/* ---------- EDICIÓN EN VIVO + SUBIDA DE FOTOS (JPG/PNG) ---------- */
let siteLiveEdit = false, siteLiveRAF = 0, siteRevealOb = null;
function sitePickImage(target){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/jpeg,image/png';
  inp.onchange = function(){
    const f = inp.files && inp.files[0]; if(!f) return;
    if(!/image\/(jpeg|png)/i.test(f.type || '')){ toast('Solo se aceptan fotos JPG o PNG', 'err'); return; }
    siteUploadImage(f, target);
  };
  inp.click();
}
function resizeSiteImage(file, max, q){
  return new Promise(function(resolve, reject){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function(){
      try{
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if(file.type === 'image/png'){ ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        const type = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
        cv.toBlob(function(b){ URL.revokeObjectURL(url); resolve(b || file); }, type, type === 'image/jpeg' ? q : undefined);
      }catch(e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
async function siteUploadImage(file, target){
  toast('Subiendo foto…', 'ok');
  const el = document.getElementById(target);
  try{
    /* Alta resolución para el landing: hasta 2400px (antes 1600) manteniendo
       buena calidad, para que las fotos se vean nítidas en pantallas grandes.
       Si the imagen es más chica, no se amplía ni distorsiona. */
    const blob = await resizeSiteImage(file, 2400, 0.95);
    if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
    const name = 'sites/' + (TENANT_ID || 'x') + '/' + Date.now() + Math.random().toString(36).slice(2, 7) + (blob.type === 'image/png' ? '.png' : '.jpg');
    const ref = firebase.storage().ref(name);
    await ref.put(blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
    const url = await ref.getDownloadURL();
    if(el) el.value = url;
    if(el && el.parentElement){ const pr = el.parentElement.querySelector('.sf-preview'); if(pr){ pr.src = url; pr.style.display = ''; } }
    /* Preview específica del hero del landing principal (superadmin) */
    if(target === 'saLandHero'){
      const ph = document.getElementById('saLandHeroPrev');
      if(ph){ ph.src = url; ph.style.display = ''; }
    }
    /* SIEMPRE volcar el valor del input actualizado a siteConfig (aunque el
       modo edición en vivo esté apagado) para que "Guardar cambios" lo
       persista. */
    if(document.getElementById('siteRoot')){
      try{ siteConfig = sitePreserveLive(readSiteEditor()); siteDirty = true; if(siteLiveEdit) renderSiteFull(); }catch(e){}
    }
    toast('Foto subida', 'ok');
  }catch(e){
    console.error(e);
    toast('No se pudo subir la foto: ' + ((e && e.message) || 'error'), 'err');
  }
}
function toggleSiteLive(){
  siteLiveEdit = !siteLiveEdit;
  document.body.classList.toggle('site-live-edit', siteLiveEdit);
  if(siteLiveEdit){
    siteDemoActive = false; siteViewOverride = null;
    siteConfig = sitePreserveLive(readSiteEditor());
    closeSiteLightbox();
    renderSiteFull();
    ensureLivePill();
    enableSiteInlineEditing();
    sitePillLabel();
  }else{
    removeLivePill();
    disableSiteInlineEditing();
    /* AUTO-GUARDADO: al salir del modo en vivo, se persisten TODOS los
       textos/imágenes editados en la vista previa (Firestore + Storage)
       para que ningún cambio se pierda. */
    try{
      const merged = deepMerge(siteDeep(readSiteEditor()), siteDeep(siteConfig || {}));
      if(siteDoc){ siteDoc.set(JSON.parse(JSON.stringify(merged)), { merge:true }).catch(()=>{}); }
      saveSiteToStorage(merged).catch(()=>{});
      siteConfig = merged;
    }catch(e){ console.warn('Auto-guardado al salir del modo en vivo:', e); }
    /* Re-render limpio: quita las capas y tools del modo edición */
    renderSiteFull();
  }
}
/* Editor unificado: abre SIEMPRE el modo edición en vivo (vista previa a la
   par). No hay formularios separados: todo se edita en la vista previa. */
function ensureSiteLive(){
  if(siteLiveEdit) return;
  siteConfig = sitePreserveLive(readSiteEditor());
  siteLiveEdit = true;
  document.body.classList.add('site-live-edit');
  siteDemoActive = false; siteViewOverride = null;
  closeSiteLightbox();
  renderSiteFull();
  ensureLivePill();
  enableSiteInlineEditing();
}
/* ÚNICO Botón "Volver al panel" (esquina inferior derecha, debajo del panel
   flotante de estilo). Si está en edición en vivo, sale y AUTO-GUARDA; si es
   la vista pública, vuelve al panel del negocio. */
function ensureLivePill(){
  if(document.getElementById('svLivePill')) return;
  const p = document.createElement('button');
  p.id = 'svLivePill';
  p.type = 'button';
  p.innerHTML = '🔙 Volver al panel';
  p.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:540;background:#17202A;color:#fff;border:none;border-radius:999px;padding:10px 20px;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:0 12px 30px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px';
  p.onmouseover = function(){ p.style.background = '#111'; };
  p.onmouseout = function(){ p.style.background = '#17202A'; };
  p.onclick = function(){ siteReturnToPanel(); };
  document.body.appendChild(p);
}
/* Etiqueta del pill según el estado actual */
function sitePillLabel(){
  const p = document.getElementById('svLivePill');
  if(!p) return;
  if(siteLiveEdit) p.innerHTML = '💾 Salir de edición y guardar';
  else p.innerHTML = '🔙 Volver al panel';
}
/* Acción única de vuelta: desde edición → guarda y vuelve al panel;
   desde vista pública → vuelve al panel. */
function siteReturnToPanel(){
  if(siteLiveEdit){
    toggleSiteLive(); /* al salir ya AUTO-GUARDA en Firestore + Storage */
  } else {
    closeSitePublic();
  }
}
function removeLivePill(){ const p = document.getElementById('svLivePill'); if(p) p.remove(); }
/* Reconstruye siteConfig desde el editor (inputs del formulario) SIN perder
   el estado visual de la edición en vivo: posiciones/rotaciones/tamaños
   (canvas), objetos superpuestos (overlays) e imágenes borradas
   (removedUrls). Evita que subir una foto o tipear en el formulario borre
   los cambios anteriores. */
function sitePreserveLive(cfg){
  if(!cfg) return cfg;
  if(siteConfig){
    if(siteConfig.canvas) cfg.canvas = siteConfig.canvas;
    if(siteConfig.overlays) cfg.overlays = siteConfig.overlays;
    if(siteConfig.removedUrls) cfg.removedUrls = siteConfig.removedUrls;
    /* Textos/imágenes editadas con clic-directo en la vista previa que NO
       tienen input en el formulario se conservan desde siteConfig. */
    const liveKeys = ['hero','about','offer','cta','footer','benefits','whyUs','categories','featured','testimonials','gallery'];
    liveKeys.forEach(function(k){
      if(!cfg[k] || (typeof cfg[k] === 'object' && !Array.isArray(cfg[k]) && Object.keys(cfg[k]).every(function(x){ return !cfg[k][x]; }))){
        if(siteConfig[k]) cfg[k] = siteConfig[k];
      }
    });
    if(siteConfig.videoVertical && !cfg.videoVertical) cfg.videoVertical = siteConfig.videoVertical;
    if(siteConfig.videoHorizontal && !cfg.videoHorizontal) cfg.videoHorizontal = siteConfig.videoHorizontal;
    if(siteConfig.videoHorizontal2 && !cfg.videoHorizontal2) cfg.videoHorizontal2 = siteConfig.videoHorizontal2;
    if(siteConfig.businessName && !cfg.businessName) cfg.businessName = siteConfig.businessName;
    if(siteConfig.tagline && !cfg.tagline) cfg.tagline = siteConfig.tagline;
    if(siteConfig.logoUrl && !cfg.logoUrl) cfg.logoUrl = siteConfig.logoUrl;
    if(siteConfig.seoTitle && !cfg.seoTitle) cfg.seoTitle = siteConfig.seoTitle;
    if(siteConfig.seoDesc && !cfg.seoDesc) cfg.seoDesc = siteConfig.seoDesc;
    if(siteConfig.contact){
      if(!cfg.contact) cfg.contact = siteConfig.contact;
      else {
        /* El contacto SIEMPRE se fusiona campo a campo: los valores vacíos
           del formulario no pisan datos ya guardados (ej: whatsapp viene
           de Configuraciones cuando el campo está vacío). */
        const keep = siteConfig.contact;
        Object.keys(keep).forEach(function(k){
          if(cfg.contact[k] === undefined || cfg.contact[k] === '') cfg.contact[k] = keep[k];
        });
      }
    }
  }
  return cfg;
}
function refreshSitePreview(){
  if(siteLiveRAF) return;
  siteLiveRAF = requestAnimationFrame(function(){
    siteLiveRAF = 0;
    try{
      siteConfig = sitePreserveLive(readSiteEditor());
      siteDirty = true;
      renderSiteFull();
    }catch(e){ console.error(e); }
  });
}
function bindSiteLiveInputs(){
  document.addEventListener('input', function(ev){
    if(!siteLiveEdit) return;
    const t = ev.target;
    if(t && t.id && t.closest && t.closest('#panel-site')) refreshSitePreview();
  });
  document.addEventListener('change', function(ev){
    if(!siteLiveEdit) return;
    const t = ev.target;
    if(t && t.id && t.closest && t.closest('#panel-site') && (t.type === 'checkbox' || t.type === 'color')) refreshSitePreview();
  });
}
/* ==================== EDITOR CANVA COMPLETO (TODA LA LANDING) ====================
   Al activar "Editar en vivo" TODOS los objetos visuales del landing se
   convierten automáticamente en "capas" editables (auto-detección):
   - DRAG para mover (transform: translate — no rompe el flujo/proporciones)
   - Handles morados en las 4 esquinas para redimensionar (ancho/altura y fuente)
   - Handle amarillo abajo para ROTAR
   - Doble clic en un texto para editarlo
   - Clic en una imagen para subir una nueva a Storage
   - Panel flotante: tipografía (fuente, tamaño, color, negrita, cursiva,
     alineación) y ANIMACIONES (fade, slide, bounce, float, pulse, shake...)
   Todo se guarda en siteConfig.canvas[objId] y "Guardar cambios" lo persiste.
   ==================================================================== */
const CV_ANIMATIONS = ['','cvAnimFadeIn','cvAnimSlideUp','cvAnimSlideDown','cvAnimSlideLeft','cvAnimSlideRight','cvAnimBounce','cvAnimFloat','cvAnimPulse','cvAnimShake'];
const CV_ANIM_NAMES = ['Sin animación','Aparecer','Subir','Bajar','Entrar izq.','Entrar der.','Rebote','Flotar','Pulso','Sacudida'];
const CV_FONTS = ['Inter','Georgia','Arial','Helvetica','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact','Tahoma'];
let _cvBound = false, _cvDrag = null, _cvSel = null, _cvMoved = false;
function siteCanvasGet(objId){
  if(!siteConfig) siteConfig = {};
  /* Los objetos superpuestos guardan su estilo en overlays[id] (mismo sistema) */
  if(siteConfig.overlays && siteConfig.overlays[objId]) return siteConfig.overlays[objId];
  if(!siteConfig.canvas) siteConfig.canvas = {};
  if(!siteConfig.canvas[objId]) siteConfig.canvas[objId] = {};
  return siteConfig.canvas[objId];
}
/* ---- Activa el editor: convierte la landing en capas editables ---- */
function enableSiteInlineEditing(){
  const root = document.getElementById('siteRoot');
  if(!root) return;
  if(_cvBound) return;
  _cvBound = true;
  /* Double-click en texto → editable; clic en imagen → selector */
  root.addEventListener('dblclick', function(ev){
    if(!siteLiveEdit) return;
    const layer = ev.target.closest('[data-obj]');
    if(!layer) return;
    /* Iconos del pie de página (redes): doble clic para cambiar la URL */
    if(layer.classList.contains('sv-social')){
      ev.preventDefault();
      const cur = layer.getAttribute('href') || '';
      const n = prompt('URL del enlace de este icono (red social):', cur);
      if(n !== null && n.trim()){
        layer.setAttribute('href', n.trim());
        /* Guardar en el canvas del objeto para que persista tras re-render */
        const st = siteCanvasGet(layer.dataset.obj);
        st.href = n.trim();
        siteDirty = true;
        siteLiveAutoSave();
        toast('Enlace del icono actualizado ✓', 'ok');
      }
      return;
    }
    const txt = layer.querySelector('[data-cv="text"]');
    if(txt){
      txt.contentEditable = 'true';
      txt.focus();
    }
  });
  root.addEventListener('mousedown', function(ev){
    if(!siteLiveEdit) return;
    /* ev.target puede ser un nodo de texto (no tiene .closest): subir al
       elemento padre para poder recorrer hacia [data-obj]. */
    var tgt = ev.target.nodeType === 3 ? ev.target.parentElement : ev.target;
    const layer = tgt && tgt.closest ? tgt.closest('[data-obj]') : null;
    if(!layer){
      cvSelectReset();
      return;
    }
    cvSelect(layer.dataset.obj);
    /* Si se pulsan los tools, NO iniciar drag de mover */
    if(tgt.closest('.cv-tool')) return;
    if(tgt.closest('[data-cv="text"]')) return; // editar texto, no mover
    _cvMoved = false;
    cvDragStart(ev, layer);
  }, true);
  root.addEventListener('click', function(ev){
    if(!siteLiveEdit) return;
    /* En modo edición, los enlaces (<a>) de capas NO navegan: se editan. */
    const a = ev.target.closest('[data-obj] a, [data-obj][href]');
    if(a){ ev.preventDefault(); ev.stopPropagation(); return; }
    /* Si el objeto se acaba de mover (drag), NO abrir el selector de imagen */
    if(_cvMoved) return;
    const img = ev.target.closest('img[data-cv="image"]');
    if(img){
      ev.preventDefault();
      ev.stopPropagation();
      siteInlinePickImage(img.dataset.path);
    }
  });
  /* Texto editable: persistir al escribir + auto-guardado con debounce */
  root.addEventListener('input', function(ev){
    if(!siteLiveEdit) return;
    const el = ev.target;
    if(el && el.isContentEditable){
      const layer = el.closest('[data-obj]');
      if(el.dataset && el.dataset.path){
        siteInlineWriteText(el.dataset.path, el.innerText);
      } else if(layer && siteConfig.overlays && siteConfig.overlays[layer.dataset.obj]){
        siteConfig.overlays[layer.dataset.obj].text = el.innerText;
      }
      if(el.dataset && el.dataset.path || (layer && siteConfig.overlays && siteConfig.overlays[layer.dataset.obj])) siteLiveAutoSave();
    }
  });
  document.addEventListener('mousemove', cvDragMove);
  document.addEventListener('mouseup', cvDragEnd);
  ensureCvStylePanel();
  cvBuildLayers();
}
/* AUTO-GUARDADO rápido: 2 segundos después del último cambio en la vista
   previa, guarda la landing completa en Firestore + Storage. Así los
   textos y fotos editados en vivo se persisten automáticamente sin
   depender de presionar ningún botón. */
let _cvSaveTimer = null;
function siteLiveAutoSave(){
  siteDirty = true;
  if(_cvSaveTimer) clearTimeout(_cvSaveTimer);
  _cvSaveTimer = setTimeout(async function(){
    if(!siteLiveEdit) return;
    try{
      const merged = deepMerge(siteDeep(readSiteEditor()), siteDeep(siteConfig || {}));
      if(siteDoc) await siteDoc.set(JSON.parse(JSON.stringify(merged)), { merge:true });
      await saveSiteToStorage(merged);
      siteConfig = merged;
      siteDirty = false;
      toast('Cambio guardado ✓', 'ok');
    }catch(e){ console.warn('Auto-guardado falló:', e && e.message); }
    _cvSaveTimer = null;
  }, 2000);
}
function disableSiteInlineEditing(){
  cvSelectReset();
  document.querySelectorAll('#siteRoot [contenteditable="true"]').forEach(el => {
    el.removeAttribute('contenteditable');
  });
  const sp = document.getElementById('cvStylePanel');
  if(sp) sp.classList.remove('show');
}
/* ---- Auto-detección: marca TODOS los objetos visuales como capas ---- */
function cvBuildLayers(){
  document.querySelectorAll('#siteRoot [data-obj]').forEach(layer => {
    layer.classList.add('cv-layer');
    const st = siteCanvasGet(layer.dataset.obj);
    cvApply(layer, st);
  });
}
/* ---- Selección ---- */
function cvSelect(objId){
  _cvSel = objId;
  document.querySelectorAll('#siteRoot [data-obj]').forEach(l => {
    l.classList.toggle('sel', l.dataset.obj === objId);
  });
  const sp = document.getElementById('cvStylePanel');
  if(!sp) return;
  if(!objId){ sp.classList.remove('show'); return; }
  sp.classList.add('show');
  const st = siteCanvasGet(objId);
  const fEl = sp.querySelector('[data-cv-sp="font"]');
  const sEl = sp.querySelector('[data-cv-sp="size"]');
  const cEl = sp.querySelector('[data-cv-sp="color"]');
  const aEl = sp.querySelector('[data-cv-sp="align"]');
  const tEl = sp.querySelector('[data-cv-sp="text"]');
  if(fEl) fEl.value = st.font || 'Inter';
  if(sEl) sEl.value = st.fontSize || 16;
  if(cEl) cEl.value = st.color || '#17202A';
  if(aEl) aEl.value = st.align || 'left';
  if(tEl){
    const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(objId) + '"]');
    const tx = layer && layer.querySelector('[data-cv="text"]');
    tEl.value = tx ? (tx.innerText || '') : '';
  }
  sp.querySelectorAll('.sp-anim').forEach(b => b.classList.toggle('on', b.dataset.anim === (st.anim || '')));
  sp.querySelector('[data-cv-sp="bold"]').classList.toggle('on', !!st.bold);
  sp.querySelector('[data-cv-sp="italic"]').classList.toggle('on', !!st.italic);
  /* Sombra editable: sincronizar los controles con el estado actual */
  const sh = st.shadow || {};
  const shx = sp.querySelector('[data-cv-sp="shx"]');
  const shy = sp.querySelector('[data-cv-sp="shy"]');
  const shb = sp.querySelector('[data-cv-sp="shb"]');
  const shc = sp.querySelector('[data-cv-sp="shc"]');
  const sho = sp.querySelector('[data-cv-sp="sho"]');
  if(shx) shx.value = sh.offX || 0;
  if(shy) shy.value = sh.offY || 0;
  if(shb) shb.value = sh.blur || 0;
  if(sho) sho.value = (sh.opacity == null ? 0.3 : sh.opacity);
  if(shc){
    const hex = sh.colorHex || '#000000';
    shc.value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  }
  /* Enlace del objeto: sincronizar el campo */
  const lEl = sp.querySelector('[data-cv-sp="link"]');
  if(lEl){
    const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(objId) + '"]');
    lEl.value = st.link || (layer && layer.getAttribute('data-link')) || '';
  }
}
function cvSelectReset(){ cvSelect(null); }
/* ---- Drag: mover (translate), size (w/h), rotar ---- */
function cvDragStart(ev, layer){
  const st = siteCanvasGet(layer.dataset.obj);
  const rect = layer.getBoundingClientRect();
  _cvDrag = {
    layer,
    startX: ev.clientX, startY: ev.clientY,
    origX: st.x || 0, origY: st.y || 0,
    origW: st.w || rect.width, origH: st.h || rect.height,
    origRot: st.rotate || 0,
    mode: 'move',
    rect
  };
  ev.preventDefault();
}
function cvDragMove(ev){
  if(!_cvDrag || !siteLiveEdit) return;
  _cvMoved = true;
  const d = _cvDrag;
  const dx = ev.clientX - d.startX;
  const dy = ev.clientY - d.startY;
  const st = siteCanvasGet(d.layer.dataset.obj);
  if(d.mode === 'move'){
    /* SNAP a múltiplos de 5px: mantiene los objetos ALINEADOS y organizados,
       evitando posiciones desordenadas/milimétricas. */
    st.x = Math.round((d.origX + dx) / 5) * 5;
    st.y = Math.round((d.origY + dy) / 5) * 5;
  } else if(d.mode === 'size'){
    st.w = Math.round(Math.max(60, d.origW + dx) / 5) * 5;
    st.h = Math.round(Math.max(24, d.origH + dy) / 5) * 5;
  } else if(d.mode === 'rotate'){
    const cx = d.rect.left + d.rect.width/2;
    const cy = d.rect.top + d.rect.height/2;
    /* ROTACIÓN CON SNAP: se ajusta a 5° en 5° (nada de ángulos raros) */
    st.rotate = Math.round(Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90) - (Math.round(Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90) % 5);
  }
  cvApply(d.layer, st);
  siteDirty = true;
  /* Al escalar, ajustar el tamaño de fuente proporcionalmente */
  if(d.mode === 'size'){
    const txt = d.layer.querySelector('[data-cv="text"]');
    if(txt){
      const base = st.fontSize || 16;
      const ratio = (st.w || 100) / 100;
      txt.style.fontSize = Math.round(base * Math.max(.5, Math.min(3, ratio))) + 'px';
    }
  }
}
function cvDragEnd(){
  _cvDrag = null;
  /* Al soltar un objeto movido/redimensionado/rotado, persistir los cambios */
  if(_cvMoved && siteLiveEdit){ siteDirty = true; siteLiveAutoSave(); }
  _cvMoved = false;
}
function cvDragTool(mode){
  return function(ev){
    ev.preventDefault();
    ev.stopPropagation();
    cvDragStartTool(ev, mode);
  };
}
function cvDragStartTool(ev, mode){
  if(!_cvSel) return;
  const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(_cvSel) + '"]');
  if(!layer) return;
  const st = siteCanvasGet(_cvSel);
  const rect = layer.getBoundingClientRect();
  _cvDrag = {
    layer, mode,
    startX: ev.clientX, startY: ev.clientY,
    origX: st.x || 0, origY: st.y || 0,
    origW: st.w || rect.width, origH: st.h || rect.height,
    origRot: st.rotate || 0,
    rect
  };
}
/* ---- Aplica el estilo de una capa (transform, tamaño, texto, anim) ---- */
function cvApply(layer, st){
  if(!layer) return;
  /* transform: translate + rotate (NO cambia el flujo → proporciones ok) */
  const t = [];
  if(st.x || st.y) t.push('translate(' + (st.x||0) + 'px, ' + (st.y||0) + 'px)');
  if(st.rotate) t.push('rotate(' + st.rotate + 'deg)');
  layer.style.transform = t.length ? t.join(' ') : 'none';
  if(st.w) layer.style.width = st.w + 'px';
  if(st.h && st.h > 0) layer.style.height = st.h + 'px';
  /* Enlace del objeto: aplicar el href guardado en el canvas (p. ej. iconos
     del pie de página editados con doble clic). */
  if(layer.tagName === 'A' && st.href) layer.setAttribute('href', st.href);
  if(st.link) layer.setAttribute('data-link', st.link);
  else if(layer.getAttribute('data-link')) layer.removeAttribute('data-link');
  /* Texto: estilos tipográficos */
  const tx = layer.querySelector('[data-cv="text"]');
  if(tx){
    if(st.font) tx.style.fontFamily = "'" + st.font + "', sans-serif";
    if(st.fontSize) tx.style.fontSize = st.fontSize + 'px';
    if(st.color) tx.style.color = st.color;
    tx.style.fontWeight = st.bold ? '700' : '400';
    tx.style.fontStyle = st.italic ? 'italic' : 'normal';
    tx.style.textAlign = st.align || 'left';
  }
  /* SOMBRA editable: se aplica al objeto completo con box-shadow */
  if(st.shadow){
    const sh = st.shadow;
    layer.style.boxShadow = (sh.enabled === false ? 'none' :
      (sh.offX||0) + 'px ' + (sh.offY||0) + 'px ' + (sh.blur||0) + 'px ' + (sh.color||'rgba(0,0,0,.3)'));
  } else {
    layer.style.boxShadow = '';
  }
  /* Animación */
  layer.style.animation = st.anim ? (st.anim + ' 1.3s ease infinite') : '';
}
/* ---- Panel de estilo ---- */
function ensureCvStylePanel(){
  if(document.getElementById('cvStylePanel')) return;
  const sp = document.createElement('div');
  sp.id = 'cvStylePanel'; sp.className = 'cv-style-panel';
  sp.innerHTML =
    '<h5>✍️ Texto <span style="color:#6B7280;font-weight:400;text-transform:none;letter-spacing:0">(doble clic también)</span></h5>' +
    '<div class="sp-row"><input type="text" data-cv-sp="text" placeholder="Escribí el texto aquí" style="flex:1;background:#0F172A;color:#fff;border:1px solid #334155;border-radius:8px;padding:6px 8px;font-size:12.5px;outline:none"></div>' +
    '<h5>🎨 Estilo del objeto</h5>' +
    '<div class="sp-row"><label style="font-size:11px;color:#9CA3AF">Fuente</label>' +
      '<select data-cv-sp="font">' + CV_FONTS.map(f => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join('') + '</select></div>' +
    '<div class="sp-row"><label style="font-size:11px;color:#9CA3AF">Tamaño</label>' +
      '<input type="number" data-cv-sp="size" min="10" max="120" step="1">' +
      '<label style="font-size:11px;color:#9CA3AF">Color</label>' +
      '<input type="color" data-cv-sp="color"></div>' +
    '<div class="sp-row">' +
      '<button class="sp-btn" data-cv-sp="bold" title="Negrita"><b>B</b></button>' +
      '<button class="sp-btn" data-cv-sp="italic" title="Cursiva"><i>I</i></button>' +
      '<select data-cv-sp="align" style="flex:1"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></div>' +
    '<h5 style="margin-top:6px">📐 Orden del objeto</h5>' +
    '<div class="sp-row">' +
      '<button class="sp-btn" data-cv-sp="moveup" title="Subir objeto (mantiene el orden)">⬆️ Arriba</button>' +
      '<button class="sp-btn" data-cv-sp="movedown" title="Bajar objeto (mantiene el orden)">⬇️ Abajo</button>' +
      '<button class="sp-btn" data-cv-sp="delobj" title="Eliminar objeto">🗑️</button>' +
    '</div>' +
    '<h5 style="margin-top:6px">🔗 Enlace del objeto</h5>' +
    '<div class="sp-row"><input type="url" data-cv-sp="link" placeholder="https://… (opcional)" style="flex:1;background:#0F172A;color:#fff;border:1px solid #334155;border-radius:8px;padding:6px 8px;font-size:12px;outline:none"></div>' +
    '<div class="hint" style="font-size:10.5px;color:#6B7280;margin-top:2px">Si ponés un enlace, al hacer clic en este objeto (en la página publicada) se abrirá esa URL.</div>' +
    '<h5 style="margin-top:6px">🌫️ Sombra</h5>' +
    '<div class="sp-row">' +
      '<label style="font-size:11px;color:#9CA3AF">X</label><input type="number" data-cv-sp="shx" min="-50" max="50" step="1" style="width:48px">' +
      '<label style="font-size:11px;color:#9CA3AF">Y</label><input type="number" data-cv-sp="shy" min="-50" max="50" step="1" style="width:48px">' +
      '<label style="font-size:11px;color:#9CA3AF">Blur</label><input type="number" data-cv-sp="shb" min="0" max="60" step="1" style="width:48px">' +
    '</div>' +
    '<div class="sp-row">' +
      '<label style="font-size:11px;color:#9CA3AF">Color</label><input type="color" data-cv-sp="shc" style="width:32px;height:28px">' +
      '<label style="font-size:11px;color:#9CA3AF">Opac.</label><input type="number" data-cv-sp="sho" min="0" max="1" step="0.05" style="width:48px">' +
      '<button class="sp-btn" data-cv-sp="shoff" title="Quitar sombra">🚫</button>' +
    '</div>' +
    '<h5 style="margin-top:6px">✨ Animación</h5>' +
    '<div class="sp-btns">' + CV_ANIMATIONS.map((a,i) => '<button class="sp-anim" data-anim="' + a + '">' + esc(CV_ANIM_NAMES[i]) + '</button>').join('') + '</div>' +
    '<h5 style="margin-top:6px">➕ Agregar objeto</h5>' +
    '<div class="sp-btns">' +
      '<button class="sp-btn" data-cv-sp="addtext">TEXT</button>' +
      '<button class="sp-btn" data-cv-sp="addimg">📷</button>' +
      '<button class="sp-btn" data-cv-sp="added">● Círculo</button>' +
      '<button class="sp-btn" data-cv-sp="addlink">🔗 Enlace</button>' +
    '</div>';
  document.body.appendChild(sp);
  sp.addEventListener('input', function(ev){
    if(!_cvSel) return;
    const st = siteCanvasGet(_cvSel);
    const k = ev.target.dataset.cvSp;
    if(!k) return;
    if(k === 'size') st.fontSize = Math.max(10, Math.min(120, parseFloat(ev.target.value) || 16));
    else if(k === 'color'){
      st.color = ev.target.value;
      /* Si es una forma (rect, círculo, estrella, etc.) el color pinta el relleno */
      if(['rect','box','ellipse','line','star','heart','bolt','arrow','parallelogram'].indexOf(st.kind) !== -1){ st.shapeColor = ev.target.value; }
      // Reconstruir el DOM para reflejar color/estilo
      const lyr = document.querySelector('#siteRoot [data-obj="' + CSS.escape(_cvSel) + '"]');
      if(lyr && siteConfig.overlays && siteConfig.overlays[_cvSel]) sceneBuildOverlay(_cvSel);
    }
    else if(k === 'font') st.font = ev.target.value;
    else if(k === 'align') st.align = ev.target.value;
    else if(k === 'link'){
      /* Enlace del objeto superpuesto: al hacer clic en la página publicada
         abre esa URL. Se guarda en st.link (para overlays) o en canvas. */
      st.link = ev.target.value.trim();
      const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(_cvSel) + '"]');
      if(layer){
        if(st.link){
          if(siteConfig.overlays && siteConfig.overlays[_cvSel]){
            layer.style.cursor = 'pointer';
            layer.setAttribute('data-link', st.link);
          }
        } else {
          layer.removeAttribute('data-link');
          if(siteConfig.overlays && siteConfig.overlays[_cvSel]) layer.style.cursor = '';
        }
      }
      siteDirty = true;
      siteLiveAutoSave();
      return;
    }
    else if(k === 'text'){
      /* Editar el contenido del texto desde el panel (como editor web) */
      const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(_cvSel) + '"]');
      const tx = layer && layer.querySelector('[data-cv="text"]');
      if(tx){
        tx.innerText = ev.target.value;
        const path = tx.getAttribute('data-path');
        if(path) siteInlineWriteText(path, ev.target.value);
        else if(siteConfig.overlays && siteConfig.overlays[_cvSel]) siteConfig.overlays[_cvSel].text = ev.target.value;
      }
      return;
    }
    /* SOMBRA editable (offset X/Y, blur, color, opacidad) */
    else if(['shx','shy','shb','shc','sho'].includes(k)){
      if(!st.shadow) st.shadow = { offX:0, offY:3, blur:8, color:'rgba(0,0,0,.3)', enabled:true };
      if(k === 'shx') st.shadow.offX = parseFloat(ev.target.value) || 0;
      else if(k === 'shy') st.shadow.offY = parseFloat(ev.target.value) || 0;
      else if(k === 'shb') st.shadow.blur = Math.max(0, parseFloat(ev.target.value) || 0);
      else if(k === 'shc') st.shadow.colorHex = ev.target.value;
      else if(k === 'sho') st.shadow.opacity = Math.max(0, Math.min(1, parseFloat(ev.target.value) || 0.3));
      // Construir color con opacidad: rgba(hex, opacidad)
      const hex = st.shadow.colorHex || '#000000';
      const op = st.shadow.opacity == null ? 0.3 : st.shadow.opacity;
      const r = parseInt(hex.slice(1,3),16), g2 = parseInt(hex.slice(3,5),16), b2 = parseInt(hex.slice(5,7),16);
      st.shadow.color = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + op + ')';
      st.shadow.enabled = true;
    }
    const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(_cvSel) + '"]');
    cvApply(layer, st);
  });
  sp.addEventListener('click', function(ev){
    if(!_cvSel) return;
    const st = siteCanvasGet(_cvSel);
    const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(_cvSel) + '"]');
    const btn = ev.target.closest('.sp-anim');
    if(btn){
      st.anim = btn.dataset.anim || '';
      sp.querySelectorAll('.sp-anim').forEach(b => b.classList.toggle('on', b.dataset.anim === st.anim));
      cvApply(layer, st);
      return;
    }
    const bold = ev.target.closest('[data-cv-sp="bold"]');
    if(bold){
      st.bold = !st.bold;
      bold.classList.toggle('on', st.bold);
      cvApply(layer, st);
      return;
    }
    const ital = ev.target.closest('[data-cv-sp="italic"]');
    if(ital){
      st.italic = !st.italic;
      ital.classList.toggle('on', st.italic);
      cvApply(layer, st);
      return;
    }
    const up = ev.target.closest('[data-cv-sp="moveup"]');
    if(up){ cvReorder(_cvSel, 'up'); return; }
    const down = ev.target.closest('[data-cv-sp="movedown"]');
    if(down){ cvReorder(_cvSel, 'down'); return; }
    /* Eliminar objeto (texto/imagen/círculo superpuesto) */
    const del = ev.target.closest('[data-cv-sp="delobj"]');
    if(del){ cvDeleteOverlay(_cvSel); return; }
    /* Quitar sombra */
    const shoff = ev.target.closest('[data-cv-sp="shoff"]');
    if(shoff){
      if(st.shadow) st.shadow.enabled = false;
      cvApply(layer, st);
      return;
    }
    /* Agregar objetos superpuestos */
    const addT = ev.target.closest('[data-cv-sp="addtext"]');
    if(addT){ cvAddOverlay('text'); return; }
    const addI = ev.target.closest('[data-cv-sp="addimg"]');
    if(addI){ cvAddOverlay('image'); return; }
    const addE = ev.target.closest('[data-cv-sp="added"]');
    if(addE){ cvAddOverlay('ellipse'); return; }
    const addL = ev.target.closest('[data-cv-sp="addlink"]');
    if(addL){ cvAddOverlay('link'); return; }
  });
}
/* ---- Agregar OBJETOS SUPERPUESTOS (texto, imagen, círculo) al landing ----
   Se agregan como capas libres dentro de un contenedor flotante dentro de
   #siteRoot: se pueden mover, redimensionar, rotar, estilizar y aplicarles
   SOMBRA editable. Se guardan en siteConfig.overlays[{id}] y se persisten
   con "Guardar cambios" (saveSite usa siteConfig como base). */
function cvAddOverlay(kind){
  const root = document.getElementById('siteRoot');
  if(!root) return;
  if(!siteConfig.overlays) siteConfig.overlays = {};
  const id = 'ov' + Date.now().toString(36);
  const isShape = ['rect','ellipse','line','star','heart','bolt','arrow','box','parallelogram'].indexOf(kind) !== -1;
  const isElem = ['text','subtext','button','link','image','icon'].indexOf(kind) !== -1;
  /* Tamaño base según tipo */
  let w = 180, h = 60, color = '#ffffff', text = '';
  let bg = '', fontSize = 16, font = 'Inter', bold = true;
  if(kind === 'image'){ w = 200; h = 150; }
  else if(kind === 'link'){ w = 200; h = 48; bg = '#17202A'; text = 'Ir al enlace'; }
  else if(kind === 'button'){ w = 200; h = 52; bg = '#1B7A43'; text = 'Comprar'; }
  else if(kind === 'text'){ w = 320; h = 70; text = 'Título'; fontSize = 40; color = '#17202A'; }
  else if(kind === 'subtext'){ w = 340; h = 40; text = 'Subtítulo'; fontSize = 20; bold = false; color = '#64748B'; }
  else if(kind === 'icon'){ w = 64; h = 64; color = '#DB2777'; text = '✳'; fontSize = 40; bold = false; }
  else if(isShape){ w = 120; h = 120; }
  const ov = siteConfig.overlays[id] = {
    kind: kind,
    x: 60, y: 60, w: w, h: h, rotate: 0,
    font: font, fontSize: fontSize, color: color, bold: bold, italic: false, align: 'center',
    text: text,
    link: '',
    bg: bg,
    shapeColor: (isShape ? (kind==='line'?'#334155': kind==='star'||kind==='bolt'?'#F59E0B': kind==='heart'?'#DC2626' : '#7C3AED') : ''),
    shadow: { offX: 0, offY: 4, blur: 12, color: 'rgba(0,0,0,.35)', enabled: true }
  };
  sceneBuildOverlay(id);
  cvSelect(id);
}
/* Crea el elemento DOM de un overlay dentro del contenedor flotante */
function sceneBuildOverlay(id){
  const root = document.getElementById('siteRoot');
  if(!root) return;
  const ov = siteConfig && siteConfig.overlays && siteConfig.overlays[id];
  if(!ov) return;
  let cont = document.getElementById('cvOverlaysHolder');
  if(!cont || !root.contains(cont)){
    cont = document.createElement('div');
    cont.id = 'cvOverlaysHolder';
    root.appendChild(cont);
  }
  /* Si ya existe el elemento de este overlay, quitarlo antes de reconstruir
     (evita duplicados al editar color/estilo). */
  const existing = cont.querySelector('[data-obj="' + CSS.escape(id) + '"]');
  if(existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'cv-overlay-obj';
  el.setAttribute('data-obj', id);
  el.setAttribute('data-way', ov.kind || 'text');
  el.style.cssText = 'position:absolute;left:0;top:0;width:' + (ov.w||180) + 'px;height:' + (ov.h||60) + 'px;';
  if(ov.kind === 'image'){
    el.innerHTML = (ov.image
      ? '<img src="' + esc(ov.image) + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;cursor:pointer" onclick="event.stopPropagation();cvAddOverlayImage(\'' + id + '\')" title="Clic para cambiar la imagen">'
      : '<div data-cv="image" style="width:100%;height:100%;background:#E5E7EB;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px" onclick="event.stopPropagation();cvAddOverlayImage(\'' + id + '\')">📷</div>');
  } else if(ov.kind === 'ellipse'){
    el.innerHTML = '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,' + esc(ov.shapeColor||'#7C3AED') + ',' + esc(ov.shapeColor||'#BE185D') + ')"></div>';
  } else if(ov.kind === 'rect' || ov.kind === 'box'){
    el.innerHTML = '<div style="width:100%;height:100%;border-radius:12px;background:linear-gradient(135deg,' + esc(ov.shapeColor||'#7C3AED') + ',' + esc(ov.shapeColor||'#BE185D') + ');opacity:.85"></div>';
  } else if(ov.kind === 'star'){
    el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:' + Math.min(ov.w, ov.h)*0.8 + 'px;color:' + esc(ov.shapeColor||'#F59E0B') + ';text-shadow:0 4px 14px rgba(0,0,0,.25)">★</div>';
  } else if(ov.kind === 'heart'){
    el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:' + Math.min(ov.w, ov.h)*0.8 + 'px;color:' + esc(ov.shapeColor||'#DC2626') + ';text-shadow:0 4px 14px rgba(0,0,0,.25)">♥</div>';
  } else if(ov.kind === 'bolt'){
    el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:' + Math.min(ov.w, ov.h)*0.8 + 'px;color:' + esc(ov.shapeColor||'#F59E0B') + ';text-shadow:0 4px 14px rgba(0,0,0,.25)">⚡</div>';
  } else if(ov.kind === 'line'){
    el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center"><span style="width:100%;height:4px;border-radius:99px;background:' + esc(ov.shapeColor||'#334155') + '"></span></div>';
  } else if(ov.kind === 'arrow'){
    el.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:' + Math.min(ov.w, ov.h)*0.8 + 'px;color:' + esc(ov.shapeColor||'#334155') + '">➜</div>';
  } else if(ov.kind === 'parallelogram'){
    el.innerHTML = '<div style="width:100%;height:100%;transform:skewX(-14deg);border-radius:8px;background:linear-gradient(135deg,' + esc(ov.shapeColor||'#7C3AED') + ',' + esc(ov.shapeColor||'#BE185D') + ')"></div>';
  } else if(ov.kind === 'link'){
    /* OBJETO ENLACE: parece un botón y abre la URL definida (ov.link).
       En la vista pública se vuelve clickable para navegar (data-link). */
    el.innerHTML = '<div data-cv="text" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + esc(ov.bg || '#17202A') + ';border-radius:10px;color:' + esc(ov.color || '#fff') + ';font-family:' + esc(ov.font || 'Inter') + ',sans-serif;font-size:' + (ov.fontSize||16) + 'px;font-weight:700;cursor:pointer">' + esc(ov.text || 'Ir al enlace') + '</div>';
  } else if(ov.kind === 'button'){
    el.innerHTML = '<div data-cv="text" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + esc(ov.bg || '#1B7A43') + ';border-radius:12px;color:' + esc(ov.color || '#fff') + ';font-family:' + esc(ov.font || 'Inter') + ',sans-serif;font-size:' + (ov.fontSize||18) + 'px;font-weight:800;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.2)">' + esc(ov.text || 'Comprar') + '</div>';
  } else if(ov.kind === 'icon'){
    el.innerHTML = '<div data-cv="text" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:' + (ov.fontSize||40) + 'px;color:' + esc(ov.color || '#DB2777') + ';font-weight:400">' + esc(ov.text || '✳') + '</div>';
  } else {
    /* text / subtext: texto con estilos */
    el.innerHTML = '<div data-cv="text" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:' + esc(ov.font || 'Inter') + ',sans-serif;font-size:' + (ov.fontSize||16) + 'px;font-weight:' + (ov.bold?'800':'400') + ';color:' + esc(ov.color || '#17202A') + ';text-align:' + esc(ov.align || 'center') + ';line-height:1.2">' + esc(ov.text || 'Texto') + '</div>';
  }
  /* Cualquier objeto superpuesto puede tener un enlace (data-link) que se
     abre al hacer clic en la vista pública. */
  if(ov.link) el.setAttribute('data-link', ov.link);
  el.appendChild(cvToolSpan('cv-t-r'));
  el.appendChild(cvToolSpan('cv-t-r2'));
  el.appendChild(cvToolSpan('cv-t-r3'));
  el.appendChild(cvToolSpan('cv-t-rot'));
  el.appendChild(cvToolDelSpan(id));
  el.classList.add('cv-layer');
  cvApply(el, ov);
  cont.appendChild(el);
}
/* Renderiza TODOS los overlays guardados (se llama tras cada renderSiteFull) */
function renderSiteOverlays(){
  const root = document.getElementById('siteRoot');
  if(!root) return;
  const old = document.getElementById('cvOverlaysHolder');
  if(old) old.remove();
  if(!siteConfig || !siteConfig.overlays) return;
  Object.keys(siteConfig.overlays).forEach(function(id){
    sceneBuildOverlay(id);
  });
}
/* Span de tool reutilizable para objetos superpuestos.
   IMPORTANTE: el modo (size/rotate) se escribe LITERAL en el atributo
   (no se puede usar la variable `cls` dentro del onmousedown porque el
   atributo se evalúa en el scope global y `cls` no existe allí). */
function cvToolSpan(cls){
  const s = document.createElement('span');
  s.className = 'cv-tool ' + cls;
  const mode = cls.indexOf('rot') !== -1 ? 'rotate' : 'size';
  s.setAttribute('onmousedown', "event.preventDefault();event.stopPropagation();cvDragStartTool(event,'" + mode + "')");
  return s;
}
/* X roja para eliminar el objeto superpuesto (igual que las imágenes) */
function cvToolDelSpan(id){
  const s = document.createElement('span');
  s.className = 'cv-tool cv-t-del';
  s.title = 'Eliminar este objeto';
  s.textContent = '✕';
  s.setAttribute('onmousedown', 'event.preventDefault();event.stopPropagation()');
  s.setAttribute('onclick', "event.preventDefault();event.stopPropagation();cvDeleteOverlay('" + id + "')");
  return s;
}
/* Subir imagen a un objeto superpuesto */
function cvAddOverlayImage(id){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/jpeg,image/png';
  inp.onchange = async function(){
    const f = inp.files && inp.files[0];
    if(!f) return;
    try{
      const blob = await resizeSiteImage(f, 1600, 0.86);
      const ref = firebase.storage().ref('sites/' + (TENANT_ID || 'x') + '/ov-' + Date.now() + '.jpg');
      await ref.put(blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
      const url = await ref.getDownloadURL();
      const ov = siteConfig && siteConfig.overlays && siteConfig.overlays[id];
      if(ov) ov.image = url;
      sceneBuildOverlay(id);
      cvSelect(id);
      toast('Imagen agregada ✓', 'ok');
    }catch(e){ toast('No se pudo subir la imagen: ' + (e && e.message ? e.message : 'error'), 'err'); }
  };
  inp.click();
}
/* Eliminar un objeto superpuesto (solo los creados por el usuario) */
function cvDeleteOverlay(id){
  const ovs = siteConfig && siteConfig.overlays;
  if(!ovs || !ovs[id]){ toast('Solo se pueden eliminar los objetos superpuestos', 'err'); return; }
  delete ovs[id];
  if(siteConfig.canvas && siteConfig.canvas[id]) delete siteConfig.canvas[id];
  const el = document.querySelector('#siteRoot [data-obj="' + CSS.escape(id) + '"]');
  if(el) el.remove();
  cvSelectReset();
  toast('Objeto eliminado', 'ok');
  siteLiveAutoSave();
}
/* ---- Reordenar objetos (mantiene el orden y la organización) ----
   Mueve el elemento dentro de su contenedor: arriba = más temprano en el
   documento (mayor prioridad visual), abajo = later. Funciona sobre el
   contenedor padre de la capa. */
function cvReorder(objId, dir){
  const layer = document.querySelector('#siteRoot [data-obj="' + CSS.escape(objId) + '"]');
  if(!layer) return;
  const parent = layer.parentElement;
  if(!parent) return;
  if(dir === 'up'){
    const prev = layer.previousElementSibling;
    if(prev) parent.insertBefore(layer, prev);
  } else {
    const next = layer.nextElementSibling;
    if(next) parent.insertBefore(next, layer);
  }
  toast(dir === 'up' ? 'Objeto movido arriba' : 'Objeto movido abajo', 'ok');
}
/* ---- Escribe texto editado en siteConfig (con ruta) ---- */
function siteInlineWriteText(path, text){
  if(!siteConfig) siteConfig = {};
  if(!path || String(path).indexOf('.') === -1){ return; }
  const parts = path.split('.');
  let cur = siteConfig;
  for(let i=0;i<parts.length-1;i++){
    if(!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length-1]] = String(text == null ? '' : text).trim();
  /* Sincronizar también los inputs del formulario lateral (sf_*) */
  const inputId = 'sf_' + path.replace(/\./g, '__');
  const inp = document.getElementById(inputId);
  if(inp && inp.value !== cur[parts[parts.length-1]]){
    inp.value = cur[parts[parts.length-1]];
  }
  /* Sincronizar filas de listas (srow_*) y galería (grow_*) */
  const rowMatch = path.match(/^([a-zA-Z]+)\.(\d+)\.(\w+)$/);
  if(rowMatch){
    const rInp = document.getElementById('srow_' + rowMatch[1] + '_' + rowMatch[2] + '_' + rowMatch[3]);
    if(rInp) rInp.value = String(text == null ? '' : text).trim();
  }
  const galMatch = path.match(/^gallery\.(\d+)$/);
  if(galMatch){
    const gInp = document.getElementById('grow_' + galMatch[1] + '_url');
    if(gInp) gInp.value = String(text == null ? '' : text).trim();
  }
}
/* ---- Subir imagen a Storage desde la vista previa ---- */
function siteInlinePickImage(path){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/jpeg,image/png';
  inp.onchange = async function(){
    const f = inp.files && inp.files[0];
    if(!f) return;
    try{
      const blob = await resizeSiteImage(f, 1600, 0.86);
      if(typeof firebase === 'undefined' || !firebase.storage) throw new Error('Storage no disponible');
      const name = 'sites/' + (TENANT_ID || 'x') + '/' + Date.now() + Math.random().toString(36).slice(2, 7) + '.jpg';
      const ref = firebase.storage().ref(name);
      await ref.put(blob, { contentType: blob.type, cacheControl: 'public,max-age=31536000' });
      const url = await ref.getDownloadURL();
      siteInlineWriteText(path, url);
      refreshSitePreview();
      siteDirty = true;
      toast('Imagen subida a Storage ✓ (guardando…)', 'ok');
      siteLiveAutoSave();
    }catch(e){
      console.error(e);
      toast('No se pudo subir la imagen: ' + (e && e.message ? e.message : 'error'), 'err');
    }
  };
  inp.click();
}
function siteReveal(){
  const els = document.querySelectorAll('#siteRoot .sv-reveal');
  if(!('IntersectionObserver' in window)){
    els.forEach(function(el){ el.classList.add('in'); });
    return;
  }
  if(!siteRevealOb){
    siteRevealOb = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          en.target.classList.add('in');
          siteRevealOb.unobserve(en.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
  }
  els.forEach(function(el){
    const r = el.getBoundingClientRect();
    if(r.top < window.innerHeight - 60) el.classList.add('in');
    else siteRevealOb.observe(el);
  });
}
bindSiteLiveInputs();
/* Clic en objetos superpuestos con enlace (OVerlays) en la vista pública:
   si el objeto tiene data-link, se abre la URL. No aplica en edición. */
document.addEventListener('click', function(ev){
  if(ev.target.closest('.cv-tool')) return;
  const ov = ev.target.closest('.cv-overlay-obj[data-link]');
  if(ov && !document.body.classList.contains('site-live-edit')){
    ev.preventDefault();
    window.open(ov.getAttribute('data-link'), '_blank', 'noopener');
  }
});
/* ---------- CREACIÓN AUTOMÁTICA DE LA LANDING ----------
   La plataforma arma la landing con la INFORMACIÓN REAL de la tienda:
   nombre, eslogan, logo, WhatsApp, categorías, productos y precios. */
function fillLandingImages(c){
  const seed = (TENANT_ID || 'neg') + Math.random().toString(36).slice(2, 6);
  if(!c.hero || !c.hero.image) c.hero.image = 'https://picsum.photos/seed/lhero-' + seed + '/900/720';
  c.categories = (c.categories || []).map(function(x, i){ if(!x.image) x.image = 'https://picsum.photos/seed/lcat-' + seed + i + '/640/480'; return x; });
  c.featured = (c.featured || []).map(function(x, i){ if(!x.image) x.image = 'https://picsum.photos/seed/lprod-' + seed + i + '/800/800'; return x; });
  if(c.offer && !c.offer.image) c.offer.image = 'https://picsum.photos/seed/lofer-' + seed + '/800/600';
  if(c.about && !c.about.image) c.about.image = 'https://picsum.photos/seed/lab-' + seed + '/800/620';
  if(!c.gallery || !c.gallery.length) c.gallery = (SITE_DEFAULTS.gallery || []).slice();
  c.testimonials = (c.testimonials || []).map(function(t){ t.photo = t.photo || ''; return t; });
  return c;
}
function buildLandingData(){
  const c = siteDeep(SITE_DEFAULTS);
  const name = (settings && settings.storeName) || '';
  const tag = (settings && settings.tagline) || (TENANT_DATA && TENANT_DATA.tagline) || '';
  const cat = (settings && settings.categoria) || '';
  c.businessName = name;
  c.tagline = tag;
  c.logoUrl = siteLogo();
  c.active = true;
  c.seoTitle = (name ? name + ' — ' : '') + (tag || 'Productos y servicios de calidad');
  c.seoDesc = (tag || 'Visitá ' + (name || 'nuestro negocio')) + ' · Comprá fácil por WhatsApp con entrega a domicilio.';
  c.hero.badge = 'Catálogo y venta directa · MARKET CR';
  c.hero.title = 'Tu mejor opción en ' + (cat ? cat.toLowerCase() : 'productos y servicios') + (name ? ' · ' + name : '');
  c.hero.sub = 'Pedís por WhatsApp y en minutos te enviamos lo que necesitás. Atención personalizada, calidad garantizada y precios competitivos.';
  const sets = (settings && settings.categories) || [];
  const cats = sets.filter(Boolean).map(function(nm, i){ return { name: nm, desc: 'Todo lo que buscás en ' + String(nm).toLowerCase() + ', con entrega y calidad garantizada.', image: 'https://picsum.photos/seed/lcat-' + TENANT_ID + i + '/640/480', tag: '' }; });
  if(cats.length >= 2) c.categories = cats.slice(0, 8);
  c.contact.whatsapp = siteWa();
  c.contact.hours = (settings && settings.hours) || '';
  if(settings && settings.shipping) c.cta.sub = 'Estamos listos para atenderte. Pedís por WhatsApp y te lo llevamos a domicilio (' + settings.shipping + ').';
  const feats = (products || []).filter(function(p){ return !p.removed && p.active !== false && (p.unlimited || (Number(p.stock) || 0) > 0); })
    .map(function(p){
      const img = (Array.isArray(p.images) && p.images[0]) || p.image || 'https://picsum.photos/seed/lprod-' + p.id + '/800/800';
      let price = fmt(p.price);
      if(p.hasVariants){
        const av = (p.variants || []).filter(function(v){ return !v.removed; });
        if(av.length) price = 'Desde ' + fmt(av[0].price);
      }
      let old = '';
      if(p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price || 0)) old = fmt(p.compareAtPrice);
      let tagTxt = p.tag || '';
      if(!tagTxt && p.status === 'descuento') tagTxt = 'Oferta';
      return { name: p.name, desc: String(p.desc || '').slice(0, 80), price: price, old: old, image: img, tag: tagTxt, productId: p.id };
    });
  if(feats.length >= 3) c.featured = feats.slice(0, 9);
  const deal = (products || []).find(function(p){ return !p.removed && p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price || 0); });
  if(deal){
    const pct = Math.max(5, Math.round(100 - (Number(deal.price || 0) / Number(deal.compareAtPrice || 1)) * 100));
    c.offer.name = deal.name;
    c.offer.percent = '-' + pct + '%';
    c.offer.old = fmt(deal.compareAtPrice);
    c.offer.price = fmt(deal.price);
    c.offer.image = (Array.isArray(deal.images) && deal.images[0]) || deal.image || 'https://picsum.photos/seed/lofer-' + deal.id + '/800/600';
    c.offer.ends = 'Oferta válida por tiempo limitado.';
  }
  const ts = [];
  (products || []).forEach(function(p){ (Array.isArray(p.reviews) ? p.reviews : []).forEach(function(r){ if(r && r.name && r.comment) ts.push({ name: r.name, photo: '', comment: String(r.comment).slice(0, 140), stars: Math.min(5, Number(r.stars) || 5) }); }); });
  if(ts.length >= 2) c.testimonials = ts.slice(0, 4);
  const gl = [];
  (products || []).forEach(function(p){ (Array.isArray(p.images) ? p.images : []).forEach(function(im){ if(gl.length < 8 && im) gl.push(im); }); });
  if(gl.length >= 4) c.gallery = gl.slice(0, 8);
  c.about.title = 'Conocé ' + (name || 'nuestro negocio');
  c.about.text = tag ? tag + '. Trabajamos todos los días para ofrecerte lo mejor, con atención cercana y entregas a tiempo.' : c.about.text;
  c.about.mission = 'Ofrecer productos y servicios de calidad con un trato cercano y honesto a precios justos.';
  c.footer.about = tag || ('Visitá ' + (name || 'nuestro negocio') + ' y pedí por WhatsApp. Entrega a domicilio y atención personalizada.');
  fillLandingImages(c);
  return c;
}
function buildLandingFromBusiness(autoSave){
  const setMsg = document.getElementById('siteGenMsg');
  const setm = function(t){ if(setMsg) setMsg.textContent = t; };
  const c = buildLandingData();
  siteConfig = c;
  loadSiteEditor();
  /* Auto-guardar al crear (Firestore + Storage) para que siempre quede
     persistida y el admin pueda publicarla sin perder nada. */
  if(autoSave){ siteAutoSaveNow(true); }
  setm('✓ Landing creada con la información de tu negocio. Revisala en las pestañas y presioná "Guardar cambios" para publicarla.');
  toast('Landing creada con tu negocio', 'ok');
}
/* ---------- CREACIÓN CON IA (usa el backend aiChat + datos reales) ---------- */
function siteAiReady(){
  const provider = settings.aiProvider || 'gemini';
  const hasCreds = (settings.aiConfigured !== undefined)
    ? !!settings.aiConfigured
    : provider === 'openrouter'
      ? !!(settings.aiOpenrouterKey && settings.aiModel)
      : provider === 'external'
        ? !!(settings.aiExternalKey && settings.aiExternalModel)
        : !!settings.aiApiKey;
  return !!(settings.aiEnabled && hasCreds);
}
/* La IA escribe SOLO los textos (brief), los productos/categorías/contacto
   siempre salen de los datos reales del negocio; así la respuesta es corta,
   no se corta a la mitad y la landing conserva la información del admin. */
function buildSiteGenPrompt(){
  const facts = [];
  facts.push('Negocio: ' + siteName());
  if(settings && settings.tagline) facts.push('Eslogan: ' + settings.tagline);
  if(settings && settings.categoria) facts.push('Giro: ' + settings.categoria);
  if(settings && Array.isArray(settings.categories) && settings.categories.length) facts.push('Categorías: ' + settings.categories.join(', '));
  const prods = (products || []).filter(function(p){ return !p.removed && p.active !== false; }).slice(0, 8)
    .map(function(p){ return p.name + (p.hasVariants ? ' (variantes)' : '') + ' - ' + fmt(p.price); });
  if(prods.length) facts.push('Productos destacados: ' + prods.join(' | '));
  if(settings && settings.shipping) facts.push('Envío: ' + settings.shipping);
  if(settings && settings.hours) facts.push('Horario: ' + settings.hours);
  const schema = '{"hero":{"badge":"","title":"","sub":""},"benefits":[{"icon":"leaf|truck|chat|cart|heart|tag","title":"","desc":""}],"offer":{"name":"","message":""},"about":{"title":"","text":"","mission":"","values":[""],"experience":""},"whyUs":[{"icon":"","title":"","desc":""}],"testimonials":[{"name":"","comment":"","stars":5}],"cta":{"title":"","sub":""},"footer":{"about":""}}';
  return 'Sos un redactor publicitario experto en español costarricense. Generá SOLO los TEXTOS de la landing page profesional de este negocio. No generes productos, categorías, precios ni contacto: eso ya viene de los datos reales.\n' +
    'Datos reales del negocio:\n- ' + facts.join('\n- ') + '\n\n' +
    'Reglas:\n' +
    '1. Respondé SOLO en JSON válido, sin markdown y sin texto antes ni después.\n' +
    '2. Beneficios: exactamente 4. WhyUs: exactamente 4. Testimonios: exactamente 3. Cada texto entre 8 y 25 palabras.\n' +
    '3. Hero: badge corto, título con gancho (máx 12 palabras), sub (máx 22 palabras).\n' +
    '4. Offer: usá el nombre del producto en oferta enviado o dejá un producto genérico del negocio, y un mensaje de urgencia breve.\n' +
    '5. About: título (máx 10 palabras), texto (máx 45 palabras), misión y 3 valores. experience: un número.\n' +
    '6. Evitá "Bienvenido", "ofrecemos", frases plantilla. Sonido auténtico de negocio local costarricense.\n' +
    '7. Mantené exactamente las claves del schema. Usá SOLO campos de texto, sin emojis:\n' + schema;
}
function tryParseJsonLoose(raw){
  raw = String(raw || '').trim();
  if(raw.indexOf('```') === 0) raw = raw.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
  if(!raw) return null;
  const tryP = function(s){ try{ const o = JSON.parse(s); return (o && typeof o === 'object') ? o : undefined; }catch(e){ return undefined; } };
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}');
  if(first >= 0){
    if(tryP(raw)) return tryP(raw);
    if(last > first){
      let cut = last;
      while(cut > first){
        const o = tryP(raw.slice(first, cut + 1));
        if(o) return o;
        cut = raw.lastIndexOf('}', cut - 1);
      }
    }
    const openB = (raw.match(/\{/g) || []).length, closeB = (raw.match(/\}/g) || []).length;
    const openA = (raw.match(/\[/g) || []).length, closeA = (raw.match(/\]/g) || []).length;
    let s = raw.replace(/,(\s*)$/, ' ');
    for(let i = 0; i < openA - closeA; i++) s += ']';
    for(let i = 0; i < openB - closeB; i++) s += '}';
    const o2 = tryP(s);
    if(o2) return o2;
    for(let cut = raw.length - 1; cut > first; cut--){
      if(raw[cut] === ',' || raw[cut] === ']'){
        const o3 = tryP(raw.slice(first, cut));
        if(o3) return o3;
      }
    }
  }
  return null;
}
async function generateSiteWithAI(){
  const setMsg = document.getElementById('siteGenMsg');
  const setm = function(t){ if(setMsg) setMsg.textContent = t; };
  if(!siteAiReady()){
    /* Si la IA no está configurada, NO se bloquea: se crea igual con los
       datos reales del negocio (igual que "Crear con mi negocio"). */
    setm('La IA no está activa: se creó la landing con los datos reales de tu negocio. Configurá la IA en Configuraciones para generar textos automáticos.');
    buildLandingFromBusiness(true);
    return;
  }
  setm('Creando tu landing con IA… puede tardar unos segundos.');
  try{
    const base = buildLandingData();
    const prompt = buildSiteGenPrompt();
    const data = await cloudCall('aiChat', { slug: TENANT_ID, text: 'Generá solo los textos de la landing.', system: prompt, history: [], maxTokens: 1600 });
    let raw = (data && data.reply) || '';
    raw = String(raw).trim();
    let obj = tryParseJsonLoose(raw);
    if(!obj){
      setm('La IA cortó la respuesta… reintentando.');
      try{
        const data2 = await cloudCall('aiChat', { slug: TENANT_ID, text: 'Continuá generando SOLO el objeto JSON (mismo schema), breve, sin markdown ni explicaciones.', system: prompt, history: [], maxTokens: 1400 });
        obj = tryParseJsonLoose((data2 && data2.reply) || '');
      }catch(e2){ console.error(e2); }
    }
    if(obj){
      const merged = deepMerge(base, obj);
      fillLandingImages(merged);
      siteConfig = merged;
      await siteAutoSaveNow(true);
      loadSiteEditor();
      setm('✓ Landing generada con IA (sobre tus productos reales). Revisala y presioná "Guardar cambios".');
      toast('Landing generada con IA', 'ok');
    }else{
      siteConfig = base;
      await siteAutoSaveNow(true);
      loadSiteEditor();
      setm('La IA respondió incompleto, así que usamos los textos estándar con tus productos reales. Revisá y guardá.');
      toast('IA incompleta: se usaron textos estándar', 'warn');
    }
  }catch(e){
    console.error(e);
    /* Si la IA falla en tiempo de ejecución, caer a los datos reales y
       guardar, para que la función SIEMPRE funcione. */
    try{
      const base = buildLandingData();
      siteConfig = base;
      await siteAutoSaveNow(true);
      loadSiteEditor();
      setm('La IA no respondió, así que usamos los datos reales de tu negocio. Revisá y guardá.');
      toast('La IA falló: se usaron los datos de tu negocio', 'warn');
    }catch(e2){ console.error(e2); }
  }
}
/* Guarda la landing al instante (Firestore + Storage) sin depender del botón.
   Usado al crear con IA / mi negocio para que siempre quede persistida. */
async function siteAutoSaveNow(fromCreate){
  try{
    const cfg = siteDeep(siteConfig || {});
    if(siteDoc) await siteDoc.set(JSON.parse(JSON.stringify(cfg)), { merge:true });
    await saveSiteToStorage(cfg);
    siteConfig = cfg;
    siteDirty = false;
    if(fromCreate) console.info('Landing autoguardada tras creación');
  }catch(e){ console.warn('Auto-guardado de creación falló:', e && e.message); }
}
/* Ajuste en el render: cerrar el editor antes de la vista pública si hay cambios sin guardar */
async function bootPlatform(){
  renderHeader(); renderChips(); updateCartUI(); renderExternalLinks(); renderStoryVideo();
  /* SUPERADMIN POR EMAIL: si el usuario actual tiene correo en SUPERADMIN_EMAILS,
     activar modo automáticamente (sin necesidad de ?superadmin=1) */
  const user = auth.currentUser;
  const isSuperAdminByEmail = user && window.SUPERADMIN_EMAILS?.includes(user.email);
  /* Superadmin por email SOLO si la URL NO pide una tienda específica
     (sin ?tienda= en absoluto). Si ?tienda= existe (aunque esté vacío),
     se muestra SIEMPRE el landing principal con los negocios — así el enlace
     ?tienda= nunca abre el panel maestro. El superadmin accede al panel con
     ?superadmin=1. */
  const urlHasTenant = new URLSearchParams(location.search).has('tienda');
  if(isSuperAdminByEmail && !urlHasTenant){
    initSuperadminMode();
    return;
  }
  if(new URLSearchParams(location.search).get('superadmin') === '1'){
    initSuperadminMode();
    return;
  }
  if(new URLSearchParams(location.search).get('sembrar') === '1'){
    seedDemoTenants();
    return;
  }
  if(!TENANT_ID){
    /* ?tienda= presente pero vacío → SIEMPRE el landing principal.
       Limpiar cualquier estado de superadmin que pudiera haber quedado. */
    isSuperadminMode = false;
    isSuperadminSession = false;
    document.body.classList.remove('superadmin-mode');
    renderTenantSelector();
    return;
  }
  try{
    const snap = await tenantRef().get();
    if(!snap.exists){
      renderTenantSelector('No existe ningún negocio con el ID "' + TENANT_ID + '" en Firestore. Revisá que el ID del documento en tenants/ sea exactamente ese texto, sin espacios ni mayúsculas.');
      return;
    }
    if(snap.data().activo === false){
      renderTenantSelector('El negocio "' + TENANT_ID + '" existe pero está marcado como inactivo (activo: false) en Firestore.');
      return;
    }
    TENANT_DATA = snap.data();
    // Asegurar valores por defecto de membresía si no existen
    if(!TENANT_DATA.membershipPlan){
      TENANT_DATA.membershipPlan = 'emprendedor';
      TENANT_DATA.membershipStatus = 'al_dia';
      TENANT_DATA.membershipNextDueDate = addMonths(new Date(),1).toISOString();
      TENANT_DATA.membershipLastPaymentDate = new Date().toISOString();
      TENANT_DATA.membershipAutoSuspend = true;
      TENANT_DATA.membershipReminderSent = false;
      TENANT_DATA.plan = 'basico';
      TENANT_DATA.planRank = 1;
      TENANT_DATA.montoMensual = 9900;
    }
    // Compatibilidad: si no tiene planApprovedId, asignarlo desde el plan actual
    if(!TENANT_DATA.planApprovedId){
      const st = TENANT_DATA.membershipStatus || 'al_dia';
      TENANT_DATA.planApprovedId = (st === 'al_dia') ? (TENANT_DATA.membershipPlan || 'emprendedor') : 'emprendedor';
    }
    ADMIN_EMAILS = TENANT_DATA.adminEmails || [];
    window.ADMIN_EMAILS = ADMIN_EMAILS;
    document.title = (TENANT_DATA.nombre || 'Tienda') + ' — PRO.DIGITAL';
    bindTenantRefs();
    refreshAdminSession();
    /* Si el superadministrador llega desde el botón "Administrar" del
       panel maestro (?tienda=slug&panel=admin), y su sesión ya cuenta
       como admin de esta tienda, entra directo al panel sin pasos extra. */
    if(isAdminSession && new URLSearchParams(location.search).get('panel') === 'admin'){
      enterAdmin();
    }
listenSettings();
    listenProducts();
    listenEmployees();
    listenSite();
    /* El sitio web profesional (?web=1 o ?landing=1): se muestra en pantalla completa. */
    if(new URLSearchParams(location.search).get('web') === '1' || new URLSearchParams(location.search).get('landing') === '1'){
      setTimeout(openSitePublic, 400);
    }
    /* La vista compartida del POS (?pos=1): abre el acceso de empleados */
    if(new URLSearchParams(location.search).get('pos') === '1'){
      setTimeout(openEmployeeLogin, 600);
    }
    /* Abrir directo un producto si llegamos por QR/enlace compartido (?p=ID y variante &vi=) */
    const dlPid = new URLSearchParams(location.search).get('p');
    const dlVi = new URLSearchParams(location.search).get('vi');
    if(dlPid){
      scheduleProductDeepLink(dlPid, dlVi || '');
      /* Red de seguridad: si por algún motivo el catálogo no vuelve a emitir un
         snapshot (ej. ya estaba cargado), reintentamos el deep link. */
      setTimeout(maybeOpenProductDeepLink, 9000);
    }
    /* Registrar visita a esta tienda (con fuente de tráfico) */
    setTimeout(trackPageVisit, 1200);
  }catch(e){
    console.error(e);
    renderTenantSelector('No se pudo cargar "' + TENANT_ID + '": ' + (e && e.message ? e.message : 'error desconocido'));
  }
}
bootPlatform();
/* La primera vez que el administrador entre y presione "Guardar cambios" en
   Configuraciones, se crea el documento tenants/{slug}/settings/store en Firestore. */
