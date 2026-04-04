/*
  Notification Model
*/

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The user to notify
  type: { type: String, required: true }, // e.g., 'follow'
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The user who triggered the notification
  message: { type: String },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
