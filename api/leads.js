/**
 * Project Leads Master Decisions API
 * GET /api/leads - Returns live master screening decisions for Zoe, Eva, and consensus overrides
 * POST /api/leads - Updates lead decisions (password authenticated)
 */
const { kvCommand } = require('./_kv');

const LEAD_CREDENTIALS = {
  'zfisk': 'missy',
  'ekuhar': 'gunner'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Return current live lead decisions
  if (req.method === 'GET') {
    const kvRes = await kvCommand(['GET', 'soles:lead_decisions']);

    if (kvRes.error === 'KV_NOT_CONFIGURED') {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Vercel KV Storage not connected yet.',
        leadDecisions: null
      });
    }

    let leadDecisions = {
      zoe: { training: {}, exam1: {}, exam2: {} },
      eva: { training: {}, exam1: {}, exam2: {} },
      consensusOverrides: { training: {}, exam1: {}, exam2: {} }
    };

    if (kvRes.result) {
      try {
        const parsed = JSON.parse(kvRes.result);
        leadDecisions = Object.assign(leadDecisions, parsed);
      } catch (e) {
        console.error('Failed to parse lead decisions JSON from KV:', e);
      }
    }

    return res.status(200).json({
      success: true,
      configured: true,
      leadDecisions
    });
  }

  // 2. POST: Save or update lead decisions (requires password)
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const { username, password, action, stage, paperId, decision, reason, notes, leadDecisions } = body;

    // Verify Lead Password
    if (!username || !password || LEAD_CREDENTIALS[username] !== password) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid username or password for project lead.'
      });
    }

    const leadKey = (username === 'zfisk') ? 'zoe' : 'eva';

    // Retrieve existing decisions from KV
    const kvGet = await kvCommand(['GET', 'soles:lead_decisions']);
    if (kvGet.error === 'KV_NOT_CONFIGURED') {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Vercel KV Storage not connected yet. Saved to browser storage.'
      });
    }

    let current = {
      zoe: { training: {}, exam1: {}, exam2: {} },
      eva: { training: {}, exam1: {}, exam2: {} },
      consensusOverrides: { training: {}, exam1: {}, exam2: {} },
      lastUpdated: new Date().toISOString()
    };

    if (kvGet.result) {
      try {
        current = Object.assign(current, JSON.parse(kvGet.result));
      } catch (e) {}
    }

    // Process update actions
    if (action === 'save_decision' && stage && paperId) {
      // Single paper auto-save by Zoe or Eva
      if (!current[leadKey]) current[leadKey] = { training: {}, exam1: {}, exam2: {} };
      if (!current[leadKey][stage]) current[leadKey][stage] = {};

      current[leadKey][stage][paperId] = {
        paperId: Number(paperId),
        decision: decision,
        reason: (decision === 'EXCLUDE') ? reason : null,
        notes: notes || '',
        timestamp: new Date().toISOString()
      };

      // Clear any manual consensus override for this paper so fresh consensus is re-evaluated
      if (current.consensusOverrides?.[stage]?.[paperId]) {
        delete current.consensusOverrides[stage][paperId];
      }
    } else if (action === 'resolve_consensus' && stage && paperId && decision) {
      // Joint consensus override chosen in Lead Hub
      if (!current.consensusOverrides) current.consensusOverrides = {};
      if (!current.consensusOverrides[stage]) current.consensusOverrides[stage] = {};
      current.consensusOverrides[stage][paperId] = decision;
    } else if (action === 'clear_consensus_override' && stage && paperId) {
      if (current.consensusOverrides?.[stage]?.[paperId]) {
        delete current.consensusOverrides[stage][paperId];
      }
    } else if (leadDecisions) {
      // Sync full lead decision set
      if (leadDecisions[leadKey]) {
        current[leadKey] = leadDecisions[leadKey];
      }
      if (leadDecisions.consensusOverrides) {
        current.consensusOverrides = Object.assign(current.consensusOverrides || {}, leadDecisions.consensusOverrides);
      }
    }

    current.lastUpdated = new Date().toISOString();
    current.lastUpdatedBy = username;

    // Save updated decisions back to KV
    const setRes = await kvCommand(['SET', 'soles:lead_decisions', JSON.stringify(current)]);
    if (setRes.error) {
      return res.status(500).json({
        success: false,
        error: setRes.error
      });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      leadDecisions: current,
      message: 'Lead decisions successfully saved to cloud!'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
