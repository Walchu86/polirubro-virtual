const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

const DATA_FILE = path.join(__dirname, 'productos.json');

function leerProductos() {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function guardarProductos(productos) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(productos, null, 2), 'utf8');
}

function formatearPrecio(monto) {
    return Number(monto || 0).toLocaleString('es-AR');
}

const categoriasValidas = ['Estética', 'Electrónica', 'Zapatería', 'Accesorios'];
const etiquetasValidas = ['NINGUNA', 'NUEVO', 'PROMO', 'DESTACADO', 'ÚLTIMOS STOCK'];

// ==========================================
// 1. TIENDA PÚBLICA (VISTA CLIENTE)
// ==========================================
app.get('/', (req, res) => {
    const productos = leerProductos();
    const categorias = ['Todas', ...categoriasValidas];

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
                    <p>Todo lo que buscás, lo encontrás... ¡Lo cliqueás y te lo llevás!</p>
                </div>
                <div class="header-actions">
                    <button class="cart-btn" onclick="toggleCartModal()">
                        🛒 Carrito (<span id="cartCount">0</span>)
                    </button>
                </div>
            </header>

            <main>
                <!-- BUSCADOR Y FILTROS -->
                <section class="filtros-container">
                    <div class="search-bar-container">
                        <input type="text" id="searchInput" oninput="filtrarProductos()" placeholder="🔍 Buscar producto por nombre o palabra clave...">
                    </div>
                    <div class="categoria-buttons">
    `;

    categorias.forEach((cat, index) => {
        const activeClass = index === 0 ? 'active' : '';
        html += `<button class="btn-categoria ${activeClass}" onclick="filtrarCategoria('${cat}', this)">${cat}</button>`;
    });

    html += `
                    </div>
                </section>

                <section class="catalogo">
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
              <div class="product-card" data-categoria="${(prod.categoria || '').trim()}" data-nombre="${prod.nombre.toLowerCase()}" data-descripcion="${(prod.descripcion || '').toLowerCase()}">
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

            <!-- BOTÓN FLOTANTE DE WHATSAPP PRO -->
            <a href="https://wa.me/5493794655867?text=¡Hola!%20Tengo%20una%20consulta%20sobre%20Polirubro%20Virtual" class="whatsapp-float" target="_blank">
                💬 <span>¿Tenés dudas? Hablá con nosotros</span>
            </a>

            <!-- MODAL DEL CARRITO -->
            <div id="cartModal" class="modal">
                <div class="modal-content">
                    <span class="close-btn" onclick="toggleCartModal()">&times;</span>
                    <h2>🛒 Tu Carrito de Compras</h2>
                    
                    <div id="cartItemsList" class="cart-items-list">
                        <p class="empty-cart">El carrito está vacío.</p>
                    </div>

                    <div class="cart-options" id="cartOptions" style="display:none;">
                        <!-- DATOS DEL CLIENTE -->
                        <div class="customer-info-form">
                            <h4>📋 Tus Datos para la Entrega:</h4>
                            <input type="text" id="clienteNombre" placeholder="Tu Nombre y Apellido *" required>
                            <input type="text" id="clienteDireccion" placeholder="Dirección de Entrega / Barrio *">
                            <input type="tel" id="clienteTelefono" placeholder="Teléfono de contacto">
                        </div>

                        <!-- ZONAS DE ENVÍO Y PAGO -->
                        <div class="option-group">
                            <label for="tipoEnvio">🚚 Zona / Forma de Entrega:</label>
                            <select id="tipoEnvio" onchange="actualizarTotal()">
                                <option value="retiro" data-costo="0">Retirar por el local (Gratis)</option>
                                <option value="centro" data-costo="1500">Zona Centro / Cambá Cuá (+$1.500)</option>
                                <option value="barrios_cercanos" data-costo="2000">Barrios Cercanos / Aldana / Yapeyú (+$2.000)</option>
                                <option value="barrios_alejados" data-costo="2500">1000 Viviendas / Molina Punta / Laguna Seca (+$2.500)</option>
                            </select>
                        </div>

                        <div class="option-group">
                            <label for="metodoPago">💳 Método de Pago:</label>
                            <select id="metodoPago" onchange="mostrarDatosTransferencia()">
                                <option value="Efectivo">Efectivo al recibir</option>
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria (Alias/CBU)</option>
                                <option value="Personal Pay">Personal Pay</option>
                                <option value="Ualá">Ualá</option>
                            </select>
                        </div>

                        <!-- DATOS CBU SI ELIGE TRANSFERENCIA -->
                        <div id="transferInfo" class="transfer-info" style="display:none;">
                            <small>🏦 <strong>Alias CBU:</strong> POLIRUBRO.VIRTUAL.MP</small>
                            <button type="button" class="btn-copy" onclick="copiarAlias()">📋 Copiar Alias</button>
                        </div>

                        <div class="cart-total">
                            <h3>Total a Pagar: $<span id="cartTotalPrice">0</span></h3>
                        </div>

                        <button class="btn-checkout" onclick="procesarPedido()">
                            📲 Confirmar y Enviar por WhatsApp
                        </button>
                    </div>
                </div>
            </div>

            <!-- MODAL CÓDIGO QR PARA PC -->
            <div id="optionsModal" class="modal">
                <div class="modal-content" style="text-align:center;">
                    <span class="close-btn" onclick="cerrarOptionsModal()">&times;</span>
                    <h2>📲 Escaneá para enviar tu Pedido</h2>
                    <p style="color:#94a3b8; font-size:0.9rem; margin-bottom:1.2rem;">Apuntá con la cámara de tu celular para abrir WhatsApp y enviar el pedido al instante:</p>

                    <div style="background:#0f172a; padding:1.5rem; border-radius:20px; border:1px solid #334155; display:inline-block;">
                        <img id="qrImage" src="" alt="Código QR Pedido" style="width:210px; height:210px; border-radius:12px; border:3px solid #38bdf8;">
                    </div>
                </div>
            </div>

            <!-- MODAL PARA VER IMAGEN EN GRANDE (CELULARES) -->
            <div id="modal-imagen-zoom" onclick="this.style.display='none'" style="display:none; position:fixed; z-index:999999; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.9); justify-content:center; align-items:center; padding:1rem;">
                <span style="position:absolute; top:20px; right:30px; color:#fff; font-size:2.5rem; font-weight:bold; cursor:pointer;">&times;</span>
                <img id="img-ampliada" src="" alt="Zoom Producto" style="max-width:90%; max-height:85vh; object-fit:contain; border-radius:12px; box-shadow:0 0 25px rgba(255,255,255,0.2);">
            </div>

            <footer>
                <p>&copy; 2026 Polirubro Virtual — Todos los derechos reservados.</p>
            </footer>

            <script>
                let carrito = [];
                let categoriaSeleccionada = 'Todas';

                function formatoPesos(num) {
                    return Number(num || 0).toLocaleString('es-AR');
                }

                function filtrarCategoria(categoria, elemento) {
                    categoriaSeleccionada = categoria;
                    const botones = document.querySelectorAll('.btn-categoria');
                    botones.forEach(btn => btn.classList.remove('active'));
                    if (elemento) elemento.classList.add('active');
                    filtrarProductos();
                }

                function filtrarProductos() {
                    const busqueda = document.getElementById('searchInput').value.toLowerCase().trim();
                    const tarjetas = document.querySelectorAll('.product-card');

                    tarjetas.forEach(tarjeta => {
                        const catProducto = tarjeta.getAttribute('data-categoria') || '';
                        const nombre = tarjeta.getAttribute('data-nombre') || '';
                        const descripcion = tarjeta.getAttribute('data-descripcion') || '';

                        const coincideCategoria = (categoriaSeleccionada === 'Todas' || catProducto.toLowerCase() === categoriaSeleccionada.toLowerCase());
                        const coincideTexto = (nombre.includes(busqueda) || descripcion.includes(busqueda));

                        if (coincideCategoria && coincideTexto) {
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
                            alert('Alcanzaste el límite de stock disponible de este producto.');
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
                            alert('No hay más stock disponible.');
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
                        cartItemsList.innerHTML = '<p class="empty-cart">El carrito está vacío.</p>';
                        cartOptions.style.display = 'none';
                        return;
                    }

                    cartOptions.style.display = 'block';
                    let html = '';
                    carrito.forEach(item => {
                        html += \`
                            <div class="cart-item">
                                <div>
                                    <strong>\${item.nombre}</strong><br>
                                    <small>\$\${formatoPesos(item.precio)} x \${item.cantidad}</small>
                                </div>
                                <div class="cart-item-controls">
                                    <button onclick="cambiarCantidad(\${item.id}, -1)">-</button>
                                    <span>\${item.cantidad}</span>
                                    <button onclick="cambiarCantidad(\${item.id}, 1)">+</button>
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
                    alert('¡Alias copiado al portapapeles!');
                }

                function compartirProducto(nombre, precio) {
                    const texto = \`¡Mirá este producto en Polirubro Virtual! 🛒\\n*\${nombre}* - \$\${formatoPesos(precio)}\\nPedilo directamente acá: https://polirubro-virtual.onrender.com\`;
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
                        alert('Por favor, ingresá tu Nombre y Apellido.');
                        return;
                    }

                    const tipoEnvioSelect = document.getElementById('tipoEnvio');
                    const opcionEnvio = tipoEnvioSelect.options[tipoEnvioSelect.selectedIndex];
                    const costoEnvio = Number(opcionEnvio.getAttribute('data-costo') || 0);
                    const metodoPago = document.getElementById('metodoPago').value;

                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    let totalFinal = subtotal + costoEnvio;

                    let mensaje = \`¡Hola! Quiero confirmar el siguiente pedido en *Polirubro Virtual*:\\n\\n\`;
                    mensaje += \`👤 *Cliente:* \${nombre}\\n\`;
                    if (direccion) mensaje += \`📍 *Dirección:* \${direccion}\\n\`;
                    if (telefono) mensaje += \`📞 *Contacto:* \${telefono}\\n\`;
                    mensaje += \`\\n🛒 *Detalle del Pedido:*\\n\`;

                    carrito.forEach(item => {
                        mensaje += \`- \${item.cantidad}x \${item.nombre} (\$\${formatoPesos(item.precio * item.cantidad)})\\n\`;
                    });

                    mensaje += \`\\n🚚 *Entrega:* \${opcionEnvio.text}\`;
                    mensaje += \`\\n💳 *Pago:* \${metodoPago}\`;
                    mensaje += \`\\n💰 *Total a abonar:* \$\${formatoPesos(totalFinal)}\\n\\n¡Espero tus instrucciones para coordinar!\`;

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
                    <p>Administrá stock, precios y etiquetas de Polirubro Virtual</p>
                </div>
                <div class="header-actions">
                    <a href="/" class="admin-link" target="_blank">🌐 Ver Tienda Pública</a>
                </div>
            </header>

            <main class="admin-container">
                <section class="form-section">
                    <h2>➕ Cargar Nuevo Producto</h2>
                    <form action="/admin/agregar" method="POST" class="admin-form" id="productForm">
                        <input type="hidden" id="imagenBase64" name="imagenBase64">

                        <div class="form-group">
                            <label>Nombre del Producto:</label>
                            <input type="text" name="nombre" required placeholder="Ej: Protector Solar x 200ml">
                        </div>

                        <div class="form-group">
                            <label>Precio en $ (ejemplo: 4000):</label>
                            <input type="number" name="precio" required placeholder="4000" step="1">
                        </div>

                        <div class="form-group">
                            <label>Stock Disponible (Cantidad):</label>
                            <input type="number" name="stock" required placeholder="10" value="10" min="0">
                        </div>

                        <div class="form-group">
                            <label>Etiqueta / Badge Promocional:</label>
                            <select name="etiqueta">
    `;

    etiquetasValidas.forEach(et => {
        html += `<option value="${et}">${et}</option>`;
    });

    html += `
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Categoría:</label>
                            <select name="categoria" required>
    `;

    categoriasValidas.forEach(cat => {
        html += `<option value="${cat}">${cat}</option>`;
    });

    html += `
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Descripción Breve (opcional):</label>
                            <textarea name="descripcion" rows="2" placeholder="Ej: Excelente calidad, incluye accesorios."></textarea>
                        </div>

                        <div class="form-group" style="background:#0f172a; padding:1rem; border-radius:12px; border:1px solid #334155;">
                            <label>🖼️ Foto del Producto:</label>
                            <small style="color:#94a3b8; display:block; margin-bottom:0.5rem;">Cargá un archivo desde tu PC o pegá un enlace URL:</small>
                            <input type="file" id="fileInput" accept="image/*" style="margin-bottom:0.8rem;" onchange="convertirImagen()">
                            <label style="font-size:0.85rem; color:#cbd5e1;">O usar Enlace URL:</label>
                            <input type="url" id="urlInput" name="imagenUrl" placeholder="https://ejemplo.com/foto.jpg">

                            <div id="previewContainer" style="display:none; margin-top:1rem; text-align:center;">
                                <small style="color:#38bdf8; display:block;">Vista previa:</small>
                                <img id="imgPreview" src="" alt="Vista previa" style="max-width:140px; max-height:140px; border-radius:10px; border:2px solid #38bdf8; margin-top:0.4rem; object-fit:cover;">
                            </div>
                        </div>

                        <button type="submit" class="btn-checkout" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); width:100%; margin-top:1rem;">
                            💾 Guardar Producto
                        </button>
                    </form>
                </section>

                <section class="list-section">
                    <h2>📦 Productos en Stock (${productos.length})</h2>
                    <div class="admin-product-list" style="display:flex; flex-direction:column; gap:1rem; max-height:650px; overflow-y:auto; padding-right:0.5rem;">
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
                <div class="cart-item" style="background:#0f172a; padding:1rem; border-radius:14px; border:1px solid #334155;">
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <img src="${prod.imagen}" alt="${prod.nombre}" style="width:60px; height:60px; object-fit:cover; border-radius:10px; border:1px solid #334155;">
                        <div>
                            <strong style="color:#f8fafc; font-size:1.05rem;">${prod.nombre}</strong><br>
                            <span class="badge" style="position:static; display:inline-block; margin:0.3rem 0;">${prod.categoria}</span>
                            <strong style="color:#34d399; margin-left:0.5rem;">$${precioFormateado}</strong>
                            <br><small style="color:#38bdf8;">Stock: ${stockActual} unidades ${et}</small>
                            ${desc}
                        </div>
                    </div>
                    <form action="/admin/eliminar/${prod.id}" method="POST" onsubmit="return confirm('¿Seguro que querés eliminar este producto?');">
                        <button type="submit" style="background:#ef4444; color:white; border:none; padding:0.5rem 0.8rem; border-radius:8px; cursor:pointer; font-weight:bold;">
                            🗑️
                        </button>
                    </form>
                </div>
            `;
        });
    }

    html += `
                    </div>
                </section>
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
        categoria,
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
