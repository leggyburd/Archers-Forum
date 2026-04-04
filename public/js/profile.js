/*
  Profile Page Script
*/

(function () {
  function resetPageTransitionState() {
    document.body.classList.remove("is-leaving");
    document.body.classList.add("is-ready");
  }

  resetPageTransitionState();
  window.addEventListener("pageshow", resetPageTransitionState);

  const savedTheme = localStorage.getItem("af_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const currentUserName = localStorage.getItem("af_user");
  const currentUserEmail = localStorage.getItem("af_user_email");
  let currentUserRole = localStorage.getItem("af_user_role") || "user";
  const profileParams = new URLSearchParams(window.location.search);
  const profileEmail = profileParams.get("email") || currentUserEmail;
  const isOwnProfile = profileEmail === currentUserEmail;
  let profileName = isOwnProfile ? (currentUserName || "User") : "User";

  if (!currentUserName || !currentUserEmail) {
    window.location.href = "/login";
    return;
  }

  const POSTS_KEY = AF_STORAGE.KEYS.POSTS;

  const PROFILE_KEYS = {
    COVER: `af_profile_cover_${profileEmail}`,
    AVATAR: `af_profile_avatar_${profileEmail}`,
  };

  const DEFAULTS = {
    COVER: "/assets/default_banner.png", 
    AVATAR: "/assets/default_pfp.png",  
  };

  function navigateWithFade(href) {
    document.body.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.href = href;
    }, 260);
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function setSrc(id, value) {
    const el = document.getElementById(id);
    if (el) el.src = value;
  }

  function loadJSON(key, fallback) {
    if (window.AF_STORAGE && typeof AF_STORAGE.load === "function") {
      return AF_STORAGE.load(key, fallback);
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function getNameParts(fullName) {
    const raw = String(fullName || "").trim();
    if (!raw) return { first: "", last: "" };
    const parts = raw.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  function isDefaultSrc(src, defaultPath) {
    return String(src || "").includes(defaultPath);
  }

  function hydrateProfileHeader() {
    setText(".profile-display-name", profileName);
    setText("#profileEmail", profileEmail);

    const savedCover = localStorage.getItem(PROFILE_KEYS.COVER);
    const savedAvatar = localStorage.getItem(PROFILE_KEYS.AVATAR);
    
    setSrc("coverImage", savedCover || DEFAULTS.COVER);
    setSrc("profileAvatar", savedAvatar || DEFAULTS.AVATAR);

    const profileActions = document.querySelector(".profile-actions");
    if (profileActions) {
      profileActions.style.display = isOwnProfile ? "block" : "none";
    }
  }

  function setupHeaderReportsButton() {
    const reportsBtn = document.getElementById("headerReportsBtn");
    if (!reportsBtn) return;
    
    if (currentUserRole === "admin") {
      reportsBtn.style.display = "inline-flex";
      reportsBtn.hidden = false;
    } else {
      reportsBtn.style.display = "none";
      reportsBtn.hidden = true;
    }
  }

  function setupHeaderVisibility() {
    const headerActions = document.getElementById("headerActions");
    if (!headerActions) return;
    
    if (!isOwnProfile) {
      headerActions.style.display = "none";
    } else {
      headerActions.style.display = "flex";
    }
  }

  function updateProfileTabLabels(threadCount, replyCount) {
    const tabs = document.querySelectorAll(".profile-tabs .profile-tab");
    if (tabs[0]) tabs[0].textContent = `${isOwnProfile ? "My Threads" : "Threads"} (${threadCount})`;
    if (tabs[1]) tabs[1].textContent = `${isOwnProfile ? "My Replies" : "Replies"} (${replyCount})`;
  }

  function hydrateProfileNameFromPosts() {
    for (const post of allPosts) {
      if (post && post.authorEmail === profileEmail && post.authorName) {
        profileName = post.authorName;
        return;
      }

      for (const comment of post.comments || []) {
        if (comment.authorEmail === profileEmail && comment.authorName) {
          profileName = comment.authorName;
          return;
        }

        for (const reply of comment.replies || []) {
          if (reply.authorEmail === profileEmail && reply.authorName) {
            profileName = reply.authorName;
            return;
          }
        }
      }
    }
  }

  let allPosts = [];

  function computeStats() {
    const posts = allPosts;
    const mine = posts.filter((p) => p && p.authorEmail === profileEmail);

    let totalReplies = 0;
    posts.forEach((post) => {
      if (post.comments) {
        post.comments.forEach((comment) => {
          if (comment.authorEmail === profileEmail) {
            totalReplies++;
          }
          if (comment.replies) {
            comment.replies.forEach((reply) => {
              if (reply.authorEmail === profileEmail) {
                totalReplies++;
              }
            });
          }
        });
      }
    });

    const threadsCreated = mine.length;

    updateProfileTabLabels(threadsCreated, totalReplies);
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

  function renderUserThreads() {
    const threadsContainer = document.getElementById("threadsContent");
    if (!threadsContainer) return;

    const posts = allPosts;
    const userThreads = posts.filter((p) => p && p.authorEmail === profileEmail);

    if (userThreads.length === 0) {
      threadsContainer.innerHTML = `
        <div class="empty-state">
          <p>No threads created yet.</p>
        </div>
      `;
      return;
    }

    userThreads.sort((a, b) => b.createdAt - a.createdAt);

    const threadsHTML = userThreads.map(thread => `
      <div class="thread-item clickable" data-post-id="${thread.id}" onclick="navigateToPost('${thread.id}')">
        <div class="thread-header">
          <h3 class="thread-title">${escapeHtml(thread.title)} <span class="click-indicator">→</span></h3>
          <span class="thread-category">${escapeHtml(thread.category)}</span>
        </div>
        <div class="thread-meta">
          <span class="thread-date">${formatDate(thread.createdAt)}</span>
          <span class="thread-stats">${(thread.comments || []).length} comments</span>
        </div>
        <div class="thread-body">
          ${escapeHtml(thread.body.substring(0, 150))}${thread.body.length > 150 ? '...' : ''}
        </div>
        ${thread.tags && thread.tags.length > 0 ? `
          <div class="thread-tags">
            ${thread.tags.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');

    threadsContainer.innerHTML = threadsHTML;
  }

  function renderUserReplies() {
    const repliesContainer = document.getElementById("repliesContent");
    if (!repliesContainer) return;

    const posts = allPosts;
    const userReplies = [];

    posts.forEach((post) => {
      if (post.comments) {
        post.comments.forEach((comment) => {
          if (comment.authorEmail === profileEmail) {
            userReplies.push({
              ...comment,
              postTitle: post.title,
              postId: post.id,
              isTopLevel: true
            });
          }
          if (comment.replies) {
            comment.replies.forEach((reply) => {
              if (reply.authorEmail === profileEmail) {
                userReplies.push({
                  ...reply,
                  postTitle: post.title,
                  postId: post.id,
                  parentComment: comment.body.substring(0, 50) + '...',
                  isTopLevel: false
                });
              }
            });
          }
        });
      }
    });

    if (userReplies.length === 0) {
      repliesContainer.innerHTML = `
        <div class="empty-state">
          <p>No replies posted yet.</p>
        </div>
      `;
      return;
    }

    userReplies.sort((a, b) => b.createdAt - a.createdAt);

    const repliesHTML = userReplies.map(reply => `
      <div class="reply-item clickable" data-post-id="${reply.postId}" onclick="navigateToPost('${reply.postId}')">
        <div class="reply-header">
          <span class="reply-type">${reply.isTopLevel ? 'Comment on' : 'Reply to'}</span>
          <span class="reply-thread">${escapeHtml(reply.postTitle)} <span class="click-indicator">→</span></span>
        </div>
        ${!reply.isTopLevel ? `
          <div class="reply-context">
            <small>In response to: "${escapeHtml(reply.parentComment)}"</small>
          </div>
        ` : ''}
        <div class="reply-body">
          ${escapeHtml(reply.body)}
        </div>
        <div class="reply-meta">
          <span class="reply-date">${formatDate(reply.createdAt)}</span>
        </div>
      </div>
    `).join('');

    repliesContainer.innerHTML = repliesHTML;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function updateEditMediaUI() {
    const coverPreview = document.getElementById("editCoverPreview");
    const avatarPreview = document.getElementById("previewImg");

    const bannerAddBtn = document.getElementById("bannerAddBtn");
    const bannerHas = document.getElementById("bannerHasControls");

    const avatarAddBtn = document.getElementById("avatarAddBtn");
    const avatarHas = document.getElementById("avatarHasControls");

    const hasCover = coverPreview
      ? !isDefaultSrc(coverPreview.src, DEFAULTS.COVER)
      : false;

    const hasAvatar = avatarPreview
      ? !isDefaultSrc(avatarPreview.src, DEFAULTS.AVATAR)
      : false;

    if (bannerAddBtn && bannerHas) {
      bannerAddBtn.style.display = hasCover ? "none" : "inline-flex";
      bannerHas.style.display = hasCover ? "flex" : "none";
    }

    if (avatarAddBtn && avatarHas) {
      avatarAddBtn.style.display = hasAvatar ? "none" : "inline-flex";
      avatarHas.style.display = hasAvatar ? "flex" : "none";
    }
  }

  function updateProfileStats(followersCount, followingCount) {
    const followersEl = document.getElementById("followersCount");
    const followingEl = document.getElementById("followingCount");
    
    if (followersEl) followersEl.textContent = followersCount;
    if (followingEl) followingEl.textContent = followingCount;
  }

  function setupFollowButton() {
    const followBtn = document.getElementById("followBtn");
    if (!followBtn) return;
    
    if (isOwnProfile) {
      followBtn.style.display = "none";
    } else {
      followBtn.style.display = "inline-flex";
    }
  }

  async function checkFollowStatus() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(profileEmail)}/following/${encodeURIComponent(currentUserEmail)}`);
      const data = await res.json();
      
      if (res.ok) {
        updateFollowButton(data.isFollowing);
      }
    } catch (err) {
      console.error("Failed to check follow status:", err);
    }
  }

  function updateFollowButton(isFollowing) {
    const followBtn = document.getElementById("followBtn");
    if (!followBtn) return;
    
    if (isFollowing) {
      followBtn.textContent = "Unfollow";
      followBtn.classList.add("following");
    } else {
      followBtn.textContent = "Follow";
      followBtn.classList.remove("following");
    }
  }

  window.toggleFollow = async function() {
    const followBtn = document.getElementById("followBtn");
    if (!followBtn || isOwnProfile) return;
    
    const isCurrentlyFollowing = followBtn.classList.contains("following");
    const action = isCurrentlyFollowing ? "unfollow" : "follow";
    
    try {
      followBtn.disabled = true;
      followBtn.textContent = isCurrentlyFollowing ? "Unfollowing..." : "Following...";
      
      const res = await fetch(`/api/users/${encodeURIComponent(profileEmail)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerEmail: currentUserEmail })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        updateFollowButton(!isCurrentlyFollowing);
        
        const followersEl = document.getElementById("followersCount");
        if (followersEl) {
          followersEl.textContent = data.followersCount;
        }
        
        const message = isCurrentlyFollowing ? "Unfollowed successfully!" : "Following successfully!";
        if (window.AF_MAIN_UTILS && window.AF_MAIN_UTILS.showToast) {
          window.AF_MAIN_UTILS.showToast(message, "success");
        }
      } else {
        throw new Error(data.error || "Failed to update follow status");
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
      
      updateFollowButton(isCurrentlyFollowing);
      
      if (window.AF_MAIN_UTILS && window.AF_MAIN_UTILS.showToast) {
        window.AF_MAIN_UTILS.showToast("Failed to update follow status", "error");
      }
    } finally {
      followBtn.disabled = false;
    }
  };

  window.handleLogout = function () {
    localStorage.removeItem("af_user");
    localStorage.removeItem("af_user_email");
    localStorage.removeItem("af_user_role");
    localStorage.removeItem("af_user_password");
    navigateWithFade("/login");
  };

  window.goBackToMain = function () {
    navigateWithFade("/mainpage");
  };

  window.goToBookmarks = function () {
    navigateWithFade("/bookmarks");
  };

  window.navigateToPost = function (postId) {
    localStorage.setItem("af_open_post", postId);
    navigateWithFade("/mainpage");
  };

  function animateContentIn(el) {
    if (!el) return;
    el.classList.remove("content-in");
    void el.offsetWidth;
    el.classList.add("content-in");
  }


  window.switchTab = function (clickedTab, tabType) {
    document.querySelectorAll(".profile-tab").forEach((tab) => {
      tab.classList.remove("profile-tab-active");
    });
    clickedTab.classList.add("profile-tab-active");

    const threadsContent = document.getElementById("threadsContent");
    const repliesContent = document.getElementById("repliesContent");

    if (tabType === "threads") {
      if (threadsContent) threadsContent.style.display = "block";
      if (repliesContent) repliesContent.style.display = "none";
      renderUserThreads();
      animateContentIn(threadsContent);
    } else {
      if (threadsContent) threadsContent.style.display = "none";
      if (repliesContent) repliesContent.style.display = "block";
      renderUserReplies();
      animateContentIn(repliesContent);
    }
  };


  window.openEditModal = function () {
    if (!isOwnProfile) return;

    const modal = document.getElementById("editProfileModal");
    if (!modal) return;

    modal.style.display = "block";
    document.body.classList.add("modal-open");

    // Start the enter animation on the next frame.
    requestAnimationFrame(() => {
      modal.classList.remove("closing");
      modal.classList.add("open");
    });

    const parts = getNameParts(localStorage.getItem("af_user") || currentUserName);
    setValue("firstName", parts.first);
    setValue("lastName", parts.last);
    setValue("userEmail", currentUserEmail);

    // Populate previews with saved images or fallback defaults.
    const savedAvatar = document.getElementById("profileAvatar").src;
    const savedCover = document.getElementById("coverImage").src;

    setSrc("previewImg", savedAvatar);
    setSrc("editCoverPreview", savedCover);

    updateEditMediaUI();
  };

  window.closeEditModal = function () {
    const modal = document.getElementById("editProfileModal");
    if (!modal) return;

    // Start the exit animation.
    modal.classList.remove("open");
    modal.classList.add("closing");
    document.body.classList.remove("modal-open");

    // Hide it completely after the transition ends.
    window.setTimeout(() => {
      modal.style.display = "none";
      modal.classList.remove("closing");
    }, 180);
  };


  window.triggerCoverPicker = function () {
    const input = document.getElementById("coverPicture");
    if (input) input.click();
  };

  window.triggerAvatarPicker = function () {
    const input = document.getElementById("profilePicture");
    if (input) input.click();
  };

  window.previewImage = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      setSrc("previewImg", e.target.result);
      updateEditMediaUI();
    };
    reader.readAsDataURL(file);
  };

  window.previewCoverInEdit = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      setSrc("editCoverPreview", e.target.result);
      updateEditMediaUI();
    };
    reader.readAsDataURL(file);
  };

  window.removeCoverFromEdit = function () {
    setSrc("editCoverPreview", DEFAULTS.COVER);

    const input = document.getElementById("coverPicture");
    if (input) input.value = "";

    updateEditMediaUI();
  };

  window.removeAvatarFromEdit = function () {
    setSrc("previewImg", DEFAULTS.AVATAR);

    const input = document.getElementById("profilePicture");
    if (input) input.value = "";

    updateEditMediaUI();
  };

  window.saveProfile = async function (event) {
    event.preventDefault();

    if (!isOwnProfile) return;

    const firstName = (document.getElementById("firstName") || {}).value || "";
    const lastName = (document.getElementById("lastName") || {}).value || "";
    const newName = (firstName + " " + lastName).trim();
    const avatarData = document.getElementById("previewImg").src;
    const coverData = document.getElementById("editCoverPreview").src;

    if (!firstName.trim()){
      return alert("First name is required.");
    }

    const saveBtn = event.target.querySelector('.save-btn') || document.querySelector('.save-btn');
    const originalText = saveBtn ? saveBtn.textContent : "Save";
    if (saveBtn) {
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;
    }
    
    try {
      // SEND TO DATABASE
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserEmail)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, avatar: avatarData, cover: coverData })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Failed to update profile.");
      }

      const nextName = (payload.name || newName || "").trim() || "User";
      const nextAvatar = payload.avatar || avatarData || DEFAULTS.AVATAR;
      const nextCover = payload.cover || coverData || DEFAULTS.COVER;

      // Sync local storage and in-memory profile state.
      localStorage.setItem("af_user", nextName);
      localStorage.setItem(`af_profile_avatar_${currentUserEmail}`, nextAvatar);
      localStorage.setItem(`af_profile_cover_${currentUserEmail}`, nextCover);

      profileName = nextName;
      hydrateProfileHeader();

      if (window.AF_MAIN_UTILS && typeof window.AF_MAIN_UTILS.hydrateHeaderUser === "function") {
        window.AF_MAIN_UTILS.hydrateHeaderUser();
      }

      window.closeEditModal();
    } catch (err) {
      console.error("Save failed", err);
      alert(err.message || "Failed to save profile.");
    } finally {
      if (saveBtn) {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    }
  };

  hydrateProfileHeader();
  setupHeaderReportsButton();

  async function loadViewedUser() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(profileEmail)}`);
      const data = await res.json();
      if (res.ok) {
        if (data.name) profileName = data.name;
        localStorage.setItem(PROFILE_KEYS.AVATAR, data.avatar || DEFAULTS.AVATAR);
        localStorage.setItem(PROFILE_KEYS.COVER, data.cover || DEFAULTS.COVER);

        if (isOwnProfile && data.name) {
          localStorage.setItem("af_user", data.name);
        }
        
        updateProfileStats(data.followersCount || 0, data.followingCount || 0);
        
        if (!isOwnProfile) {
          checkFollowStatus();
        }
      }

      const meRes = await fetch(`/api/users/${encodeURIComponent(currentUserEmail)}`);
      const meData = await meRes.json();
      if (meRes.ok && meData.role) {
        currentUserRole = meData.role;
        localStorage.setItem("af_user_role", meData.role);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }

    hydrateProfileHeader();
    setupHeaderReportsButton();
    setupHeaderVisibility();
    setupFollowButton();
  }

  async function loadProfileData() {
    try {
      const [_, postsRes] = await Promise.all([
        loadViewedUser(),
        fetch("/api/posts"),
      ]);
      const data = await postsRes.json();
      if (postsRes.ok) allPosts = data;
    } catch (err) {
      console.error("Failed to load posts for profile:", err);
    }

    if (!isOwnProfile && profileName === "User") {
      hydrateProfileNameFromPosts();
      hydrateProfileHeader();
    }

    computeStats();
    renderUserThreads();
  }

  loadProfileData();

  setupHeaderReportsButton();
  setupHeaderVisibility();

  // Expose a refresh helper so other pages can update this view.
  window.refreshProfileData = async function () {
    try {
      const res  = await fetch("/api/posts");
      const data = await res.json();
      if (res.ok) allPosts = data;
    } catch (err) {
      console.error("Failed to refresh posts:", err);
    }
    computeStats();
    renderUserThreads();
    if (document.getElementById("repliesContent").style.display !== "none") {
      renderUserReplies();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (window.AF_MAIN_UTILS) window.AF_MAIN_UTILS.renderNotifications();

    const bell = document.getElementById('notifBell');
    const dropdown = document.getElementById('notifDropdown');

    if (bell && dropdown) {
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        window.AF_MAIN_UTILS.renderNotifications();
      });

      document.addEventListener('click', () => dropdown.classList.remove('show'));
      dropdown.addEventListener('click', (e) => e.stopPropagation());
    }
  });

  window.showFollowersModal = async function() {
    await showFollowModal('followers', 'Followers');
  };

  window.showFollowingModal = async function() {
    await showFollowModal('following', 'Following');
  };

  async function showFollowModal(type, title) {
    try {
      const response = await fetch(`/api/users/${profileEmail}/${type}`);
      const data = await response.json();
      
      if (response.ok) {
        const users = data[type] || [];
        displayFollowModal(users, title);
      } else {
        console.error(`Failed to load ${type}:`, data.error);
        displayFollowModal([], title);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
      displayFollowModal([], title);
    }
  }

  function displayFollowModal(users, title) {
    const modal = document.getElementById('followModalOverlay');
    const modalTitle = document.getElementById('followModalTitle');
    const followList = document.getElementById('followList');
    
    modalTitle.textContent = title;
    
    if (users.length === 0) {
      followList.innerHTML = `
        <div class="follow-empty-state">
          <div class="empty-icon">👥</div>
          <p class="empty-text">No ${title.toLowerCase()} yet</p>
        </div>
      `;
    } else {
      followList.innerHTML = users.map(user => {
        let displayName = user.displayName;
        if (!displayName) {
          const emailUsername = user.email.split('@')[0];
          displayName = emailUsername
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
        return `
          <a href="/profile?email=${encodeURIComponent(user.email)}" class="follow-user-item">
            <img 
              src="/assets/default_pfp.png" 
              alt="Profile Picture" 
              class="follow-user-avatar"
            />
            <div class="follow-user-info">
              <p class="follow-user-name">${escapeHtml(displayName)}</p>
              <p class="follow-user-email">${escapeHtml(user.email)}</p>
            </div>
          </a>
        `;
      }).join('');
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  window.closeFollowModal = function() {
    const modal = document.getElementById('followModalOverlay');
    modal.classList.remove('show');
    document.body.style.overflow = '';
  };

  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeFollowModal();
    }
  });


  // --- Notification UI/Fetch Logic ---
  async function fetchNotifications() {
    try {
      const res = await fetch(`/api/notifications/${currentUserId()}`);
      const data = await res.json();
      const notifList = document.getElementById('notifList');
      const notifBadge = document.getElementById('notifBadge');
      if (!notifList) return;
      notifList.innerHTML = '';
      if (data.notifications && data.notifications.length > 0) {
        let unreadCount = 0;
        data.notifications.forEach(n => {
          const notifItem = document.createElement('div');
          notifItem.className = 'notif-item' + (n.isRead ? '' : ' unread');
          notifItem.innerHTML = `<b>${n.fromUser?.name || 'Someone'}</b>: ${n.message} <span class='notif-date'>${new Date(n.createdAt).toLocaleString()}</span>`;
          notifItem.onclick = async () => {
            if (!n.isRead) {
              await fetch(`/api/notifications/read/${n._id}`, { method: 'POST' });
              notifItem.classList.remove('unread');
              notifBadge.hidden = true;
            }
          };
          notifList.appendChild(notifItem);
          if (!n.isRead) unreadCount++;
        });
        notifBadge.textContent = unreadCount;
        notifBadge.hidden = unreadCount === 0;
      } else {
        notifList.innerHTML = '<p class="empty-notif">No new notifications</p>';
        notifBadge.hidden = true;
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }

  function currentUserId() {
    return localStorage.getItem('af_user_id');
  }

  document.getElementById('notifBell').addEventListener('click', function() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show')) fetchNotifications();
  });
  // --- End Notification UI/Fetch Logic ---
})();


