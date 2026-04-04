/*
  Main Page Utility Functions
  This module provides various utility functions for the main page, such as string manipulation, date formatting, localStorage handling, and notification management. These functions are designed to be reusable across different components of the main page to maintain consistency and reduce code duplication
*/

(function () {
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

  function addNotification(type, senderName, recipientEmail, postTitle, postId) {
    const currentEmail = localStorage.getItem("af_user_email");
    const role = localStorage.getItem("af_user_role");

    // Don't notify yourself for your own actions
    if (currentEmail === recipientEmail && type !== 'report') return;

    // Build the message
    let message = "";
    if (type === 'like') message = `<strong>${escapeHtml(senderName)}</strong> liked your post: "${escapeHtml(postTitle)}"`;
    if (type === 'comment') message = `<strong>${escapeHtml(senderName)}</strong> commented on: "${escapeHtml(postTitle)}"`;
    if (type === 'report') {
      if (role !== 'admin' && recipientEmail !== 'admin@archersforum.com') return;
      message = `🚨 <strong>${escapeHtml(senderName)}</strong> reported: "${escapeHtml(postTitle)}"`;
    }

    // TARGET RECIPIENT'S STORAGE
    const key = `af_notifs_${recipientEmail}`;
    const notifs = JSON.parse(localStorage.getItem(key) || "[]");
    
    notifs.unshift({
      id: Date.now() + Math.random(),
      type, message, postId,
      read: false,
      time: new Date().getTime()
    });

    localStorage.setItem(key, JSON.stringify(notifs.slice(0, 20)));
    
    // Refresh UI if the recipient is the one currently logged in
    if (currentEmail === recipientEmail) {
      renderNotifications();
    }
  }

  function renderNotifications() {
    const email = localStorage.getItem("af_user_email");
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (!email || !list) return;

    const notifs = JSON.parse(localStorage.getItem(`af_notifs_${email}`) || "[]");
    const unread = notifs.filter(n => !n.read).length;

    if (badge) {
      badge.textContent = unread;
      badge.hidden = unread === 0;
    }

    if (notifs.length === 0) {
      list.innerHTML = '<p class="empty-notif" style="padding:25px; text-align:center; color:#888;">No notifications yet</p>';
      return;
    }

    list.innerHTML = notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="window.AF_MAIN_UTILS.handleNotifClick('${n.id}', '${n.postId}')" 
           style="padding: 12px 15px; border-bottom: 1px solid #f5f5f5; cursor: pointer;">
        <div style="font-size: 13px;">${n.message}</div>
        <div style="font-size: 11px; color: #888; margin-top: 4px;">${formatDate(n.time)}</div>
      </div>
    `).join('');
  }

  function handleNotifClick(notifId, postId) {
    const email = localStorage.getItem("af_user_email");
    const key = `af_notifs_${email}`;
    let notifs = JSON.parse(localStorage.getItem(key) || "[]");
    notifs = notifs.map(n => n.id == notifId ? { ...n, read: true } : n);
    localStorage.setItem(key, JSON.stringify(notifs));

    if (postId && postId !== "undefined" && postId !== "null") {
      localStorage.setItem("af_open_post", postId);
      window.location.href = "/mainpage";
    } else {
      renderNotifications();
    }
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
    handleNotifClick
  };
})();
