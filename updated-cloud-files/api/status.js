/**
 * Vercel KV Health & Connection Status Endpoint
 * GET /api/status
 */
const { kvCommand } = require('./_kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const hasToken = !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!kvUrl || !hasToken) {
    return res.status(200).json({
      status: 'offline',
      configured: false,
      message: 'Vercel KV Storage is not connected yet. Click Storage -> Create Database -> KV in Vercel to activate cloud persistence.'
    });
  }

  try {
    const ping = await kvCommand(['PING']);
    if (ping.error) {
      return res.status(200).json({
        status: 'error',
        configured: true,
        error: ping.error
      });
    }

    return res.status(200).json({
      status: 'online',
      configured: true,
      ping: ping.result || 'PONG',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      configured: true,
      error: err.message
    });
  }
};
