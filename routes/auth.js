const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, mobile, password } = req.body;
    const exists = await User.findOne({ mobile });
    if (exists) return res.status(400).json({ message: 'Mobile already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, mobile, password: hashed });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, mobile: user.mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login (users + supervisors)
router.post('/login', async (req, res) => {
  try {
    const { mobile, password } = req.body;

    // Admin check
    if (mobile === process.env.ADMIN_PHONE && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ id: 'admin', role: 'admin', name: 'Administrator', mobile }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: 'admin', name: 'Administrator', mobile, role: 'admin' } });
    }

    const user = await User.findOne({ mobile });
    if (!user) return res.status(400).json({ message: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, mobile: user.mobile, area: user.area }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role, area: user.area } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
