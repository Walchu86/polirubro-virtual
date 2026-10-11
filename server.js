const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

const DATA_FILE = path.join(__dirname, 'productos.json');
const CATEGORIAS_FILE = path.join(__dirname, 'categorias.json');
const STATS_FILE = path.join(__dirname, 'estadisticas.json');

const categoriasPorDefecto = [
    { id: 1, nombre: 'Estética', icono: '💄', color: 'linear-gradient(135deg, #ec4899, #be185d)' },
    { id: 2, nombre: 'Electrónica', icono: '🎧', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { id: 3, nombre: 'Zapatería', icono: '👟', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { id: 4, nombre: 'Accesorios', icono: '📱', color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }
];

function leerCategorias() {
    if (!fs.existsSync(CATEGORIAS_FILE)) {
        guardarCategorias(categoriasPorDefecto);
        return categoriasPorDefecto;
    }
    try {
        return JSON.parse(fs.readFileSync(CATEGORIAS_FILE, 'utf8'));
    } catch (e) {
        return categoriasPorDefecto;
    }
}

function guardarCategorias(cats) {
    fs.writeFileSync(CATEGORIAS_FILE, JSON.stringify(cats, null, 2), 'utf8');
}

function leerProductos() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function guardarProductos(prods) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(prods, null, 2), 'utf8');
}

// ==========================================
// MANEJO DE ESTADÍSTICAS PERSISTENTES
// ==========================================
function leerEstadisticas() {
    const estructuraInicial = {
        totalVisitas: 0,
        visitasMovil: 0,
        visitasPC: 0,
        secciones: {},
        busquedas: {},
        porDia: {}
    };

    if (!fs.existsSync(STATS_FILE)) {
        guardarEstadisticas(estructuraInicial);
        return estructuraInicial;
    }
    try {
        const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
        return { ...estructuraInicial, ...stats };
    } catch (e) {
        return estructuraInicial;
    }
}

function guardarEstadisticas(stats) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
}

function obtenerFechaHoy() {
    const ahora = new Date();
    const offsetArg = -3 * 60; // UTC-3 para Argentina
    const fechaArg = new Date(ahora.getTime() + (ahora.getTimezoneOffset() + offsetArg) * 60000);
    return fechaArg.toISOString().split('T')[0];
}

function registrarVisita(req) {
    const userAgent = req.headers['user-agent'] || '';
    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const hoy = obtenerFechaHoy();

    let stats = leerEstadisticas();

    stats.totalVisitas = (stats.totalVisitas || 0) + 1;
    if (esMovil) {
        stats.visitasMovil = (stats.visitasMovil || 0) + 1;
    } else {
        stats.visitasPC = (stats.visitasPC || 0) + 1;
    }

    if (!stats.porDia[hoy]) {
        stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    }

    stats.porDia[hoy].total = (stats.porDia[hoy].total || 0) + 1;
    if (esMovil) {
        stats.porDia[hoy].movil = (stats.porDia[hoy].movil || 0) + 1;
    } else {
        stats.porDia[hoy].pc = (stats.porDia[hoy].pc || 0) + 1;
    }

    guardarEstadisticas(stats);
}

function formatearPrecio(monto) {
    return Number(monto || 0).toLocaleString('es-AR');
}

// API ENDPOINTS PARA REGISTRAR ACCIONES DE CLIENTES
app.post('/api/stats/seccion', (req, res) => {
    const { seccion } = req.body;
    if (!seccion) return res.json({ success: false });

    const hoy = obtenerFechaHoy();
    let stats = leerEstadisticas();

    stats.secciones[seccion] = (stats.secciones[seccion] || 0) + 1;

    if (!stats.porDia[hoy]) {
        stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    }
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

    if (!stats.porDia[hoy]) {
        stats.porDia[hoy] = { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };
    }
    if (!stats.porDia[hoy].busquedas) stats.porDia[hoy].busquedas = {};
    stats.porDia[hoy].busquedas[terminoLimpio] = (stats.porDia[hoy].busquedas[terminoLimpio] || 0) + 1;

    guardarEstadisticas(stats);
    res.json({ success: true });
});

