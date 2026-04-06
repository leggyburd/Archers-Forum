const express = require('express');
const router  = express.Router();
const Post    = require('../model/Post');
const User    = require('../model/User');
const Notification = require('../model/Notification');
const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');

const DEFAULT_AVATAR = '/assets/default_pfp.png';

// Configure uploads for post media.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    ALLOWED_MIME.has(file.mimetype) ? cb(null, true) : cb(new Error('Unsupported file type.'));
  },
});

function normalizeMediaUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  if (/^https?:/i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const normalizedPath = (parsed.pathname || '').replace(/\\/g, '/');
      if (normalizedPath.includes('/uploads/')) {
        return normalizedPath.slice(normalizedPath.indexOf('/uploads/'));
      }
      return raw;
    } catch (_err) {
      // Fall through.
    }
  }

  if (/^data:/i.test(raw)) return raw;
  if (/^blob:/i.test(raw)) return null;

  let normalized = raw.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.startsWith('/uploads/')) return normalized;
  if (normalized.includes('/uploads/')) {
    return normalized.slice(normalized.indexOf('/uploads/'));
  }
  return normalized;
}

async function cleanupRemovedMediaFiles(previousMediaUrls, nextMediaUrls) {
  const previous = new Set((previousMediaUrls || []).map(normalizeMediaUrl).filter(Boolean));
  const next = new Set((nextMediaUrls || []).map(normalizeMediaUrl).filter(Boolean));
  const removed = Array.from(previous).filter((url) => !next.has(url));

  await Promise.all(
    removed.map(async (url) => {
      if (!String(url || '').startsWith('/uploads/')) return;

      const filePath = path.join(UPLOAD_DIR, path.basename(url));
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        if (err && err.code !== 'ENOENT') {
          console.error('Failed to delete removed media file:', filePath, err.message);
        }
      }
    }),
  );
}

// Normalize Mongo documents into frontend-friendly objects.
// The client expects string ids and numeric timestamps.
function serializePost(post) {
  const obj = post.toObject ? post.toObject() : { ...post };

  obj.id = obj._id.toString();
  obj.createdAt = obj.createdAt instanceof Date
    ? obj.createdAt.getTime()
    : obj.createdAt;
  obj.mediaUrls = (obj.mediaUrls || []).map(normalizeMediaUrl).filter(Boolean);

  obj.comments = (obj.comments || []).map((c) => {
    c.id = c._id.toString();
    c.createdAt = c.createdAt instanceof Date ? c.createdAt.getTime() : c.createdAt;
    c.editedAt = c.editedAt instanceof Date ? c.editedAt.getTime() : c.editedAt || null;

    c.replies = (c.replies || []).map((r) => {
      r.id = r._id.toString();
      r.createdAt = r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt;
      r.editedAt = r.editedAt instanceof Date ? r.editedAt.getTime() : r.editedAt || null;
      r.replyToId = r.replyToId ? String(r.replyToId) : null;
      r.replyToName = r.replyToName || null;
      return r;
    });

    return c;
  });


  delete obj.reports;

  return obj;
}

function serializeReportedPost(post) {
  const obj = post.toObject ? post.toObject() : { ...post };

  obj.id = obj._id.toString();
  obj.createdAt = obj.createdAt instanceof Date
    ? obj.createdAt.getTime()
    : obj.createdAt;

  obj.reports = (obj.reports || []).map((r) => ({
    id: r._id ? r._id.toString() : undefined,
    reporterName: r.reporterName,
    reporterEmail: r.reporterEmail,
    reason: r.reason,
    details: r.details || '',
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
  }));

  obj.reportCount = obj.reports.length;
  return obj;
}

async function isAdminEmail(email) {
  if (!email) return false;
  const admin = await User.findOne({ email: String(email).toLowerCase(), role: 'admin' });
  return Boolean(admin);
}

async function createPostNotification({ recipientEmail, actorEmail, type, message, postId }) {
  try {
    const recipient = await User.findOne({ email: String(recipientEmail || '').toLowerCase() });
    if (!recipient) return;

    const normalizedActorEmail = String(actorEmail || '').toLowerCase();
    if (normalizedActorEmail && normalizedActorEmail === String(recipient.email).toLowerCase()) {
      return;
    }

    let actor = null;
    if (normalizedActorEmail) {
      actor = await User.findOne({ email: normalizedActorEmail });
    }

    await Notification.create({
      user: recipient._id,
      type,
      fromUser: actor ? actor._id : null,
      message,
      postId: String(postId || ''),
      isRead: false,
    });
  } catch (err) {
    console.error('Failed to create post notification:', err.message);
  }
}

