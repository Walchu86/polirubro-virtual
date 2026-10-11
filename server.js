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

// Función limpia y exacta para formatear precios en pesos argentinos
function formatearPrecio(monto) {
    return Number(monto || 0).toLocaleString('es-AR');
}

const categoriasValidas = ['Estética', 'Electrónica', 'Zapatería', 'Accesorios'];

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
                    <button class="cart-summary-btn" onclick="toggleCartModal()">
                        🛒 Carrito (<span id="cartCount">0</span>)
                    </button>
                </div>
            </header>

            <main>
                <section class="filtros-container">
                    <h3>Filtrar por Categoría:</h3>
                    <div class="categoria-buttons">
    `;

    categorias.forEach((cat, index) => {
        const activeClass = index === 0 ? 'active' : '';
        html += `<button class="btn-categoria ${activeClass}" onclick="filtrarCategoria('${cat}')">${cat}</button>`;
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
            html += `
              <div class="product-card" data-categoria="${prod.categoria}">
                  <div class="product-image-container">
                      <img src="${imagenUrl}" alt="${prod.nombre}" class="zoom-img" onerror="this.src='https://via.placeholder.com/300x200?text=Error+Imagen'">
                      <span class="badge">${prod.categoria}</span>
                  </div>
                  <div class="product-info">
                      <h3>${prod.nombre}</h3>
                      ${descripcionTexto}
                      <p class="price">$${precioFormateado}</p>
                      <button class="btn-agregar" onclick="agregarAlCarrito(${prod.id}, '${prod.nombre.replace(/'/g, "\\'")}', ${prod.precio})">
                          ➕ Agregar al Carrito
                      </button>
                  </div>
              </div>
            `;
        });
    }

    html += `
                    </div>
                </section>
            </main>

            <!-- MODAL DEL CARRITO -->
            <div id="cartModal" class="modal">
                <div class="modal-content">
                    <span class="close-btn" onclick="toggleCartModal()">&times;</span>
                    <h2>🛒 Tu Carrito de Compras</h2>
                    
                    <div id="cartItemsList" class="cart-items-list">
                        <p class="empty-cart">El carrito está vacío.</p>
                    </div>

                    <div class="cart-options" id="cartOptions" style="display:none;">
                        <div class="option-group">
                            <label for="tipoEnvio">🚚 Tipo de Entrega:</label>
                            <select id="tipoEnvio" onchange="actualizarTotal()">
                                <option value="retiro">Retirar por el local (Gratis)</option>
                                <option value="envio">Envío a domicilio (+$2.500)</option>
                            </select>
                        </div>

                        <div class="option-group">
                            <label for="metodoPago">💳 Método de Pago:</label>
                            <select id="metodoPago">
                                <option value="Mercado Pago">Mercado Pago</option>
                                <option value="Personal Pay">Personal Pay</option>
                                <option value="Brubank">Brubank</option>
                                <option value="Ualá">Ualá</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria (Alias/CBU)</option>
                            </select>
                        </div>

                        <div class="cart-total">
                            <h3>Total a Pagar: $<span id="cartTotalPrice">0</span></h3>
                        </div>

                        <button class="btn-checkout" onclick="procesarPedido()">
                            📲 Finalizar Compra
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
                const COSTO_ENVIO = 2500;

                function formatoPesos(num) {
                    return Number(num || 0).toLocaleString('es-AR');
                }

                function filtrarCategoria(categoria) {
                    const tarjetas = document.querySelectorAll('.product-card');
                    const botones = document.querySelectorAll('.btn-categoria');

                    botones.forEach(btn => {
                        if (btn.innerText === categoria) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });

                    tarjetas.forEach(tarjeta => {
                        const catProducto = tarjeta.getAttribute('data-categoria');
                        if (categoria === 'Todas' || catProducto === categoria) {
                            tarjeta.style.display = 'flex';
                        } else {
                            tarjeta.style.display = 'none';
                        }
                    });
                }

                function agregarAlCarrito(id, nombre, precio) {
                    const index = carrito.findIndex(item => item.id === id);
                    if (index > -1) {
                        carrito[index].cantidad += 1;
                    } else {
                        carrito.push({ id, nombre, precio: Number(precio), cantidad: 1 });
                    }
                    actualizarVistaCarrito();
                    alert('¡Producto agregado al carrito!');
                }

                function cambiarCantidad(id, cambio) {
                    const index = carrito.findIndex(item => item.id === id);
                    if (index > -1) {
                        carrito[index].cantidad += cambio;
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
                        html += `
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
                        `;
                    });
                    cartItemsList.innerHTML = html;
                    actualizarTotal();
                }

                function actualizarTotal() {
                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    const tipoEnvio = document.getElementById('tipoEnvio').value;
                    let total = tipoEnvio === 'envio' ? subtotal + COSTO_ENVIO : subtotal;
                    document.getElementById('cartTotalPrice').innerText = formatoPesos(total);
                }

                function toggleCartModal() {
                    const modal = document.getElementById('cartModal');
                    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
                }

                function cerrarOptionsModal() {
                    document.getElementById('optionsModal').style.display = 'none';
                }

                // Activar zoom en dispositivos táctiles / celulares
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

                    const tipoEnvioSelect = document.getElementById('tipoEnvio');
                    const metodoPagoSelect = document.getElementById('metodoPago');
                    
                    const tipoEnvioTexto = tipoEnvioSelect.value === 'envio' ? 'Envío a domicilio (+$2.500)' : 'Retiro por el local';
                    const metodoPago = metodoPagoSelect.value;
                    
                    let subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
                    let costoEnvioActual = tipoEnvioSelect.value === 'envio' ? COSTO_ENVIO : 0;
                    let totalFinal = subtotal + costoEnvioActual;

                    let mensaje = "¡Hola! Quiero confirmar el siguiente pedido en *Polirubro Virtual*:\\n\\n";
                    carrito.forEach(item => {
                        mensaje += \`- \${item.cantidad}x \${item.nombre} (\$\${formatoPesos(item.precio * item.cantidad)})\\n\`;
                    });

                    mensaje += \`\\n🚚 *Entrega:* \${tipoEnvioTexto}\`;
                    mensaje += \`\\n💳 *Pago:* \${metodoPago}\`;
                    
                    if (metodoPago === 'Transferencia Bancaria') {
                        mensaje += \`\\n🏦 _(Solicito los datos de CBU/Alias para realizar la transferencia y adjuntar el comprobante)_\`;
                    }

                    mensaje += \`\\n💰 *Total a abonar:* \$\${formatoPesos(totalFinal)}\\n\\n¡Espero las instrucciones para coordinar!\`;

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
                    <p>Administrá los productos de Polirubro Virtual</p>
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
                            <label>Precio en $ (ejemplo: 4000 sin puntos ni comas):</label>
                            <input type="number" name="precio" required placeholder="4000" step="1">
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
                            <textarea name="descripcion" rows="2" placeholder="Ej: Excelente calidad, incluye accesorios e instrucciones."></textarea>
                        </div>

                        <div class="form-group" style="background:#0f172a; padding:1rem; border-radius:12px; border:1px solid #334155;">
                            <label>🖼️ Foto del Producto:</label>
                            <small style="color:#94a3b8; display:block; margin-bottom:0.5rem;">Cargá un archivo desde tu PC o pegá un enlace directo:</small>
                            
                            <input type="file" id="fileInput" accept="image/*" style="margin-bottom:0.8rem;" onchange="convertirImagen()">
                            
                            <label style="font-size:0.85rem; color:#cbd5e1;">O usar Enlace URL:</label>
                            <input type="url" id="urlInput" name="imagenUrl" placeholder="https://ejemplo.com/foto.jpg">

                            <div id="previewContainer" style="display:none; margin-top:1rem; text-align:center;">
                                <small style="color:#38bdf8; display:block;">Vista previa de la foto:</small>
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
            html += `
                <div class="cart-item" style="background:#0f172a; padding:1rem; border-radius:14px; border:1px solid #334155;">
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <img src="${prod.imagen}" alt="${prod.nombre}" style="width:60px; height:60px; object-fit:cover; border-radius:10px; border:1px solid #334155;">
                        <div>
                            <strong style="color:#f8fafc; font-size:1.05rem;">${prod.nombre}</strong><br>
                            <span class="badge" style="position:static; display:inline-block; margin:0.3rem 0;">${prod.categoria}</span>
                            <strong style="color:#34d399; margin-left:0.5rem;">$${precioFormateado}</strong>
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
    const { nombre, precio, categoria, descripcion, imagenBase64, imagenUrl } = req.body;
    let productos = leerProductos();

    const nuevoId = productos.length > 0 ? Math.max(...productos.map(p => p.id)) + 1 : 1;
    
    const imagenFinal = imagenBase64 && imagenBase64.trim() !== '' 
        ? imagenBase64 
        : (imagenUrl && imagenUrl.trim() !== '' ? imagenUrl.trim() : 'https://via.placeholder.com/300x200?text=Sin+Imagen');

    productos.push({
        id: nuevoId,
        nombre: nombre.trim(),
        precio: Math.round(Number(precio) || 0),
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
