const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

const MASTER_KEY = "$2a$10$tg1ZdjhTaaMXJux9z9NikO/nVFhjVdV28wxjdimgawIO.VkiBMEUi";
const BIN_ID = "6acba057ac6210605a28056a";

let memoriaProductos = [];
let memoriaCategorias = [
    { id: 1, nombre: 'Estética', icono: '💄', color: 'linear-gradient(135deg, #ec4899, #be185d)' },
    { id: 2, nombre: 'Electrónica', icono: '🎧', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { id: 3, nombre: 'Zapatería', icono: '👟', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { id: 4, nombre: 'Accesorios', icono: '📱', color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }
];
let memoriaEstadisticas = { totalVisitas: 0, visitasMovil: 0, visitasPC: 0, secciones: {}, busquedas: {}, porDia: {} };

let datosListos = false;
let nubeSincronizadaOk = false;

function sincronizarConCloud(forzarGuardado = false) {
    if (!datosListos) return;
    
    if (!nubeSincronizadaOk && memoriaProductos.length === 0 && !forzarGuardado) {
        console.log('🛡️ ALERTA CRÍTICA: Bloqueo de seguridad activado. No se sincronizó con la nube aún, se evita sobreescritura.');
        return;
    }

    console.log('🔍 ANALIZANDO IMÁGENES DE LOS PRODUCTOS A SUBIR:');
    memoriaProductos.forEach((p, index) => {
        let tipoImg = 'Sin Imagen';
        let detalle = 'URL por defecto o vacía';
        if (p.imagen) {
            if (p.imagen.startsWith('data:image')) {
                tipoImg = '📸 Base64 (Archivo local comprimido)';
                detalle = 'Tamaño del string: ' + Math.round(p.imagen.length / 1024) + ' KB';
            } else if (p.imagen.startsWith('http')) {
                tipoImg = '🌐 URL Externa';
                detalle = p.imagen;
            }
        }
        console.log(`   -> [${index + 1}] Producto: "${p.nombre}" | Tipo: ${tipoImg} | Detalle: ${detalle}`);
    });

    const payload = JSON.stringify({
        record: {
            productos: memoriaProductos,
            categorias: memoriaCategorias,
            estadisticas: memoriaEstadisticas
        }
    });

    const options = {
        hostname: 'api.jsonbin.io',
        port: 443,
        path: '/v3/b/' + BIN_ID,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': MASTER_KEY,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('☁️ Sincronización con JSONBin exitosa. Total en la nube:', memoriaProductos.length);
            } else {
                console.log('⚠️ Aviso de JSONBin (Código ' + res.statusCode + '):', body);
            }
        });
    });

    req.on('error', (e) => {
        console.error('Error de conexión con JSONBin:', e.message);
    });

    req.write(payload);
    req.end();
}

function cargarDesdeCloud() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.jsonbin.io',
            port: 443,
            path: '/v3/b/' + BIN_ID + '/latest',
            method: 'GET',
            headers: {
                'X-Master-Key': MASTER_KEY
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const response = JSON.parse(body);
                        const dataRoot = response.record || response;
                        
                        if (dataRoot && Array.isArray(dataRoot.productos) && dataRoot.productos.length > 0) {
                            memoriaProductos = dataRoot.productos;
                            nubeSincronizadaOk = true;
                            console.log('☁️ Datos RECUPERADOS desde JSONBin correctamente. Total productos:', memoriaProductos.length);
                        } else {
                            console.log('⚠️ JSONBin devolvió productos vacíos o estructura inválida.');
                        }
                        if (dataRoot && Array.isArray(dataRoot.categorias) && dataRoot.categorias.length > 0) {
                            memoriaCategorias = dataRoot.categorias;
                        }
                        if (dataRoot && dataRoot.estadisticas) {
                            memoriaEstadisticas = dataRoot.estadisticas;
                        }
                    } else {
                        console.log('⚠️ Error al leer JSONBin (Código ' + res.statusCode + '):', body);
                    }
                } catch (e) {
                    console.error('Error al parsear datos de JSONBin:', e.message);
                }
                datosListos = true;
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error('Error de red al leer JSONBin:', e.message);
            datosListos = true;
            resolve();
        });

        req.end();
    });
}

function leerProductos() { return memoriaProductos; }
function guardarProductos(prods, esBorradoOlimpia = false) { 
    memoriaProductos = prods; 
    sincronizarConCloud(esBorradoOlimpia); 
}

function leerCategorias() { return memoriaCategorias; }
function guardarCategorias(cats) { memoriaCategorias = cats; sincronizarConCloud(); }

function leerEstadisticas() { return memoriaEstadisticas; }
function guardarEstadisticas(stats) { memoriaEstadisticas = stats; sincronizarConCloud(); }

function obtenerFechaHoy() {
    const ahora = new Date();
    const offsetArg = -3 * 60;
    const fechaArg = new Date(ahora.getTime() + (ahora.getTimezoneOffset() + offsetArg) * 60000);
    return fechaArg.toISOString().split('T')[0];
}

function registrarVisita(req) {
    const userAgent = req.headers['user-agent'] || '';
    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const hoy = obtenerFechaHoy();

    let stats = leerEstadisticas();
    stats.totalVisitas = (stats.totalVisitas || 0) + 1;
    if (esMovil) stats.visitasMovil = (stats.visitasMovil || 0) + 1;
    else stats.visitasPC = (stats.visitasPC || 0) + 1;

    if (!stats.porDia) stats.porDia = {};
    if (!stats.porDia[hoy]) stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    stats.porDia[hoy].total = (stats.porDia[hoy].total || 0) + 1;
    if (esMovil) stats.porDia[hoy].movil = (stats.porDia[hoy].movil || 0) + 1;
    else stats.porDia[hoy].pc = (stats.porDia[hoy].pc || 0) + 1;

    guardarEstadisticas(stats);
}

function formatearPrecio(monto) {
    return Number(monto || 0).toLocaleString('es-AR');
}

app.post('/api/stats/seccion', (req, res) => {
    const { seccion } = req.body;
    if (!seccion) return res.json({ success: false });
    const hoy = obtenerFechaHoy();
    let stats = leerEstadisticas();
    if (!stats.secciones) stats.secciones = {};
    stats.secciones[seccion] = (stats.secciones[seccion] || 0) + 1;
    if (!stats.porDia) stats.porDia = {};
    if (!stats.porDia[hoy]) stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    if (!stats.porDia[hoy].secciones) stats.porDia[hoy].secciones = {};
    stats.porDia[hoy].secciones[seccion] = (stats.porDia[hoy].secciones[seccion] || 0) + 1;
    guardarEstadisticas(stats);
    res.json({ success: true });
});