// ==========================================
// 1. TIENDA PÚBLICA (VISTA CLIENTE)
// ==========================================
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
                .btn-home-mini:hover {
                    transform: translateY(-2px);
                }
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
                .btn-seccion-mini:hover {
                    border-color: #38bdf8 !important;
                    color: #38bdf8 !important;
                    transform: translateY(-2px);
                }

                @media (max-width: 768px) {
                    .promo-banner {
                        font-size: 0.82rem !important;
                        padding: 0.6rem 0.5rem !important;
                        text-align: center !important;
                        white-space: normal !important;
                    }
                    .promo-text-marquee {
                        animation: none !important;
                        display: block !important;
                        width: 100% !important;
                    }
                    .top-bar-container {
                        border-radius: 18px !important;
                        width: 100% !important;
                        padding: 0.8rem !important;
                    }
                    .top-bar-grid {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 0.5rem !important;
                    }
                    .btn-home-mini {
                        grid-column: span 2 !important;
                        text-align: center !important;
                        justify-content: center !important;
                    }
                    .btn-seccion-mini {
                        justify-content: center !important;
                        padding: 0.5rem 0.6rem !important;
                        font-size: 0.8rem !important;
                    }
                    .card-seccion-glow {
                        padding: 1.2rem 0.8rem !important;
                        border-radius: 16px !important;
                    }
                    .card-seccion-glow span.icono-cat {
                        font-size: 2.2rem !important;
                        margin-bottom: 0.3rem !important;
                    }
                    .card-seccion-glow strong {
                        font-size: 0.95rem !important;
                    }
                    .card-seccion-glow span.texto-accion {
                        font-size: 0.78rem !important;
                        margin-top: 0.3rem !important;
                        line-height: 1.1 !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="promo-banner">
                <div class="promo-text-marquee">
                    🚚 <span>¡ENVÍO GRATIS en compras superiores a <strong>$20.000</strong>!</span> 🛍️ <span>¡Aprovechá tus beneficios hoy!</span>
                </div>
            </div>

            <header>
                <div class="header-content">
                    <h1>🏪 Polirubro Virtual</h1>
                    <p style="color: #38bdf8 !important; font-weight: 700;">✨ ¡Hacé clic y llevate lo que más te gusta!</p>
                </div>
                <div class="header-actions">
                    <button class="cart-btn" onclick="toggleCartModal()">
                        🛒 Carrito (<span id="cartCount">0</span>)
                    </button>
                </div>
            </header>

            <main>
                <section class="top-bar-container">
                    <div class="top-bar-grid">
                        <button onclick="mostrarMenuPrincipal()" class="btn-home-mini">
                            🏠 Inicio
                        </button>
    `;

    categorias.forEach(cat => {
        html += `
            <button onclick="entrarASeccion('${cat.nombre.replace(/'/g, "\\'")}')" class="btn-seccion-mini">
                <span>${cat.icono || '📦'}</span> ${cat.nombre}
            </button>
        `;
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
            <div onclick="entrarASeccion('${cat.nombre.replace(/'/g, "\\'")}')" class="card-seccion-glow" style="background: #111827; border: 2px solid #334155; border-radius: 20px; padding: 1.2rem 0.8rem; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; text-align: center; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 5px; background: ${bgGlow};"></div>
                <span class="icono-cat" style="font-size: 2.5rem; margin-bottom: 0.5rem;">${cat.icono || '📦'}</span>
                <strong style="font-size: 1.05rem; color: #ffffff; font-weight: 800;">${cat.nombre}</strong>
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
            const descripcionTexto = prod.descripcion ? `<p class="description" style="color: #94a3b8; font-size: 0.88rem; margin: 0.4rem 0;">${prod.descripcion}</p>` : '';
            const precioFormateado = formatearPrecio(prod.precio);
            const stockActual = prod.stock !== undefined ? Number(prod.stock) : 10;
            const estaAgotado = stockActual <= 0;

            const badgeCategoria = `<span class="badge ${estaAgotado ? 'badge-agotado' : ''}">${estaAgotado ? 'AGOTADO' : prod.categoria}</span>`;

            const botonAgregar = estaAgotado 
                ? `<button class="btn-agregar btn-disabled" disabled style="width:100%; padding:0.75rem; border-radius:12px; border:none; background:#374151; color:#9ca3af; font-weight:bold; cursor:not-allowed;">🚫 Sin Stock</button>`
                : `<button class="btn-agregar" onclick="agregarAlCarrito(${prod.id}, '${prod.nombre.replace(/'/g, "\\'")}', ${prod.precio}, ${stockActual})" style="width:100%; padding:0.75rem; border-radius:12px; border:none; background:linear-gradient(135deg, #2563eb, #3b82f6); color:#fff; font-weight:bold; cursor:pointer;">➕ Agregar al Carrito</button>`;

            html += `
              <div class="product-card" data-categoria="${(prod.categoria || '').trim()}" data-nombre="${prod.nombre || ''}" data-descripcion="${prod.descripcion || ''}">
                  <div class="product-image-container" style="position: relative; width: 100%; height: 210px;">
                      <img src="${imagenUrl}" alt="${prod.nombre}" class="zoom-img" onerror="this.src='https://via.placeholder.com/300x200?text=Error+Imagen'">
                      ${badgeCategoria}
                  </div>
                  <div class="product-info" style="padding: 1.2rem; display: flex; flex-direction: column; justify-content: space-between; flex: 1;">
                      <div>
                          <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 0.3rem; font-weight: 700;">${prod.nombre}</h3>
                          ${descripcionTexto}
                      </div>

                      <div style="margin-top: 0.8rem;">
                          <div class="stock-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                              <span class="price" style="font-size: 1.4rem; font-weight: 800; color: #34d399;">$${precioFormateado}</span>
                              <small class="stock-count" style="color: #94a3b8; font-size: 0.82rem;">${estaAgotado ? 'Sin disponibilidad' : 'Stock: ' + stockActual}</small>
                          </div>

                          <button class="btn-share-prominente" onclick="compartirProducto('${prod.nombre.replace(/'/g, "\\'")}', '${prod.precio}')" style="width: 100%; background: #059669; color: #ffffff; border: 1px solid #10b981; padding: 0.65rem; border-radius: 12px; font-weight: bold; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.65rem;">
                              📲 Compartir por WhatsApp
                          </button>

                          ${botonAgregar}
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

            <!-- POPUP BIENVENIDA -->
            <div id="promoWelcomeModal" class="modal" style="display:flex; position:fixed; z-index:9999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background: linear-gradient(135deg, #0f172a, #1e1b4b); border: 2px solid #10b981; border-radius: 28px; padding: 2.2rem 1.8rem; width: 100%; max-width: 440px; text-align: center; position: relative; color: #fff; box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4);">
                    <button type="button" onclick="cerrarPromoWelcome()" style="position:absolute; top:15px; right:20px; background:none; border:none; color:#94a3b8; font-size:2rem; cursor:pointer;">&times;</button>
                    <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">🚚🎉</div>
                    <h2 style="font-size: 1.6rem; color: #10b981; margin-bottom: 0.8rem; font-weight: 900;">¡SÚPER PROMO DE BIENVENIDA!</h2>
                    <p style="font-size: 1.05rem; color: #f1f5f9; line-height: 1.5; margin-bottom: 1.5rem;">
                        Llevate tu pedido con <strong style="color: #34d399; font-size: 1.2rem;">ENVÍO GRATIS</strong> superando los <strong style="color: #38bdf8; font-size: 1.2rem;">$20.000</strong> en tu compra.
                    </p>
                    <button onclick="cerrarPromoWelcome()" style="background: linear-gradient(135deg, #059669, #10b981); color: white; width: 100%; padding: 0.95rem; border-radius: 14px; border: none; font-weight: 800; font-size: 1.05rem; cursor: pointer;">
                        🛍️ ¡Genial, empezar a comprar!
                    </button>
                </div>
            </div>

            <!-- MODAL CARRITO COMPACTO -->
            <div id="cartModal" class="modal" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background:#0f172a; border:1px solid #334155; border-radius:24px; padding:1.5rem; width:100%; max-width:420px; position:relative; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.9); max-height:85vh; overflow-y:auto;">
                    
                    <button type="button" onclick="toggleCartModal()" style="position:absolute; top:12px; right:16px; background:#ef4444; color:#fff; border:none; width:32px; height:32px; border-radius:50%; font-size:1.2rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Cerrar y volver">&times;</button>
                    
                    <h2 style="font-size:1.25rem; color:#38bdf8; margin-bottom:0.6rem; font-weight:800;">🛒 Tu Carrito</h2>
                    
                    <div id="promoEnvioProgress" style="background:#1e293b; border:1px solid #3b82f6; border-radius:10px; padding:0.4rem 0.6rem; margin-bottom:0.6rem; text-align:center; font-size:0.8rem; font-weight:bold;">
                        🚚 Envío gratis superando los $20.000
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
                                <option value="centro" data-costo="1500">Zona Centro / Cambá Cuá (+$1.500)</option>
                                <option value="barrios_cercanos" data-costo="2000">Barrios Cercanos / Aldana / Yapeyú (+$2.000)</option>
                                <option value="barrios_alejados" data-costo="2500">1000 Viviendas / Molina Punta / Laguna Seca (+$2.500)</option>
                            </select>
                        </div>

                        <div id="cartelEnvioGratis" style="display:none; background:#064e3b; border:1px solid #10b981; border-radius:8px; padding:0.6rem; text-align:center; margin-bottom:0.6rem;">
                            <span style="color:#a7f3d0; font-size:0.82rem; font-weight:bold;">🚚 Zona / Envío: <strong style="color:#fff;">🎉 ¡ENVÍO GRATIS APLICADO! ($0)</strong></span>
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
                            <h3 style="color:#34d399; font-size:1.2rem; font-weight:800;">Total: $<span id="cartTotalPrice">0</span></h3>
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
            <div id="modal-imagen-zoom" onclick="this.style.display='none'" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.9); justify-content:center; align-items:center; padding:1rem;">
                <span style="position:absolute; top:20px; right:30px; color:#fff; font-size:2.5rem; font-weight:bold; cursor:pointer;">&times;</span>
                <img id="img-ampliada" src="" alt="Zoom Producto" style="max-width:90%; max-height:85vh; object-fit:contain; border-radius:12px;">
            </div>

            <footer>
                <p>&copy; 2026 Polirubro Virtual — Todos los derechos reservados.</p>
            </footer>

            <script>
                let carrito = [];
                let seccionSeleccionada = '';
                let searchTimeout = null;

                function cerrarPromoWelcome() {
                    document.getElementById('promoWelcomeModal').style.display = 'none';
                }

                function normalizar(str) {
                    if (!str) return '';
                    return str.toString()
                        .toLowerCase()
                        .trim()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "");
                }

                function formatoPesos(num) {
                    return Number(num || 0).toLocaleString('es-AR');
                }

                function entrarASeccion(nombreCat) {
                    seccionSeleccionada = nombreCat;
                    document.getElementById('vistaSecciones').style.display = 'none';
                    document.getElementById('vistaProductos').style.display = 'block';
                    document.getElementById('tituloSeccionActual').innerText = '📂 Sección: ' + nombreCat;
                    document.getElementById('searchInput').value = '';
                    filtrarProductos();
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    fetch('/api/stats/seccion', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ seccion: nombreCat })
                    }).catch(() => {});
                }

                function mostrarMenuPrincipal() {
                    seccionSeleccionada = '';
                    document.getElementById('vistaSecciones').style.display = 'block';
                    document.getElementById('vistaProductos').style.display = 'none';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                        html += \`
                            <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.5rem 0.7rem; border-radius:6px; margin-bottom:0.3rem; border:1px solid #334155;">
                                <div>
                                    <strong style="color:#fff; font-size:0.88rem;">\${item.nombre}</strong><br>
                                    <small style="color:#38bdf8;">\$\${formatoPesos(item.precio)} x \${item.cantidad}</small>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.3rem;">
                                    <button onclick="cambiarCantidad(\${item.id}, -1)" style="background:#0f172a; color:#fff; border:1px solid #475569; width:22px; height:22px; border-radius:4px; font-weight:bold; cursor:pointer;">-</button>
                                    <span style="font-weight:bold; padding:0.2rem; font-size:0.9rem;">\${item.cantidad}</span>
                                    <button onclick="cambiarCantidad(\${item.id}, 1)" style="background:#0f172a; color:#fff; border:1px solid #475569; width:22px; height:22px; border-radius:4px; font-weight:bold; cursor:pointer;">+</button>
                                </div>
                            </div>
                        \`;
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
                        promoProgress.innerHTML = '🎉 ¡Felicitaciones! Tenés <strong>ENVÍO GRATIS</strong> en esta compra.';
                        
                        contenedorEnvio.style.display = 'none';
                        cartelEnvioGratis.style.display = 'block';
                    } else {
                        const falta = 20000 - subtotal;
                        promoProgress.style.background = '#1e293b';
                        promoProgress.style.borderColor = '#3b82f6';
                        promoProgress.style.color = '#38bdf8';
                        promoProgress.innerHTML = \`🚚 Agregá \$\${formatoPesos(falta)} más para tener <strong>ENVÍO GRATIS</strong>\`;

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
                    navigator.clipboard.writeText('POLIRUBRO.VIRTUAL.MP');
                    alert('¡Alias copiado!');
                }

                function compartirProducto(nombre, precio) {
                    const texto = \`¡Mirá este producto en Polirubro Virtual! 🛒\\n*\${nombre}* - \$\${formatoPesos(precio)}\\nPedilo acá: https://polirubro-virtual.onrender.com\`;
                    window.open(\`https://api.whatsapp.com/send?text=\${encodeURIComponent(texto)}\`, '_blank');
                }

                function toggleCartModal() {
                    const modal = document.getElementById('cartModal');
                    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
                }

                function cerrarOptionsModal() {
                    document.getElementById('optionsModal').style.display = 'none';
                }

                document.addEventListener("click", function(e) {
                    if (e.target.classList.contains("zoom-img")) {
                        const modal = document.getElementById("modal-imagen-zoom");
                        const imgAmpliada = document.getElementById("img-ampliada");
                        imgAmpliada.src = e.target.src;
                        modal.style.display = "flex";
                    }
                });

                function procesarPedido() {
                    if (carrito.length === 0) return;

                    const nombre = document.getElementById('clienteNombre').value.trim();
                    const direccion = document.getElementById('clienteDireccion').value.trim();
                    const telefono = document.getElementById('clienteTelefono').value.trim();

                    if (!nombre) {
                        alert('Por favor, ingresá tu Nombre.');
                        return;
                    }

                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    const ES_ENVIO_GRATIS = subtotal >= 20000;
                    
                    let costoEnvio = 0;
                    let detalleEnvioTexto = "Envío a Domicilio (¡ENVÍO GRATIS APLICADO!)";

                    if (!ES_ENVIO_GRATIS) {
                        const tipoEnvioSelect = document.getElementById('tipoEnvio');
                        if (tipoEnvioSelect) {
                            const opcionEnvio = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];
                            costoEnvio = Number(opcionEnvio.getAttribute('data-costo') || 0);
                            detalleEnvioTexto = opcionEnvio.text;
                        }
                    }

                    const metodoPago = document.getElementById('metodoPago').value;
                    let totalFinal = subtotal + costoEnvio;

                    let mensaje = \`¡Hola! Quiero confirmar mi pedido en *Polirubro Virtual*:\\n\\n\`;
                    mensaje += \`👤 *Cliente:* \${nombre}\\n\`;
                    if (direccion) mensaje += \`📍 *Dirección:* \${direccion}\\n\`;
                    if (telefono) mensaje += \`📞 *Contacto:* \${telefono}\\n\`;
                    mensaje += \`\\n🛒 *Detalle del Pedido:*\\n\`;

                    carrito.forEach(item => {
                        mensaje += \`- \${item.cantidad}x \${item.nombre} (\$\${formatoPesos(item.precio * item.cantidad)})\\n\`;
                    });

                    mensaje += \`\\n🚚 *Entrega:* \${detalleEnvioTexto}\`;
                    mensaje += \`\\n💳 *Pago:* \${metodoPago}\`;
                    mensaje += \`\\n💰 *Total a abonar:* \$\${formatoPesos(totalFinal)}\\n\\n¡Gracias!\`;

                    const numeroWhatsApp = "5493794655867";
                    const mensajeCodificado = encodeURIComponent(mensaje);
                    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

                    toggleCartModal();

                    if (esMovil) {
                        window.location.href = \`https://api.whatsapp.com/send?phone=\${numeroWhatsApp}&text=\${mensajeCodificado}\`;
                    } else {
                        const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=\${encodeURIComponent("https://wa.me/" + numeroWhatsApp + "?text=" + mensajeCodificado)}\`;
                        document.getElementById('qrImage').src = qrUrl;
                        document.getElementById('optionsModal').style.display = 'flex';
                    }
                }
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

// ==========================================
// 2. PANEL ADMINISTRADOR (CON ESTADÍSTICAS)
// ==========================================
app.get('/admin', (req, res) => {
    const productos = leerProductos();
    const categorias = leerCategorias();
    const stats = leerEstadisticas();
    const hoy = obtenerFechaHoy();

    const statsHoy = stats.porDia && stats.porDia[hoy] ? stats.porDia[hoy] : { total: 0, movil: 0, pc: 0, secciones: {}, busquedas: {} };

    const seccionesOrdenadas = Object.entries(stats.secciones || {})
        .sort((a, b) => b[1] - a[1]);

    const busquedasOrdenadas = Object.entries(stats.busquedas || {})
        .sort((a, b) => b[1] - a[1]);

    let filasSeccionesHTML = '';
    if (seccionesOrdenadas.length === 0) {
        filasSeccionesHTML = '<tr><td colspan="2" style="color:#94a3b8; font-size:0.85rem;">Aún no hay ingresos a secciones.</td></tr>';
    } else {
        for (let i = 0; i < seccionesOrdenadas.length; i++) {
            const sec = seccionesOrdenadas[i][0];
            const cant = seccionesOrdenadas[i][1];
            filasSeccionesHTML += '<tr><td style="color:#fff; font-weight:bold;">' + sec + '</td><td style="color:#34d399; font-weight:bold; text-align:right;">' + cant + '</td></tr>';
        }
    }

    let filasBusquedasHTML = '';
    if (busquedasOrdenadas.length === 0) {
        filasBusquedasHTML = '<tr><td colspan="2" style="color:#94a3b8; font-size:0.85rem;">Aún no hay búsquedas registradas.</td></tr>';
    } else {
        const limite = Math.min(busquedasOrdenadas.length, 10);
        for (let i = 0; i < limite; i++) {
            const term = busquedasOrdenadas[i][0];
            const cant = busquedasOrdenadas[i][1];
            filasBusquedasHTML += '<tr><td style="color:#fff; text-transform:capitalize;">' + term + '</td><td style="color:#38bdf8; font-weight:bold; text-align:right;">' + cant + '</td></tr>';
        }
    }

    let opcionesCatHTML = '';
    for (let i = 0; i < categorias.length; i++) {
        const cat = categorias[i];
        opcionesCatHTML += '<option value="' + cat.nombre + '">' + (cat.icono || '📦') + ' ' + cat.nombre + '</option>';
    }

    let listaProductosAdminHTML = '';
    if (productos.length === 0) {
        listaProductosAdminHTML = '<p style="color:#94a3b8;">No hay productos cargados.</p>';
    } else {
        for (let i = 0; i < productos.length; i++) {
            const prod = productos[i];
            const desc = prod.descripcion ? '<br><small style="color:#94a3b8;">' + prod.descripcion + '</small>' : '';
            const precioFormateado = formatearPrecio(prod.precio);
            const stockActual = prod.stock !== undefined ? prod.stock : 0;

            listaProductosAdminHTML += '<div class="admin-item-card" style="display:flex; flex-direction:column; gap:0.8rem; background:#0f172a; padding:1rem; border-radius:14px; border:1px solid #1e293b; margin-bottom:1rem;">' +
                '<div style="display:flex; align-items:center; gap:1rem; width:100%;">' +
                    '<img src="' + prod.imagen + '" alt="' + prod.nombre + '" class="admin-item-img" style="width:60px; height:60px; object-fit:cover; border-radius:10px;">' +
                    '<div class="admin-item-info" style="flex:1;">' +
                        '<strong style="color:#fff; font-size:1rem;">' + prod.nombre + '</strong>' +
                        '<div>' +
                            '<span class="badge-mini" style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:700;">' + prod.categoria + '</span>' +
                            '<strong style="color:#34d399;">\$' + precioFormateado + '</strong>' +
                        '</div>' +
                        desc +
                    '</div>' +
                    '<form action="/admin/eliminar/' + prod.id + '" method="POST" onsubmit="return confirm(\'¿Seguro que querés eliminar este producto?\');">' +
                        '<button type="submit" class="btn-delete" style="background:#ef4444; color:white; border:none; padding:0.5rem 0.8rem; border-radius:8px; cursor:pointer;" title="Eliminar Producto">🗑️</button>' +
                    '</form>' +
                '</div>' +
                '<form action="/admin/actualizar-stock/' + prod.id + '" method="POST" style="display:flex; align-items:center; justify-content:space-between; background:#1e293b; padding:0.6rem 0.8rem; border-radius:10px; border:1px solid #334155; width:100%;">' +
                    '<span style="font-size:0.85rem; color:#38bdf8; font-weight:bold;">📦 Modificar Stock:</span>' +
                    '<div style="display:flex; align-items:center; gap:0.5rem;">' +
                        '<input type="number" name="nuevoStock" value="' + stockActual + '" min="0" style="width:70px; padding:0.4rem; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #475569; text-align:center; font-weight:bold;">' +
                        '<button type="submit" style="background:#2563eb; color:#fff; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.8rem;">💾 Actualizar</button>' +
                    '</div>' +
                '</form>' +
            '</div>';
        }
    }

    let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Administrador | Polirubro Virtual</title>
            <link rel="stylesheet" href="/style.css">
            <style>
                .stats-grid-top {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .stat-box {
                    background: #1e293b;
                    border: 1px solid #334155;
                    border-radius: 18px;
                    padding: 1.2rem;
                    text-align: center;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                }
                .stat-box h3 {
                    color: #94a3b8;
                    font-size: 0.85rem;
                    margin-bottom: 0.4rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .stat-number {
                    color: #38bdf8;
                    font-size: 2.2rem;
                    font-weight: 900;
                }
                .stat-sub {
                    color: #34d399;
                    font-size: 0.8rem;
                    font-weight: 700;
                    margin-top: 0.3rem;
                }
                .table-stats {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 0.8rem;
                }
                .table-stats th, .table-stats td {
                    padding: 0.6rem 0.8rem;
                    text-align: left;
                    border-bottom: 1px solid #334155;
                    font-size: 0.88rem;
                }
                .table-stats th {
                    color: #38bdf8;
                    font-weight: 700;
                }
            </style>
        </head>
        <body class="admin-body">
            <header>
                <div class="header-content">
                    <h1>⚙️ Panel de Control</h1>
                    <p>Administrá Secciones, Productos y Revisá tus Estadísticas de Venta</p>
                </div>
                <div class="header-actions">
                    <a href="/" class="admin-link" target="_blank">🌐 Ver Tienda Pública</a>
                </div>
            </header>

            <main class="admin-container" style="max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem;">

                <!-- 📊 SECCIÓN DE ESTADÍSTICAS -->
                <section class="admin-card" style="background:#0f172a; border:2px solid #38bdf8; border-radius:24px; padding:1.8rem; margin-bottom:2rem; box-shadow:0 10px 30px rgba(56,189,248,0.15);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
                        <div>
                            <h2 style="color:#38bdf8; font-size:1.5rem; font-weight:900; margin:0;">📊 Métricas y Estadísticas de la Tienda</h2>
                            <small style="color:#94a3b8;">Datos registrados en tiempo real — Hoy: ${hoy}</small>
                        </div>
                        <form action="/admin/estadisticas/reiniciar" method="POST" onsubmit="return confirm('¿Seguro que querés reiniciar todas las estadísticas a cero?');">
                            <button type="submit" style="background:#ef4444; color:#fff; border:none; padding:0.55rem 1rem; border-radius:10px; font-weight:bold; cursor:pointer; font-size:0.82rem;">🔄 Reiniciar Estadísticas</button>
                        </form>
                    </div>

                    <div class="stats-grid-top">
                        <div class="stat-box">
                            <h3>👁️ Visitas Totales</h3>
                            <div class="stat-number">${stats.totalVisitas || 0}</div>
                            <div class="stat-sub">📅 Hoy: ${statsHoy.total || 0} visitas</div>
                        </div>
                        <div class="stat-box">
                            <h3>📱 Visitas desde Celular</h3>
                            <div class="stat-number" style="color:#a7f3d0;">${stats.visitasMovil || 0}</div>
                            <div class="stat-sub">📅 Hoy: ${statsHoy.movil || 0} celulares</div>
                        </div>
                        <div class="stat-box">
                            <h3>💻 Visitas desde PC</h3>
                            <div class="stat-number" style="color:#fde047;">${stats.visitasPC || 0}</div>
                            <div class="stat-sub">📅 Hoy: ${statsHoy.pc || 0} computadoras</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem;">
                        <div style="background:#1e293b; padding:1.2rem; border-radius:16px; border:1px solid #334155;">
                            <h4 style="color:#38bdf8; font-size:1rem; font-weight:800; margin-bottom:0.6rem;">📂 Secciones Más Entradas / Clics</h4>
                            <table class="table-stats">
                                <thead>
                                    <tr>
                                        <th>Sección</th>
                                        <th style="text-align:right;">Clics Totales</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filasSeccionesHTML}
                                </tbody>
                            </table>
                        </div>

                        <div style="background:#1e293b; padding:1.2rem; border-radius:16px; border:1px solid #334155;">
                            <h4 style="color:#38bdf8; font-size:1rem; font-weight:800; margin-bottom:0.6rem;">🔍 Términos Más Buscados</h4>
                            <table class="table-stats">
                                <thead>
                                    <tr>
                                        <th>Palabra o Producto</th>
                                        <th style="text-align:right;">Búsquedas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filasBusquedasHTML}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <div class="admin-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem; padding:0;">
                    <div class="admin-column">
                        <section class="admin-card">
                            <h2>📂 Crear Nueva Sección / Categoría</h2>
                            <form action="/admin/categoria/agregar" method="POST" class="admin-form">
                                <div class="form-group">
                                    <label>Nombre de la Sección:</label>
                                    <input type="text" name="nombreCat" class="custom-input" placeholder="Ej: Bazar, Ferretería, Cotillón" required>
                                </div>
                                <div class="form-group">
                                    <label>Ícono Emoji (ej: 🛋️, 🔧, 🎈):</label>
                                    <input type="text" name="iconoCat" class="custom-input" placeholder="🛋️" value="📦" required>
                                </div>
                                <button type="submit" class="btn-primary">✨ Guardar Sección</button>
                            </form>
                        </section>

                        <section class="admin-card">
                            <h2>➕ Cargar Nuevo Producto</h2>
                            <form action="/admin/agregar" method="POST" class="admin-form" id="productForm">
                                <input type="hidden" id="imagenBase64" name="imagenBase64">

                                <div class="form-group">
                                    <label>Nombre del Producto:</label>
                                    <input type="text" name="nombre" class="custom-input" required placeholder="Ej: Protector Solar x 200ml">
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label>Precio ($):</label>
                                        <input type="number" name="precio" class="custom-input" required placeholder="4000" step="1">
                                    </div>
                                    <div class="form-group">
                                        <label>Stock Disponible:</label>
                                        <input type="number" name="stock" class="custom-input" required placeholder="10" value="10" min="0">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label>Sección / Categoría:</label>
                                    <select name="categoria" class="custom-input" required>
                                        ${opcionesCatHTML}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label>Descripción Breve:</label>
                                    <textarea name="descripcion" class="custom-input" rows="2" placeholder="Ej: Excelente calidad."></textarea>
                                </div>

                                <div class="form-group image-upload-box">
                                    <label>🖼️ Foto del Producto:</label>
                                    <input type="file" id="fileInput" accept="image/*" onchange="convertirImagen()">
                                    <small>O usar Enlace URL:</small>
                                    <input type="url" id="urlInput" name="imagenUrl" class="custom-input" placeholder="https://ejemplo.com/foto.jpg">

                                    <div id="previewContainer" style="display:none; margin-top:0.8rem; text-align:center;">
                                        <img id="imgPreview" src="" alt="Vista previa" class="preview-img">
                                    </div>
                                </div>

                                <button type="submit" class="btn-success">💾 Guardar Producto</button>
                            </form>
                        </section>
                    </div>

                    <div class="admin-column">
                        <section class="admin-card">
                            <h2>📦 Productos en Stock (${productos.length})</h2>
                            <div class="admin-product-list">
                                ${listaProductosAdminHTML}
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            <script>
                function convertirImagen() {
                    const fileInput = document.getElementById('fileInput');
                    const file = fileInput.files[0];
                    const preview = document.getElementById('imgPreview');
                    const previewContainer = document.getElementById('previewContainer');
                    const hiddenInput = document.getElementById('imagenBase64');

                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            hiddenInput.value = e.target.result;
                            preview.src = e.target.result;
                            previewContainer.style.display = 'block';
                        };
                        reader.readAsDataURL(file);
                    }
                }

                document.getElementById('urlInput').addEventListener('input', function() {
                    const url = this.value.trim();
                    const preview = document.getElementById('imgPreview');
                    const previewContainer = document.getElementById('previewContainer');
                    const hiddenInput = document.getElementById('imagenBase64');

                    if (url) {
                        hiddenInput.value = '';
                        preview.src = url;
                        previewContainer.style.display = 'block';
                    }
                });
            </script>
        </body>
        </html>
    `;
    res.send(html);
});

