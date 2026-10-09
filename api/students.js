/**
 * Student Progress & Live Gradebook API
 * GET /api/students - Returns all student submissions for Lead Gradebook, or ?name=XYZ for specific student
 * POST /api/students - Real-time auto-save for student answers, stage, and completion statistics
 * DELETE /api/students?name=XYZ - Remove student record from gradebook
 */
const { kvCommand, parseHash } = require('./_kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Fetch student progress or full roster
  if (req.method === 'GET') {
    const studentName = req.query.name;

    // A. Fetch single student by name
    if (studentName) {
      const studentKey = studentName.trim().toLowerCase();
      const kvRes = await kvCommand(['HGET', 'soles:students', studentKey]);

      if (kvRes.error === 'KV_NOT_CONFIGURED') {
        return res.status(200).json({
          success: false,
          configured: false,
          message: 'Vercel KV not configured yet.'
        });
      }

      if (!kvRes.result) {
        return res.status(200).json({
          success: true,
          configured: true,
          found: false,
          student: null
        });
      }

      try {
        const student = JSON.parse(kvRes.result);
        return res.status(200).json({
          success: true,
          configured: true,
          found: true,
          student
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: 'Failed to parse student record' });
      }
    }

    // B. Fetch all students for Lead Gradebook
    const allRes = await kvCommand(['HGETALL', 'soles:students']);

    if (allRes.error === 'KV_NOT_CONFIGURED') {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Vercel KV not configured yet.',
        roster: []
      });
    }

    const hash = parseHash(allRes.result);
    const roster = [];

    Object.keys(hash).forEach(key => {
      try {
        const parsed = JSON.parse(hash[key]);
        roster.push(parsed);
      } catch (e) {}
    });

    // Sort by latest update descending
    roster.sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));

    return res.status(200).json({
      success: true,
      configured: true,
      roster
    });
  }

  // 2. POST: Auto-save student progress and update gradebook
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const { name, stage, paperId, decision, reason, notes, answers, currentPaperIndex, summary } = body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Student name is required.'
      });
    }

    const studentKey = name.trim().toLowerCase();

    // Fetch existing record
    const existingRes = await kvCommand(['HGET', 'soles:students', studentKey]);
    if (existingRes.error === 'KV_NOT_CONFIGURED') {
      return res.status(200).json({
        success: false,
        configured: false,
        message: 'Vercel KV not configured yet. Saved locally.'
      });
    }

    let record = {
      name: name.trim(),
      stage: stage || 'training',
      currentPaperIndex: currentPaperIndex !== undefined ? currentPaperIndex : 0,
      answers: { training: {}, exam1: {}, exam2: {} },
      totalScreened: 0,
      consensusPct: 0,
      leadPct: 0,
      coleadPct: 0,
      kappa: "0.00",
      falseExcl: 0,
      timestamp: new Date().toLocaleDateString(),
      lastUpdated: new Date().toISOString()
    };

    if (existingRes.result) {
      try {
        record = Object.assign(record, JSON.parse(existingRes.result));
      } catch (e) {}
    }

    // Update fields
    record.name = name.trim();
    if (stage) record.stage = stage;
    if (currentPaperIndex !== undefined) record.currentPaperIndex = currentPaperIndex;
    record.lastUpdated = new Date().toISOString();

    // Merge answers if batch provided
    if (answers) {
      if (answers.training) record.answers.training = Object.assign(record.answers.training || {}, answers.training);
      if (answers.exam1) record.answers.exam1 = Object.assign(record.answers.exam1 || {}, answers.exam1);
      if (answers.exam2) record.answers.exam2 = Object.assign(record.answers.exam2 || {}, answers.exam2);
    }

    // Merge single decision
    if (stage && paperId && decision) {
      if (!record.answers[stage]) record.answers[stage] = {};
      record.answers[stage][paperId] = {
        paperId: Number(paperId),
        decision,
        reason: (decision === 'EXCLUDE') ? reason : null,
        notes: notes || '',
        timestamp: new Date().toISOString()
      };
    }

    // Update Gradebook summary metrics
    if (summary) {
      if (summary.totalScreened !== undefined) record.totalScreened = summary.totalScreened;
      if (summary.consensusPct !== undefined) record.consensusPct = summary.consensusPct;
      if (summary.leadPct !== undefined) record.leadPct = summary.leadPct;
      if (summary.coleadPct !== undefined) record.coleadPct = summary.coleadPct;
      if (summary.kappa !== undefined) record.kappa = summary.kappa;
      if (summary.falseExcl !== undefined) record.falseExcl = summary.falseExcl;
      record.timestamp = summary.timestamp || new Date().toLocaleDateString();
    }

    // Save to KV Hash
    const saveRes = await kvCommand(['HSET', 'soles:students', studentKey, JSON.stringify(record)]);
    if (saveRes.error) {
      return res.status(500).json({ success: false, error: saveRes.error });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      message: 'Student progress saved to cloud!',
      student: record
    });
  }

  // 3. DELETE: Remove student from gradebook
  if (req.method === 'DELETE') {
    const studentName = req.query.name;
    if (!studentName) {
      return res.status(400).json({ success: false, error: 'Student name required' });
    }

    const studentKey = studentName.trim().toLowerCase();
    await kvCommand(['HDEL', 'soles:students', studentKey]);

    return res.status(200).json({ success: true, message: `Removed ${studentName} from roster` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
