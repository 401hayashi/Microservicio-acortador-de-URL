const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const url = require('url');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/urlshortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Esquema de URL
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

const URLModel = mongoose.model('URL', urlSchema);

// Función para validar URL
function isValidUrl(string) {
  try {
    const parsedUrl = new URL(string);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

// Función para verificar si la URL existe
function urlExists(urlString, callback) {
  try {
    const parsedUrl = new URL(urlString);
    dns.lookup(parsedUrl.hostname, (err) => {
      callback(!err);
    });
  } catch (err) {
    callback(false);
  }
}

// Rutas
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Endpoint para crear short URL
app.post('/api/shorturl', (req, res) => {
  const originalUrl = req.body.url;
  
  if (!isValidUrl(originalUrl)) {
    return res.json({ error: 'invalid url' });
  }
  
  urlExists(originalUrl, (exists) => {
    if (!exists) {
      return res.json({ error: 'invalid url' });
    }
    
    // Buscar si la URL ya existe
    URLModel.findOne({ original_url: originalUrl })
      .then(existingUrl => {
        if (existingUrl) {
          return res.json({
            original_url: existingUrl.original_url,
            short_url: existingUrl.short_url
          });
        }
        
        // Crear nueva URL corta
        URLModel.countDocuments()
          .then(count => {
            const newUrl = new URLModel({
              original_url: originalUrl,
              short_url: count + 1
            });
            
            newUrl.save()
              .then(savedUrl => {
                res.json({
                  original_url: savedUrl.original_url,
                  short_url: savedUrl.short_url
                });
              })
              .catch(err => {
                console.error(err);
                res.json({ error: 'database error' });
              });
          })
          .catch(err => {
            console.error(err);
            res.json({ error: 'database error' });
          });
      })
      .catch(err => {
        console.error(err);
        res.json({ error: 'database error' });
      });
  });
});

// Endpoint para redirigir
app.get('/api/shorturl/:short_url', (req, res) => {
  const shortUrl = parseInt(req.params.short_url);
  
  if (isNaN(shortUrl)) {
    return res.json({ error: 'Wrong format' });
  }
  
  URLModel.findOne({ short_url: shortUrl })
    .then(foundUrl => {
      if (!foundUrl) {
        return res.json({ error: 'No short URL found for the given input' });
      }
      
      res.redirect(foundUrl.original_url);
    })
    .catch(err => {
      console.error(err);
      res.json({ error: 'database error' });
    });
});

// Endpoint para ver todas las URLs (útil para debugging)
app.get('/api/all', (req, res) => {
  URLModel.find({})
    .then(urls => {
      res.json(urls);
    })
    .catch(err => {
      console.error(err);
      res.json({ error: 'database error' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
