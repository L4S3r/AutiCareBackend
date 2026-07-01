const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const aiGatewayRoutes = require('./routes/aiGatewayRoutes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const patientRoutes = require('./routes/patient.routes');
const geneticRoutes = require('./routes/genetic.routes');
const nutritionRoutes = require('./routes/nutrition.routes');
const logRoutes = require('./routes/log.routes');
const gameRoutes = require('./routes/game.routes');
const aiRoutes = require('./routes/ai.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const noteRoutes = require('./routes/note.routes');
const contactRoutes = require('./routes/contact.routes');

const { errorHandler } = require('./middleware/error.middleware');
const { auditLogger } = require('./middleware/audit.middleware');

const app = express();

app.set('trust proxy', 1);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // dev fallback — tighten in prod if needed
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ✅ Handle ALL preflight requests before any other middleware touches them
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// Security middleware
app.use(helmet());



app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback: allow request in dev environment
    }
  },
  credentials: true,
}));


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth attempts, please try again later.',
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Audit logging
app.use(auditLogger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'AutiCare API', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/genetic', geneticRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/ai', aiGatewayRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

module.exports = app;
