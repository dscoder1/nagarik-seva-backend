const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'supervisor', 'admin'], default: 'user' },
  area: { type: String, default: '' }, // for supervisors
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
