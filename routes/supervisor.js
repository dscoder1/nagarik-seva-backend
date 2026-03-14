const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { supervisorMiddleware } = require('../middleware/auth');

// Get complaints assigned to this supervisor
router.get('/complaints', supervisorMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ supervisorId: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark complaint
router.put('/complaints/:id', supervisorMiddleware, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const update = { status };
    if (rejectionReason) update.rejectionReason = rejectionReason;
    if (status === 'solved') update.resolvedAt = new Date();
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Supervisor report with period presets and area breakdown
router.get('/report', supervisorMiddleware, async (req, res) => {
  try {
    const { from, to, period } = req.query;
    let filter = { supervisorId: req.user.id };
    const now = new Date();

    if (period === 'today') {
      const start = new Date(now); start.setHours(0,0,0,0);
      filter.createdAt = { $gte: start, $lte: now };
    } else if (period === 'yesterday') {
      const start = new Date(now); start.setDate(start.getDate()-1); start.setHours(0,0,0,0);
      const end = new Date(now); end.setDate(end.getDate()-1); end.setHours(23,59,59,999);
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'last10') {
      const start = new Date(now); start.setDate(start.getDate()-10); start.setHours(0,0,0,0);
      filter.createdAt = { $gte: start, $lte: now };
    } else if (period === 'month') {
      const start = new Date(now); start.setDate(start.getDate()-30); start.setHours(0,0,0,0);
      filter.createdAt = { $gte: start, $lte: now };
    } else if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }

    const complaints = await Complaint.find(filter);
    const byStatus = { pending: 0, assigned: 0, 'in-progress': 0, solved: 0, rejected: 0 };
    const byType = { garbage: 0, streetlight: 0, water: 0, drainage: 0 };
    const areaMap = {};

    complaints.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byType[c.type] = (byType[c.type] || 0) + 1;
      const areaKey = (c.location || 'Unknown').split(',')[0].trim().substring(0, 35) || 'Unknown';
      if (!areaMap[areaKey]) areaMap[areaKey] = { area: areaKey, total: 0, solved: 0, pending: 0, rejected: 0 };
      areaMap[areaKey].total += 1;
      if (c.status === 'solved') areaMap[areaKey].solved += 1;
      else if (c.status === 'rejected') areaMap[areaKey].rejected += 1;
      else areaMap[areaKey].pending += 1;
    });

    const byArea = Object.values(areaMap).sort((a,b) => b.total - a.total).slice(0,10);
    res.json({ total: complaints.length, byStatus, byType, byArea });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
