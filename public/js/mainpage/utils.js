/*
  Main Page Utility Functions
  This module provides various utility functions for the main page, such as string manipulation, date formatting, localStorage handling, and notification management. These functions are designed to be reusable across different components of the main page to maintain consistency and reduce code duplication
*/

(function () {
  let notificationPollTimer = null;
  let latestNotificationTimestamp = 0;

  function truncateName(name, maxChars = 16) {
    const text = String(name || "").trim();
    if (!text) return "User";
    if (text.length <= maxChars) return text;
    return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
  }

  function hydrateHeaderUser() {
    const headerName = localStorage.getItem("af_user") || "User";
    const email = localStorage.getItem("af_user_email");
    const avatar = email ? localStorage.getItem(`af_profile_avatar_${email}`) : null;

    const nameNode =
      document.getElementById("headerUserName") || document.querySelector(".user-name");
    if (nameNode) {
      nameNode.textContent = truncateName(headerName, 16);
      nameNode.title = headerName;
    }

    const avatarNode =
      document.getElementById("headerAvatar") || document.querySelector(".user-avatar-img");
    if (avatarNode) avatarNode.src = avatar || "/assets/default_pfp.png";
  }

  function getAuthorAvatar(authorEmail, serverAvatar) {
    if (typeof serverAvatar === 'string' && serverAvatar.trim() !== "") {
      return serverAvatar;
    }
    const stored = authorEmail ? localStorage.getItem(`af_profile_avatar_${authorEmail}`) : null;
    return stored || "/assets/default_pfp.png";
  }

  function getProfileHref(authorEmail) {
    return `/profile?email=${encodeURIComponent(authorEmail || "")}`;
  }

  function navigateWithFade(href) {
    document.body.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.href = href;
    }, 260);
  }

  function loadJSON(key, fallback) {
    return AF_STORAGE.load(key, fallback);
  }

  function saveJSON(key, value) {
    AF_STORAGE.save(key, value);
  }

  function makeId(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now() +
      "_" +
      Math.random().toString(16).slice(2)
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function normalizeTags(input) {
    if (!input) return [];
    return input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.replace(/\s+/g, " "))
      .slice(0, 8);
  }

  function categorySlug(cat) {
    return String(cat || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function getNotificationStorageKey(email) {
    return `af_notifs_${String(email || '').toLowerCase()}`;
  }

  function areNotificationsEquivalent(a, b) {
    if (!a || !b) return false;

    const aMessage = String(a.message || "").trim();
    const bMessage = String(b.message || "").trim();
    const aType = String(a.type || "").trim();
    const bType = String(b.type || "").trim();
    const aPostId = String(a.postId || "").trim();
    const bPostId = String(b.postId || "").trim();

    if (aMessage !== bMessage || aType !== bType || aPostId !== bPostId) {
      return false;
    }

    const aTime = Number(a.time || 0);
    const bTime = Number(b.time || 0);
    return Math.abs(aTime - bTime) <= 15000;
  }

  function dedupeNotifications(notifs) {
    const unique = [];

    (notifs || []).forEach((incoming) => {
      const index = unique.findIndex((item) => {
        if (item.id && incoming.id && String(item.id) === String(incoming.id)) return true;
        return areNotificationsEquivalent(item, incoming);
      });

      if (index === -1) {
        unique.push(incoming);
        return;
      }

      const existing = unique[index];
      unique[index] = {
        ...existing,
        ...incoming,
        read: Boolean(existing.read || incoming.read),
        time: Math.max(Number(existing.time || 0), Number(incoming.time || 0)),
        id: existing.id || incoming.id,
      };
    });

    return unique.sort((a, b) => Number(b.time || 0) - Number(a.time || 0));
  }

  function saveNotificationsToStorage(email, notifications) {
    if (!email) return [];
    const normalized = dedupeNotifications(notifications).slice(0, 20);
    localStorage.setItem(getNotificationStorageKey(email), JSON.stringify(normalized));
    const newest = normalized.reduce((max, item) => Math.max(max, Number(item.time || 0)), 0);
    latestNotificationTimestamp = Math.max(latestNotificationTimestamp, newest);
    return normalized;
  }

  function loadNotificationsFromStorage(email) {
    if (!email) return [];
    const raw = JSON.parse(localStorage.getItem(getNotificationStorageKey(email)) || '[]');
    return saveNotificationsToStorage(email, raw);
  }

  async function fetchNotificationsFromServer() {
    const email = localStorage.getItem('af_user_email');
    if (!email) return [];

    try {
      const response = await fetch(`/api/users/notifications?email=${encodeURIComponent(email)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const notifications = await response.json();
      return saveNotificationsToStorage(email, notifications);
    } catch (err) {
      console.error('Failed to fetch notifications from server:', err);
      return loadNotificationsFromStorage(email);
    }
  }

  async function fetchLatestNotifications() {
    const email = localStorage.getItem('af_user_email');
    if (!email) return [];

    try {
      const response = await fetch(
        `/api/users/notifications/latest?email=${encodeURIComponent(email)}&since=${encodeURIComponent(latestNotificationTimestamp)}`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const incoming = await response.json();
      if (!Array.isArray(incoming) || incoming.length === 0) {
        return loadNotificationsFromStorage(email);
      }

      const existing = loadNotificationsFromStorage(email);
      return saveNotificationsToStorage(email, [...incoming, ...existing]);
    } catch (err) {
      console.error('Failed to fetch latest notifications:', err);
      return loadNotificationsFromStorage(email);
    }
  }

  function addNotification(type, senderName, recipientEmail, postTitle, postId) {
    const currentEmail = localStorage.getItem('af_user_email');
    const role = localStorage.getItem('af_user_role');

    if (currentEmail === recipientEmail && type !== 'report') return;

    let message = '';
    if (type === 'like') message = `<strong>${escapeHtml(senderName)}</strong> liked your post: "${escapeHtml(postTitle)}"`;
    if (type === 'comment') message = `<strong>${escapeHtml(senderName)}</strong> commented on: "${escapeHtml(postTitle)}"`;
    if (type === 'report') {
      if (role !== 'admin' && recipientEmail !== 'admin@archersforum.com') return;
      message = `🚨 <strong>${escapeHtml(senderName)}</strong> reported: "${escapeHtml(postTitle)}"`;
    }

    const key = getNotificationStorageKey(recipientEmail);
    const notifs = JSON.parse(localStorage.getItem(key) || '[]');

    notifs.unshift({
      id: Date.now() + Math.random(),
      type,
      message,
      postId,
      read: false,
      time: new Date().getTime(),
    });

    localStorage.setItem(key, JSON.stringify(notifs.slice(0, 20)));

    if (currentEmail === recipientEmail) {
      renderNotifications();
    }
  }

  function renderNotifications() {
    const email = localStorage.getItem('af_user_email');
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    const count = document.getElementById('notifHeaderCount');
    const markReadBtn = document.getElementById('markNotificationsReadBtn');
    const clearBtn = document.getElementById('clearNotificationsBtn');

    if (!email || !list) return;

    const notifs = loadNotificationsFromStorage(email);
    const unread = notifs.filter((n) => !n.read).length;

    if (badge) {
      badge.textContent = String(unread);
      badge.hidden = unread === 0;
    }

    if (count) {
      count.hidden = notifs.length === 0;
      if (notifs.length > 0) {
        count.textContent = unread > 0 ? `${unread} unread` : 'All caught up';
      }
    }

    if (markReadBtn) {
      markReadBtn.disabled = notifs.length === 0 || unread === 0;
    }

    if (clearBtn) {
      clearBtn.disabled = notifs.length === 0;
    }

    if (notifs.length === 0) {
      list.innerHTML = '<p class="empty-notif" style="padding:25px; text-align:center; color:#888;">No notifications yet</p>';
      return;
    }

    list.innerHTML = notifs.map((n) => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="window.AF_MAIN_UTILS.handleNotifClick('${n.id}', '${n.postId}')"
           style="padding: 12px 15px; border-bottom: 1px solid #f5f5f5; cursor: pointer;">
        <div style="font-size: 13px;">${n.message}</div>
        <div style="font-size: 11px; color: #888; margin-top: 4px;">${formatDate(n.time)}</div>
      </div>
    `).join('');
  }

  async function handleNotifClick(notifId, postId) {
    const email = localStorage.getItem('af_user_email');
    const key = getNotificationStorageKey(email);
    let notifs = JSON.parse(localStorage.getItem(key) || '[]');
    notifs = notifs.map((n) => (String(n.id) === String(notifId) ? { ...n, read: true } : n));
    localStorage.setItem(key, JSON.stringify(notifs));
    renderNotifications();

    try {
      await fetch(`/api/users/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    if (postId && postId !== 'undefined' && postId !== 'null') {
      localStorage.setItem('af_open_post', postId);
      navigateWithFade('/mainpage');
    }
  }

  async function markAllNotificationsRead() {
    const email = localStorage.getItem('af_user_email');
    if (!email) return;

    try {
      await fetch(`/api/users/notifications/read-all?email=${encodeURIComponent(email)}`, {
        method: 'PUT',
      });
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }

    const key = getNotificationStorageKey(email);
    const notifs = JSON.parse(localStorage.getItem(key) || '[]').map((n) => ({ ...n, read: true }));
    localStorage.setItem(key, JSON.stringify(notifs));
    renderNotifications();
  }

  async function clearNotifications() {
    const email = localStorage.getItem('af_user_email');
    if (!email) return;

    try {
      await fetch(`/api/users/notifications?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }

    localStorage.setItem(getNotificationStorageKey(email), JSON.stringify([]));
    renderNotifications();
  }

  function bindNotificationActions() {
    const markReadBtn = document.getElementById('markNotificationsReadBtn');
    const clearBtn = document.getElementById('clearNotificationsBtn');

    if (markReadBtn && markReadBtn.dataset.bound !== '1') {
      markReadBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await markAllNotificationsRead();
      });
      markReadBtn.dataset.bound = '1';
    }

    if (clearBtn && clearBtn.dataset.bound !== '1') {
      clearBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await clearNotifications();
      });
      clearBtn.dataset.bound = '1';
    }
  }

  async function initializeNotifications() {
    bindNotificationActions();
    await fetchNotificationsFromServer();
    renderNotifications();
  }

  function startNotificationPolling(intervalMs = 8000) {
    if (notificationPollTimer) {
      window.clearInterval(notificationPollTimer);
    }

    notificationPollTimer = window.setInterval(async () => {
      await fetchLatestNotifications();
      renderNotifications();
    }, intervalMs);
  }

  window.AF_MAIN_UTILS = {
    truncateName,
    hydrateHeaderUser,
    getAuthorAvatar,
    getProfileHref,
    navigateWithFade,
    loadJSON,
    saveJSON,
    makeId,
    escapeHtml,
    formatDate,
    normalizeTags,
    categorySlug,
    addNotification,
    renderNotifications,
    handleNotifClick,
    fetchNotificationsFromServer,
    fetchLatestNotifications,
    initializeNotifications,
    startNotificationPolling,
    markAllNotificationsRead,
    clearNotifications,
  };
})();