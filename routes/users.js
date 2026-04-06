const express = require('express');
const router  = express.Router();
const User    = require('../model/User');
const Post = require('../model/Post');
const Notification = require('../model/Notification');

async function anonymizeUserComments(userEmail) {
  const normalizedEmail = String(userEmail || '').toLowerCase();
  if (!normalizedEmail) return;

  const posts = await Post.find({
    $or: [
      { 'comments.authorEmail': normalizedEmail },
      { 'comments.replies.authorEmail': normalizedEmail },
    ],
  });

  for (const post of posts) {
    let changed = false;

    for (const comment of post.comments || []) {
      if (String(comment.authorEmail || '').toLowerCase() === normalizedEmail) {
        comment.body = '*comment deleted by user*';
        comment.isDeleted = true;
        comment.editedAt = new Date();
        changed = true;
      }

      for (const reply of comment.replies || []) {
        if (String(reply.authorEmail || '').toLowerCase() === normalizedEmail) {
            reply.body = '*comment deleted by user*';
            reply.isDeleted = true;
            reply.editedAt = new Date();
          changed = true;
        }
      }
    }

    if (changed) {
      await post.save();
    }
  }
}

function serializePublicUser(user) {
  return {
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    avatar: user.avatar,
    cover: user.cover,
    followersCount: user.followers ? user.followers.length : 0,
    followingCount: user.following ? user.following.length : 0,
    followers: user.followers || [],
    following: user.following || [],
  };
}

// Search users by name or email
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length < 2) {
      return res.json({ users: [] });
    }

    const currentUserEmail = req.headers['x-user-email'] || '';
    const searchTerm = query.trim();
    
    // Search by name or email (case insensitive)
    const users = await User.find({
      $and: [
        {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } }
          ]
        },

        { email: { $ne: currentUserEmail } },
        { isDisabled: { $ne: true } }
      ]
    })
    .select('name email avatar followers')
    .limit(10);

    // Check follow status for each user
    const currentUser = currentUserEmail ? await User.findOne({ email: currentUserEmail }) : null;
    const currentUserFollowing = currentUser ? currentUser.following || [] : [];

    const usersWithFollowStatus = users.map(user => ({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isFollowing: currentUserFollowing.some(f => f.email === user.email)
    }));

    res.json({ users: usersWithFollowStatus });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ error: 'Failed to search users.' });
  }
});

