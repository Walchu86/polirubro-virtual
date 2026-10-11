const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

const MASTER_KEY = "$2a$10$tg1ZdjhTaAMXJux9z9NikO/vNFhjVdW28wxjdimgawIO.VkiBMEUi";
const BIN_ID = "6acba057ac6210605a28056a";

let memoriaProductos = [];
let memoriaCategorias = [
    { id: 1, nombre: 'Estética', icono: '💄', color: 'linear-gradient(135deg, #ec4899, #be185d)' },
    { id: 2, nombre: 'Electrónica', icono: '🎧', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { id: 3, nombre: 'Zapatería', icono: '👟', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { id: 4, nombre: 'Accesorios', icono: '📱', color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }
];
let memoriaEstadisticas = { totalVisitas: 0, visitasMovil: 0, visitasPC: 0, secciones: {}, busquedas: {}, porDia: {} };

function sincronizarConCloud() {
    const datosASubir = JSON.stringify({
        record: {
            productos: memoriaProductos,
            categorias: memoriaCategorias,
            estadisticas: memoriaEstadisticas
        }
    });

    const options = {
        hostname: 'api.jsonbin.io',
        port: 443,
        path: `/v3/b/\${BIN_ID}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': MASTER_KEY,
            'Content-Length': Buffer.byteLength(datosASubir)
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log('☁️ Sincronizado con JSONBin:', res.statusCode);
        });
    });
    req.on('error', (e) => {
        console.error('Error al sincronizar con JSONBin:', e);
    });
    req.write(datosASubir);
    req.end();
}

function cargarDesdeCloud() {
    const options = {
        hostname: 'api.jsonbin.io',
        port: 443,
        path: `/v3/b/\${BIN_ID}/latest`,
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
                const response = JSON.parse(body);
                const dataRoot = response.record || response;
                if (dataRoot) {
                    if (Array.isArray(dataRoot.productos)) memoriaProductos = dataRoot.productos;
                    if (Array.isArray(dataRoot.categorias) && dataRoot.categorias.length > 0) memoriaCategorias = dataRoot.categorias;
                    if (dataRoot.estadisticas) memoriaEstadisticas = dataRoot.estadisticas;
                    console.log('☁️ Datos cargados exitosamente desde JSONBin');
                }
            } catch (e) {
                console.error('Error al parsear datos de JSONBin:', e);
            }
        });
    });
    req.on('error', (e) => {
        console.error('Error al conectar con JSONBin para lectura:', e);
    });
    req.end();
}

cargarDesdeCloud();

function leerProductos() { return memoriaProductos; }
function guardarProductos(prods) { memoriaProductos = prods; sincronizarConCloud(); }

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
    stats.secciones[seccion] = (stats.secciones[seccion] || 0) + 1;
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
    stats.busquedas[terminoLimpio] = (stats.busquedas[terminoLimpio] || 0) + 1;
    if (!stats.porDia[hoy]) stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    if (!stats.porDia[hoy].busquedas) stats.porDia[hoy].busquedas = {};
    stats.porDia[hoy].busquedas[terminoLimpio] = (stats.porDia[hoy].busquedas[terminoLimpio] || 0) + 1;
    guardarEstadisticas(stats);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    registrarVisita(req);
    const productos = leerProductos();
    const categorias = leerCategorias();

    let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Polirubro Virtual | Tu Tienda Online</title>
            <link rel="stylesheet" href="/style.css">
            <style>
                @keyframes marqueePC {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                .promo-banner {
                    background: linear-gradient(90deg, #059669, #10b981, #059669);
                    color: #ffffff;
                    padding: 0.7rem 1rem;
                    font-weight: 800;
                    font-size: 0.95rem;
                    letter-spacing: 0.4px;
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                    overflow: hidden;
                    white-space: nowrap;
                    position: relative;
                    z-index: 99;
                }
                .promo-text-marquee {
                    display: inline-block;
                    animation: marqueePC 14s linear infinite;
                    width: 100%;
                    text-align: center;
                }
                .top-bar-container {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 50px;
                    padding: 0.6rem 1.2rem;
                    margin: 0 auto 2rem auto;
                    width: fit-content;
                    max-width: 95%;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                }
                .top-bar-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.6rem;
                    justify-content: center;
                    align-items: center;
                }
                .btn-home-mini {
                    background: linear-gradient(135deg, #0284c7, #0369a1) !important;
                    color: #ffffff !important;
                    border: 1px solid #38bdf8 !important;
                    padding: 0.55rem 1.2rem !important;
                    border-radius: 50px !important;
                    font-weight: 800 !important;
                    font-size: 0.88rem !important;
                    cursor: pointer !important;
                    white-space: nowrap !important;
                    box-shadow: 0 4px 12px rgba(56, 189, 248, 0.25);
                    transition: all 0.2s;
                }
                .btn-home-mini:hover { transform: translateY(-2px); }
                .btn-seccion-mini {
                    background: #1e293b !important;
                    color: #f1f5f9 !important;
                    border: 1px solid #334155 !important;
                    padding: 0.55rem 1.1rem !important;
                    border-radius: 50px !important;
                    font-weight: 700 !important;
                    font-size: 0.88rem !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 0.4rem !important;
                    white-space: nowrap !important;
                    transition: all 0.2s;
                }
                .btn-seccion-mini:hover { border-color: #38bdf8 !important; color: #38bdf8 !important; transform: translateY(-2px); }
                .product-image-container {
                    position: relative;
                    width: 100%;
                    height: 180px !important;
                    max-height: 180px !important;
                    background: #070a12;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                    box-sizing: border-box;
                }
                .product-image-container img.zoom-img {
                    max-width: 100% !important;
                    max-height: 100% !important;
                    width: auto !important;
                    height: auto !important;
                    object-fit: contain !important;
                    cursor: zoom-in;
                    transition: transform 0.3s ease;
                }
                .product-image-container img.zoom-img:hover { transform: scale(1.05); }
                @media (max-width: 768px) {
                    .promo-banner { font-size: 0.82rem !important; padding: 0.6rem 0.5rem !important; text-align: center !important; white-space: normal !important; }
                    .promo-text-marquee { animation: none !important; display: block !important; width: 100% !important; }
                    .top-bar-container { border-radius: 18px !important; width: 100% !important; padding: 0.8rem !important; }
                    .top-bar-grid { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 0.5rem !important; }
                    .btn-home-mini { grid-column: span 2 !important; text-align: center !important; justify-content: center !important; }
                    .btn-seccion-mini { justify-content: center !important; padding: 0.5rem 0.6rem !important; font-size: 0.8rem !important; }
                }
            </style>
        </head>
        <body>
            <div class="promo-banner">
                <div class="promo-text-marquee">
                    🚚 <span>¡ENVÍO GRATIS comprando exclusivamente en la WEB superando los <strong>\$20.000</strong>!</span> 🛍️ <span>¡Aprovechá tus beneficios hoy!</span>
                </div>
            </div>

            <header>
                <div class="header-content">
                    <h1>🏪 Polirubro Virtual</h1>
                    <p style="color: #38bdf8 !important; font-weight: 700;">✨ ¡Hacé clic y llevate lo que más te gusta!</p>
                </div>
                <div class="header-actions">
                    <button class="cart-btn" onclick="toggleCartModal()">🛒 Carrito (<span id="cartCount">0</span>)</button>
                </div>
            </header>

            <main>
                <section class="top-bar-container">
                    <div class="top-bar-grid">
                        <button onclick="mostrarMenuPrincipal()" class="btn-home-mini">🏠 Inicio</button>
    `;

    categorias.forEach(cat => {
        html += `<button onclick="entrarASeccion('\${cat.nombre.replace(/'/g, "\\'")}')" class="btn-seccion-mini"><span>${cat.icono \vert{}\vert{} '📦'}</span> ${cat.nombre}</button>`;
    });

    html += `
                    </div>
                </section>

                <section id="vistaSecciones" class="secciones-container">
                    <h2 style="text-align: center; font-size: 1.5rem; color: #38bdf8; margin-bottom: 1.5rem; font-weight: 900;">🛍️ ¿Qué estás buscando hoy?</h2>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; justify-content: center; max-width: 900px; margin: 0 auto; padding: 0 0.5rem;">
    `;

    categorias.forEach(cat => {
        const bgGlow = cat.color || 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
        html += `
            <div onclick="entrarASeccion('\${cat.nombre.replace(/'/g, "\\'")}')" class="card-seccion-glow" style="background: #111827; border: 2px solid #334155; border-radius: 20px; padding: 1.2rem 0.8rem; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; text-align: center; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 5px; background: \${bgGlow};"></div>
                <span class="icono-cat" style="font-size: 2.5rem; margin-bottom: 0.5rem;">\${cat.icono || '📦'}</span>
                <strong style="font-size: 1.05rem; color: #ffffff; font-weight: 800;">\${cat.nombre}</strong>
                <span class="texto-accion" style="font-size: 0.8rem; color: #38bdf8; margin-top: 0.4rem; font-weight: 600;">Ver productos ➔</span>
            </div>
        `;
    });

    html += `
                    </div>
                </section>

                <section id="vistaProductos" class="catalogo" style="display: none;">
                    <div style="margin-bottom: 1.5rem;">
                        <input type="text" id="searchInput" oninput="filtrarProductosConDebounce()" placeholder="🔍 Buscar producto en esta sección..." style="width: 100%; padding: 1rem 1.4rem; border-radius: 14px; background: #111827; color: white; border: 1px solid #334155; font-size: 1rem; outline: none;">
                    </div>

                    <h2 id="tituloSeccionActual" style="font-size: 1.5rem; color: #38bdf8; margin-bottom: 1.5rem; border-bottom: 2px solid #1e293b; padding-bottom: 0.6rem; font-weight: 800;"></h2>
                    <div class="product-grid" id="productGrid">
    `;

    if (productos.length === 0) {
        html += `<p class="no-products">No hay productos cargados en este momento.</p>`;
    } else {
        productos.forEach(prod => {
            const imagenUrl = prod.imagen || 'https://via.placeholder.com/300x200?text=Sin+Imagen';
            const descripcionTexto = prod.descripcion ? `<p class="description" style="color: #94a3b8; font-size: 0.88rem; margin: 0.4rem 0;">\${prod.descripcion}</p>` : '';
            const precioFormateado = formatearPrecio(prod.precio);
            const stockActual = prod.stock !== undefined ? Number(prod.stock) : 10;
            const estaAgotado = stockActual <= 0;

            const badgeCategoria = `<span class="badge ${estaAgotado ? 'badge-agotado' : ''}">${estaAgotado ? 'AGOTADO' : prod.categoria}</span>`;
            const botonAgregar = estaAgotado 
                ? `<button class="btn-agregar btn-disabled" disabled style="width:100%; padding:0.75rem; border-radius:12px; border:none; background:#374151; color:#9ca3af; font-weight:bold; cursor:not-allowed;">🚫 Sin Stock</button>`
                : `<button class="btn-agregar" onclick="agregarAlCarrito(${prod.id}, '${prod.nombre.replace(/'/g, "\\'")}', ${prod.precio},${stockActual})" style="width:100%; padding:0.75rem; border-radius:12px; border:none; background:linear-gradient(135deg, #2563eb, #3b82f6); color:#fff; font-weight:bold; cursor:pointer;">➕ Agregar al Carrito</button>`;

            html += `
              <div class="product-card" data-categoria="\${(prod.categoria || '').trim()}" data-nombre="${prod.nombre \vert{}\vert{} ''}" data-descripcion="${prod.descripcion || ''}">
                  <div class="product-image-container">
                      <img src="${imagenUrl}" alt="${prod.nombre}" class="zoom-img" onerror="this.src='https://via.placeholder.com/300x200?text=Error+Imagen'">
                      \${badgeCategoria}
                  </div>
                  <div class="product-info" style="padding: 1.2rem; display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
                      <div>
                          <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 0.3rem; font-weight: 700;">\${prod.nombre}</h3>
                          ${descripcionTexto}                       </div>                        <div style="margin-top: 0.8rem;">                           <div class="stock-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">                               <span class="price" style="font-size: 1.4rem; font-weight: 800; color: #34d399;">$\${precioFormateado}</span>
                              <small class="stock-count" style="color: #94a3b8; font-size: 0.82rem;">\${estaAgotado ? 'Sin disponibilidad' : 'Stock: ' + stockActual}</small>
                          </div>

                          <button class="btn-share-prominente" onclick="compartirProducto('${prod.nombre.replace(/'/g, "\\'")}', '${prod.precio}')" style="width: 100%; background: #059669; color: #ffffff; border: 1px solid #10b981; padding: 0.65rem; border-radius: 12px; font-weight: bold; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.65rem;">
                              📲 Compartir por WhatsApp
                          </button>

                          \${botonAgregar}
                      </div>
                  </div>
              </div>
            `;
        });
    }

    html += `
                    </div>
                </section>
            </main>

            <a href="https://wa.me/5493794655867?text=¡Hola!%20Tengo%20una%20consulta%20sobre%20Polirubro%20Virtual" class="whatsapp-float" target="_blank">
                💬 <span>¿Tenés dudas? Hablá con nosotros</span>
            </a>

            <!-- MODAL BIENVENIDA -->
            <div id="promoWelcomeModal" class="modal" style="display:none; position:fixed; z-index:9999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background: linear-gradient(135deg, #0f172a, #1e1b4b); border: 2px solid #10b981; border-radius: 28px; padding: 2.2rem 1.8rem; width: 100%; max-width: 440px; text-align: center; position: relative; color: #fff; box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4);">
                    <button type="button" onclick="cerrarPromoWelcome()" style="position:absolute; top:15px; right:20px; background:none; border:none; color:#94a3b8; font-size:2rem; cursor:pointer;">&times;</button>
                    <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">🚚🎉</div>
                    <h2 style="font-size: 1.6rem; color: #10b981; margin-bottom: 0.8rem; font-weight: 900;">¡SÚPER PROMO DE BIENVENIDA!</h2>
                    <p style="font-size: 1.05rem; color: #f1f5f9; line-height: 1.5; margin-bottom: 1.5rem;">
                        Llevate tu pedido con <strong style="color: #34d399; font-size: 1.2rem;">ENVÍO GRATIS EXCLUSIVO EN LA WEB</strong> superando los <strong style="color: #38bdf8; font-size: 1.2rem;">\$20.000</strong> en tu compra.
                    </p>
                    <button onclick="cerrarPromoWelcome()" style="background: linear-gradient(135deg, #059669, #10b981); color: white; width: 100%; padding: 0.95rem; border-radius: 14px; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer;">
                        🛍️ ¡Genial, empezar a comprar!
                    </button>
                </div>
            </div>

            <!-- MODAL CARRITO COMPACTO -->
            <div id="cartModal" class="modal" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background:#0f172a; border:1px solid #334155; border-radius:24px; padding:1.5rem; width:100%; max-width:420px; position:relative; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.9); max-height:85vh; overflow-y:auto;">
                    <button type="button" onclick="toggleCartModal()" style="position:absolute; top:12px; right:16px; background:#ef4444; color:#fff; border:none; width:32px; height:32px; border-radius:50%; font-size:1.2rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
                    <h2 style="font-size:1.25rem; color:#38bdf8; margin-bottom:0.6rem; font-weight:800;">🛒 Tu Carrito</h2>
                    
                    <div id="promoEnvioProgress" style="background:#1e293b; border:1px solid #3b82f6; border-radius:10px; padding:0.4rem 0.6rem; margin-bottom:0.6rem; text-align:center; font-size:0.8rem; font-weight:bold;">
                        🚚 Envío gratis exclusivo en la Web superando los \$20.000
                    </div>

                    <div id="cartItemsList" style="max-height:120px; overflow-y:auto; margin-bottom:0.6rem; padding-right:0.2rem;">
                        <p style="color:#94a3b8; text-align:center;">El carrito está vacío.</p>
                    </div>

                    <div id="cartOptions" style="display:none;">
                        <div style="background:#1e293b; padding:0.7rem; border-radius:10px; border:1px solid #334155; margin-bottom:0.6rem;">
                            <h4 style="font-size:0.82rem; color:#38bdf8; margin-bottom:0.4rem; font-weight:700;">📋 Datos para Entrega:</h4>
                            <input type="text" id="clienteNombre" placeholder="Tu Nombre y Apellido *" style="width:100%; padding:0.5rem 0.7rem; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #475569; margin-bottom:0.4rem; outline:none;" required>
                            <input type="text" id="clienteDireccion" placeholder="Dirección / Barrio *" style="width:100%; padding:0.5rem 0.7rem; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #475569; margin-bottom:0.4rem; outline:none;">
                            <input type="tel" id="clienteTelefono" placeholder="Teléfono de contacto" style="width:100%; padding:0.5rem 0.7rem; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #475569; outline:none;">
                        </div>

                        <div id="contenedorEnvio" style="margin-bottom:0.6rem;">
                            <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem; font-weight:600;">🚚 Zona / Forma de Entrega:</label>
                            <select id="tipoEnvio" onchange="actualizarTotal()" style="width:100%; padding:0.5rem 0.7rem; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569; outline:none; cursor:pointer;">
                                <option value="retiro" data-costo="0">Retirar por el local (Gratis)</option>
                                <option value="centro" data-costo="1500">Zona Centro / Cambá Cuá (+\$1.500)</option>
                                <option value="barrios_cercanos" data-costo="2000">Barrios Cercanos / Aldana / Yapeyú (+\$2.000)</option>
                                <option value="barrios_alejados" data-costo="2500">1000 Viviendas / Molina Punta / Laguna Seca (+\$2.500)</option>
                            </select>
                        </div>

                        <div id="cartelEnvioGratis" style="display:none; background:#064e3b; border:1px solid #10b981; border-radius:8px; padding:0.6rem; text-align:center; margin-bottom:0.6rem;">
                            <span style="color:#a7f3d0; font-size:0.82rem; font-weight:bold;">🚚 Zona / Envío: <strong style="color:#fff;">🎉 ¡ENVÍO GRATIS WEB APLICADO! (\$0)</strong></span>
                        </div>

                        <div style="margin-bottom:0.6rem;">
                            <label style="display:block; font-size:0.82rem; color:#cbd5e1; margin-bottom:0.3rem; font-weight:600;">💳 Método de Pago:</label>
                            <select id="metodoPago" onchange="mostrarDatosTransferencia()" style="width:100%; padding:0.5rem 0.7rem; border-radius:6px; background:#1e293b; color:#fff; border:1px solid #475569; outline:none; cursor:pointer;">
                                <option value="Efectivo">Efectivo al recibir</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria (Alias/CBU)</option>
                                <option value="Personal Pay">Personal Pay</option>
                                <option value="Ualá">Ualá</option>
                            </select>
                        </div>

                        <div id="transferInfo" style="display:none; background:#064e3b; border:1px solid #059669; padding:0.5rem 0.7rem; border-radius:6px; margin:0.5rem 0; justify-content:space-between; align-items:center;">
                            <small style="color:#a7f3d0;">🏦 <strong>Alias:</strong> POLIRUBRO.VIRTUAL.MP</small>
                            <button type="button" onclick="copiarAlias()" style="background:#10b981; color:#fff; border:none; padding:0.3rem 0.6rem; border-radius:4px; cursor:pointer; font-size:0.75rem; font-weight:bold;">📋 Copiar</button>
                        </div>

                        <div style="text-align:right; margin:0.8rem 0 0.5rem 0;">
                            <h3 style="color:#34d399; font-size:1.2rem; font-weight:800;">Total: \$<span id="cartTotalPrice">0</span></h3>
                        </div>

                        <button onclick="procesarPedido()" style="background:linear-gradient(135deg, #059669, #10b981); color:white; width:100%; padding:0.75rem; border-radius:8px; border:none; font-weight:bold; font-size:0.92rem; cursor:pointer;">
                            📲 Confirmar y Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL QR PC -->
            <div id="optionsModal" class="modal" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background:#0f172a; border:1px solid #334155; border-radius:24px; padding:2rem; width:100%; max-width:420px; text-align:center; position:relative; color:#fff;">
                    <button type="button" onclick="cerrarOptionsModal()" style="position:absolute; top:18px; right:20px; background:none; border:none; color:#94a3b8; font-size:1.8rem; cursor:pointer;">&times;</button>
                    <h2 style="font-size:1.35rem; color:#38bdf8; margin-bottom:0.5rem; font-weight:800;">📲 Escaneá tu Pedido</h2>
                    <p style="color:#94a3b8; font-size:0.88rem; margin-bottom:1.2rem;">Apuntá con tu celular para enviar el pedido por WhatsApp:</p>
                    <div style="background:#1e293b; padding:1.2rem; border-radius:18px; border:1px solid #334155; display:inline-block;">
                        <img id="qrImage" src="" alt="Código QR Pedido" style="width:200px; height:200px; border-radius:12px; border:2px solid #38bdf8;">
                    </div>
                </div>
            </div>

            <!-- MODAL ZOOM IMAGEN -->
            <div id="modal-imagen-zoom" onclick="cerrarZoom(event)" style="display:none; position:fixed; z-index:99999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.92); justify-content:center; align-items:center; padding:1rem; box-sizing:border-box;">
                <span onclick="cerrarZoom(event)" style="position:absolute; top:15px; right:20px; color:#fff; font-size:2.5rem; font-weight:bold; cursor:pointer; background:rgba(0,0,0,0.5); width:45px; height:45px; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:100000000;">&times;</span>
                <img id="img-ampliada" src="" alt="Zoom Producto" style="max-width:88%; max-height:80vh; object-fit:contain; border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
            </div>

            <footer>
                <p>&copy; 2026 Polirubro Virtual — Todos los derechos reservados.</p>
            </footer>

            <script>
                let carrito = [];
                let seccionSeleccionada = '';
                let searchTimeout = null;

                document.addEventListener("DOMContentLoaded", function() {
                    if (!sessionStorage.getItem('promoVisto')) {
                        document.getElementById('promoWelcomeModal').style.display = 'flex';
                    }

                    let ultimaSeccion = localStorage.getItem('seccionActiva');
                    if (window.location.hash && window.location.hash.startsWith('#seccion-')) {
                        ultimaSeccion = decodeURIComponent(window.location.hash.replace('#seccion-', ''));
                    }

                    if (ultimaSeccion && ultimaSeccion !== '') {
                        entrarASeccion(ultimaSeccion, false, false);
                    } else {
                        mostrarMenuPrincipal(false, false);
                    }
                });

                window.addEventListener('popstate', function(event) {
                    const modalZoom = document.getElementById("modal-imagen-zoom");
                    if (modalZoom.style.display === "flex") {
                        modalZoom.style.display = "none";
                        return;
                    }
                    if (seccionSeleccionada !== '') {
                        mostrarMenuPrincipal(true, false);
                    }
                });

                function abrirZoom(urlImagen) {
                    const modal = document.getElementById("modal-imagen-zoom");
                    const imgAmpliada = document.getElementById("img-ampliada");
                    imgAmpliada.src = urlImagen;
                    modal.style.display = "flex";
                }

                function cerrarZoom(event) {
                    if (event) event.stopPropagation();
                    const modal = document.getElementById("modal-imagen-zoom");
                    modal.style.display = "none";
                }

                function cerrarPromoWelcome() {
                    sessionStorage.setItem('promoVisto', 'true');
                    document.getElementById('promoWelcomeModal').style.display = 'none';
                }

                function normalizar(str) {
                    if (!str) return '';
                    return str.toString().toLowerCase().trim().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
                }

                function formatoPesos(num) {
                    return Number(num || 0).toLocaleString('es-AR');
                }

                function entrarASeccion(nombreCat, registrarStat = true, pushHistory = true) {
                    seccionSeleccionada = nombreCat;
                    localStorage.setItem('seccionActiva', nombreCat);

                    if (pushHistory) {
                        history.pushState({ seccionActiva: nombreCat }, "", '#seccion-' + encodeURIComponent(nombreCat));
                    } else {
                        history.replaceState({ seccionActiva: nombreCat }, "", '#seccion-' + encodeURIComponent(nombreCat));
                    }

                    document.getElementById('vistaSecciones').style.display = 'none';
                    document.getElementById('vistaProductos').style.display = 'block';
                    document.getElementById('tituloSeccionActual').innerText = '📂 Sección: ' + nombreCat;
                    document.getElementById('searchInput').value = '';
                    filtrarProductos();

                    if (registrarStat) {
                        fetch('/api/stats/seccion', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ seccion: nombreCat })
                        }).catch(() => {});
                    }
                }

                function mostrarMenuPrincipal(limpiarHash = true, pushHistory = true) {
                    seccionSeleccionada = '';
                    localStorage.removeItem('seccionActiva');
                    
                    if (pushHistory) {
                        history.pushState({ menuPrincipal: true }, "", window.location.pathname);
                    } else if (limpiarHash) {
                        history.replaceState(null, "", window.location.pathname);
                    }

                    document.getElementById('vistaSecciones').style.display = 'block';
                    document.getElementById('vistaProductos').style.display = 'none';
                }

                function filtrarProductosConDebounce() {
                    filtrarProductos();
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        const termino = document.getElementById('searchInput').value.trim();
                        if (termino.length >= 2) {
                            fetch('/api/stats/busqueda', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ termino })
                            }).catch(() => {});
                        }
                    }, 1000);
                }

                function filtrarProductos() {
                    if (!seccionSeleccionada) return;
                    const busqueda = normalizar(document.getElementById('searchInput').value);
                    const catActivaNorm = normalizar(seccionSeleccionada);
                    const tarjetas = document.querySelectorAll('.product-card');

                    tarjetas.forEach(tarjeta => {
                        const catProd = normalizar(tarjeta.getAttribute('data-categoria'));
                        const nombreProd = normalizar(tarjeta.getAttribute('data-nombre'));
                        const descProd = normalizar(tarjeta.getAttribute('data-descripcion'));

                        const coincideSeccion = (catProd === catActivaNorm);
                        const coincideBusqueda = (busqueda === '' || nombreProd.includes(busqueda) || descProd.includes(busqueda));

                        if (coincideSeccion && coincideBusqueda) {
                            tarjeta.style.setProperty('display', 'flex', 'important');
                        } else {
                            tarjeta.style.setProperty('display', 'none', 'important');
                        }
                    });
                }

                function agregarAlCarrito(id, nombre, precio, stockMax) {
                    const index = carrito.findIndex(item => item.id === id);
                    if (index > -1) {
                        if (carrito[index].cantidad < stockMax) {
                            carrito[index].cantidad += 1;
                        } else {
                            alert('Alcanzaste el límite de stock disponible.');
                            return;
                        }
                    } else {
                        carrito.push({ id, nombre, precio: Number(precio), cantidad: 1, stockMax });
                    }
                    actualizarVistaCarrito();
                    alert('¡Producto agregado al carrito!');
                }

                function cambiarCantidad(id, cambio) {
                    const index = carrito.findIndex(item => item.id === id);
                    if (index > -1) {
                        const nuevaCant = carrito[index].cantidad + cambio;
                        if (nuevaCant > carrito[index].stockMax) {
                            alert('No hay más stock.');
                            return;
                        }
                        carrito[index].cantidad = nuevaCant;
                        if (carrito[index].cantidad <= 0) {
                            carrito.splice(index, 1);
                        }
                    }
                    actualizarVistaCarrito();
                }

                function actualizarVistaCarrito() {
                    const cartCount = document.getElementById('cartCount');
                    const cartItemsList = document.getElementById('cartItemsList');
                    const cartOptions = document.getElementById('cartOptions');

                    let totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
                    cartCount.innerText = totalItems;

                    if (carrito.length === 0) {
                        cartItemsList.innerHTML = '<p style="color:#94a3b8; text-align:center;">El carrito está vacío.</p>';
                        cartOptions.style.display = 'none';
                        return;
                    }

                    cartOptions.style.display = 'block';
                    let html = '';
                    carrito.forEach(item => {
                        html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.5rem 0.7rem; border-radius:6px; margin-bottom:0.3rem; border:1px solid #334155;">
                                <div>
                                    <strong style="color:#fff; font-size:0.88rem;">${item.nombre}</strong><br>
                                    <small style="color:#38bdf8;">$${formatoPesos(item.precio)} x ${item.cantidad}</small>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.3rem;">
                                    <button onclick="cambiarCantidad(${item.id}, -1)" style="background:#0f172a; color:#fff; border:1px solid #475569; width:22px; height:22px; border-radius:4px; font-weight:bold; cursor:pointer;">-</button>
                                    <span style="font-weight:bold; padding:0.2rem; font-size:0.9rem;">${item.cantidad}</span>
                                    <button onclick="cambiarCantidad(${item.id}, 1)" style="background:#0f172a; color:#fff; border:1px solid #475569; width:22px; height:22px; border-radius:4px; font-weight:bold; cursor:pointer;">+</button>
                                </div>
                            </div>
                        `;
                    });
                    cartItemsList.innerHTML = html;
                    actualizarTotal();
                }

                function actualizarTotal() {
                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    const contenedorEnvio = document.getElementById('contenedorEnvio');
                    const cartelEnvioGratis = document.getElementById('cartelEnvioGratis');
                    const promoProgress = document.getElementById('promoEnvioProgress');
                    const ES_ENVIO_GRATIS = subtotal >= 20000;

                    if (ES_ENVIO_GRATIS) {
                        promoProgress.style.background = '#064e3b';
                        promoProgress.style.borderColor = '#10b981';
                        promoProgress.style.color = '#a7f3d0';
                        promoProgress.innerHTML = '🎉 ¡Felicitaciones! Tenés <strong>ENVÍO GRATIS WEB</strong> en esta compra.';
                        contenedorEnvio.style.display = 'none';
                        cartelEnvioGratis.style.display = 'block';
                    } else {
                        const falta = 20000 - subtotal;
                        promoProgress.style.background = '#1e293b';
                        promoProgress.style.borderColor = '#3b82f6';
                        promoProgress.style.color = '#38bdf8';
                        promoProgress.innerHTML = `🚚 Agregá \$${formatoPesos(falta)} más para tener <strong>ENVÍO GRATIS WEB</strong>`;
                        contenedorEnvio.style.display = 'block';
                        cartelEnvioGratis.style.display = 'none';
                    }

                    let costoEnvio = 0;
                    if (!ES_ENVIO_GRATIS) {
                        const tipoEnvioSelect = document.getElementById('tipoEnvio');
                        if (tipoEnvioSelect) {
                            const opcionSeleccionada = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];
                            costoEnvio = Number(opcionSeleccionada.getAttribute('data-costo') || 0);
                        }
                    }

                    let total = subtotal + costoEnvio;
                    document.getElementById('cartTotalPrice').innerText = formatoPesos(total);
                }

                function mostrarDatosTransferencia() {
                    const metodo = document.getElementById('metodoPago').value;
                    const transferDiv = document.getElementById('transferInfo');
                    transferDiv.style.display = metodo === 'Transferencia Bancaria' ? 'flex' : 'none';
                }

                function copiarAlias() {
                    navigator.clipboard.writeText
