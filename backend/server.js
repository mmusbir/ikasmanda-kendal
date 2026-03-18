const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
});

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const alumniRoutes = require('./routes/alumniRoutes');
const usahaRoutes = require('./routes/usahaRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { bootstrapApp } = require('./config/bootstrap');

const app = express();
const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 10;
const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isInteger(parsedPort) ? parsedPort : DEFAULT_PORT;
let bootstrapPromise = null;
let bootstrapError = null;

function ensureAppReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapApp()
      .then(() => {
        bootstrapError = null;
        console.log('Bootstrap selesai.');
      })
      .catch((err) => {
        bootstrapError = err;
        bootstrapPromise = null;
        throw err;
      });
  }

  return bootstrapPromise;
}

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow external CDN scripts and fonts
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Global rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak request, silakan coba lagi nanti.',
  },
});
app.use('/api', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight health check that does not depend on database bootstrap.
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'IKA SMANDA API is running',
    ready: bootstrapError === null,
  });
});

app.get('/api/ready', (_req, res) => {
  if (bootstrapError) {
    return res.status(503).json({
      success: false,
      message: 'Aplikasi belum siap digunakan',
      error: bootstrapError.message,
    });
  }

  res.json({
    success: true,
    message: 'Aplikasi siap digunakan',
  });
});

app.use(async (_req, _res, next) => {
  try {
    await ensureAppReady();
    next();
  } catch (err) {
    console.error('Bootstrap gagal:', err.message);
    next(err);
  }
});

// Serve the frontend folder from the parent directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api', alumniRoutes);
app.use('/api', usahaRoutes);
app.use('/api', adminRoutes);

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/login.html'));
});

app.get('/admin/panel', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/dashboard.html'));
});

app.get('/pendaftaran', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pendaftaran.html'));
});

app.get('/direktori', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/direktori.html'));
});

app.get('/lapak', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/lapak.html'));
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Ukuran file terlalu besar untuk diproses.',
    });
  }

  if (err.message === 'File gambar harus berformat PNG atau JPG'
    || err.message === 'File import harus berformat CSV') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan server',
  });
});

function listenOnAvailablePort(port, attemptsLeft = MAX_PORT_ATTEMPTS) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once('listening', () => {
      resolve({ server, port });
    });

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptsLeft > 1) {
        const nextPort = port + 1;
        console.log(`Port ${port} sedang dipakai. Mencoba port ${nextPort}...`);
        resolve(listenOnAvailablePort(nextPort, attemptsLeft - 1));
        return;
      }

      reject(err);
    });
  });
}

async function startServer() {
  try {
    await ensureAppReady();
  } catch (err) {
    console.error('Bootstrap gagal:', err.message);
  }

  try {
    const { port } = await listenOnAvailablePort(PORT);
    console.log(`Server running on port ${port}`);

    if (port !== PORT) {
      console.log(`Port default ${PORT} sedang dipakai, server dialihkan ke http://localhost:${port}`);
    }
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`Gagal menemukan port kosong setelah ${MAX_PORT_ATTEMPTS} percobaan mulai dari ${PORT}.`);
    } else {
      console.error('Gagal menjalankan server:', err.message);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
