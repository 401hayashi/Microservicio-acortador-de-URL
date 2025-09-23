const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { URL } = require('url');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Conexión mejorada a MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('❌ MONGODB_URI no está definida');
      console.log('💡 Configura la variable MONGODB_URI en Render');
      return;
    }
    
    console.log('🔗 Conectando a MongoDB...');
    console.log('📝 URI:', mongoURI.replace(/:[^:]*@/, ':********@')); // Oculta la contraseña en logs
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });
    
    console.log('✅ Conectado a MongoDB correctamente');
  } catch (error) {
    console.error('❌ Error de conexión a MongoDB:');
    console.error('📌 Mensaje:', error.message);
    console.error('💡 Solución: Verifica usuario/contraseña en MongoDB Atlas');
  }
};

connectDB();

// Schema y modelo
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true }
});

const Url = mongoose.model('Url', urlSchema);

// Validación de URL
function isValidUrl(urlString) {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Health check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  res.json({ 
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    database: dbStatus === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API endpoints
app.post('/api/shorturl', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !isValidUrl(url)) {
      return res.json({ error: 'invalid url' });
    }
    
    // Verificar conexión a BD
    if (mongoose.connection.readyState !== 1) {
      return res.json({ error: 'database unavailable' });
    }
    
    const existingUrl = await Url.findOne({ original_url: url });
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }
    
    const count = await Url.countDocuments();
    const newUrl = new Url({
      original_url: url,
      short_url: count + 1
    });
    
    await newUrl.save();
    res.json({ original_url: url, short_url: count + 1 });
    
  } catch (error) {
    console.error('Error en POST /api/shorturl:', error);
    res.json({ error: 'server error' });
  }
});

app.get('/api/shorturl/:short_url', async (req, res) => {
  try {
    const shortUrl = parseInt(req.params.short_url);
    
    if (isNaN(shortUrl) || mongoose.connection.readyState !== 1) {
      return res.json({ error: 'invalid' });
    }
    
    const urlDoc = await Url.findOne({ short_url: shortUrl });
    if (!urlDoc) {
      return res.json({ error: 'No short URL found for the given input' });
    }
    
    res.redirect(urlDoc.original_url);
  } catch (error) {
    res.json({ error: 'server error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${port}`);
});
