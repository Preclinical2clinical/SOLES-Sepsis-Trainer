/**
 * Shared Upstash Redis / Vercel KV Client for Vercel Serverless Functions
 * Uses zero external npm dependencies - standard fetch.
 */

async function kvCommand(command) {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) {
    return {
      error: 'KV_NOT_CONFIGURED',
      configured: false,
      result: null
    };
  }

  const endpoint = kvUrl.replace(/\/+$/, '');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        error: `KV API Error (${response.status}): ${errText}`,
        configured: true,
        result: null
      };
    }

    const data = await response.json();
    return {
      error: null,
      configured: true,
      result: data.result
    };
  } catch (err) {
    return {
      error: err.message,
      configured: true,
      result: null
    };
  }
}

function parseHash(res) {
  if (!res) return {};
  if (typeof res === 'object' && !Array.isArray(res)) return res;
  if (Array.isArray(res)) {
    const obj = {};
    for (let i = 0; i < res.length; i += 2) {
      obj[res[i]] = res[i + 1];
    }
    return obj;
  }
  return {};
}

module.exports = {
  kvCommand,
  parseHash
};
