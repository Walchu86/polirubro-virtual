const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para leer JSON
app.use(express.json({ limit: '10mb' }));

// Servir archivos estáticos (HTML, CSS, JS públicos) desde la raíz o carpeta public
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Archivo local donde se guardarán los productos y categorías
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

// Configuración de Multer para guardar las imágenes subidas en la carpeta /uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = Date.now() + '_' + Math.round(Math.random() * 1E9) + ext;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

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

// 2. Guardar/Actualizar datos (productos y categorías)
app.post('/api/datos', (req, res) => {
    try {
        const nuevosDatos = req.body;
        fs.writeFileSync(DATA_FILE, JSON.stringify(nuevosDatos, null, 2));
        res.json({ success: true, message: "Datos guardados correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al guardar los datos" });
    }
});

// 3. Subir imágenes (Reemplaza el Base64 pesado por archivos reales en /uploads/)
app.post('/api/upload', upload.single('imagen'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se subió ninguna imagen" });
        }
        // Armar la URL pública de la imagen
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const urlImagen = `${protocol}://${host}/uploads/${req.file.filename}`;

        res.json({ success: true, url: urlImagen });
    } catch (error) {
        res.status(500).json({ error: "Error al procesar la imagen" });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Polirubro Virtual corriendo en el puerto ${PORT}`);
});