async function createCommentThreadNotifications({ post, actorEmail, actorName, parentCommentId }) {
  const recipients = new Map();
  const normalizedActorEmail = String(actorEmail || '').toLowerCase();

  if (!post || !normalizedActorEmail) return;

  if (post.authorEmail && String(post.authorEmail).toLowerCase() !== normalizedActorEmail) {
    recipients.set(String(post.authorEmail).toLowerCase(), {
      type: 'comment',
      message: `${actorName} commented on your post: "${post.title}"`,
    });
  }

  if (parentCommentId) {
    const parentId = String(parentCommentId);
    let parentEntry = post.comments.id(parentId);

    if (!parentEntry) {
      for (const comment of post.comments || []) {
        const matchedReply = (comment.replies || []).find(
          (reply) => reply._id && reply._id.toString() === parentId,
        );
        if (matchedReply) {
          parentEntry = matchedReply;
          break;
        }
      }
    }

    if (parentEntry && parentEntry.authorEmail) {
      const parentAuthorEmail = String(parentEntry.authorEmail).toLowerCase();
      if (parentAuthorEmail !== normalizedActorEmail) {
        recipients.set(parentAuthorEmail, {
          type: 'reply',
          message: `${actorName} replied to your comment on "${post.title}"`,
        });
      }
    }
  }

  await Promise.all(
    Array.from(recipients.entries()).map(([recipientEmail, payload]) =>
      createPostNotification({
        recipientEmail,
        actorEmail: normalizedActorEmail,
        type: payload.type,
        message: payload.message,
        postId: post._id,
      }),
    ),
  );
}

async function createAdminReportNotifications({ reporterEmail, reporterName, post }) {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id email');
    if (!admins.length) return;

    const normalizedReporter = String(reporterEmail || '').toLowerCase();
    const reporter = await User.findOne({ email: normalizedReporter }).select('_id');

    const message = `${reporterName} reported a post: "${post.title}"`;

    const notifications = admins
      .filter((admin) => String(admin.email || '').toLowerCase() !== normalizedReporter)
      .map((admin) => ({
        user: admin._id,
        type: 'report',
        fromUser: reporter ? reporter._id : null,
        message,
        postId: String(post._id),
        isRead: false,
      }));

    if (notifications.length) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Failed to create admin report notifications:', err.message);
  }
}

