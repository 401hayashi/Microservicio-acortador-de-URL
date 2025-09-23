const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const { URL } = require('url');
require('dotenv').config();

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/urlshortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

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

// Helper function to validate URL format (strictly for freeCodeCamp tests)
function isValidUrl(urlString) {
  try {
    const urlObj = new URL(urlString);
    // freeCodeCamp requiere formato específico como http://www.example.com
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
    console.error(error);
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
    console.error(error);
    res.json({ error: 'server error' });
  }
});

// Endpoint para testing (opcional)
app.get('/api/hello', (req, res) => {
  res.json({ greeting: 'hello API' });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
