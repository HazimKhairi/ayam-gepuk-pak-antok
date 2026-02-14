"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("./config/prisma"));
const cleanupOrders_1 = require("./utils/cleanupOrders");
// Load environment variables
dotenv_1.default.config();
// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-this-in-production-to-a-random-string') {
    console.warn('WARNING: JWT_SECRET is not set or using default. Set a strong secret in production!');
}
// Import routes
const outlets_1 = __importDefault(require("./routes/outlets"));
const reservations_1 = __importDefault(require("./routes/reservations"));
const menu_1 = __importDefault(require("./routes/menu"));
const payments_1 = __importDefault(require("./routes/payments"));
const admin_1 = __importDefault(require("./routes/admin"));
const auth_1 = __importDefault(require("./routes/auth"));
const upload_1 = __importDefault(require("./routes/upload"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const promotions_1 = __importDefault(require("./routes/promotions"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Security headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow image loading from different origins
}));
// Compression
app.use((0, compression_1.default)());
// CORS
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
// Body parsing with size limits
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Global rate limiter — 200 requests per minute per IP
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);
// Strict rate limiter for auth endpoints — 10 attempts per 15 minutes
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again in 15 minutes' },
});
// Serve static files with cache headers
app.use('/uploads', express_1.default.static('public/uploads', {
    maxAge: '1d',
    etag: true,
}));
// Health check with DB connectivity
app.get('/health', async (req, res) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    }
    catch {
        res.status(503).json({ status: 'error', database: 'disconnected', timestamp: new Date().toISOString() });
    }
});
// API Routes
app.use('/api/v1/outlets', outlets_1.default);
app.use('/api/v1/reservations', reservations_1.default);
app.use('/api/v1/menu', menu_1.default);
app.use('/api/v1/payments', payments_1.default);
app.use('/api/v1/admin', admin_1.default);
app.use('/api/v1/auth', authLimiter, auth_1.default);
app.use('/api/v1/upload', upload_1.default);
app.use('/api/v1/reviews', reviews_1.default);
app.use('/api/v1/promotions', promotions_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Internal server error' });
});
// Start server
const server = app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    // Cleanup abandoned orders on startup
    await (0, cleanupOrders_1.cleanupOnStartup)().catch(err => {
        console.error('Failed to run cleanup on startup:', err);
    });
});
// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        await prisma_1.default.$disconnect();
        console.log('Server closed.');
        process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
exports.default = app;
//# sourceMappingURL=server.js.map