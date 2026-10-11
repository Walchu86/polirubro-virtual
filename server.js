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

function formatearPrecio(monto) {
    return Number(monto || 0).toLocaleString('es-AR');
}

// ==========================================
// 1. TIENDA PÚBLICA (DISEÑO MÓVIL AMIGABLE)
// ==========================================
app.get('/', (req, res) => {
    const productos = leerProductos();
    const categorias = leerCategorias();
    const userAgent = req.headers['user-agent'] || '';
    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Polirubro Virtual | Tu Tienda Online</title>
            <link rel="stylesheet" href="/style.css">
    `;

    if (esMovil) {
        html += `
            <style>
                body { background-color: #0b0f19 !important; padding: 0 !important; margin: 0 !important; }
                header { padding: 1rem !important; flex-direction: column !important; text-align: center !important; gap: 0.8rem !important; }
                header h1 { font-size: 1.6rem !important; }
                header p { font-size: 0.85rem !important; }
                .header-actions { width: 100% !important; display: flex !important; justify-content: center !important; }
                button.cart-btn { width: 100% !important; padding: 0.8rem !important; font-size: 1rem !important; border-radius: 14px !important; }
                
                main { padding: 0.8rem !important; margin: 0.5rem auto !important; width: 100% !important; }
                
                /* GRILLA DE CATEGORÍAS EN INICIO */
                .secciones-container div {
                    display: grid !important;
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 1rem !important;
                }
                .card-seccion-glow {
                    padding: 1.5rem 0.8rem !important;
                    border-radius: 18px !important;
                }
                .card-seccion-glow span {
                    font-size: 3rem !important;
                }
                .card-seccion-glow strong {
                    font-size: 1rem !important;
                }

                /* PRODUCTOS EN UNA COLUMNA CÓMODA */
                .product-grid {
                    display: grid !important;
                    grid-template-columns: 1fr !important;
                    gap: 1.2rem !important;
                }
                .product-card {
                    border-radius: 16px !important;
                }
                .product-card img {
                    height: 220px !important;
                }
                
                .whatsapp-float {
                    bottom: 15px !important;
                    right: 15px !important;
                    padding: 0.6rem 1rem !important;
                    font-size: 0.8rem !important;
                }
            </style>
        `;
    }

    html += `
        </head>
        <body>
            <header>
                <div class="header-content">
                    <h1>🏪 Polirubro Virtual</h1>
                    <p>Elegí una sección para explorar los productos</p>
                </div>
                <div class="header-actions">
                    <button class="cart-btn" onclick="toggleCartModal()">
                        🛒 Carrito (<span id="cartCount">0</span>)
                    </button>
                </div>
            </header>

            <main>
                <!-- VISTA 1: MENÚ CENTRAL DE SECCIONES -->
                <section id="vistaSecciones" class="secciones-container">
                    <h2 style="text-align: center; font-size: 1.6rem; color: #38bdf8; margin-bottom: 1.5rem; font-weight: 900;">✨ Explorar Secciones</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1.5rem; justify-content: center; max-width: 900px; margin: 0 auto;">
    `;

    categorias.forEach(cat => {
        const bgGlow = cat.color || 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
        html += `
            <div onclick="entrarASeccion('${cat.nombre.replace(/'/g, "\\'")}')" class="card-seccion-glow" style="background: #111827; border: 2px solid #334155; border-radius: 24px; padding: 2.2rem 1.2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; text-align: center; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: ${bgGlow};"></div>
                <span style="font-size: 4rem; margin-bottom: 1rem;">${cat.icono || '📦'}</span>
                <strong style="font-size: 1.2rem; color: #ffffff; font-weight: 800;">${cat.nombre}</strong>
                <span style="font-size: 0.8rem; color: #38bdf8; margin-top: 0.5rem; font-weight: 600;">Ver productos ➔</span>
            </div>
        `;
    });

    html += `
                    </div>
                </section>

                <!-- VISTA 2: CATÁLOGO DE PRODUCTOS -->
                <section id="vistaProductos" class="catalogo" style="display: none;">
                    
                    <!-- BOTÓN GRANDE PARA VOLVER AL MENÚ PRINCIPAL DESDE EL CELU -->
                    <div style="margin-bottom: 1rem;">
                        <button onclick="mostrarMenuPrincipal()" style="width: 100%; background: linear-gradient(135deg, #334155, #1e293b); color: #38bdf8; border: 2px solid #38bdf8; padding: 0.8rem; border-radius: 14px; font-weight: 800; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2);">
                            🏠 Volver a Elegir Sección
                        </button>
                    </div>

                    <!-- SELECTOR DESPLEGABLE RÁPIDO DE CATEGORÍAS -->
                    <div style="margin-bottom: 1.2rem;">
                        <select id="selectCategoriaMovil" onchange="cambiarSeccionDesdeSelect(this.value)" style="width: 100%; padding: 0.9rem 1rem; border-radius: 12px; background: #1e293b; color: white; border: 2px solid #3b82f6; font-size: 1rem; font-weight: bold; outline: none; cursor: pointer;">
                            <option value="">📂 Cambiar de sección al instante...</option>
    `;

    categorias.forEach(cat => {
        html += `<option value="${cat.nombre}">${cat.icono || '📦'} ${cat.nombre}</option>`;
    });

    html += `
                        </select>
                    </div>

                    <div style="margin-bottom: 1.2rem;">
                        <input type="text" id="searchInput" oninput="filtrarProductos()" placeholder="🔍 Buscar producto..." style="width: 100%; padding: 0.9rem 1.2rem; border-radius: 12px; background: #111827; color: white; border: 1px solid #334155; font-size: 1rem; outline: none;">
                    </div>

                    <h2 id="tituloSeccionActual" style="font-size: 1.4rem; color: #38bdf8; margin-bottom: 1.2rem; border-bottom: 2px solid #1e293b; padding-bottom: 0.5rem; font-weight: 800;"></h2>
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

            <div id="cartModal" class="modal" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background:#0f172a; border:1px solid #334155; border-radius:24px; padding:1.8rem; width:100%; max-width:480px; position:relative; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.9);">
                    <button type="button" onclick="toggleCartModal()" style="position:absolute; top:18px; right:20px; background:none; border:none; color:#94a3b8; font-size:1.8rem; cursor:pointer; line-height:1;">&times;</button>
                    <h2 style="font-size:1.4rem; color:#38bdf8; margin-bottom:1rem; font-weight:800;">🛒 Tu Carrito de Compras</h2>
                    
                    <div id="cartItemsList" style="max-height:180px; overflow-y:auto; margin-bottom:1rem; padding-right:0.3rem;">
                        <p style="color:#94a3b8; text-align:center;">El carrito está vacío.</p>
                    </div>

                    <div id="cartOptions" style="display:none;">
                        <div style="background:#1e293b; padding:1rem; border-radius:14px; border:1px solid #334155; margin-bottom:1rem;">
                            <h4 style="font-size:0.92rem; color:#38bdf8; margin-bottom:0.6rem; font-weight:700;">📋 Tus Datos para la Entrega:</h4>
                            <input type="text" id="clienteNombre" placeholder="Tu Nombre y Apellido *" style="width:100%; padding:0.7rem 0.9rem; border-radius:10px; background:#0f172a; color:#fff; border:1px solid #475569; margin-bottom:0.6rem; outline:none;" required>
                            <input type="text" id="clienteDireccion" placeholder="Dirección de Entrega / Barrio *" style="width:100%; padding:0.7rem 0.9rem; border-radius:10px; background:#0f172a; color:#fff; border:1px solid #475569; margin-bottom:0.6rem; outline:none;">
                            <input type="tel" id="clienteTelefono" placeholder="Teléfono de contacto" style="width:100%; padding:0.7rem 0.9rem; border-radius:10px; background:#0f172a; color:#fff; border:1px solid #475569; outline:none;">
                        </div>

                        <div style="margin-bottom:0.8rem;">
                            <label style="display:block; font-size:0.88rem; color:#cbd5e1; margin-bottom:0.4rem; font-weight:600;">🚚 Zona / Forma de Entrega:</label>
                            <select id="tipoEnvio" onchange="actualizarTotal()" style="width:100%; padding:0.7rem 0.9rem; border-radius:10px; background:#1e293b; color:#fff; border:1px solid #475569; outline:none; cursor:pointer;">
                                <option value="retiro" data-costo="0">Retirar por el local (Gratis)</option>
                                <option value="centro" data-costo="1500">Zona Centro / Cambá Cuá (+$1.500)</option>
                                <option value="barrios_cercanos" data-costo="2000">Barrios Cercanos / Aldana / Yapeyú (+$2.000)</option>
                                <option value="barrios_alejados" data-costo="2500">1000 Viviendas / Molina Punta / Laguna Seca (+$2.500)</option>
                            </select>
                        </div>

                        <div style="margin-bottom:0.8rem;">
                            <label style="display:block; font-size:0.88rem; color:#cbd5e1; margin-bottom:0.4rem; font-weight:600;">💳 Método de Pago:</label>
                            <select id="metodoPago" onchange="mostrarDatosTransferencia()" style="width:100%; padding:0.7rem 0.9rem; border-radius:10px; background:#1e293b; color:#fff; border:1px solid #475569; outline:none; cursor:pointer;">
                                <option value="Efectivo">Efectivo al recibir</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria (Alias/CBU)</option>
                                <option value="Personal Pay">Personal Pay</option>
                                <option value="Ualá">Ualá</option>
                            </select>
                        </div>

                        <div id="transferInfo" style="display:none; background:#064e3b; border:1px solid #059669; padding:0.7rem 0.9rem; border-radius:10px; margin:0.8rem 0; justify-content:space-between; align-items:center;">
                            <small style="color:#a7f3d0;">🏦 <strong>Alias:</strong> POLIRUBRO.VIRTUAL.MP</small>
                            <button type="button" onclick="copiarAlias()" style="background:#10b981; color:#fff; border:none; padding:0.4rem 0.8rem; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:bold;">📋 Copiar</button>
                        </div>

                        <div style="text-align:right; margin:1.2rem 0 0.8rem 0;">
                            <h3 style="color:#34d399; font-size:1.4rem; font-weight:800;">Total: $<span id="cartTotalPrice">0</span></h3>
                        </div>

                        <button onclick="procesarPedido()" style="background:linear-gradient(135deg, #059669, #10b981); color:white; width:100%; padding:0.9rem; border-radius:12px; border:none; font-weight:bold; font-size:1rem; cursor:pointer;">
                            📲 Confirmar y Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>

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
                    
                    const selectMovil = document.getElementById('selectCategoriaMovil');
                    if (selectMovil) selectMovil.value = nombreCat;

                    filtrarProductos();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }

                function cambiarSeccionDesdeSelect(nombreCat) {
                    if (!nombreCat) return;
                    entrarASeccion(nombreCat);
                }

                function mostrarMenuPrincipal() {
                    seccionSeleccionada = '';
                    document.getElementById('vistaSecciones').style.display = 'block';
                    document.getElementById('vistaProductos').style.display = 'none';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                            <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:0.7rem 0.9rem; border-radius:10px; margin-bottom:0.5rem; border:1px solid #334155;">
                                <div>
                                    <strong style="color:#fff; font-size:0.95rem;">\${item.nombre}</strong><br>
                                    <small style="color:#38bdf8;">\$\${formatoPesos(item.precio)} x \${item.cantidad}</small>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                    <button onclick="cambiarCantidad(\${item.id}, -1)" style="background:#0f172a; color:#fff; border:1px solid #475569; width:26px; height:26px; border-radius:6px; font-weight:bold; cursor:pointer;">-</button>
                                    <span style="font-weight:bold; padding:0 0.3rem;">\${item.cantidad}</span>
                                    <button onclick="cambiarCantidad(\${item.id}, 1)" style="background:#0f172a; color:#fff; border:1px solid #475569; width:26px; height:26px; border-radius:6px; font-weight:bold; cursor:pointer;">+</button>
                                </div>
                            </div>
                        \`;
                    });
                    cartItemsList.innerHTML = html;
                    actualizarTotal();
                }

                function actualizarTotal() {
                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    const tipoEnvioSelect = document.getElementById('tipoEnvio');
                    const opcionSeleccionada = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];
                    const costoEnvio = Number(opcionSeleccionada.getAttribute('data-costo') || 0);

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

                    const tipoEnvioSelect = document.getElementById('tipoEnvio');
                    const opcionEnvio = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];
                    const costoEnvio = Number(opcionEnvio.getAttribute('data-costo') || 0);
                    const metodoPago = document.getElementById('metodoPago').value;

                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    let totalFinal = subtotal + costoEnvio;

                    let mensaje = \`¡Hola! Quiero confirmar mi pedido en *Polirubro Virtual*:\\n\\n\`;
                    mensaje += \`👤 *Cliente:* \${nombre}\\n\`;
                    if (direccion) mensaje += \`📍 *Dirección:* \${direccion}\\n\`;
                    if (telefono) mensaje += \`📞 *Contacto:* \${telefono}\\n\`;
                    mensaje += \`\\n🛒 *Detalle del Pedido:*\\n\`;

                    carrito.forEach(item => {
                        mensaje += \`- \${item.cantidad}x \${item.nombre} (\$\${formatoPesos(item.precio * item.cantidad)})\\n\`;
                    });

                    mensaje += \`\\n🚚 *Entrega:* \${opcionEnvio.text}\`;
                    mensaje += \`\\n💳 *Pago:* \${metodoPago}\`;
                    mensaje += \`\\n💰 *Total a abonar:* \$\${formatoPesos(totalFinal)}\\n\\n¡Gracias!\`;

                    const numeroWhatsApp = "5493794655867";
                    const mensajeCodificado = encodeURIComponent(mensaje);
                    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                    if (esMovil) {
                        window.open(\`https://api.whatsapp.com/send?phone=\${numeroWhatsApp}&text=\${mensajeCodificado}\`, '_blank');
                    } else {
                        const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=\${encodeURIComponent("https://wa.me/" + numeroWhatsApp + "?text=" + mensajeCodificado)}\`;
                        document.getElementById('qrImage').src = qrUrl;
                        toggleCartModal();
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
// 2. PANEL ADMINISTRADOR
// ==========================================
app.get('/admin', (req, res) => {
    const productos = leerProductos();
    const categorias = leerCategorias();

    let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Panel Administrador | Polirubro Virtual</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body class="admin-body">
            <header>
                <div class="header-content">
                    <h1>⚙️ Panel de Control</h1>
                    <p>Administrá Secciones, Productos y Stock de tu Tienda</p>
                </div>
                <div class="header-actions">
                    <a href="/" class="admin-link" target="_blank">🌐 Ver Tienda Pública</a>
                </div>
            </header>

            <main class="admin-container">
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
    `;

    categorias.forEach(cat => {
        html += `<option value="${cat.nombre}">${cat.icono || '📦'} ${cat.nombre}</option>`;
    });

    html += `
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
    `;

    if (productos.length === 0) {
        html += `<p style="color:#94a3b8;">No hay productos cargados.</p>`;
    } else {
        productos.forEach(prod => {
            const desc = prod.descripcion ? `<br><small style="color:#94a3b8;">${prod.descripcion}</small>` : '';
            const precioFormateado = formatearPrecio(prod.precio);
            const stockActual = prod.stock !== undefined ? prod.stock : 0;

            html += `
                <div class="admin-item-card" style="display:flex; flex-direction:column; gap:0.8rem; background:#0f172a; padding:1rem; border-radius:14px; border:1px solid #1e293b; margin-bottom:1rem;">
                    <div style="display:flex; align-items:center; gap:1rem; width:100%;">
                        <img src="${prod.imagen}" alt="${prod.nombre}" class="admin-item-img" style="width:60px; height:60px; object-fit:cover; border-radius:10px;">
                        <div class="admin-item-info" style="flex:1;">
                            <strong style="color:#fff; font-size:1rem;">${prod.nombre}</strong>
                            <div>
                                <span class="badge-mini" style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:0.2rem 0.6rem; border-radius:12px; font-size:0.75rem; font-weight:700;">${prod.categoria}</span>
                                <strong style="color:#34d399;">$${precioFormateado}</strong>
                            </div>
                            ${desc}
                        </div>
                        <form action="/admin/eliminar/${prod.id}" method="POST" onsubmit="return confirm('¿Seguro que querés eliminar este producto?');">
                            <button type="submit" class="btn-delete" style="background:#ef4444; color:white; border:none; padding:0.5rem 0.8rem; border-radius:8px; cursor:pointer;" title="Eliminar Producto">🗑️</button>
                        </form>
                    </div>

                    <form action="/admin/actualizar-stock/${prod.id}" method="POST" style="display:flex; align-items:center; justify-content:space-between; background:#1e293b; padding:0.6rem 0.8rem; border-radius:10px; border:1px solid #334155; width:100%;">
                        <span style="font-size:0.85rem; color:#38bdf8; font-weight:bold;">📦 Modificar Stock:</span>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <input type="number" name="nuevoStock" value="${stockActual}" min="0" style="width:70px; padding:0.4rem; border-radius:6px; background:#0f172a; color:#fff; border:1px solid #475569; text-align:center; font-weight:bold;">
                            <button type="submit" style="background:#2563eb; color:#fff; border:none; padding:0.4rem 0.8rem; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.8rem;">💾 Actualizar</button>
                        </div>
                    </form>
                </div>
            `;
        });
    }

    html += `
                        </div>
                    </section>
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