app.post('/api/stats/busqueda', (req, res) => {
    const { termino } = req.body;
    const terminoLimpio = (termino || '').trim().toLowerCase();
    if (!terminoLimpio || terminoLimpio.length < 2) return res.json({ success: false });
    const hoy = obtenerFechaHoy();
    let stats = leerEstadisticas();
    if (!stats.busquedas) stats.busquedas = {};
    stats.busquedas[terminoLimpio] = (stats.busquedas[terminoLimpio] || 0) + 1;
    if (!stats.porDia) stats.porDia = {};
    if (!stats.porDia[hoy]) stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    if (!stats.porDia[hoy].busquedas) stats.porDia[hoy].busquedas = {};
    stats.porDia[hoy].busquedas[terminoLimpio] = (stats.porDia[hoy].busquedas[terminoLimpio] || 0) + 1;
    guardarEstadisticas(stats);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    try {
        registrarVisita(req);
        const productos = leerProductos();
        const categorias = leerCategorias();
        const productosEnOferta = productos.filter(p => p.enOferta);

        let botonesCategoriasHtml = '';
        categorias.forEach(cat => {
            const nomLimpio = cat.nombre.replace(/'/g, "\\'");
            botonesCategoriasHtml += '<button onclick="entrarASeccion(\'' + nomLimpio + '\')" class="btn-seccion-mini"><span>' + (cat.icono || '📦') + '</span> ' + cat.nombre + '</button>';
        });

        let tarjetasCategoriasHtml = '';
        if (productosEnOferta.length > 0) {
            tarjetasCategoriasHtml += '<div onclick="entrarASeccion(\'__OFERTAS__\')" class="card-seccion-glow card-seccion-box card-oferta-glow">' +
                '<div class="card-linea-top oferta-linea"></div>' +
                '<span class="icono-cat">🔥</span>' +
                '<strong class="titulo-cat-card">¡OFERTAS!</strong>' +
                '<span class="texto-accion-card texto-oferta">Ver promos ➔</span>' +
            '</div>';
        }

        categorias.forEach(cat => {
            const nomLimpio = cat.nombre.replace(/'/g, "\\'");
            const bgGlow = cat.color || 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
            tarjetasCategoriasHtml += '<div onclick="entrarASeccion(\'' + nomLimpio + '\')" class="card-seccion-glow card-seccion-box">' +
                '<div class="card-linea-top" style="background: ' + bgGlow + ';"></div>' +
                '<span class="icono-cat">' + (cat.icono || '📦') + '</span>' +
                '<strong class="titulo-cat-card">' + cat.nombre + '</strong>' +
                '<span class="texto-accion-card">Ver productos ➔</span>' +
            '</div>';
        });

        let productosHtml = '';
        if (productos.length === 0) {
            productosHtml = '<p class="no-products">No hay productos cargados en este momento.</p>';
        } else {
            productos.forEach(prod => {
                const imagenUrl = prod.imagen || 'https://via.placeholder.com/300x200?text=Sin+Imagen';
                const descripcionTexto = prod.descripcion ? '<p class="description">' + prod.descripcion + '</p>' : '';
                const precioFormateado = formatearPrecio(prod.precio);
                const stockActual = prod.stock !== undefined ? Number(prod.stock) : 10;
                const estaAgotado = stockActual <= 0;
                const esOferta = prod.enOferta === true;
                const categoriaLimpia = (prod.categoria || 'General').trim();
                
                let badgeHtml = '<span class="badge ' + (estaAgotado ? 'badge-agotado' : '') + '">' + (estaAgotado ? 'AGOTADO' : categoriaLimpia) + '</span>';
                if (esOferta && !estaAgotado) {
                    badgeHtml = '<span class="badge badge-oferta">🔥 ¡OFERTA!</span>';
                }

                const nomLimpio = (prod.nombre || '').replace(/'/g, "\\'");
                const botonAgregar = estaAgotado 
                    ? '<button class="btn-agregar btn-disabled" disabled>🚫 Sin Stock</button>'
                    : '<button class="btn-agregar" onclick="agregarAlCarrito(' + prod.id + ', \'' + nomLimpio + '\', ' + prod.precio + ', ' + stockActual + ')">➕ Agregar al Carrito</button>';

                const cardClassOferta = esOferta ? 'product-card-oferta' : '';

                productosHtml += '<div class="product-card ' + cardClassOferta + '" data-categoria="' + categoriaLimpia + '" data-oferta="' + (esOferta ? 'si' : 'no') + '" data-nombre="' + (prod.nombre || '') + '" data-descripcion="' + (prod.descripcion || '') + '">' +
                    '<div class="product-image-container">' +
                        '<img src="' + imagenUrl + '" alt="' + (prod.nombre || '') + '" class="zoom-img" onerror="this.src=\'https://via.placeholder.com/300x200?text=Error+Imagen\'">' +
                        badgeHtml +
                    '</div>' +
                    '<div class="product-info">' +
                        '<div>' +
                            '<h3>' + (prod.nombre || '') + '</h3>' +
                            descripcionTexto +
                        '</div>' +
                        '<div class="prod-action-area">' +
                            '<div class="stock-info">' +
                                '<span class="price">$' + precioFormateado + '</span>' +
                                '<small class="stock-count">' + (estaAgotado ? 'Sin disponibilidad' : 'Stock: ' + stockActual) + '</small>' +
                            '</div>' +
                            '<button class="btn-share-prominente" onclick="compartirProducto(\'' + nomLimpio + '\', \'' + prod.precio + '\')">' +
                                '📲 Compartir por WhatsApp' +
                            '</button>' +
                            botonAgregar +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
        }

        let html = '<!DOCTYPE html>' +
        '<html lang="es">' +
        '<head>' +
            '<meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
            '<title>Polirubro Virtual | Tu Tienda Online</title>' +
            '<link rel="stylesheet" href="/style.css">' +
        '</head>' +
        '<body>' +
            '<div class="promo-banner">' +
                '<div class="promo-text-marquee">' +
                    '🚚 <span>¡ENVÍO GRATIS comprando exclusivamente en la WEB superando los <strong>$20.000</strong>!</span> 🛍️ <span>¡Aprovechá tus beneficios hoy!</span>' +
                '</div>' +
            '</div>' +

            '<header>' +
                '<div class="header-content">' +
                    '<h1>🏪 Polirubro Virtual</h1>' +
                    '<p class="sub-header-text">✨ ¡Hacé clic y llevate lo que más te gusta!</p>' +
                '</div>' +
                '<div class="header-actions">' +
                    '<button class="cart-btn" onclick="toggleCartModal()">🛒 Carrito (<span id="cartCount">0</span>)</button>' +
                '</div>' +
            '</header>' +

            '<main>' +
                '<section class="top-bar-container">' +
                    '<div class="top-bar-grid">' +
                        '<button onclick="mostrarMenuPrincipal()" class="btn-home-mini">🏠 Inicio</button>' +
                        (productosEnOferta.length > 0 ? '<button onclick="entrarASeccion(\'__OFERTAS__\')" class="btn-seccion-mini btn-oferta-mini"><span>🔥</span> Ofertas</button>' : '') +
                        botonesCategoriasHtml +
                    '</div>' +
                '</section>' +

                '<section id="vistaSecciones" class="secciones-container">' +
                    '<h2 class="titulo-bienvenida">🛍️ ¿Qué estás buscando hoy?</h2>' +
                    '<div class="grid-secciones-container">' +
                        tarjetasCategoriasHtml +
                    '</div>' +
                '</section>' +

                '<section id="vistaProductos" class="catalogo" style="display: none;">' +
                    '<div class="search-container">' +
                        '<input type="text" id="searchInput" oninput="filtrarProductosConDebounce()" placeholder="🔍 Buscar producto en esta sección..." class="input-busqueda">' +
                    '</div>' +

                    '<h2 id="tituloSeccionActual" class="titulo-seccion-head"></h2>' +
                    '<div class="product-grid" id="productGrid">' +
                        productosHtml +
                    '</div>' +
                    '<div id="mensajeSinResultados" class="mensaje-sin-resultados" style="display: none;">' +
                        'No hay productos disponibles en esta sección por el momento.' +
                    '</div>' +
                '</section>' +
            '</main>' +

            '<a href="https://wa.me/5493794655867?text=¡Hola!%20Tengo%20una%20consulta%20sobre%20Polirubro%20Virtual" class="whatsapp-float" target="_blank">' +
                '💬 <span>¿Tenés dudas? Hablá con nosotros</span>' +
            '</a>' +

            '<div id="promoWelcomeModal" class="modal" style="display:none;">' +
                '<div class="modal-bienvenida-content">' +
                    '<button type="button" onclick="cerrarPromoWelcome()" class="btn-close-modal">&times;</button>' +
                    '<div class="modal-icon-pulse">🚚🎁</div>' +
                    '<h2>¡BIENVENIDO A POLIRUBRO VIRTUAL!</h2>' +
                    '<p>¡Queremos regalarte el envío! Comprando en nuestra tienda web y alcanzando los <strong>$20.000</strong>, tu <strong>ENVÍO ES 100% GRATIS</strong>. 🥳</p>' +
                    '<p class="sub-text">Aprovechá las mejores ofertas y armá tu carrito en unos pocos clics. ✨</p>' +
                    '<button onclick="cerrarPromoWelcome()" class="btn-start-shop">🛍️ ¡Empezar a comprar!</button>' +
                '</div>' +
            '</div>' +

            '<div id="cartModal" class="modal" style="display:none;">' +
                '<div class="cart-modal-content">' +
                    '<button type="button" onclick="toggleCartModal()" class="btn-close-cart">&times;</button>' +
                    '<h2>🛒 Tu Carrito</h2>' +
                    
                    '<div id="promoEnvioProgress" class="envio-progress-box">' +
                        '🚚 Envío gratis exclusivo en la Web superando los $20.000' +
                    '</div>' +

                    '<div id="cartItemsList" class="cart-items-list">' +
                        '<p style="color:#94a3b8; text-align:center;">El carrito está vacío.</p>' +
                    '</div>' +

                    '<div id="cartOptions" style="display:none;">' +
                        '<div class="datos-entrega-box">' +
                            '<h4>📋 Datos para Entrega:</h4>' +
                            '<input type="text" id="clienteNombre" placeholder="Tu Nombre y Apellido *" class="cart-input" required>' +
                            '<input type="text" id="clienteDireccion" placeholder="Dirección / Barrio *" class="cart-input">' +
                            '<input type="tel" id="clienteTelefono" placeholder="Teléfono de contacto" class="cart-input">' +
                        '</div>' +

                        '<div id="contenedorEnvio" class="cart-step-margin">' +
                            '<label>🚚 Zona / Forma de Entrega:</label>' +
                            '<select id="tipoEnvio" onchange="actualizarTotal()" class="cart-select">' +
                                '<option value="retiro" data-costo="0">Retirar por el local (Gratis)</option>' +
                                '<option value="centro" data-costo="1500">Zona Centro / Cambá Cuá (+$1.500)</option>' +
                                '<option value="barrios_cercanos" data-costo="2000">Barrios Cercanos / Aldana / Yapeyú (+$2.000)</option>' +
                                '<option value="barrios_alejados" data-costo="2500">1000 Viviendas / Molina Punta / Laguna Seca (+$2.500)</option>' +
                            '</select>' +
                        '</div>' +

                        '<div id="cartelEnvioGratis" class="cartel-envio-gratis-box" style="display:none;">' +
                            '<span>🚚 Zona / Envío: <strong>🎉 ¡ENVÍO GRATIS WEB APLICADO! ($0)</strong></span>' +
                        '</div>' +

                        '<div class="cart-step-margin">' +
                            '<label>💳 Método de Pago:</label>' +
                            '<select id="metodoPago" onchange="mostrarDatosTransferencia()" class="cart-select">' +
                                '<option value="Efectivo">Efectivo al recibir</option>' +
                                '<option value="Mercado Pago">Mercado Pago</option>' +
                                '<option value="Transferencia Bancaria">Transferencia Bancaria (Alias/CBU)</option>' +
                                '<option value="Personal Pay">Personal Pay</option>' +
                                '<option value="Ualá">Ualá</option>' +
                            '</select>' +
                        '</div>' +

                        '<div id="transferInfo" class="transfer-info-box" style="display:none;">' +
                            '<small>🏦 <strong>Alias:</strong> POLIRUBRO.VIRTUAL.MP</small>' +
                            '<button type="button" onclick="copiarAlias()" class="btn-copy">📋 Copiar</button>' +
                        '</div>' +

                        '<div class="total-price-box">' +
                            '<h3>Total: $<span id="cartTotalPrice">0</span></h3>' +
                        '</div>' +

                        '<button onclick="procesarPedido()" class="btn-confirm-order">' +
                            '📲 Confirmar y Enviar por WhatsApp' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div id="optionsModal" class="modal" style="display:none;">' +
                '<div class="qr-modal-content">' +
                    '<button type="button" onclick="cerrarOptionsModal()" class="btn-close-simple">&times;</button>' +
                    '<h2>📲 Escaneá tu Pedido</h2>' +
                    '<p>Apuntá con tu celular para enviar el pedido por WhatsApp:</p>' +
                    '<div class="qr-box">' +
                        '<img id="qrImage" src="" alt="Código QR Pedido">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div id="modal-imagen-zoom" onclick="cerrarZoom(event)" style="display:none;">' +
                '<span onclick="cerrarZoom(event)" class="btn-close-zoom">&times;</span>' +
                '<img id="img-ampliada" src="" alt="Zoom Producto">' +
            '</div>' +

            '<footer>' +
                '<p>&copy; 2026 Polirubro Virtual — Todos los derechos reservados.</p>' +
            '</footer>' +

            '<script>' +
                'let carrito = [];' +
                'let seccionSeleccionada = "";' +
                'let searchTimeout = null;' +

                'document.addEventListener("DOMContentLoaded", function() {' +
                    'if (!sessionStorage.getItem("promoBienvenidaVista")) {' +
                        'document.getElementById("promoWelcomeModal").style.display = "flex";' +
                    '}' +
                    'let ultimaSeccion = localStorage.getItem("seccionActiva");' +
                    'if (window.location.hash && window.location.hash.startsWith("#seccion-")) {' +
                        'ultimaSeccion = decodeURIComponent(window.location.hash.replace("#seccion-", ""));' +
                    '}' +
                    'if (ultimaSeccion && ultimaSeccion !== "") {' +
                        'entrarASeccion(ultimaSeccion, false, false);' +
                    '} else {' +
                        'mostrarMenuPrincipal(false, false);' +
                    '}' +
                '});' +

                'window.addEventListener("popstate", function(event) {' +
                    'const modalZoom = document.getElementById("modal-imagen-zoom");' +
                    'if (modalZoom && modalZoom.style.display === "flex") {' +
                        'modalZoom.style.display = "none";' +
                        'return;' +
                    '}' +
                    'if (seccionSeleccionada !== "") {' +
                        'mostrarMenuPrincipal(true, false);' +
                    '}' +
                '});' +

                'function abrirZoom(urlImagen) {' +
                    'const modal = document.getElementById("modal-imagen-zoom");' +
                    'const imgAmpliada = document.getElementById("img-ampliada");' +
                    'imgAmpliada.src = urlImagen;' +
                    'modal.style.display = "flex";' +
                '}' +

                'function cerrarZoom(event) {' +
                    'if (event) event.stopPropagation();' +
                    'const modal = document.getElementById("modal-imagen-zoom");' +
                    'modal.style.display = "none";' +
                '}' +

                'function cerrarPromoWelcome() {' +
                    'sessionStorage.setItem("promoBienvenidaVista", "true");' +
                    'document.getElementById("promoWelcomeModal").style.display = "none";' +
                '}' +

                'function normalizar(str) {' +
                    'if (!str) return "";' +
                    'return str.toString().toLowerCase().trim().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");' +
                '}' +

                'function formatoPesos(num) {' +
                    'return Number(num || 0).toLocaleString("es-AR");' +
                '}' +

                'function entrarASeccion(nombreCat, registrarStat = true, pushHistory = true) {' +
                    'seccionSeleccionada = nombreCat;' +
                    'localStorage.setItem("seccionActiva", nombreCat);' +
                    'if (pushHistory) {' +
                        'history.pushState({ seccionActiva: nombreCat }, "", "#seccion-" + encodeURIComponent(nombreCat));' +
                    '} else {' +
                        'history.replaceState({ seccionActiva: nombreCat }, "", "#seccion-" + encodeURIComponent(nombreCat));' +
                    '}' +
                    'document.getElementById("vistaSecciones").style.display = "none";' +
                    'document.getElementById("vistaProductos").style.display = "block";' +
                    'if (nombreCat === "__OFERTAS__") {' +
                        'document.getElementById("tituloSeccionActual").innerText = "🔥 ¡Ofertas Imperdibles!";' +
                    '} else {' +
                        'document.getElementById("tituloSeccionActual").innerText = "📂 Sección: " + nombreCat;' +
                    '}' +
                    'document.getElementById("searchInput").value = "";' +
                    'filtrarProductos();' +
                    'if (registrarStat && nombreCat !== "__OFERTAS__") {' +
                        'fetch("/api/stats/seccion", {' +
                            'method: "POST",' +
                            'headers: { "Content-Type": "application/json" },' +
                            'body: JSON.stringify({ seccion: nombreCat })' +
                        '}).catch(() => {});' +
                    '}' +
                '}' +

                'function mostrarMenuPrincipal(limpiarHash = true, pushHistory = true) {' +
                    'seccionSeleccionada = "";' +
                    'localStorage.removeItem("seccionActiva");' +
                    'if (pushHistory) {' +
                        'history.pushState({ menuPrincipal: true }, "", window.location.pathname);' +
                    '} else if (limpiarHash) {' +
                        'history.replaceState(null, "", window.location.pathname);' +
                    '}' +
                    'document.getElementById("vistaSecciones").style.display = "block";' +
                    'document.getElementById("vistaProductos").style.display = "none";' +
                '}' +

                'function filtrarProductosConDebounce() {' +
                    'filtrarProductos();' +
                    'clearTimeout(searchTimeout);' +
                    'searchTimeout = setTimeout(() => {' +
                        'const termino = document.getElementById("searchInput").value.trim();' +
                        'if (termino.length >= 2) {' +
                            'fetch("/api/stats/busqueda", {' +
                                'method: "POST",' +
                                'headers: { "Content-Type": "application/json" },' +
                                'body: JSON.stringify({ termino })' +
                            '}).catch(() => {});' +
                        '}' +
                    '}, 1000);' +
                '}' +

                'function filtrarProductos() {' +
                    'if (!seccionSeleccionada) return;' +
                    'const busqueda = normalizar(document.getElementById("searchInput").value);' +
                    'const tarjetas = document.querySelectorAll(".product-card");' +
                    'let visibles = 0;' +
                    'tarjetas.forEach(tarjeta => {' +
                        'const catProd = normalizar(tarjeta.getAttribute("data-categoria"));' +
                        'const esOfertaProd = tarjeta.getAttribute("data-oferta");' +
                        'const nombreProd = normalizar(tarjeta.getAttribute("data-nombre"));' +
                        'const descProd = normalizar(tarjeta.getAttribute("data-descripcion"));' +
                        '' +
                        'let coincideSeccion = false;' +
                        'if (seccionSeleccionada === "__OFERTAS__") {' +
                            'coincideSeccion = (esOfertaProd === "si");' +
                        '} else {' +
                            'coincideSeccion = (catProd === normalizar(seccionSeleccionada));' +
                        '}' +
                        '' +
                        'const coincideBusqueda = (busqueda === "" || nombreProd.includes(busqueda) || descProd.includes(busqueda));' +
                        'if (coincideSeccion && coincideBusqueda) {' +
                            'tarjeta.style.setProperty("display", "flex", "important");' +
                            'visibles++;' +
                        '} else {' +
                            'tarjeta.style.setProperty("display", "none", "important");' +
                        '}' +
                    '});' +
                    'const mensajeVacio = document.getElementById("mensajeSinResultados");' +
                    'if (mensajeVacio) {' +
                        'mensajeVacio.style.display = visibles === 0 ? "block" : "none";' +
                    '}' +
                '}' +

                'function agregarAlCarrito(id, nombre, precio, stockMax) {' +
                    'const index = carrito.findIndex(item => item.id === id);' +
                    'if (index > -1) {' +
                        'if (carrito[index].cantidad < stockMax) {' +
                            'carrito[index].cantidad += 1;' +
                        '} else {' +
                            'alert("Alcanzaste el límite de stock disponible.");' +
                            'return;' +
                        '}' +
                    '} else {' +
                        'carrito.push({ id, nombre, precio: Number(precio), cantidad: 1, stockMax });' +
                    '}' +
                    'actualizarVistaCarrito();' +
                    'alert("¡Producto agregado al carrito!");' +
                '}' +

                'function cambiarCantidad(id, cambio) {' +
                    'const index = carrito.findIndex(item => item.id === id);' +
                    'if (index > -1) {' +
                        'const nuevaCant = carrito[index].cantidad + cambio;' +
                        'if (nuevaCant > carrito[index].stockMax) {' +
                            'alert("No hay más stock.");' +
                            'return;' +
                        '}' +
                        'carrito[index].cantidad = nuevaCant;' +
                        'if (carrito[index].cantidad <= 0) {' +
                            'carrito.splice(index, 1);' +
                        '}' +
                    '}' +
                    'actualizarVistaCarrito();' +
                '}' +

                'function actualizarVistaCarrito() {' +
                    'const cartCount = document.getElementById("cartCount");' +
                    'const cartItemsList = document.getElementById("cartItemsList");' +
                    'const cartOptions = document.getElementById("cartOptions");' +
                    'let totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);' +
                    'cartCount.innerText = totalItems;' +
                    'if (carrito.length === 0) {' +
                        'cartItemsList.innerHTML = "<p style=\\"color:#94a3b8; text-align:center;\\">El carrito está vacío.</p>";' +
                        'cartOptions.style.display = "none";' +
                        'return;' +
                    '}' +
                    'cartOptions.style.display = "block";' +
                    'let html = "";' +
                    'carrito.forEach(item => {' +
                        'html += "<div class=\\"cart-item-row\\">" +' +
                            '"<div>" +' +
                                '"<strong>" + item.nombre + "</strong><br>" +' +
                                '"<small>$" + formatoPesos(item.precio) + " x " + item.cantidad + "</small>" +' +
                            '"</div>" +' +
                            '"<div class=\\"cart-item-controls\\">" +' +
                                '"<button onclick=\\"cambiarCantidad(" + item.id + ", -1)\\">-</button>" +' +
                                '"<span>" + item.cantidad + "</span>" +' +
                                '"<button onclick=\\"cambiarCantidad(" + item.id + ", 1)\\">+</button>" +' +
                            '"</div>" +' +
                        '"</div>";' +
                    '});' +
                    'cartItemsList.innerHTML = html;' +
                    'actualizarTotal();' +
                '}' +

                'function actualizarTotal() {' +
                    'let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);' +
                    'const contenedorEnvio = document.getElementById("contenedorEnvio");' +
                    'const cartelEnvioGratis = document.getElementById("cartelEnvioGratis");' +
                    'const promoProgress = document.getElementById("promoEnvioProgress");' +
                    'const ES_ENVIO_GRATIS = subtotal >= 20000;' +
                    'if (ES_ENVIO_GRATIS) {' +
                        'promoProgress.classList.add("envio-gratis-ok");' +
                        'promoProgress.innerHTML = "🎉 ¡Felicitaciones! Tenés <strong>ENVÍO GRATIS WEB</strong> en esta compra.";' +
                        'contenedorEnvio.style.display = "none";' +
                        'cartelEnvioGratis.style.display = "block";' +
                    '} else {' +
                        'const falta = 20000 - subtotal;' +
                        'promoProgress.classList.remove("envio-gratis-ok");' +
                        'promoProgress.innerHTML = "🚚 Agregá $" + formatoPesos(falta) + " más para tener <strong>ENVÍO GRATIS WEB</strong>";' +
                        'contenedorEnvio.style.display = "block";' +
                        'cartelEnvioGratis.style.display = "none";' +
                    '}' +
                    'let costoEnvio = 0;' +
                    'if (!ES_ENVIO_GRATIS) {' +
                        'const tipoEnvioSelect = document.getElementById("tipoEnvio");' +
                        'if (tipoEnvioSelect) {' +
                            'const opcionSeleccionada = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];' +
                            'costoEnvio = Number(opcionSeleccionada.getAttribute("data-costo") || 0);' +
                        '}' +
                    '}' +
                    'let total = subtotal + costoEnvio;' +
                    'document.getElementById("cartTotalPrice").innerText = formatoPesos(total);' +
                '}' +

                'function mostrarDatosTransferencia() {' +
                    'const metodo = document.getElementById("metodoPago").value;' +
                    'const transferDiv = document.getElementById("transferInfo");' +
                    'transferDiv.style.display = metodo === "Transferencia Bancaria" ? "flex" : "none";' +
                '}' +

                'function copiarAlias() {' +
                    'navigator.clipboard.writeText("POLIRUBRO.VIRTUAL.MP");' +
                    'alert("¡Alias copiado!");' +
                '}' +

                'function compartirProducto(nombre, precio) {' +
                    'const texto = "¡Mirá este producto en Polirubro Virtual! 🛒\\n*" + nombre + "* - $" + formatoPesos(precio) + "\\nPedilo acá: https://polirubro-virtual.onrender.com";' +
                    'window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(texto), "_blank");' +
                '}' +

                'function toggleCartModal() {' +
                    'const modal = document.getElementById("cartModal");' +
                    'modal.style.display = modal.style.display === "flex" ? "none" : "flex";' +
                '}' +

                'function cerrarOptionsModal() {' +
                    'document.getElementById("optionsModal").style.display = "none";' +
                '}' +

                'document.addEventListener("click", function(e) {' +
                    'if (e.target.classList.contains("zoom-img")) {' +
                        'abrirZoom(e.target.src);' +
                    '}' +
                '});' +

                'function procesarPedido() {' +
                    'if (carrito.length === 0) return;' +
                    'const nombre = document.getElementById("clienteNombre").value.trim();' +
                    'const direccion = document.getElementById("clienteDireccion").value.trim();' +
                    'const telefono = document.getElementById("clienteTelefono").value.trim();' +
                    'if (!nombre) {' +
                        'alert("Por favor, ingresá tu Nombre.");' +
                        'return;' +
                    '}' +
                    'let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);' +
                    'const ES_ENVIO_GRATIS = subtotal >= 20000;' +
                    'let costoEnvio = 0;' +
                    'let detalleEnvioTexto = "Envío a Domicilio (¡ENVÍO GRATIS WEB APLICADO!)";' +
                    'if (!ES_ENVIO_GRATIS) {' +
                        'const tipoEnvioSelect = document.getElementById("tipoEnvio");' +
                        'if (tipoEnvioSelect) {' +
                            'const opcionEnvio = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];' +
                            'costoEnvio = Number(opcionEnvio.getAttribute("data-costo") || 0);' +
                            'detalleEnvioTexto = opcionEnvio.text;' +
                        '}' +
                    '}' +
                    'const metodoPago = document.getElementById("metodoPago").value;' +
                    'let totalFinal = subtotal + costoEnvio;' +
                    'let mensaje = "¡Hola! Quiero confirmar mi pedido en *Polirubro Virtual* (Vía Web):\\n\\n";' +
                    'mensaje += "👤 *Cliente:* " + nombre + "\\n";' +
                    'if (direccion) mensaje += "📍 *Dirección:* " + direccion + "\\n";' +
                    'if (telefono) mensaje += "📞 *Contacto:* " + telefono + "\\n";' +
                    'mensaje += "\\n🛒 *Detalle del Pedido:*\\n";' +
                    'carrito.forEach(item => {' +
                        'mensaje += "- " + item.cantidad + "x " + item.nombre + " ($" + formatoPesos(item.precio * item.cantidad) + ")\\n";' +
                    '});' +
                    'mensaje += "\\n🚚 *Entrega:* " + detalleEnvioTexto;' +
                    'mensaje += "\\n💳 *Pago:* " + metodoPago;' +
                    'mensaje += "\\n💰 *Total a abonar:* $" + formatoPesos(totalFinal) + "\\n\\n¡Gracias!";' +
                    'const numeroWhatsApp = "5493794655867";' +
                    'const mensajeCodificado = encodeURIComponent(mensaje);' +
                    'const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;' +
                    'toggleCartModal();' +
                    'if (esMovil) {' +
                        'window.location.href = "https://api.whatsapp.com/send?phone=" + numeroWhatsApp + "&text=" + mensajeCodificado;' +
                    '} else {' +
                        'const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent("https://wa.me/" + numeroWhatsApp + "?text=" + mensajeCodificado);' +
                        'document.getElementById("qrImage").src = qrUrl;' +
                        'document.getElementById("optionsModal").style.display = "flex";' +
                    '}' +
                '}' +
            '</script>' +
        '</body>' +
        '</html>';
        
        res.send(html);
    } catch (err) {
        console.error("Error cargando /:", err);
        res.status(500).send("Error del servidor: " + err.message);
    }
});

app.get('/admin', (req, res) => {
    try {
        const productos = leerProductos();
        const categorias = leerCategorias();
        const stats = leerEstadisticas();
        const hoy = obtenerFechaHoy();

        const statsHoy = stats.porDia && stats.porDia[hoy] ? stats.porDia[hoy] : { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
        const seccionesOrdenadas = Object.entries(stats.secciones || {}).sort((a, b) => b[1] - a[1]);
        const busquedasOrdenadas = Object.entries(stats.busquedas || {}).sort((a, b) => b[1] - a[1]);

        let filasSeccionesHTML = seccionesOrdenadas.length === 0 ? '<tr><td colspan="2" style="color:#94a3b8; font-size:0.85rem;">Aún no hay ingresos a secciones.</td></tr>' : seccionesOrdenadas.map(([sec, cant]) => '<tr><td style="color:#fff; font-weight:bold;">' + sec + '</td><td style="color:#34d399; font-weight:bold; text-align:right;">' + cant + '</td></tr>').join('');
        let filasBusquedasHTML = busquedasOrdenadas.length === 0 ? '<tr><td colspan="2" style="color:#94a3b8; font-size:0.85rem;">Aún no hay búsquedas registradas.</td></tr>' : busquedasOrdenadas.slice(0, 10).map(([term, cant]) => '<tr><td style="color:#fff; text-transform:capitalize;">' + term + '</td><td style="color:#38bdf8; font-weight:bold; text-align:right;">' + cant + '</td></tr>').join('');
        
        let opcionesCatHTML = categorias.map(cat => '<option value="' + cat.nombre + '">' + (cat.icono || '📦') + ' ' + cat.nombre + '</option>').join('');
        
        let listaCategoriasAdminHTML = categorias.map(cat => {
            return '<div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.5rem 0.8rem; border-radius:8px; border:1px solid #334155; margin-bottom:0.5rem;">' +
                '<span style="color:#fff; font-weight:bold; font-size:0.9rem;">' + (cat.icono || '📦') + ' ' + cat.nombre + '</span>' +
                '<form action="/admin/categoria/eliminar/' + cat.id + '" method="POST" onsubmit="return confirm(\'¿Seguro querés eliminar la sección ' + cat.nombre + '?\');">' +
                    '<button type="submit" style="background:#ef4444; color:white; border:none; padding:0.3rem 0.6rem; border-radius:6px; cursor:pointer; font-size:0.75rem;" title="Eliminar Sección">🗑️ Borrar</button>' +
                '</form>' +
            '</div>';
        }).join('');

        let listaProductosAdminHTML = productos.length === 0 ? '<p style="color:#94a3b8;">No hay productos cargados.</p>' : productos.map(prod => {
            const desc = prod.descripcion ? '<br><small style="color:#94a3b8;">' + prod.descripcion + '</small>' : '';
            const precioFormateado = formatearPrecio(prod.precio);
            const stockActual = prod.stock !== undefined ? prod.stock : 0;
            const esOferta = prod.enOferta === true;

            const botonOfertaToggle = esOferta
                ? '<form action="/admin/toggle-oferta/' + prod.id + '" method="POST"><button type="submit" style="background:#ec4899; color:#fff; border:none; padding:0.35rem 0.6rem; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.75rem;" title="Quitar de Ofertas">🔥 En Oferta</button></form>'
                : '<form action="/admin/toggle-oferta/' + prod.id + '" method="POST"><button type="submit" style="background:#334155; color:#94a3b8; border:none; padding:0.35rem 0.6rem; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.75rem;" title="Marcar como Oferta">⭐ Hacer Oferta</button></form>';

            return '<div style="display:flex; flex-direction:column; gap:0.6rem; background:#0f172a; padding:0.9rem; border-radius:14px; border:1px solid ' + (esOferta ? '#ec4899' : '#1e293b') + '; margin-bottom:0.8rem;">' +
                '<div style="display:flex; align-items:center; gap:0.8rem; width:100%;">' +
                    '<img src="' + prod.imagen + '" alt="' + prod.nombre + '" style="width:50px; height:50px; object-fit:contain; border-radius:8px; background:#070a12;">' +
                    '<div style="flex:1; overflow:hidden;">' +
                        '<strong style="color:#fff; font-size:0.95rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + prod.nombre + '</strong>' +
                        '<div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.2rem;">' +
                            '<span style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:0.15rem 0.5rem; border-radius:10px; font-size:0.75rem; font-weight:700;">' + prod.categoria + '</span>' +
                            '<strong style="color:#34d399; font-size:0.9rem;">$' + precioFormateado + '</strong>' +
                        '</div>' + desc +
                    '</div>' +
                    '<div style="display:flex; flex-direction:column; gap:0.3rem; align-items:flex-end;">' +
                        botonOfertaToggle +
                        '<form action="/admin/eliminar/' + prod.id + '" method="POST" onsubmit="return confirm(\'¿Seguro que querés eliminar este producto?\');">' +
                            '<button type="submit" style="background:#ef4444; color:white; border:none; padding:0.35rem 0.6rem; border-radius:6px; cursor:pointer; font-size:0.75rem;" title="Eliminar Producto">🗑️ Borrar</button>' +
                        '</form>' +
                    '</div>' +
                '</div>' +
                '<form action="/admin/actualizar-stock/' + prod.id + '" method="POST" style="display:flex; align-items:center; justify-content:space-between; background:#1e293b; padding:0.5rem 0.7rem; border-radius:8px; border:1px solid #334155;">' +
                    '<span style="font-size:0.8rem; color:#38bdf8; font-weight:bold;">📦 Stock:</span>' +
                    '<div style="display:flex; align-items:center; gap:0.4rem;">' +
                        '<input type="number" name="nuevoStock" value="' + stockActual + '" min="0" style="width:60px; padding:0.3rem; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #475569; text-align:center; font-weight:bold;">' +
                        '<button type="submit" style="background:#2563eb; color:#fff; border:none; padding:0.35rem 0.7rem; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.78rem;">💾 Guardar</button>' +
                    '</div>' +
                '</form>' +
            '</div>';
        }).join('');

        let html = '<!DOCTYPE html>' +
            '<html lang="es">' +
            '<head>' +
                '<meta charset="UTF-8">' +
                '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">' +
                '<title>Panel Administrador | Polirubro Virtual</title>' +
                '<link rel="stylesheet" href="/style.css">' +
                '<style>' +
                    'body.admin-body { background-color: #0b0f19 !important; color: #f8fafc !important; font-family: system-ui, -apple-system, sans-serif !important; }' +
                    '.admin-wrapper { max-width: 1250px; margin: 0 auto; padding: 1.5rem 1rem; }' +
                    '.grid-stats-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }' +
                    '.stat-box-clean { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 1.2rem 1rem; text-align: center; }' +
                    '.stat-box-clean h3 { color: #94a3b8; font-size: 0.82rem; margin: 0 0 0.3rem 0; text-transform: uppercase; }' +
                    '.stat-box-clean .num { font-size: 2rem; font-weight: 900; color: #38bdf8; }' +
                    '.stat-box-clean .sub { font-size: 0.78rem; color: #34d399; font-weight: 700; margin-top: 0.2rem; }' +
                    '.table-clean { width: 100%; border-collapse: collapse; }' +
                    '.table-clean th, .table-clean td { padding: 0.5rem 0.7rem; border-bottom: 1px solid #334155; font-size: 0.85rem; }' +
                    '.admin-two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }' +
                    '@media (max-width: 900px) { .grid-stats-cards { grid-template-columns: 1fr; } .admin-two-columns { grid-template-columns: 1fr; } }' +
                '</style>' +
            '</head>' +
            '<body class="admin-body">' +
                '<header style="background:#0f172a; padding:1.2rem; border-bottom:1px solid #1e293b; text-align:center;">' +
                    '<h1 style="margin:0; font-size:1.6rem; color:#fff;">⚙️ Panel de Control Administrador</h1>' +
                    '<p style="margin:0.3rem 0 0 0; color:#38bdf8; font-size:0.9rem;">Gestioná productos, secciones y monitoreá métricas en tiempo real</p>' +
                    '<div style="margin-top:0.8rem;">' +
                        '<a href="/" target="_blank" style="background:#0284c7; color:#fff; padding:0.4rem 1rem; border-radius:20px; text-decoration:none; font-weight:bold; font-size:0.85rem;">🌐 Ir a la Tienda Pública</a>' +
                    '</div>' +
                '</header>' +

                '<div class="admin-wrapper">' +
                    '<section style="background:#0f172a; border:1px solid #1e293b; border-radius:20px; padding:1.5rem; margin-bottom:1.8rem; box-shadow:0 8px 25px rgba(0,0,0,0.4);">' +
                        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.2rem; border-bottom:1px solid #1e293b; padding-bottom:0.8rem;">' +
                            '<div>' +
                                '<h2 style="margin:0; font-size:1.3rem; color:#38bdf8; font-weight:800;">📊 Estadísticas de Rendimiento</h2>' +
                                '<small style="color:#94a3b8;">Fecha actual: ' + hoy + '</small>' +
                            '</div>' +
                            '<form action="/admin/estadisticas/reiniciar" method="POST" onsubmit="return confirm(\'¿Seguro que querés reiniciar todas las estadísticas a cero?\');">' +
                                '<button type="submit" style="background:#ef4444; color:#fff; border:none; padding:0.5rem 0.9rem; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.8rem;">🔄 Reiniciar Contadores</button>' +
                            '</form>' +
                        '</div>' +

                        '<div class="grid-stats-cards">' +
                            '<div class="stat-box-clean">' +
                                '<h3>👁️ Visitas Totales</h3>' +
                                '<div class="num">' + (stats.totalVisitas || 0) + '</div>' +
                                '<div class="sub">📅 Hoy: ' + (statsHoy.total || 0) + '</div>' +
                            '</div>' +
                            '<div class="stat-box-clean">' +
                                '<h3>📱 Desde Celular</h3>' +
                                '<div class="num" style="color:#a7f3d0;">' + (stats.visitasMovil || 0) + '</div>' +
                                '<div class="sub">📅 Hoy: ' + (statsHoy.movil || 0) + '</div>' +
                            '</div>' +
                            '<div class="stat-box-clean">' +
                                '<h3>💻 Desde Computadora</h3>' +
                                '<div class="num" style="color:#fde047;">' + (stats.visitasPC || 0) + '</div>' +
                                '<div class="sub">📅 Hoy: ' + (statsHoy.pc || 0) + '</div>' +
                            '</div>' +
                        '</div>' +

                        '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.2rem;">' +
                            '<div style="background:#1e293b; padding:1rem; border-radius:12px; border:1px solid #334155;">' +
                                '<h4 style="margin:0 0 0.6rem 0; color:#38bdf8; font-size:0.95rem;">📂 Clics por Sección</h4>' +
                                '<table class="table-clean">' +
                                    '<thead><tr style="color:#94a3b8; text-align:left;"><th>Sección</th><th style="text-align:right;">Clics</th></tr></thead>' +
                                    '<tbody>' + filasSeccionesHTML + '</tbody>' +
                                '</table>' +
                            '</div>' +
                            '<div style="background:#1e293b; padding:1rem; border-radius:12px; border:1px solid #334155;">' +
                                '<h4 style="margin:0 0 0.6rem 0; color:#38bdf8; font-size:0.95rem;">🔍 Búsquedas Frecuentes</h4>' +
                                '<table class="table-clean">' +
                                    '<thead><tr style="color:#94a3b8; text-align:left;"><th>Término</th><th style="text-align:right;">Cant.</th></tr></thead>' +
                                    '<tbody>' + filasBusquedasHTML + '</tbody>' +
                                '</table>' +
                            '</div>' +
                        '</div>' +
                    '</section>' +

                    '<div class="admin-two-columns">' +
                        '<div style="display:flex; flex-direction:column; gap:1.5rem;">' +
                            '<section style="background:#0f172a; border:1px solid #1e293b; border-radius:18px; padding:1.2rem;">' +
                                '<h3 style="margin:0 0 1rem 0; font-size:1.1rem; color:#38bdf8;">📂 Gestionar Secciones</h3>' +
                                '<form action="/admin/categoria/agregar" method="POST" style="display:flex; flex-direction:column; gap:0.8rem; margin-bottom:1.2rem; border-bottom:1px solid #1e293b; padding-bottom:1.2rem;">' +
                                    '<div>' +
                                        '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Nueva Sección:</label>' +
                                        '<input type="text" name="nombreCat" placeholder="Ej: Bazar, Ferretería" required style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                    '</div>' +
                                    '<div>' +
                                        '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Emoji:</label>' +
                                        '<input type="text" name="iconoCat" value="📦" required style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                    '</div>' +
                                    '<button type="submit" style="background:#2563eb; color:#fff; border:none; padding:0.7rem; border-radius:8px; font-weight:bold; cursor:pointer;">✨ Guardar Sección</button>' +
                                '</form>' +
                                
                                '<h4 style="margin:0 0 0.6rem 0; font-size:0.95rem; color:#94a3b8;">Secciones Existentes:</h4>' +
                                '<div>' + listaCategoriasAdminHTML + '</div>' +
                            '</section>' +

                            '<section style="background:#0f172a; border:1px solid #1e293b; border-radius:18px; padding:1.2rem;">' +
                                '<h3 style="margin:0 0 1rem 0; font-size:1.1rem; color:#38bdf8;">➕ Cargar Nuevo Producto</h3>' +
                                '<form action="/admin/agregar" method="POST" id="productForm" style="display:flex; flex-direction:column; gap:0.8rem;">' +
                                    '<input type="hidden" id="imagenBase64" name="imagenBase64">' +
                                    '<div>' +
                                        '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Nombre del Producto:</label>' +
                                        '<input type="text" name="nombre" required placeholder="Ej: Protector Solar" style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                    '</div>' +
                                    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">' +
                                        '<div>' +
                                            '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Precio (\$):</label>' +
                                            '<input type="number" name="precio" required placeholder="4000" style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                        '</div>' +
                                        '<div>' +
                                            '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Stock:</label>' +
                                            '<input type="number" name="stock" required value="10" min="0" style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                        '</div>' +
                                    '</div>' +
                                    '<div>' +
                                        '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Sección:</label>' +
                                        '<select name="categoria" required style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                            opcionesCatHTML +
                                        '</select>' +
                                    '</div>' +
                                    '<div style="display:flex; align-items:center; gap:0.5rem; background:#1e293b; padding:0.6rem; border-radius:8px; border:1px solid #334155;">' +
                                        '<input type="checkbox" id="enOferta" name="enOferta" value="true" style="width:18px; height:18px; cursor:pointer;">' +
                                        '<label for="enOferta" style="font-size:0.85rem; color:#f43f5e; font-weight:bold; cursor:pointer;">🔥 Marcar como Producto en Oferta Destacada</label>' +
                                    '</div>' +
                                    '<div>' +
                                        '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">Descripción:</label>' +
                                        '<textarea name="descripcion" rows="2" placeholder="Breve detalle..." style="width:100%; padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;"></textarea>' +
                                    '</div>' +
                                    '<div>' +
                                        '<label style="font-size:0.82rem; color:#cbd5e1; display:block; margin-bottom:0.3rem;">🖼️ Imagen (Archivo o URL):</label>' +
                                        '<input type="file" id="fileInput" accept="image/*" onchange="comprimirYConvertirImagen()" style="margin-bottom:0.4rem;">' +
                                        '<input type="url" id="urlInput" name="imagenUrl" placeholder="https://..." style="width:100%; padding:0.5rem; border-radius:8px; background:#1e293b; border:1px solid #334155; color:#fff; outline:none;">' +
                                        '<div id="previewContainer" style="display:none; margin-top:0.5rem; text-align:center;">' +
                                            '<img id="imgPreview" src="" alt="Preview" style="max-width:100px; max-height:100px; border-radius:8px; border:1px solid #38bdf8; background:#070a12; object-fit:contain;">' +
                                        '</div>' +
                                    '</div>' +
                                    '<button type="submit" style="background:#10b981; color:#fff; border:none; padding:0.8rem; border-radius:8px; font-weight:bold; cursor:pointer;">💾 Guardar Producto</button>' +
                                '</form>' +
                            '</section>' +
                        '</div>' +

                        '<section style="background:#0f172a; border:1px solid #1e293b; border-radius:18px; padding:1.2rem;">' +
                            '<h3 style="margin:0 0 1rem 0; font-size:1.1rem; color:#38bdf8;">📦 Productos Cargados (' + productos.length + ')</h3>' +
                            '<div>' + listaProductosAdminHTML + '</div>' +
                        '</section>' +
                    '</div>' +
                '</div>' +

                '<script>' +
                    'function comprimirYConvertirImagen() {' +
                        'const fileInput = document.getElementById("fileInput");' +
                        'const file = fileInput.files[0];' +
                        'if (!file) return;' +
                        'const reader = new FileReader();' +
                        'reader.onload = function(e) {' +
                            'const img = new Image();' +
                            'img.src = e.target.result;' +
                            'img.onload = function() {' +
                                'const canvas = document.createElement("canvas");' +
                                'const MAX_WIDTH = 500;' +
                                'const MAX_HEIGHT = 500;' +
                                'let width = img.width;' +
                                'let height = img.height;' +
                                'if (width > height) {' +
                                    'if (width > MAX_WIDTH) {' +
                                        'height *= MAX_WIDTH / width;' +
                                        'width = MAX_WIDTH;' +
                                    '}' +
                                '} else {' +
                                    'if (height > MAX_HEIGHT) {' +
                                        'width *= MAX_HEIGHT / height;' +
                                        'height = MAX_HEIGHT;' +
                                    '}' +
                                '}' +
                                'canvas.width = width;' +
                                'canvas.height = height;' +
                                'const ctx = canvas.getContext("2d");' +
                                'ctx.drawImage(img, 0, 0, width, height);' +
                                'const dataUrl = canvas.toDataURL("image/jpeg", 0.7);' +
                                'document.getElementById("imagenBase64").value = dataUrl;' +
                                'document.getElementById("imgPreview").src = dataUrl;' +
                                'document.getElementById("previewContainer").style.display = "block";' +
                            '};' +
                        '};' +
                        'reader.readAsDataURL(file);' +
                    '}' +
                    'document.getElementById("urlInput").addEventListener("input", function() {' +
                        'const url = this.value.trim();' +
                        'const preview = document.getElementById("imgPreview");' +
                        'const previewContainer = document.getElementById("previewContainer");' +
                        'const hiddenInput = document.getElementById("imagenBase64");' +
                        'if (url) {' +
                            'hiddenInput.value = "";' +
                            'preview.src = url;' +
                            'previewContainer.style.display = "block";' +
                        '}' +
                    '});' +
                '</script>' +
            '</body>' +
            '</html>';
        res.send(html);
    } catch (err) {
        console.error("Error cargando /:", err);
        res.status(500).send("Error del servidor: " + err.message);
    }
});

app.post('/admin/estadisticas/reiniciar', (req, res) => {
    guardarEstadisticas({ totalVisitas: 0, visitasMovil: 0, visitasPC: 0, secciones: {}, busquedas: {}, porDia: {} });
    res.redirect('/admin');
});

app.post('/admin/actualizar-stock/:id', (req, res) => {
    const idProd = Number(req.params.id);
    const nuevoStock = Math.max(0, parseInt(req.body.nuevoStock) || 0);
    let productos = leerProductos();
    const index = productos.findIndex(p => p.id === idProd);
    if (index > -1) {
        productos[index].stock = nuevoStock;
        guardarProductos(productos);
    }
    res.redirect('/admin');
});

app.post('/admin/toggle-oferta/:id', (req, res) => {
    const idProd = Number(req.params.id);
    let productos = leerProductos();
    const index = productos.findIndex(p => p.id === idProd);
    if (index > -1) {
        productos[index].enOferta = !productos[index].enOferta;
        guardarProductos(productos);
    }
    res.redirect('/admin');
});

app.post('/admin/categoria/agregar', (req, res) => {
    const { nombreCat, iconoCat } = req.body;
    let categorias = leerCategorias();
    if (nombreCat && nombreCat.trim() !== '') {
        const nuevoId = categorias.length > 0 ? Math.max(...categorias.map(c => c.id)) + 1 : 1;
        categorias.push({ id: nuevoId, nombre: nombreCat.trim(), icono: iconoCat ? iconoCat.trim() : '📦' });
        guardarCategorias(categorias);
    }
    res.redirect('/admin');
});

app.post('/admin/categoria/eliminar/:id', (req, res) => {
    const idAEliminar = Number(req.params.id);
    let categorias = leerCategorias();
    categorias = categorias.filter(c => c.id !== idAEliminar);
    guardarCategorias(categorias);
    res.redirect('/admin');
});

app.post('/admin/agregar', (req, res) => {
    const { nombre, precio, stock, categoria, descripcion, imagenBase64, imagenUrl, enOferta } = req.body;
    let productos = leerProductos();
    const nuevoId = productos.length > 0 ? Math.max(...productos.map(p => p.id)) + 1 : 1;
    const imagenFinal = imagenBase64 && imagenBase64.trim() !== '' ? imagenBase64 : (imagenUrl && imagenUrl.trim() !== '' ? imagenUrl.trim() : 'https://via.placeholder.com/300x200?text=Sin+Imagen');

    productos.push({
        id: nuevoId,
        nombre: nombre.trim(),
        precio: Math.round(Number(precio) || 0),
        stock: Math.max(0, parseInt(stock) || 0),
        categoria: categoria || 'General',
        descripcion: descripcion ? descripcion.trim() : '',
        imagen: imagenFinal,
        enOferta: enOferta === 'true'
    });

    guardarProductos(productos);
    res.redirect('/admin');
});

app.post('/admin/eliminar/:id', (req, res) => {
    const idAEliminar = Number(req.params.id);
    let productos = leerProductos();
    productos = productos.filter(p => p.id !== idAEliminar);
    guardarProductos(productos, true);
    res.redirect('/admin');
});

async function iniciarServidor() {
    await cargarDesdeCloud();
    app.listen(PORT, () => {
        console.log(`🚀 Polirubro Virtual funcionando en http://localhost:${PORT}`);
        console.log(`⚙️ Panel Administrador en http://localhost:${PORT}/admin`);
    });
}

iniciarServidor();
