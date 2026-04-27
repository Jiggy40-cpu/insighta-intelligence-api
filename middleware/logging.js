import { logRequest } from '../lib/db-extended.js';

export const requestLogger = async (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', async () => {
    const responseTimeMs = Date.now() - startTime;
    const userId = req.user?.sub || null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      await logRequest(
        userId,
        req.method,
        req.path,
        res.statusCode,
        responseTimeMs,
        ipAddress,
        userAgent
      );
    } catch (error) {
      console.error('Error logging request:', error.message);
    }
  });

  next();
};
