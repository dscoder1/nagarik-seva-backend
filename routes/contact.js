const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, mobile, message } = req.body;
    const contact = await Contact.create({ userId: req.user.id, name, mobile, message });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
