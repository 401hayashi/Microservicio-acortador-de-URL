const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { URL } = require('url');
require('dotenv').config();

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MongoDB connection con mejor manejo de errores
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }
    
    console.log('Conectando a MongoDB...');
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 segundos de timeout
      socketTimeoutMS: 45000, // 45 segundos
    });
    
    console.log('✅ Conectado a MongoDB Atlas correctamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.log('💡 Verifica:');
    console.log('1. La variable MONGODB_URI en Render');
    console.log('2. Network Access en MongoDB Atlas (0.0.0.0/0)');
    console.log('3. El usuario de la base de datos');
    process.exit(1);
  }
};

// Conectar a la base de datos al iniciar
connectDB();

// URL Schema
const urlSchema = new mongoose.Schema({
  original_url: {
    type: String,
    required: true
  },
  short_url: {
    type: Number,
    required: true,
    unique: true
  }
});

const Url = mongoose.model('Url', urlSchema);

// Helper function to validate URL format
function isValidUrl(urlString) {
  try {
    const urlObj = new URL(urlString);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// POST endpoint to create short URL
app.post('/api/shorturl', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.json({ error: 'invalid url' });
  }
  
  // Validar formato de URL
  if (!isValidUrl(url)) {
    return res.json({ error: 'invalid url' });
  }
  
  try {
    // Verificar si la URL ya existe
    const existingUrl = await Url.findOne({ original_url: url });
    
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }
    
    // Crear nueva URL corta
    const count = await Url.countDocuments();
    const shortUrl = count + 1;
    
    const newUrl = new Url({
      original_url: url,
      short_url: shortUrl
    });
    
    await newUrl.save();
    
    res.json({
      original_url: url,
      short_url: shortUrl
    });
    
  } catch (error) {
    console.error('Error en POST /api/shorturl:', error);
    res.json({ error: 'server error' });
  }
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  try {
    const shortUrl = parseInt(req.params.short_url);
    
    if (isNaN(shortUrl)) {
      return res.json({ error: 'Wrong format' });
    }
    
    const urlDoc = await Url.findOne({ short_url: shortUrl });
    
    if (!urlDoc) {
      return res.json({ error: 'No short URL found for the given input' });
    }
    
    res.redirect(urlDoc.original_url);
    
  } catch (error) {
    console.error('Error en GET /api/shorturl:', error);
    res.json({ error: 'server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok', 
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, function() {
  console.log(`🚀 Servidor ejecutándose en puerto ${port}`);
  console.log(`📊 Estado BD: ${mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
});
