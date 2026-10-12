const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

const MASTER_KEY = "\$2a\$10\$tg1ZdjhTaaMXJux9z9NikO/nVFhjVdV28wxjdimgawIO.VkiBMEUi";
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

    const payload = JSON.stringify({
        record: {
            productos: memoriaProductos,
            categorias: memoriaCategorias,
            estadisticas: memoriaEstadisticas
        }
    });

    const pesoPayloadKB = Math.round(Buffer.byteLength(payload) / 1024);
    console.log(`📦 Peso total a sincronizar con JSONBin: ${pesoPayloadKB} KB`);

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
                console.log('☁️ Sincronización con JSONBin exitosa. Total productos en la nube:', memoriaProductos.length);
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
                        
                        if (dataRoot && Array.isArray(dataRoot.productos)) {
                            memoriaProductos = dataRoot.productos;
                            nubeSincronizadaOk = true;
                            console.log('☁️ Datos RECUPERADOS desde JSONBin correctamente. Total productos:', memoriaProductos.length);
                        }
                        if (dataRoot && Array.isArray(dataRoot.categorias) && dataRoot.categorias.length > 0) {
                            memoriaCategorias = dataRoot.categorias;
                        }
                        if (dataRoot && dataRoot.estadisticas) {
                            memoriaEstadisticas = dataRoot.estadisticas;
                        }
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

// Ruta Principal (Lee index.html directamente de la raíz)
app.get('/', (req, res) => {
    try {
        registrarVisita(req);
        res.sendFile(path.resolve(__dirname, 'index.html'));
    } catch (err) {
        console.error("Error cargando /:", err);
        res.status(500).send("Error del servidor: " + err.message);
    }
});

// Ruta Admin (Lee admin.html directamente de la raíz)
app.get('/admin', (req, res) => {
    try {
        res.sendFile(path.resolve(__dirname, 'admin.html'));
    } catch (err) {
        console.error("Error cargando /admin:", err);
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