// List posts with optional filtering and sorting.
// Query params: search, category, sort (newest|oldest|top), author.
router.get('/', async (req, res) => {
  try {
    const { search, category, sort, author } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (category && category !== 'All') filter.category = category;
    if (author) filter.authorEmail = author;

    if (search) {
      const q = search.trim();
      filter.$or = [
        { title:      { $regex: q, $options: 'i' } },
        { body:       { $regex: q, $options: 'i' } },
        { category:   { $regex: q, $options: 'i' } },
        { tags:       { $in: [new RegExp(q, 'i')] } },
        { authorName: { $regex: q, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 }; // Default to newest posts first.
    if (sort === 'oldest') sortObj = { createdAt: 1 };
    if (sort === 'top')    sortObj = { score: -1 };

    const feedFilter = { ...filter, isDeleted: { $ne: true } };
    const posts = await Post.find(feedFilter).sort(sortObj);

    // Fetch avatars for all participant emails in the feed.
    const participantEmails = new Set();
    posts.forEach((post) => {
      if (post.authorEmail) participantEmails.add(post.authorEmail);
      (post.comments || []).forEach((comment) => {
        if (comment.authorEmail) participantEmails.add(comment.authorEmail);
        (comment.replies || []).forEach((reply) => {
          if (reply.authorEmail) participantEmails.add(reply.authorEmail);
        });
      });
    });

    const users = await User.find({ email: { $in: Array.from(participantEmails) } });
    const avatarMap = {};
    users.forEach(u => {
      avatarMap[u.email] = u.avatar || DEFAULT_AVATAR;
    });

    const serialized = posts.map(post => {
      const obj = serializePost(post);
      obj.authorAvatar = avatarMap[obj.authorEmail] || DEFAULT_AVATAR;
      obj.comments = (obj.comments || []).map((comment) => ({
        ...comment,
        authorAvatar: avatarMap[comment.authorEmail] || DEFAULT_AVATAR,
        replies: (comment.replies || []).map((reply) => ({
          ...reply,
          authorAvatar: avatarMap[reply.authorEmail] || DEFAULT_AVATAR,
        })),
      }));
      return obj;
    });
    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// Return posts that currently have reports (admin only).
router.get('/reported', async (req, res) => {
  try {
    const adminEmail = String(req.query.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const posts = await Post.find({ 'reports.0': { $exists: true } }).sort({ createdAt: -1 });
    res.json(posts.map(serializeReportedPost));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reported posts.' });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const { since } = req.query;

    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 5 * 60 * 1000);

    const posts = await Post.find({
      createdAt: { $gt: sinceDate },
      isDeleted: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(20);

    const participantEmails = new Set();
    posts.forEach((post) => {
      if (post.authorEmail) participantEmails.add(post.authorEmail);
      (post.comments || []).forEach((comment) => {
        if (comment.authorEmail) participantEmails.add(comment.authorEmail);
        (comment.replies || []).forEach((reply) => {
          if (reply.authorEmail) participantEmails.add(reply.authorEmail);
        });
      });
    });

    const users = await User.find({ email: { $in: Array.from(participantEmails) } });
    const avatarMap = {};
    users.forEach((u) => {
      avatarMap[u.email] = u.avatar || DEFAULT_AVATAR;
    });

    const serializedPosts = posts.map((post) => {
      const obj = serializePost(post);
      obj.authorAvatar = avatarMap[obj.authorEmail] || DEFAULT_AVATAR;
      obj.comments = (obj.comments || []).map((comment) => ({
        ...comment,
        authorAvatar: avatarMap[comment.authorEmail] || DEFAULT_AVATAR,
        replies: (comment.replies || []).map((reply) => ({
          ...reply,
          authorAvatar: avatarMap[reply.authorEmail] || DEFAULT_AVATAR,
        })),
      }));
      return obj;
    });
    res.json(serializedPosts);
  } catch (err) {
    console.error('Error fetching latest posts:', err);
    res.status(500).json({ error: 'Failed to fetch latest posts' });
  }
});

router.get('/comments/latest', async (req, res) => {
  try {
    const { since } = req.query;

    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 5 * 60 * 1000);

    const posts = await Post.find({
      isDeleted: { $ne: true },
      $or: [
        { 'comments.createdAt': { $gt: sinceDate } },
        { 'comments.replies.createdAt': { $gt: sinceDate } }
      ]
    });

    const participantEmails = new Set();
    posts.forEach((post) => {
      if (post.authorEmail) participantEmails.add(post.authorEmail);
      (post.comments || []).forEach((comment) => {
        if (comment.authorEmail) participantEmails.add(comment.authorEmail);
        (comment.replies || []).forEach((reply) => {
          if (reply.authorEmail) participantEmails.add(reply.authorEmail);
        });
      });
    });

    const users = await User.find({ email: { $in: Array.from(participantEmails) } });
    const avatarMap = {};
    users.forEach((u) => {
      avatarMap[u.email] = u.avatar || DEFAULT_AVATAR;
    });

    const postsWithNewComments = [];

    posts.forEach(post => {
      let hasNewContent = false;
      const serializedPost = serializePost(post);

      serializedPost.comments = serializedPost.comments.filter(comment => {
        const commentTime = new Date(comment.createdAt);
        const isNewComment = commentTime > sinceDate;

        comment.replies = comment.replies.filter(reply => {
          const replyTime = new Date(reply.createdAt);
          return replyTime > sinceDate;
        });

        const hasNewReplies = comment.replies.length > 0;

        if (isNewComment || hasNewReplies) {
          hasNewContent = true;
          return true;
        }

        return false;
      });

      if (hasNewContent) {
        serializedPost.authorAvatar = avatarMap[serializedPost.authorEmail] || DEFAULT_AVATAR;
        serializedPost.comments = (serializedPost.comments || []).map((comment) => ({
          ...comment,
          authorAvatar: avatarMap[comment.authorEmail] || DEFAULT_AVATAR,
          replies: (comment.replies || []).map((reply) => ({
            ...reply,
            authorAvatar: avatarMap[reply.authorEmail] || DEFAULT_AVATAR,
          })),
        }));
        postsWithNewComments.push(serializedPost);
      }
    });

    res.json(postsWithNewComments);
  } catch (err) {
    console.error('Error fetching latest comments:', err);
    res.status(500).json({ error: 'Failed to fetch latest comments' });
  }
});

// Fetch one post by id.
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json(serializePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post.' });
  }
});

// Create a new post.
router.post('/', upload.array('media', 10), async (req, res) => {
  try {
    const { title, body, category, tags, authorName, authorEmail } = req.body;

    if (!title || !body || !category || !authorName || !authorEmail) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const mediaUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);

    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : (tags || []);

    const post = await Post.create({
      title,
      body,
      category,
      tags: parsedTags,
      authorName,
      authorEmail,
      mediaUrls,
    });

    res.status(201).json(serializePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// Update an existing post.
router.put('/:id', upload.array('media', 10), async (req, res) => {
  try {
    const { title, body, category, tags, email, keptMediaUrls } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const requesterEmail = String(email || '').trim().toLowerCase();
    const ownerEmail = String(post.authorEmail || '').trim().toLowerCase();

    if (ownerEmail !== requesterEmail) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    if (title    !== undefined) post.title    = title;
    if (body     !== undefined) post.body     = body;
    if (category !== undefined) post.category = category;
    if (tags     !== undefined) {
      post.tags = typeof tags === 'string'
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : Array.isArray(tags)
          ? tags.map((t) => String(t || '').trim()).filter(Boolean)
          : tags;
    }

    const previousMediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls.slice() : [];

    let retainedMediaUrls = [];
    if (keptMediaUrls) {
      try {
        const parsed = JSON.parse(keptMediaUrls);
        if (Array.isArray(parsed)) {
          retainedMediaUrls = parsed.map(normalizeMediaUrl).filter(Boolean);
        }
      } catch (_err) {
        retainedMediaUrls = String(keptMediaUrls)
          .split(',')
          .map((url) => normalizeMediaUrl(url))
          .filter(Boolean);
      }
    }

    const uploadedMediaUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);
    
    if ((req.files && req.files.length > 0) || keptMediaUrls !== undefined) {
      post.mediaUrls = [...retainedMediaUrls, ...uploadedMediaUrls];
    }

    await post.save();
    await cleanupRemovedMediaFiles(previousMediaUrls, post.mediaUrls);
    res.json(serializePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update post.' });
  }
});

// Delete a post.
router.delete('/:id', async (req, res) => {
  try {
    const { email, role } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    // Allow if the user is an owner or admin
    if (post.authorEmail !== email && role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    post.isDeleted = true; // Soft delete
    await post.save();
    res.json({ message: 'Post moved to trash.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// Apply a signed vote delta to a post score.
// Body: { delta: Number }.
router.put('/:id/vote', async (req, res) => {
  try {
    const delta = Number(req.body.delta) || 0;
    const voterName = String(req.body.voterName || 'Someone').trim() || 'Someone';
    const voterEmail = String(req.body.voterEmail || '').toLowerCase();

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    post.score = (post.score || 0) + delta;
    await post.save();

    if (delta > 0) {
      await createPostNotification({
        recipientEmail: post.authorEmail,
        actorEmail: voterEmail,
        type: 'like',
        message: `${voterName} liked your post: "${post.title}"`,
        postId: post._id,
      });
    }

    res.json({ score: post.score });
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote.' });
  }
});

router.post('/:id/report', async (req, res) => {
  try {
    const { reporterName, reporterEmail, reason, details } = req.body;

    if (!reporterName || !reporterEmail || !reason) {
      return res.status(400).json({ error: 'Missing required report fields.' });
    }

    // Check if reporter is an admin
    if (await isAdminEmail(reporterEmail)) {
      return res.status(403).json({ error: 'Admins cannot report posts.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (post.authorEmail === reporterEmail) {
      return res.status(400).json({ error: 'You cannot report your own post.' });
    }

    post.reports.push({
      reporterName,
      reporterEmail,
      reason,
      details: String(details || '').trim(),
      createdAt: new Date(),
    });

    await post.save();
    await createAdminReportNotifications({
      reporterEmail,
      reporterName,
      post,
    });

    res.status(201).json({ message: 'Report submitted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

// Clear all reports on a post (admin only).
router.put('/:id/reports/resolve', async (req, res) => {
  try {
    const adminEmail = String(req.body.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    post.reports = [];
    await post.save();

    res.json({ message: 'Reports resolved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve reports.' });
  }
});

router.delete('/:id/reports/delete', async (req, res) => {
  try {
    const adminEmail = String(req.body.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    res.json({ message: 'Reported post deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reported post.' });
  }
});


router.post('/:id/comments', async (req, res) => {
  try {
    const { body, authorName, authorEmail, parentCommentId } = req.body;

    if (!body || !authorName || !authorEmail) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const newEntry = { authorName, authorEmail, body, score: 0, createdAt: new Date(), replies: [] };

    if (parentCommentId) {
      const parentId = String(parentCommentId);

      const topLevelParent = post.comments.id(parentId);
      if (topLevelParent) {
        topLevelParent.replies.push(newEntry);
      } else {
        let owningComment = null;
        let parentReply = null;
        for (const comment of post.comments) {
          const matchedReply = (comment.replies || []).find(
            (reply) => reply._id && reply._id.toString() === parentId,
          );
          if (matchedReply) {
            owningComment = comment;
            parentReply = matchedReply;
            break;
          }
        }

        if (!owningComment || !parentReply) {
          return res.status(404).json({ error: 'Parent comment not found.' });
        }

        owningComment.replies.push({
          ...newEntry,
          replyToId: parentId,
          replyToName: parentReply.authorName || null,
        });
      }
    } else {
      post.comments.push(newEntry);
    }

    await post.save();

    await createCommentThreadNotifications({
      post,
      actorEmail: authorEmail,
      actorName: authorName,
      parentCommentId,
    });

    res.status(201).json(serializePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const requesterEmail = String(req.body.authorEmail || '').toLowerCase();
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const cid = req.params.commentId;

    const markDeleted = (entry) => {
      entry.body = '*comment deleted by user*';
      entry.isDeleted = true;
      entry.editedAt = new Date();

      // Do NOT overwrite authorName or authorEmail here
      // We still want the original identity preserved unless the account itself is gone
    };

    const topComment = post.comments.id(cid);
    if (topComment) {
      if (requesterEmail && String(topComment.authorEmail || '').toLowerCase() !== requesterEmail) {
        const requester = await User.findOne({ email: requesterEmail });
        if (!requester || requester.role !== 'admin') {
          return res.status(403).json({ error: 'You can only delete your own comment.' });
        }
      }

      markDeleted(topComment);
      await post.save();
      return res.json(serializePost(post));
    }

    let targetReply = null;
    for (const c of post.comments) {
      const reply = (c.replies || []).find(
        (r) => r._id && r._id.toString() === cid
      );
      if (reply) {
        targetReply = reply;
        break;
      }
    }

    if (!targetReply) return res.status(404).json({ error: 'Comment not found.' });

    if (requesterEmail && String(targetReply.authorEmail || '').toLowerCase() !== requesterEmail) {
      const requester = await User.findOne({ email: requesterEmail });
      if (!requester || requester.role !== 'admin') {
        return res.status(403).json({ error: 'You can only delete your own comment.' });
      }
    }

    markDeleted(targetReply);
    await post.save();
    res.json(serializePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

router.put('/:id/comments/:commentId/vote', async (req, res) => {
  try {
    const delta = Number(req.body.delta) || 0;

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const cid = req.params.commentId;
    const topComment = post.comments.id(cid);
    if (topComment) {
      topComment.score = (topComment.score || 0) + delta;
      await post.save();
      return res.json(serializePost(post));
    }

    let targetReply = null;
    for (const comment of post.comments) {
      const reply = (comment.replies || []).find(
        (r) => r._id && r._id.toString() === cid,
      );
      if (reply) {
        targetReply = reply;
        break;
      }
    }

    if (!targetReply) return res.status(404).json({ error: 'Comment not found.' });

    targetReply.score = (targetReply.score || 0) + delta;
    await post.save();
    res.json(serializePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Failed to vote on comment.' });
  }
});

// Admins can get all deleted posts
// Admins can get all deleted posts
router.get('/deleted/all', async (req, res) => {
  try {
    const adminEmail = String(req.query.adminEmail || '').toLowerCase();
    console.log("DEBUG: Trash Bin requested by:", adminEmail);

    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const posts = await Post.find({ isDeleted: true }).sort({ createdAt: -1 });
    
    console.log("DEBUG: Found " + posts.length + " deleted posts.");
    res.json(posts.map(serializePost));
  } catch (err) {
    console.error("DEBUG TRASH ERROR:", err);
    res.status(500).json({ error: 'Failed to fetch trash bin.' });
  }
});

router.put('/:id/restore', async (req, res) => {
  try {
    const adminEmail = String(req.body.adminEmail || '').toLowerCase();
    if (!(await isAdminEmail(adminEmail))) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    post.isDeleted = false; 
    await post.save();

    res.json({ message: 'Post restored.', post: serializePost(post) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore post.' });
  }
});

module.exports = router;
