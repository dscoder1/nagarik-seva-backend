const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Complaint = require('../models/Complaint');
const { authMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// Submit complaint
router.post('/', authMiddleware, upload.array('media', 5), async (req, res) => {
  try {
    const { type, location, description } = req.body;
    const media = req.files ? req.files.map(f => f.filename) : [];
    const complaint = await Complaint.create({
      userId: req.user.id,
      userName: req.user.name,
      userMobile: req.user.mobile,
      type, location, description, media
    });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get my complaints
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User report with period presets
router.get('/my-report', authMiddleware, async (req, res) => {
  try {
    const { from, to, period } = req.query;
    let filter = { userId: req.user.id };
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
    const byType = { garbage: 0, streetlight: 0, water: 0, drainage: 0 };
    const byStatus = { pending: 0, assigned: 0, 'in-progress': 0, solved: 0, rejected: 0 };
    const areaMap = {};

    complaints.forEach(c => {
      byType[c.type] = (byType[c.type] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      const areaKey = (c.location || 'Unknown').split(',')[0].trim().substring(0, 35) || 'Unknown';
      if (!areaMap[areaKey]) areaMap[areaKey] = { area: areaKey, total: 0, solved: 0, pending: 0, rejected: 0 };
      areaMap[areaKey].total += 1;
      if (c.status === 'solved') areaMap[areaKey].solved += 1;
      else if (c.status === 'rejected') areaMap[areaKey].rejected += 1;
      else areaMap[areaKey].pending += 1;
    });

    const byArea = Object.values(areaMap).sort((a,b) => b.total - a.total).slice(0,10);
    res.json({ total: complaints.length, byType, byStatus, byArea });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
