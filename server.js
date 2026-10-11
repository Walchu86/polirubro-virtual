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
    { id: 1, nombre: 'Estética', icono: '💄' },
    { id: 2, nombre: 'Electrónica', icono: '🎧' },
    { id: 3, nombre: 'Zapatería', icono: '👟' },
    { id: 4, nombre: 'Accesorios', icono: '📱' }
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

const etiquetasValidas = ['NINGUNA', 'NUEVO', 'PROMO', 'DESTACADO', 'ÚLTIMOS STOCK'];

// ==========================================
// 1. TIENDA PÚBLICA (VISTA CLIENTE)
// ==========================================
app.get('/', (req, res) => {
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
                <!-- BARRA DE ICONOS SUPERIOR SIEMPRE VISIBLE PARA CAMBIAR DE SECCIÓN -->
                <section class="top-secciones-bar" style="background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 1rem; margin-bottom: 2rem;">
                    <div style="display: flex; gap: 0.8rem; overflow-x: auto; padding-bottom: 0.2rem; justify-content: center;">
    `;

    categorias.forEach(cat => {
        html += `
            <button onclick="entrarASeccion('${cat.nombre}')" class="btn-seccion-mini" style="background: #1e293b; color: #fff; border: 1px solid #334155; padding: 0.6rem 1rem; border-radius: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; transition: 0.2s;">
                <span>${cat.icono || '📦'}</span> ${cat.nombre}
            </button>
        `;
    });

    html += `
                    </div>
                </section>

                <!-- VISTA 1: MENÚ CENTRAL DE SECCIONES (SE VE AL ENTRAR) -->
                <section id="vistaSecciones" class="secciones-container">
                    <h2 style="text-align: center; font-size: 1.6rem; color: #38bdf8; margin-bottom: 1.5rem;">📂 Seleccioná una Sección</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem; justify-content: center; max-width: 800px; margin: 0 auto;">
    `;

    categorias.forEach(cat => {
        html += `
            <div onclick="entrarASeccion('${cat.nombre}')" style="background: #111827; border: 2px solid #1f2937; border-radius: 20px; padding: 2rem 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.25s; text-align: center;">
                <span style="font-size: 3.5rem; margin-bottom: 0.8rem;">${cat.icono || '📦'}</span>
                <strong style="font-size: 1.1rem; color: #ffffff;">${cat.nombre}</strong>
            </div>
        `;
    });

    html += `
                    </div>
                </section>

                <!-- VISTA 2: CATÁLOGO DE PRODUCTOS (OCULTO AL INICIO) -->
                <section id="vistaProductos" class="catalogo" style="display: none;">
                    <div style="margin-bottom: 1.5rem;">
                        <input type="text" id="searchInput" oninput="filtrarProductos()" placeholder="🔍 Buscar producto en esta sección..." style="width: 100%; padding: 0.85rem 1.2rem; border-radius: 12px; background: #111827; color: white; border: 1px solid #334155; font-size: 1rem;">
                    </div>

                    <h2 id="tituloSeccionActual" style="font-size: 1.4rem; color: #38bdf8; margin-bottom: 1.2rem; border-bottom: 1px solid #1f2937; padding-bottom: 0.5rem;"></h2>
                    <div class="product-grid" id="productGrid">
    `;

    if (productos.length === 0) {
        html += `<p class="no-products">No hay productos cargados en este momento.</p>`;
    } else {
        productos.forEach(prod => {
            const imagenUrl = prod.imagen || 'https://via.placeholder.com/300x200?text=Sin+Imagen';
            const descripcionTexto = prod.descripcion ? `<p class="description">${prod.descripcion}</p>` : '';
            const precioFormateado = formatearPrecio(prod.precio);
            const stockActual = prod.stock !== undefined ? Number(prod.stock) : 10;
            const estaAgotado = stockActual <= 0;
            
            let etiquetaTexto = prod.etiqueta && prod.etiqueta !== 'NINGUNA' ? prod.etiqueta : '';
            if (estaAgotado) etiquetaTexto = 'AGOTADO';

            const badgeEtiqueta = etiquetaTexto 
                ? `<span class="badge ${estaAgotado ? 'badge-agotado' : ''}">${etiquetaTexto}</span>` 
                : `<span class="badge">${prod.categoria}</span>`;

            const botonAgregar = estaAgotado 
                ? `<button class="btn-agregar btn-disabled" disabled>🚫 Sin Stock</button>`
                : `<button class="btn-agregar" onclick="agregarAlCarrito(${prod.id}, '${prod.nombre.replace(/'/g, "\\'")}', ${prod.precio}, ${stockActual})">➕ Agregar al Carrito</button>`;

            html += `
              <div class="product-card" data-categoria="${prod.categoria || ''}" data-nombre="${prod.nombre || ''}" data-descripcion="${prod.descripcion || ''}">
                  <div class="product-image-container">
                      <img src="${imagenUrl}" alt="${prod.nombre}" class="zoom-img" onerror="this.src='https://via.placeholder.com/300x200?text=Error+Imagen'">
                      ${badgeEtiqueta}
                      <button class="btn-share" onclick="compartirProducto('${prod.nombre.replace(/'/g, "\\'")}', '${prod.precio}')" title="Compartir por WhatsApp">📲</button>
                  </div>
                  <div class="product-info">
                      <h3>${prod.nombre}</h3>
                      ${descripcionTexto}
                      <div class="stock-info">
                          <span class="price">$${precioFormateado}</span>
                          <small class="stock-count">${estaAgotado ? 'Sin disponibilidad' : 'Stock: ' + stockActual}</small>
                      </div>
                      ${botonAgregar}
                  </div>
              </div>
            `;
        });
    }

    html += `
                    </div>
                </section>
            </main>

            <!-- BOTÓN FLOTANTE WHATSAPP -->
            <a href="https://wa.me/5493794655867?text=¡Hola!%20Tengo%20una%20consulta%20sobre%20Polirubro%20Virtual" class="whatsapp-float" target="_blank">
                💬 <span>¿Tenés dudas? Hablá con nosotros</span>
            </a>

            <!-- MODAL CARRITO -->
            <div id="cartModal" class="modal" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background:#0f172a; border:1px solid #334155; border-radius:20px; padding:1.8rem; width:100%; max-width:480px; position:relative; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.9);">
                    
                    <button type="button" onclick="toggleCartModal()" style="position:absolute; top:15px; right:18px; background:none; border:none; color:#94a3b8; font-size:1.8rem; cursor:pointer; line-height:1;">&times;</button>
                    
                    <h2 style="font-size:1.35rem; color:#38bdf8; margin-bottom:1rem; font-weight:bold;">🛒 Tu Carrito de Compras</h2>
                    
                    <div id="cartItemsList" style="max-height:160px; overflow-y:auto; margin-bottom:1rem; padding-right:0.3rem;">
                        <p style="color:#94a3b8; text-align:center;">El carrito está vacío.</p>
                    </div>

                    <div id="cartOptions" style="display:none;">
                        <div style="background:#1e293b; padding:1rem; border-radius:12px; border:1px solid #334155; margin-bottom:1rem;">
                            <h4 style="font-size:0.9rem; color:#38bdf8; margin-bottom:0.6rem;">📋 Tus Datos para la Entrega:</h4>
                            <input type="text" id="clienteNombre" placeholder="Tu Nombre y Apellido *" style="width:100%; padding:0.65rem 0.8rem; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #475569; margin-bottom:0.5rem; outline:none;" required>
                            <input type="text" id="clienteDireccion" placeholder="Dirección de Entrega / Barrio *" style="width:100%; padding:0.65rem 0.8rem; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #475569; margin-bottom:0.5rem; outline:none;">
                            <input type="tel" id="clienteTelefono" placeholder="Teléfono de contacto" style="width:100%; padding:0.65rem 0.8rem; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #475569; outline:none;">
                        </div>

                        <div style="margin-bottom:0.8rem;">
                            <label style="display:block; font-size:0.85rem; color:#cbd5e1; margin-bottom:0.3rem;">🚚 Zona / Forma de Entrega:</label>
                            <select id="tipoEnvio" onchange="actualizarTotal()" style="width:100%; padding:0.65rem 0.8rem; border-radius:8px; background:#1e293b; color:#fff; border:1px solid #475569; outline:none; cursor:pointer;">
                                <option value="retiro" data-costo="0">Retirar por el local (Gratis)</option>
                                <option value="centro" data-costo="1500">Zona Centro / Cambá Cuá (+$1.500)</option>
                                <option value="barrios_cercanos" data-costo="2000">Barrios Cercanos / Aldana / Yapeyú (+$2.000)</option>
                                <option value="barrios_alejados" data-costo="2500">1000 Viviendas / Molina Punta / Laguna Seca (+$2.500)</option>
                            </select>
                        </div>

                        <div style="margin-bottom:0.8rem;">
                            <label style="display:block; font-size:0.85rem; color:#cbd5e1; margin-bottom:0.3rem;">💳 Método de Pago:</label>
                            <select id="metodoPago" onchange="mostrarDatosTransferencia()" style="width:100%; padding:0.65rem 0.8rem; border-radius:8px; background:#1e293b; color:#fff; border:1px solid #475569; outline:none; cursor:pointer;">
                                <option value="Efectivo">Efectivo al recibir</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria (Alias/CBU)</option>
                                <option value="Personal Pay">Personal Pay</option>
                                <option value="Ualá">Ualá</option>
                            </select>
                        </div>

                        <div id="transferInfo" style="display:none; background:#064e3b; border:1px solid #059669; padding:0.6rem 0.8rem; border-radius:8px; margin:0.6rem 0; justify-content:space-between; align-items:center;">
                            <small style="color:#a7f3d0;">🏦 <strong>Alias:</strong> POLIRUBRO.VIRTUAL.MP</small>
                            <button type="button" onclick="copiarAlias()" style="background:#10b981; color:#fff; border:none; padding:0.3rem 0.6rem; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:bold;">📋 Copiar</button>
                        </div>

                        <div style="text-align:right; margin:1rem 0 0.8rem 0;">
                            <h3 style="color:#34d399; font-size:1.3rem;">Total: $<span id="cartTotalPrice">0</span></h3>
                        </div>

                        <button onclick="procesarPedido()" style="background:linear-gradient(135deg, #059669, #10b981); color:white; width:100%; padding:0.85rem; border-radius:10px; border:none; font-weight:bold; font-size:1rem; cursor:pointer; box-shadow:0 4px 12px rgba(16, 185, 129, 0.3);">
                            📲 Confirmar y Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL QR PC -->
            <div id="optionsModal" class="modal" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.85); justify-content:center; align-items:center; padding:1rem;">
                <div style="background:#0f172a; border:1px solid #334155; border-radius:20px; padding:2rem; width:100%; max-width:420px; text-align:center; position:relative; color:#fff;">
                    <button type="button" onclick="cerrarOptionsModal()" style="position:absolute; top:15px; right:18px; background:none; border:none; color:#94a3b8; font-size:1.8rem; cursor:pointer;">&times;</button>
                    <h2 style="font-size:1.3rem; color:#38bdf8; margin-bottom:0.5rem;">📲 Escaneá tu Pedido</h2>
                    <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:1rem;">Apuntá con tu celular para enviar el pedido por WhatsApp:</p>

                    <div style="background:#1e293b; padding:1rem; border-radius:16px; border:1px solid #334155; display:inline-block;">
                        <img id="qrImage" src="" alt="Código QR Pedido" style="width:200px; height:200px; border-radius:10px; border:2px solid #38bdf8;">
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

                function normalizar(str) {
                    if (!str) return '';
                    return str.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
                            tarjeta.style.display = 'flex';
                        } else {
                            tarjeta.style.display = 'none';
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

                            <div class="form-row">
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
                                    <label>Etiqueta Promocional:</label>
                                    <select name="etiqueta" class="custom-input">
    `;

    etiquetasValidas.forEach(et => {
        html += `<option value="${et}">${et}</option>`;
    });

    html += `
                                    </select>
                                </div>
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
            const stockActual = prod.stock !== undefined ? prod.stock : 10;
            const et = prod.etiqueta && prod.etiqueta !== 'NINGUNA' ? ` | Etiqueta: ${prod.etiqueta}` : '';

            html += `
                <div class="admin-item-card">
                    <img src="${prod.imagen}" alt="${prod.nombre}" class="admin-item-img">
                    <div class="admin-item-info">
                        <strong>${prod.nombre}</strong>
                        <div>
                            <span class="badge-mini">${prod.categoria}</span>
                            <strong style="color:#34d399;">$${precioFormateado}</strong>
                        </div>
                        <small style="color:#38bdf8;">Stock: ${stockActual} u. ${et}</small>
                        ${desc}
                    </div>
                    <form action="/admin/eliminar/${prod.id}" method="POST" onsubmit="return confirm('¿Seguro que querés eliminar este producto?');">
                        <button type="submit" class="btn-delete">🗑️</button>
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
    const { nombre, precio, stock, etiqueta, categoria, descripcion, imagenBase64, imagenUrl } = req.body;
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
        etiqueta: etiqueta || 'NINGUNA',
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
