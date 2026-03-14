const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userMobile: String,
  type: {
    type: String,
    enum: ['garbage', 'streetlight', 'water', 'drainage'],
    required: true
  },
  location: { type: String, required: true },
  description: { type: String, required: true },
  media: [{ type: String }], // file paths
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in-progress', 'solved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String, default: '' },
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  supervisorName: { type: String, default: '' },
  supervisorMobile: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
