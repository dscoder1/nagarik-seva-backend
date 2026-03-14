const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Contact = require('../models/Contact');
const { adminMiddleware } = require('../middleware/auth');

// Get dashboard stats
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const total = await Complaint.countDocuments();
    const solved = await Complaint.countDocuments({ status: 'solved' });
    const rejected = await Complaint.countDocuments({ status: 'rejected' });
    const pending = await Complaint.countDocuments({ status: 'pending' });
    const assigned = await Complaint.countDocuments({ status: 'assigned' });
    const users = await User.countDocuments({ role: 'user' });
    const supervisors = await User.countDocuments({ role: 'supervisor' });
    res.json({ total, solved, rejected, pending, assigned, users, supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all complaints with filter
router.get('/complaints', adminMiddleware, async (req, res) => {
  try {
    const { from, to, status, type } = req.query;
    let filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update complaint status
router.put('/complaints/:id', adminMiddleware, async (req, res) => {
  try {
    const { status, rejectionReason, supervisorId } = req.body;
    const update = { status };
    if (rejectionReason) update.rejectionReason = rejectionReason;
    if (status === 'solved') update.resolvedAt = new Date();
    if (supervisorId) {
      const sup = await User.findById(supervisorId);
      if (sup) {
        update.supervisorId = supervisorId;
        update.supervisorName = sup.name;
        update.supervisorMobile = sup.mobile;
        update.status = 'assigned';
      }
    }
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all users
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all supervisors
router.get('/supervisors', adminMiddleware, async (req, res) => {
  try {
    const supervisors = await User.find({ role: 'supervisor' }).select('-password');
    res.json(supervisors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add supervisor
router.post('/supervisors', adminMiddleware, async (req, res) => {
  try {
    const { name, mobile, password, area } = req.body;
    const exists = await User.findOne({ mobile });
    if (exists) return res.status(400).json({ message: 'Mobile already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const supervisor = await User.create({ name, mobile, password: hashed, role: 'supervisor', area });
    res.json(supervisor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete supervisor
router.delete('/supervisors/:id', adminMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supervisor deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all contacts
router.get('/contacts', adminMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Report data — with area-wise breakdown and period presets
router.get('/report', adminMiddleware, async (req, res) => {
  try {
    const { from, to, period } = req.query;
    let filter = {};
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

    const byArea = Object.values(areaMap).sort((a,b) => b.total - a.total).slice(0, 15);
    res.json({ total: complaints.length, byType, byStatus, byArea });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
