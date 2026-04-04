const express = require('express');
const router  = express.Router();
const User    = require('../model/User');
const Notification = require('../model/Notification');

// Fetch a user profile by email.
router.get('/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ 
      name: user.name, 
      email: user.email, 
      role: user.role || 'user',
      avatar: user.avatar,
      cover: user.cover,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      followers: user.followers || [],
      following: user.following || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// Update a user
router.put('/:email', async (req, res) => {
  try {
    const { name, avatar, cover } = req.body;
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
    res.status(500).json({ error: 'Failed to update profile.' });
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

module.exports = router;