app.post('/admin/estadisticas/reiniciar', (req, res) => {
    guardarEstadisticas({
        totalVisitas: 0,
        visitasMovil: 0,
        visitasPC: 0,
        secciones: {},
        busquedas: {},
        porDia: {}
    });
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

app.post('/admin/categoria/agregar', (req, res) => {
    const { nombreCat, iconoCat } = req.body;
    let categorias = leerCategorias();

    if (nombreCat && nombreCat.trim() !== '') {
        const nuevoId = categorias.length > 0 ? Math.max(...categorias.map(c => c.id)) + 1 : 1;
        categorias.push({
            id: nuevoId,
            nombre: nombreCat.trim(),
            icono: iconoCat ? iconoCat.trim() : '📦'
        });
        guardarCategorias(categorias);
    }
    res.redirect('/admin');
});

app.post('/admin/agregar', (req, res) => {
    const { nombre, precio, stock, categoria, descripcion, imagenBase64, imagenUrl } = req.body;
    let productos = leerProductos();

    const nuevoId = productos.length > 0 ? Math.max(...productos.map(p => p.id)) + 1 : 1;
    
    const imagenFinal = imagenBase64 && imagenBase64.trim() !== '' 
        ? imagenBase64 
        : (imagenUrl && imagenUrl.trim() !== '' ? imagenUrl.trim() : 'https://via.placeholder.com/300x200?text=Sin+Imagen');

    productos.push({
        id: nuevoId,
        nombre: nombre.trim(),
        precio: Math.round(Number(precio) || 0),
        stock: Math.max(0, parseInt(stock) || 0),
        categoria: categoria || 'General',
        descripcion: descripcion ? descripcion.trim() : '',
        imagen: imagenFinal
    });

    guardarProductos(productos);
    res.redirect('/admin');
});

app.post('/admin/eliminar/:id', (req, res) => {
    const idAEliminar = Number(req.params.id);
    let productos = leerProductos();

    productos = productos.filter(p => p.id !== idAEliminar);
    guardarProductos(productos);
    res.redirect('/admin');
});

app.listen(PORT, () => {
    console.log(`🚀 Polirubro Virtual funcionando en http://localhost:${PORT}`);
    console.log(`⚙️ Panel Administrador en http://localhost:${PORT}/admin`);
});
