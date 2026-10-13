const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Aumentamos el límite de tamaño de JSON para soportar imágenes en Base64 sin problemas (hasta 50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos (HTML, CSS, JS públicos) desde la raíz
app.use(express.static(path.join(__dirname)));

// Archivo local donde se guardarán los productos y categorías de forma permanente
const DATA_FILE = path.join(__dirname, 'database.json');

// Asegurar que exista un archivo database.json inicial
if (!fs.existsSync(DATA_FILE)) {
    const datosIniciales = {
        productos: [],
        categorias: ["Estética", "Electrónica", "Zapatería", "Accesorios"],
        estadisticas: { totalVisitas: 0, visitasMovil: 0, visitasPC: 0, secciones: {}, busquedas: {}, porDia: {} }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(datosIniciales, null, 2));
}

// --- ENDPOINTS DE LA API ---

// 1. Obtener datos (productos y categorías)
app.get('/api/datos', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: "Error al leer la base de datos" });
    }
});

// 2. Guardar/Actualizar datos (productos, categorías e imágenes en Base64)
app.post('/api/datos', (req, res) => {
    try {
        const nuevosDatos = req.body;
        fs.writeFileSync(DATA_FILE, JSON.stringify(nuevosDatos, null, 2));
        res.json({ success: true, message: "Datos y productos guardados correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al guardar los datos" });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Polirubro Virtual corriendo en el puerto ${PORT}`);
});
