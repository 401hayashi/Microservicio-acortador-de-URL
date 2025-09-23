require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const { URL } = require('url');  // para parsing

const app = express();

// Configuración básica
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Modelo para almacenar URLs
const urlSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number
});
const Url = mongoose.model("Url", urlSchema);

// Servir página principal opcional
app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Endpoint POST para crear URL acortada
app.post('/api/shorturl', async (req, res) => {
  const originalUrl = req.body.url;
  
  // Validación básica: intentar parsear la URL
  let hostname;
  try {
    hostname = new URL(originalUrl).hostname;
  } catch (err) {
    return res.json({ error: "invalid url" });
  }

  // Usar dns.lookup para verificar que hostname existe
  dns.lookup(hostname, async (err, address) => {
    if (err || !address) {
      return res.json({ error: "invalid url" });
    } else {
      // Verificar si ya existe esa URL
      let found = await Url.findOne({ original_url: originalUrl });
      if (found) {
        res.json({
          original_url: found.original_url,
          short_url: found.short_url
        });
      } else {
        // Generar un número para short_url
        const count = await Url.countDocuments({});
        const newUrl = new Url({ original_url: originalUrl, short_url: count + 1 });
        await newUrl.save();
        res.json({
          original_url: newUrl.original_url,
          short_url: newUrl.short_url
        });
      }
    }
  });
});

// Endpoint GET para redirigir
app.get('/api/shorturl/:short_url', async (req, res) => {
  const short = req.params.short_url;
  const urlDoc = await Url.findOne({ short_url: short });
  if (urlDoc) {
    res.redirect(urlDoc.original_url);
  } else {
    res.json({ error: "No short URL found for the given input" });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
