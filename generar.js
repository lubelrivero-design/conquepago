/* Genera las páginas del sitio a partir de los datos de la app.
 *
 *   node generar.js                      usa ./datos (lo que baja el workflow)
 *   node generar.js ../descuentos-ar/www/datos    desde la PC, con el repo al lado
 *
 * Arma, con contenido real y de hoy:
 *   descuentos-hoy.html          lo mejor de hoy por rubro          ("descuentos hoy")
 *   descuentos/<comercio>.html   todas las promos de ese comercio   ("descuentos en coto")
 *   billeteras/<medio>.html      todas las promos de esa billetera  ("descuentos cuenta dni")
 *   descuentos/index.html, billeteras/index.html, sitemap.xml
 *
 * Existe porque cuando alguien busca "descuentos coto hoy" en Google encuentra
 * notas de hace meses. La respuesta fresca la tenemos nosotros, todos los días.
 * Cada página termina en la app. Corre todas las mañanas desde GitHub Actions
 * (.github/workflows/paginas.yml). No hace falta editar nada de esto a mano.
 */

const fs = require('fs');
const path = require('path');

const DATOS = path.resolve(process.argv[2] || path.join(__dirname, 'datos'));
const SITIO = 'https://lubelrivero-design.github.io/conquepago';
const PLAY = 'https://play.google.com/store/apps/details?id=ar.com.descuentos.conquepago';
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIA_BONITO = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
                     viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
const NOMBRE_RUBRO = {
  supermercados: 'Súper', mayoristas: 'Mayoristas', farmacia: 'Farmacias', combustible: 'Nafta',
  gastronomia: 'Comer afuera', delivery: 'Delivery', transporte: 'Transporte', carnicerias: 'Carnicerías',
  ferias: 'Ferias y verdulerías', mascotas: 'Mascotas', indumentaria: 'Ropa', electro: 'Electro',
  hogar: 'Hogar', garrafas: 'Garrafas', automotor: 'Auto', viajes: 'Viajes', educacion: 'Educación',
  espectaculos: 'Espectáculos', librerias: 'Librerías', belleza: 'Belleza', opticas: 'Ópticas',
  alimentos: 'Alimentos', 'comercios de cercanía': 'Comercios de barrio', 'comercios adheridos': 'Comercios adheridos',
  marcas: 'Marcas', rodados: 'Bicicletas'
};
const ORDEN_RUBROS = ['supermercados', 'mayoristas', 'farmacia', 'combustible', 'gastronomia', 'delivery',
                      'transporte', 'carnicerias', 'ferias', 'electro', 'hogar', 'indumentaria'];

/* ---------- datos ---------- */

