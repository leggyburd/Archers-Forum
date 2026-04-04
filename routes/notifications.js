const express = require('express');
const router = express.Router();
const Notification = require('../model/Notification');
const User = require('../model/User');

// Get most recent notifications for a user
router.get('/:userId', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.params.userId })
      .populate('fromUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(30);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Mark notification as read
router.post('/read/:notificationId', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.notificationId, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

module.exports = router;