// Fetch a user profile by email.
router.get('/:email', async (req, res, next) => {
  try {
    const reservedRoutes = new Set(['notifications', 'status', 'search', 'admin']);
    if (reservedRoutes.has(String(req.params.email || '').toLowerCase())) {
      return next();
    }

    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user || user.isDisabled) return res.status(404).json({ error: 'User not found.' });

    res.json(serializePublicUser(user));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// Update a user
router.put('/:email', async (req, res) => {
  try {
    const { name, avatar, cover } = req.body;
    
    // Validate base64 data if provided
    if (avatar && avatar.startsWith('data:')) {
      // Check if it's a valid data URL format (PNG or JPEG only)
      const dataUrlPattern = /^data:image\/(jpeg|jpg|png);base64,/;
      if (!dataUrlPattern.test(avatar)) {
        return res.status(400).json({ error: 'Invalid avatar image format. Only PNG and JPEG are supported.' });
      }
      
      // Check size (base64 is ~1.37x larger than original, so 10MB limit = ~7.3MB original)
      if (avatar.length > 10 * 1024 * 1024) { // 10MB limit
        return res.status(400).json({ error: 'Avatar image too large. Maximum size is 10MB.' });
      }
    }
    
    if (cover && cover.startsWith('data:')) {
      // Check if it's a valid data URL format (PNG or JPEG only)
      const dataUrlPattern = /^data:image\/(jpeg|jpg|png);base64,/;
      if (!dataUrlPattern.test(cover)) {
        return res.status(400).json({ error: 'Invalid cover image format. Only PNG and JPEG are supported.' });
      }
      
      // Check size
      if (cover.length > 10 * 1024 * 1024) { // 10MB limit
        return res.status(400).json({ error: 'Cover image too large. Maximum size is 10MB.' });
      }
    }
    
    const updatedUser = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      { name, avatar, cover},
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json({
      name: updatedUser.name,
      avatar: updatedUser.avatar,
      cover: updatedUser.cover,
    });
  } catch (err) {
    console.error('Profile update error:', err);
    
    // Handle specific MongoDB errors
    if (err.name === 'BSONError' || err.message.includes('BSONObj size')) {
      return res.status(413).json({ error: 'Image data too large for database. Please use a smaller image.' });
    }
    
    res.status(500).json({ error: 'Failed to update profile. Please try with a smaller image.' });
  }
});

// Follow a user
router.post('/:email/follow', async (req, res) => {
  try {
    const { followerEmail } = req.body;
    
    if (!followerEmail) {
      return res.status(400).json({ error: 'Follower email is required.' });
    }

    const targetUserEmail = req.params.email.toLowerCase();
    const followerEmailLower = followerEmail.toLowerCase();

    if (targetUserEmail === followerEmailLower) {
      return res.status(400).json({ error: 'Cannot follow yourself.' });
    }

    // Find both users
    const targetUser = await User.findOne({ email: targetUserEmail });
    const followerUser = await User.findOne({ email: followerEmailLower });

    if (!targetUser) {
      return res.status(404).json({ error: 'User to follow not found.' });
    }
    if (!followerUser) {
      return res.status(404).json({ error: 'Follower user not found.' });
    }

    // Check if already following
    if (targetUser.followers && targetUser.followers.includes(followerEmailLower)) {
      return res.status(400).json({ error: 'Already following this user.' });
    }

    // Initialize arrays if they don't exist
    if (!targetUser.followers) targetUser.followers = [];
    if (!followerUser.following) followerUser.following = [];

    // Add to followers/following lists
    targetUser.followers.push(followerEmailLower);
    followerUser.following.push(targetUserEmail);

    await targetUser.save();
    await followerUser.save();

    // Create notification for the followed user
    await Notification.create({
      user: targetUser._id,
      type: 'follow',
      fromUser: followerUser._id,
      message: `${followerUser.name} started following you.`
    });

    res.json({ 
      message: 'Successfully followed user.',
      followersCount: targetUser.followers.length,
      followingCount: followerUser.following.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to follow user.' });
  }
});

// Unfollow a user
router.post('/:email/unfollow', async (req, res) => {
  try {
    const { followerEmail } = req.body;
    
    if (!followerEmail) {
      return res.status(400).json({ error: 'Follower email is required.' });
    }

    const targetUserEmail = req.params.email.toLowerCase();
    const followerEmailLower = followerEmail.toLowerCase();

    // Find both users
    const targetUser = await User.findOne({ email: targetUserEmail });
    const followerUser = await User.findOne({ email: followerEmailLower });

    if (!targetUser || !followerUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Remove from followers/following lists
    if (targetUser.followers) {
      targetUser.followers = targetUser.followers.filter(email => email !== followerEmailLower);
    }
    if (followerUser.following) {
      followerUser.following = followerUser.following.filter(email => email !== targetUserEmail);
    }

    await targetUser.save();
    await followerUser.save();

    res.json({ 
      message: 'Successfully unfollowed user.',
      followersCount: targetUser.followers ? targetUser.followers.length : 0,
      followingCount: followerUser.following ? followerUser.following.length : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unfollow user.' });
  }
});

// Check if user is following another user
router.get('/:email/following/:followerEmail', async (req, res) => {
  try {
    const targetUserEmail = req.params.email.toLowerCase();
    const followerEmailLower = req.params.followerEmail.toLowerCase();

    const targetUser = await User.findOne({ email: targetUserEmail });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isFollowing = targetUser.followers && targetUser.followers.includes(followerEmailLower);
    res.json({ isFollowing });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check following status.' });
  }
});

router.get('/:email/followers', async (req, res) => {
  try {
    const userEmail = req.params.email.toLowerCase();
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const followerEmails = user.followers || [];
    const followers = await User.find({ 
      email: { $in: followerEmails } 
    }).select('email displayName');

    res.json({ followers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get followers list.' });
  }
});

router.get('/:email/following', async (req, res) => {
  try {
    const userEmail = req.params.email.toLowerCase();
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const followingEmails = user.following || [];
    const following = await User.find({ 
      email: { $in: followingEmails } 
    }).select('email displayName');

    res.json({ following });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get following list.' });
  }
});

// Admin User Management Routes

// Helper function to check if user is admin
async function isAdminEmail(email) {
  if (!email) return false;
  const admin = await User.findOne({ email: String(email).toLowerCase(), role: 'admin' });
  return Boolean(admin);
}

// Get all users (admin only)
router.get('/admin/all', async (req, res) => {
  try {
    const adminEmail = String(req.query.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const users = await User.find({}, { password: 0 }) // Exclude password field
      .sort({ createdAt: -1 });
    
    const serializedUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isDisabled: user.isDisabled || false,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      createdAt: user.createdAt ? user.createdAt.getTime() : Date.now(),
      avatar: user.avatar
    }));

    res.json(serializedUsers);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Toggle user disabled status (admin only)
router.put('/:id/toggle-status', async (req, res) => {
  try {
    const adminEmail = String(req.body.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent admins from disabling other admins
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot disable admin accounts.' });
    }

    // Prevent admins from disabling themselves
    if (user.email === adminEmail) {
      return res.status(403).json({ error: 'Cannot disable your own account.' });
    }

    const wasDisabled = user.isDisabled;
    user.isDisabled = !user.isDisabled;
    await user.save();

    if (!wasDisabled && user.isDisabled) {
      await anonymizeUserComments(user.email);
    }

    // Send notification to user when account is disabled
    if (!wasDisabled && user.isDisabled) {
      const admin = await User.findOne({ email: adminEmail });
      await Notification.create({
        user: user._id,
        type: 'account_disabled',
        fromUser: admin ? admin._id : null,
        message: '🚫 Your account has been disabled by an administrator. You will be logged out shortly.',
        isRead: false
      });
    }

    res.json({ 
      message: `User ${user.isDisabled ? 'disabled' : 'enabled'} successfully.`,
      isDisabled: user.isDisabled 
    });
  } catch (err) {
    console.error('Failed to toggle user status:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// Delete user (admin only)
router.delete('/:id/delete', async (req, res) => {
  try {
    const adminEmail = String(req.body.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent admins from deleting other admins
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin accounts.' });
    }

    // Prevent admins from deleting themselves
    if (user.email === adminEmail) {
      return res.status(403).json({ error: 'Cannot delete your own account.' });
    }

    await anonymizeUserComments(user.email);

    await anonymizeUserComments(user.email);

    await Notification.deleteMany({
      $or: [
        { user: user._id },
        { fromUser: user._id }
      ]
    });

    await anonymizeUserComments(user.email);

    await Notification.deleteMany({
      $or: [
        { user: user._id },
        { fromUser: user._id }
      ]
    });

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully.' });

  } catch (err) {
    console.error('Failed to delete user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Send warning message to user (admin only)
router.post('/:id/warn', async (req, res) => {
  try {
    const adminEmail = String(req.body.adminEmail || '').toLowerCase();
    const { message } = req.body;

    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Warning message is required.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent admins from warning other admins
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot warn admin accounts.' });
    }

    // Create notification in database
    const Notification = require('../model/Notification');
    const admin = await User.findOne({ email: adminEmail });
    
    await Notification.create({
      user: user._id,
      type: 'warning',
      fromUser: admin ? admin._id : null,
      message: `⚠️ Administrative Warning: ${message.trim()}`,
      isRead: false
    });

    res.json({ 
      message: 'Warning sent successfully.',
      recipientEmail: user.email,
      warningText: message.trim()
    });
  } catch (err) {
    console.error('Failed to send warning:', err);
    res.status(500).json({ error: 'Failed to send warning.' });
  }
});

// Get notifications for current user
router.get('/notifications', async (req, res) => {
  try {
    const userEmail = String(req.query.email || '').toLowerCase();
    if (!userEmail) {
      return res.status(400).json({ error: 'Email required.' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const Notification = require('../model/Notification');
    const notifications = await Notification.find({ user: user._id })
      .populate('fromUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    const serializedNotifications = notifications.map(notif => ({
      id: notif._id.toString(),
      type: notif.type,
      message: notif.message,
      postId: notif.postId || null,
      read: notif.isRead,
      time: notif.createdAt.getTime(),
      fromUser: notif.fromUser ? {
        name: notif.fromUser.name,
        email: notif.fromUser.email
      } : null
    }));

    res.json(serializedNotifications);
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const userEmail = String(req.body.email || '').toLowerCase();
    if (!userEmail) {
      return res.status(400).json({ error: 'Email required.' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const Notification = require('../model/Notification');
    const notification = await Notification.findOne({ 
      _id: req.params.id,
      user: user._id 
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

// Mark all notifications as read for current user
router.put('/notifications/read-all', async (req, res) => {
  try {
    const userEmail = String(req.query.email || req.body.email || '').toLowerCase();
    if (!userEmail) {
      return res.status(400).json({ error: 'Email required.' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const Notification = require('../model/Notification');
    const result = await Notification.updateMany(
      { user: user._id, isRead: false },
      { $set: { isRead: true } },
    );

    res.json({
      message: 'Notifications marked as read.',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read.' });
  }
});

// Clear all notifications for current user
router.delete('/notifications', async (req, res) => {
  try {
    const userEmail = String(req.query.email || req.body.email || '').toLowerCase();
    if (!userEmail) {
      return res.status(400).json({ error: 'Email required.' });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const Notification = require('../model/Notification');
    const result = await Notification.deleteMany({ user: user._id });

    res.json({ message: 'Notifications cleared.', deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('Failed to clear notifications:', err);
    res.status(500).json({ error: 'Failed to clear notifications.' });
  }
});

// Get latest notifications since a timestamp (for polling)
router.get('/notifications/latest', async (req, res) => {
  try {
    const { email, since } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user first
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 5 * 60 * 1000); // Default to 5 minutes ago
    
    const notifications = await Notification.find({ 
      user: user._id,
      createdAt: { $gt: sinceDate },
      isRead: false
    }).sort({ createdAt: -1 });

    const serializedNotifications = notifications.map((notif) => ({
      id: notif._id.toString(),
      type: notif.type,
      message: notif.message,
      postId: notif.postId || null,
      read: notif.isRead,
      time: notif.createdAt.getTime(),
    }));

    res.json(serializedNotifications);
  } catch (err) {
    console.error('Error fetching latest notifications:', err);
    res.status(500).json({ error: 'Failed to fetch latest notifications' });
  }
});

// Check user account status (for real-time account disabling detection)
router.get('/status', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return 410 Gone for deleted accounts to distinguish from 404 Not Found
      return res.status(410).json({ 
        error: 'Account has been deleted',
        deleted: true 
      });
    }

    res.json({ 
      isDisabled: user.isDisabled || false,
      role: user.role || 'user',
      email: user.email,
      deleted: false
    });
  } catch (err) {
    console.error('Error checking user status:', err);
    res.status(500).json({ error: 'Failed to check user status' });
  }
});

module.exports = router;