const datos = JSON.parse(fs.readFileSync(path.join(DATOS, 'promos.json'), 'utf8'));
const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
const hoyISO = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
const hoyDia = DIAS[(ahora.getDay() + 6) % 7];
const hoyBonito = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const actualizado = new Date((datos.actualizado || hoyISO) + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

const vigentes = datos.promos.filter(p =>
  p.confianza !== 'baja' && p.vigencia_desde <= hoyISO && hoyISO <= p.vigencia_hasta);

/* ---------- ayudas ---------- */

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plata = n => '$' + Number(n).toLocaleString('es-AR');

const queDa = p => p.descuento_pct > 0
  ? p.descuento_pct + '%' + (p.cuotas ? ' + ' + p.cuotas + ' cuotas sin interés' : '')
  : (p.cuotas ? p.cuotas + ' cuotas sin interés' : '');
const tope = p => p.descuento_pct > 0
  ? (p.tope_monto
      ? 'tope ' + plata(p.tope_monto) + (p.tope_periodo === 'semanal' ? ' por semana' : p.tope_periodo === 'mensual' ? ' por mes' : (p.tope_periodo === 'diario' ? ' por día' : ''))
      : (p.tope_publicado === false ? 'tope no publicado' : 'sin tope'))
  : '';
const diasDe = p => p.dias.length >= 7 ? 'Todos los días'
  : p.dias.slice().sort((a, b) => DIAS.indexOf(a) - DIAS.indexOf(b)).map(d => DIA_BONITO[d]).join(', ');
const hasta = p => new Date(p.vigencia_hasta + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
const medioNombre = p => (p.medio_nombre || '').replace(/\s*\(.*\)\s*/, '').trim();
const zona = p => (!p.zona || p.zona === 'Nacional') ? '' : p.zona;

const porValor = (a, b) => (b.descuento_pct || 0) - (a.descuento_pct || 0) || (b.cuotas || 0) - (a.cuotas || 0) ||
                           (b.tope_monto || 0) - (a.tope_monto || 0);

/* ---------- piezas de página ---------- */

function pagina({ titulo, descripcion, ruta, cuerpo, migas }) {
  const url = SITIO + '/' + ruta;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://raw.githubusercontent.com/lubelrivero-design/descuentos-ar-datos/main/hoy/hoy.png">
<link rel="stylesheet" href="${ruta.includes('/') ? '../' : ''}estilo.css">
<style>
  .promo{background:#fff;border:1px solid var(--linea);border-radius:14px;padding:14px 17px;margin-bottom:10px}
  .promo .que{font-size:22px;font-weight:800;letter-spacing:-.01em}
  .promo .que b{color:var(--verde)}
  .promo .con{font-size:15px;margin-top:2px}
  .promo .req{font-size:14px;color:var(--suave);margin-top:6px}
  .promo .meta{font-size:13px;color:var(--suave);margin-top:6px}
  .promo .meta a{color:var(--suave)}
  .zona{display:inline-block;background:#fff3d6;color:#7a5200;border-radius:6px;padding:1px 7px;font-size:12.5px;font-weight:600;margin-left:6px}
  .hoy-si{display:inline-block;background:#e3f4ea;color:var(--verde);border-radius:6px;padding:1px 7px;font-size:12.5px;font-weight:600;margin-left:6px}
  .lista{columns:2;column-gap:20px;list-style:none;padding:0}
  .lista li{margin-bottom:6px;break-inside:avoid}
  .cta{background:var(--verde);color:#fff;border-radius:14px;padding:18px 20px;margin:34px 0}
  .cta a{color:#fff;font-weight:700}
  .cta p{margin:0}
  .migas{font-size:14px;margin-bottom:18px}
  .migas a{text-decoration:none;font-weight:600}
  @media (prefers-color-scheme:dark){.promo{background:#1c1f25}.zona{background:#4a3a10;color:#ffd98a}.hoy-si{background:#123b28;color:#8fd9b0}}
</style>
</head>
<body>
<main>
  <p class="migas">${migas}</p>
  ${cuerpo}
  <div class="cta"><p><b>¿Con qué pago?</b> te dice cada mañana con cuál de tus billeteras te conviene pagar, según las que tenés y dónde vivís. Gratis, sin cuenta, sin datos del banco.<br><a href="${PLAY}">Bajala en Google Play →</a></p></div>
  <p class="pie">Datos revisados el ${esc(actualizado)} en las páginas públicas de bancos, billeteras y comercios. Es una guía: los bancos cambian las promociones sin aviso. Antes de pagar, confirmá en la app de tu billetera.<br>
  <a href="${ruta.includes('/') ? '../' : ''}index.html">¿Con qué pago?</a> · <a href="${ruta.includes('/') ? '../' : ''}descuentos-hoy.html">Los descuentos de hoy</a> · <a href="${ruta.includes('/') ? '../' : ''}descuentos/index.html">Por comercio</a> · <a href="${ruta.includes('/') ? '../' : ''}billeteras/index.html">Por billetera</a></p>
</main>
</body>
</html>
`;
}

function tarjeta(p, { mostrarComercio = true, mostrarMedio = true } = {}) {
  const esHoy = p.dias.includes(hoyDia);
  return `<div class="promo">
    <div class="que"><b>${esc(queDa(p))}</b>${mostrarComercio ? ' en ' + esc(p.comercios.join(', ')) : ''}${zona(p) ? '<span class="zona">' + esc(zona(p)) + '</span>' : ''}${esHoy ? '<span class="hoy-si">hoy</span>' : ''}</div>
    <div class="con">${esc(diasDe(p))}${mostrarMedio ? ' · con <b>' + esc(medioNombre(p)) + '</b>' : ''}${tope(p) ? ' · ' + esc(tope(p)) : ''}</div>
    ${p.requisitos ? '<div class="req">' + esc(p.requisitos) + '</div>' : ''}
    <div class="meta">Hasta el ${esc(hasta(p))}${p.vigencia_asumida ? ' (falta confirmar que siga este mes)' : ''}${p.fuente ? ' · <a href="' + esc(p.fuente) + '" rel="nofollow">fuente</a>' : ''}</div>
  </div>`;
}

function porDia(promos, opciones) {
  const bloques = [];
  const todos = promos.filter(p => p.dias.length >= 7).sort(porValor);
  if (todos.length) bloques.push('<h2>Todos los días</h2>' + todos.map(p => tarjeta(p, opciones)).join(''));
  DIAS.forEach(d => {
    const del = promos.filter(p => p.dias.length < 7 && p.dias.includes(d)).sort(porValor);
    if (del.length) bloques.push('<h2>' + DIA_BONITO[d] + (d === hoyDia ? ' (hoy)' : '') + '</h2>' + del.map(p => tarjeta(p, opciones)).join(''));
  });
  return bloques.join('');
}

const escribir = (ruta, html) => {
  const destino = path.join(__dirname, ruta);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);
};

/* ---------- por comercio ---------- */

const porComercio = new Map();
vigentes.forEach(p => p.comercios.forEach(c => {
  const k = c.trim();
  if (!porComercio.has(k)) porComercio.set(k, []);
  porComercio.get(k).push(p);
}));
/* Una página por comercio con al menos dos promos: una sola es poco para una
   página, y Google castiga las páginas flacas. El resto vive en las de billetera. */
const comercios = [...porComercio.entries()].filter(([, ps]) => ps.length >= 2 &&
  !/adherid|seleccionad|participantes/i.test(ps[0].comercios.join(' ')))
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

const rutas = [];
comercios.forEach(([nombre, promos]) => {
  const ruta = 'descuentos/' + slug(nombre) + '.html';
  const deHoy = promos.filter(p => p.dias.includes(hoyDia) && p.descuento_pct > 0).sort(porValor);
  const mejorHoy = deHoy[0];
  const medios = [...new Set(promos.map(medioNombre))];
  const titulo = 'Descuentos en ' + nombre + (mejorHoy ? ' hoy: ' + queDa(mejorHoy) + ' con ' + medioNombre(mejorHoy) : '') + ' | ¿Con qué pago?';
  const descripcion = 'Todos los descuentos y cuotas sin interés en ' + nombre + ' con ' + medios.slice(0, 5).join(', ') +
    (medios.length > 5 ? ' y más' : '') + ', día por día, con tope y condiciones. Actualizado el ' + actualizado + '.';
  const cuerpo = `
    <h1>Descuentos en ${esc(nombre)}</h1>
    <p class="fecha">${promos.length} promociones vigentes · hoy ${esc(hoyBonito)}</p>
    ${mejorHoy
      ? '<div class="resumen"><b>Hoy en ' + esc(nombre) + ' te conviene ' + esc(queDa(mejorHoy)) + ' con ' + esc(medioNombre(mejorHoy)) + '</b>' + (tope(mejorHoy) ? ', ' + esc(tope(mejorHoy)) : '') + '.' +
        (deHoy.length > 1 ? ' También hoy: ' + esc(deHoy.slice(1, 4).map(p => queDa(p) + ' con ' + medioNombre(p)).join('; ')) + '.' : '') + '</div>'
      : '<div class="resumen">Hoy ' + esc(hoyBonito) + ' no hay descuentos en ' + esc(nombre) + '. Abajo están los de cada día.</div>'}
    ${porDia(promos, { mostrarComercio: false })}`;
  escribir(ruta, pagina({ titulo, descripcion, ruta, cuerpo, migas: '<a href="../index.html">¿Con qué pago?</a> › <a href="index.html">Descuentos por comercio</a> › ' + esc(nombre) }));
  rutas.push(ruta);
});

escribir('descuentos/index.html', pagina({
  titulo: 'Descuentos por comercio: súper, farmacias, nafta y más | ¿Con qué pago?',
  descripcion: 'Los descuentos vigentes en ' + comercios.length + ' comercios de Argentina con billeteras y bancos, día por día. Actualizado el ' + actualizado + '.',
  ruta: 'descuentos/index.html',
  migas: '<a href="../index.html">¿Con qué pago?</a> › Descuentos por comercio',
  cuerpo: '<h1>Descuentos por comercio</h1><p class="fecha">' + comercios.length + ' comercios con promociones vigentes · actualizado el ' + esc(actualizado) + '</p><ul class="lista">' +
    comercios.map(([n, ps]) => '<li><a href="' + slug(n) + '.html">' + esc(n) + '</a> <span style="color:var(--suave)">(' + ps.length + ')</span></li>').join('') + '</ul>'
}));
rutas.push('descuentos/index.html');

/* ---------- por billetera ---------- */

const porMedio = new Map();
vigentes.forEach(p => {
  if (p.medio === 'cualquiera') return;
  if (!porMedio.has(p.medio)) porMedio.set(p.medio, []);
  porMedio.get(p.medio).push(p);
});
const medios = [...porMedio.entries()].filter(([, ps]) => ps.length >= 2)
  .sort((a, b) => b[1].length - a[1].length);

medios.forEach(([id, promos]) => {
  const nombre = medioNombre(promos[0]);
  const ruta = 'billeteras/' + slug(nombre) + '.html';
  const deHoy = promos.filter(p => p.dias.includes(hoyDia) && p.descuento_pct > 0).sort(porValor);
  const comerciosHoy = [...new Set(deHoy.map(p => p.comercios[0]))];
  const titulo = 'Descuentos con ' + nombre + (deHoy.length ? ' hoy: ' + queDa(deHoy[0]) + ' en ' + deHoy[0].comercios[0] : '') + ' | ¿Con qué pago?';
  const descripcion = 'Todas las promociones vigentes de ' + nombre + ' en súper, farmacias, nafta y más, día por día, con tope y condiciones. Actualizado el ' + actualizado + '.';
  const cuerpo = `
    <h1>Descuentos con ${esc(nombre)}</h1>
    <p class="fecha">${promos.length} promociones vigentes · hoy ${esc(hoyBonito)}</p>
    ${deHoy.length
      ? '<div class="resumen"><b>Hoy con ' + esc(nombre) + ':</b> ' + esc(deHoy.slice(0, 5).map(p => queDa(p) + ' en ' + p.comercios[0]).join(' · ')) + (comerciosHoy.length > 5 ? ' y ' + (comerciosHoy.length - 5) + ' más' : '') + '.</div>'
      : '<div class="resumen">Hoy ' + esc(hoyBonito) + ' no hay descuentos con ' + esc(nombre) + '. Abajo están los de cada día.</div>'}
    ${porDia(promos, { mostrarMedio: false })}`;
  escribir(ruta, pagina({ titulo, descripcion, ruta, cuerpo, migas: '<a href="../index.html">¿Con qué pago?</a> › <a href="index.html">Descuentos por billetera</a> › ' + esc(nombre) }));
  rutas.push(ruta);
});

escribir('billeteras/index.html', pagina({
  titulo: 'Descuentos por billetera y banco: Cuenta DNI, Mercado Pago, MODO y más | ¿Con qué pago?',
  descripcion: 'Qué descuento da cada billetera y cada banco de Argentina, día por día. Actualizado el ' + actualizado + '.',
  ruta: 'billeteras/index.html',
  migas: '<a href="../index.html">¿Con qué pago?</a> › Descuentos por billetera',
  cuerpo: '<h1>Descuentos por billetera y banco</h1><p class="fecha">' + medios.length + ' billeteras y bancos con promociones vigentes · actualizado el ' + esc(actualizado) + '</p><ul class="lista">' +
    medios.map(([, ps]) => '<li><a href="' + slug(medioNombre(ps[0])) + '.html">' + esc(medioNombre(ps[0])) + '</a> <span style="color:var(--suave)">(' + ps.length + ')</span></li>').join('') + '</ul>'
}));
rutas.push('billeteras/index.html');

/* ---------- hoy ---------- */

const deHoy = vigentes.filter(p => p.dias.includes(hoyDia) && p.descuento_pct > 0 && !zona(p));
const rubrosHoy = [...new Set(deHoy.map(p => p.rubro))]
  .sort((a, b) => (ORDEN_RUBROS.indexOf(a) + 1 || 99) - (ORDEN_RUBROS.indexOf(b) + 1 || 99));
const cuerpoHoy = `
  <h1>Descuentos de hoy, ${esc(hoyBonito)}</h1>
  <p class="fecha">${deHoy.length} promociones nacionales vigentes hoy · datos revisados el ${esc(actualizado)}</p>
  <p>Lo mejor de hoy con billeteras y bancos, por rubro. Las promociones de una sola provincia están en la página de cada <a href="descuentos/index.html">comercio</a>.</p>
  ${rubrosHoy.map(r => {
    const del = deHoy.filter(p => p.rubro === r).sort(porValor).slice(0, 8);
    return '<h2>' + esc(NOMBRE_RUBRO[r] || r) + '</h2>' + del.map(p => tarjeta(p)).join('');
  }).join('')}`;
escribir('descuentos-hoy.html', pagina({
  titulo: 'Descuentos de hoy ' + hoyBonito + ' en súper, farmacias y nafta | ¿Con qué pago?',
  descripcion: 'Los descuentos de hoy con Cuenta DNI, Mercado Pago, MODO y bancos en Coto, Carrefour, Día, ChangoMás, farmacias y nafta. Se actualiza todas las mañanas.',
  ruta: 'descuentos-hoy.html',
  migas: '<a href="index.html">¿Con qué pago?</a> › Descuentos de hoy',
  cuerpo: cuerpoHoy
}));
rutas.push('descuentos-hoy.html');

/* ---------- sitemap y robots ---------- */

const fijas = ['index.html', 'hoy.html', 'privacidad.html'];
escribir('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...fijas, ...rutas].map(r => '  <url><loc>' + SITIO + '/' + r + '</loc><lastmod>' + hoyISO + '</lastmod>' +
    (fijas.includes(r) ? '' : '<changefreq>daily</changefreq>') + '</url>').join('\n') + '\n</urlset>\n');
escribir('robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + SITIO + '/sitemap.xml\n');

console.log('páginas: ' + comercios.length + ' comercios, ' + medios.length + ' billeteras, descuentos-hoy (' + deHoy.length + ' promos), sitemap con ' + (rutas.length + fijas.length) + ' urls');
