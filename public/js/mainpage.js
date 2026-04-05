/*
  Main Page Script
*/

(function () {
  function resetPageTransitionState() {
    document.body.classList.remove("is-leaving");
    document.body.classList.add("is-ready");
  }

  resetPageTransitionState();
  window.addEventListener("pageshow", resetPageTransitionState);

  const name = localStorage.getItem("af_user");
  const email = localStorage.getItem("af_user_email");
  const userRole = localStorage.getItem("af_user_role") || "user";

  if (!name || !email) {
    window.location.href = "/login";
    return;
  }

  const POSTS_KEY = AF_STORAGE.KEYS.POSTS;
  const VOTES_KEY = AF_STORAGE.KEYS.VOTES;
  const BOOKMARKS_KEY = AF_STORAGE.bookmarksKey(email);
  const COMMENT_VOTES_KEY = "af_comment_votes";
  const HISTORY_KEY = "af_search_history";
  const REPORT_REASONS = [
    "Spam or misleading",
    "Harassment or hate speech",
    "Inappropriate or NSFW content",
    "Scam or fraudulent activity",
    "Personal information or privacy issue",
    "Other",
  ];
  const {
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
  } = window.AF_MAIN_UTILS;
  const { showConfirmModal, showToast } = window.AF_MAIN_UI;
  const {
    ensureRepliesArray,
    findCommentById,
    deleteCommentById,
    addReplyToComment,
    getPostReplyCount,
  } = window.AF_MAIN_COMMENT_TREE;
  const { applyFilters, computeFeedTitle } = window.AF_MAIN_FEED_FILTERS;

  hydrateHeaderUser();

  async function syncCurrentUserProfile() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) return;

      const serverName = (data.name || "").trim();
      const serverAvatar = (data.avatar || "").trim();

      if (serverName) {
        localStorage.setItem("af_user", serverName);
      }
      if (serverAvatar) {
        localStorage.setItem(`af_profile_avatar_${email}`, serverAvatar);
      }

      hydrateHeaderUser();
    } catch (_err) {
      // Keep local values when profile sync is temporarily unavailable.
    }
  }

  syncCurrentUserProfile();

  const profileLink = document.getElementById("profileLink");
  const logoLink = document.getElementById("logoLink");
  const nameEl = document.querySelector(".user-name");
  const logoutBtn = document.querySelector(".btn-logout");

  const categoryMenu = document.getElementById("categoryMenu");
  const feed = document.getElementById("postsFeed");
  const feedEmpty = document.getElementById("feedEmpty");
  const feedTitle = document.getElementById("feedTitle");
  const searchInput = document.getElementById("searchInput");

  const openComposerBtn = document.getElementById("openComposerBtn");
  const createFirstBtn = document.getElementById("createFirstBtn");
  const quickPostTitle = document.getElementById("quickPostTitle");

  const composerOverlay = document.getElementById("composerOverlay");
  const closeComposerBtn = document.getElementById("closeComposerBtn");
  const cancelComposerBtn = document.getElementById("cancelComposerBtn");
  const createPostForm = document.getElementById("createPostForm");
  const composerTitleEl = document.getElementById("composerTitle");
  const composerSubmitBtn = createPostForm
    ? createPostForm.querySelector('button[type="submit"]')
    : null;

  const postTitle = document.getElementById("postTitle");
  const postCategory = document.getElementById("postCategory");
  const postTags = document.getElementById("postTags");
  const postBody = document.getElementById("postBody");
  const postMedia = document.getElementById("postMedia");
  const mediaPreviewList = document.getElementById("mediaPreviewList");
  const composerMediaHintEl = document.querySelector(".help-text-inline");
  const titleCount = document.getElementById("titleCount");

  const allTagsChips = document.getElementById("allTagsChips");
  const trendingTags = document.getElementById("trendingTags");
  const noTagsText = document.getElementById("noTagsText");
  const noTrendingText = document.getElementById("noTrendingText");

  const detailOverlay = document.getElementById("detailOverlay");
  const closeDetailBtn = document.getElementById("closeDetailBtn");
  const detailContent = document.getElementById("detailContent");
  const bookmarksEmptyEl = document.getElementById("feedEmptyBookmarks");
  const commentForm = document.getElementById("commentForm");
  const commentText = document.getElementById("commentText");
  const commentsList = document.getElementById("commentsList");
  const submitCommentBtn = document.getElementById("submitCommentBtn");

  const sortDropdown = document.getElementById("sortDropdown");
  const sortBtn = document.getElementById("sortBtn");
  const sortMenu = document.getElementById("sortMenu");
  const sortLabel = document.getElementById("sortLabel");

  const searchHistoryEl = document.getElementById("searchHistory");
  const userSearchDropdownEl = document.getElementById("userSearchResults");

  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");

  const themeSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
  const currentTheme = localStorage.getItem("af_theme") || "light";
  
  if (currentTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeSwitch.checked = true;
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    themeSwitch.checked = false;
  }

  // Save theme changes whenever the switch is toggled.
  if (themeSwitch) {
    themeSwitch.addEventListener("change", (e) => {
      if (e.target.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("af_theme", "dark");
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("af_theme", "light");
      }
    });
  }

  function updateIcon(theme) {
    if (!themeIcon) return;
    // Swap icon based on the active theme.
    themeIcon.src = theme === "dark" ? "/assets/sun.png" : "/assets/moon.png";
  }

  if (profileLink) {
    profileLink.addEventListener("click", (e) => {
      const href = profileLink.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      navigateWithFade(href);
    });
  }

  if (logoLink) {
    logoLink.addEventListener("click", (e) => {
      e.preventDefault();
      navigateWithFade("/mainpage");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {

      localStorage.removeItem("af_current_email");
      localStorage.removeItem("af_user");
      localStorage.removeItem("af_user_email");
      localStorage.removeItem("af_user_role");

      navigateWithFade("/login");
    });
  }


  // Keep posts in memory so filtering and sorting stay instant.
  let posts = [];
  let votesByUser = loadJSON(VOTES_KEY, {});
  let commentVotesByUser = loadJSON(COMMENT_VOTES_KEY, {});
  votesByUser[email] = votesByUser[email] || {};
  commentVotesByUser[email] = commentVotesByUser[email] || {};
  let bookmarks = new Set(loadJSON(BOOKMARKS_KEY, []));

  let activeCategory = "All";
  let activeTag = null;
  let searchQuery = "";
  let sortMode = "newest";
  let activePostId = null;
  let shouldAnimateFeed = true;
  let repliesCollapsedByComment = {};
  let composerMediaItems = [];
  let editingPostId = null;
  let composerDirty = false;

  const DEFAULT_MEDIA_HINT = "(images/videos, up to 10 files, max 100 MB each)";
  const EDIT_MEDIA_HINT = "(images/videos, up to 10 files, max 100 MB each. In edit mode, selecting one new image replaces the current picture by default; additional files append.)";

  function setComposerMode(isEditing) {
    if (composerTitleEl) {
      composerTitleEl.textContent = isEditing ? "Edit Post" : "Create Post";
    }
    if (composerSubmitBtn) {
      composerSubmitBtn.textContent = isEditing ? "Save Changes" : "Post";
    }
    if (composerMediaHintEl) {
      composerMediaHintEl.textContent = isEditing ? EDIT_MEDIA_HINT : DEFAULT_MEDIA_HINT;
    }
  }

  function resetComposerMode() {
    editingPostId = null;
    setComposerMode(false);
    composerDirty = false;
  }

  function markComposerDirty() {
    composerDirty = true;
  }

  function markComposerClean() {
    composerDirty = false;
  }

  function requestCloseComposer() {
    if (!composerDirty) {
      closeComposer(true);
      return;
    }

    showConfirmModal(
      {
        title: "Discard changes?",
        message: "You have unsaved post changes. Closing now will discard them.",
        confirmText: "Discard",
        cancelText: "Keep editing",
        danger: true,
      },
      () => closeComposer(true),
    );
  }

  function isComposerItemExisting(item) {
    return item && item.kind === "existing";
  }

  function isComposerItemFile(item) {
    return item && item.kind === "file";
  }

  function getComposerKeptMediaUrls() {
    return composerMediaItems
      .filter(isComposerItemExisting)
      .map((item) => item.url)
      .filter(Boolean);
  }

  function getComposerFiles() {
    return composerMediaItems
      .filter(isComposerItemFile)
      .map((item) => item.file)
      .filter(Boolean);
  }

  function isBookmarked(postId) {
    return bookmarks.has(postId);
  }

  function toggleBookmark(postId) {
    if (bookmarks.has(postId)) {
      bookmarks.delete(postId);
      showToast("Bookmark removed");
    } else {
      bookmarks.add(postId);
      showToast("Post bookmarked");
    }
    saveJSON(BOOKMARKS_KEY, Array.from(bookmarks));
    shouldAnimateFeed = false;
    render();
  }

  const showReportModal = window.AF_MAIN_REPORT_MODAL.createReportModal({
    name,
    email,
    reportReasons: REPORT_REASONS,
    escapeHtml,
    showToast,
    getPostById,
    isOwner,
  });

  const detailRenderer = window.AF_MAIN_DETAIL_RENDERER.createDetailRenderer({
    detailContent,
    commentsList,
    getPostById,
    getUserVote,
    getCommentUserVote,
    vote,
    voteComment,
    handleDelete,
    handleEditPost: startEditPost,
    showReportModal,
    setActiveTag,
    isOwner,
    isCommentOwner,
    ensureRepliesArray,
    isRepliesCollapsed,
    getProfileHref,
    getAuthorAvatar,
    escapeHtml,
    formatDate,
    categorySlug,
    userRole,
  });

  const historyManager = window.AF_MAIN_HISTORY.createHistoryManager({
    historyKey: HISTORY_KEY,
    searchHistoryEl,
    searchInput,
    escapeHtml,
    onSelectTerm: (term) => {
      searchQuery = term;
      shouldAnimateFeed = true;
      historyManager.saveToHistory(term);
      render();
    },
  });
  const { getHistory, renderHistory, saveToHistory } = historyManager;

  // Initialize user search manager
  const userSearchManager = window.AF_USER_SEARCH.createUserSearchManager({
    userSearchDropdownEl,
    searchInput,
    escapeHtml,
    getAuthorAvatar,
    showToast,
    currentUserEmail: email,
    searchHistoryEl,
  });
  userSearchManager.init();

  const feedRenderer = window.AF_MAIN_FEED_RENDERER.createFeedRenderer({
    allTagsChips,
    trendingTags,
    noTagsText,
    noTrendingText,
    getVotesByUser: () => votesByUser,
    getUserVote,
    getPostById,
    getPostReplyCount,
    isOwner,
    isBookmarked,
    escapeHtml,
    categorySlug,
    getProfileHref,
    getAuthorAvatar,
    formatDate,
    userRole,
  });

  function openOverlay(overlayEl) {
    overlayEl.classList.add("open");
    overlayEl.setAttribute("aria-hidden", "false");
  }

  function closeOverlay(overlayEl) {
    overlayEl.classList.remove("open");
    overlayEl.setAttribute("aria-hidden", "true");
  }

  function openComposer(prefillTitle) {
    if (!createPostForm) return;

    resetComposerMode();
    if (postMedia) {
      postMedia.disabled = false;
      postMedia.title = "";
    }
    createPostForm.reset();
    composerMediaItems = [];
    renderComposerMediaPreviews();
    markComposerClean();
    if (titleCount) titleCount.textContent = "0";

    if (prefillTitle && postTitle && titleCount) {
      postTitle.value = prefillTitle;
      titleCount.textContent = String(prefillTitle.length);
    }

    if (composerOverlay) openOverlay(composerOverlay);
    if (postTitle) postTitle.focus();
  }

  function closeComposer(force = false) {
    if (!force && composerDirty) {
      requestCloseComposer();
      return;
    }

    resetComposerMode();
    if (composerOverlay) closeOverlay(composerOverlay);
    composerMediaItems = [];
    if (postMedia) {
      postMedia.value = "";
      postMedia.disabled = false;
      postMedia.title = "";
    }
    renderComposerMediaPreviews();
  }

  function startEditPost(postId) {
    const post = getPostById(postId);
    if (!post) return;
    if (!isOwner(post) && userRole !== "admin") return;

    if (detailOverlay && detailOverlay.classList.contains("open")) {
      closeDetail();
    }

    editingPostId = post.id;
    setComposerMode(true);

    if (composerOverlay) openOverlay(composerOverlay);

    if (postTitle) {
      postTitle.value = post.title || "";
      titleCount.textContent = String(postTitle.value.length); 
    }
    if (postCategory) postCategory.value = post.category || "General Questions";
    if (postTags) postTags.value = (post.tags || []).join(", ");
    if (postBody) postBody.value = post.body || "";
    if (titleCount) titleCount.textContent = String((post.title || "").length);

    composerMediaItems = (post.mediaUrls || []).map((url) => ({
      kind: "existing",
      id: makeId("media"),
      url,
    }));
    if (postMedia) postMedia.value = "";
    renderComposerMediaPreviews();

    if (postMedia) {
      postMedia.disabled = false;
      postMedia.title = "";
    }
     
    if (composerOverlay) openOverlay(composerOverlay);
    if (postTitle) postTitle.focus();
    markComposerClean();
  }

  window.startEditPost = startEditPost;

  function openDetail(postId) {
    activePostId = postId;
    
    // Clear comment text when opening a new post
    if (commentText) {
      commentText.value = "";
    }
    
    renderDetail();
    if (detailOverlay) openOverlay(detailOverlay);
    
    // Focus on comment text area after a brief delay to ensure modal is open
    setTimeout(() => {
      if (commentText) {
        commentText.focus();
      }
    }, 150);
  }

  function closeDetail() {
    activePostId = null;
    
    if (commentText) {
      commentText.value = "";
    }
    
    if (detailOverlay) closeOverlay(detailOverlay);
  }

  function updateFeedTitle() {
    const title = computeFeedTitle({ activeCategory, activeTag });
    if (feedTitle) feedTitle.textContent = title;
  }

  function getUserVote(postId) {
    return (votesByUser[email] && votesByUser[email][postId]) || null;
  }

  function getCommentUserVote(commentId) {
    return (commentVotesByUser[email] && commentVotesByUser[email][commentId]) || null;
  }

  function setUserVote(postId, voteValue) {
    votesByUser[email][postId] = voteValue;
    saveJSON(VOTES_KEY, votesByUser);
  }

  function setCommentUserVote(commentId, voteValue) {
    commentVotesByUser[email][commentId] = voteValue;
    saveJSON(COMMENT_VOTES_KEY, commentVotesByUser);
  }

  function isRepliesCollapsed(commentId) {
    return Boolean(repliesCollapsedByComment[commentId]);
  }

  function setRepliesCollapsed(commentId, collapsed) {
    if (collapsed) {
      repliesCollapsedByComment[commentId] = true;
      return;
    }
    delete repliesCollapsedByComment[commentId];
  }

  function replacePost(updatedPost) {
    const idx = posts.findIndex((p) => p.id === updatedPost.id);
    if (idx < 0) return;
    const nextPosts = posts.slice();
    nextPosts[idx] = updatedPost;
    posts = nextPosts;
  }

  function vote(postId, direction) {
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx < 0) return;

    shouldAnimateFeed = false;

    const current = getUserVote(postId);
    let next = direction;
    if (current === direction) next = null;

    let delta = 0;
    if (!current && next === "up") delta = +1;
    if (!current && next === "down") delta = -1;
    if (current === "up" && !next) delta = -1;
    if (current === "down" && !next) delta = +1;
    if (current === "up" && next === "down") delta = -2;
    if (current === "down" && next === "up") delta = +2;

    posts[idx].score = (posts[idx].score || 0) + delta;

    const myName = localStorage.getItem("af_user");
    setUserVote(postId, next);
    saveJSON(VOTES_KEY, votesByUser);

    render();
    if (activePostId === postId) renderDetail({ animateComments: false });

    // Sync vote delta to the server (fire-and-forget; UI is already updated)
    fetch(`/api/posts/${postId}/vote`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ delta, voterName: myName, voterEmail: email }),
    }).catch((err) => console.error("Vote sync failed:", err));
  }

  function voteComment(commentId, direction) {
    const activePost = getPostById(activePostId);
    if (!activePost) return;

    const target = findCommentById(activePost.comments || [], commentId);
    if (!target) return;

    const current = getCommentUserVote(commentId);
    let next = direction;
    if (current === direction) next = null;

    let delta = 0;
    if (!current && next === "up") delta = +1;
    if (!current && next === "down") delta = -1;
    if (current === "up" && !next) delta = -1;
    if (current === "down" && !next) delta = +1;
    if (current === "up" && next === "down") delta = -2;
    if (current === "down" && next === "up") delta = +2;

    target.score = (target.score || 0) + delta;
    setCommentUserVote(commentId, next);
    renderComments({ animate: false });

    fetch(`/api/posts/${activePostId}/comments/${commentId}/vote`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to vote on comment.");
        replacePost(data);
        renderComments({ animate: false });
      })
      .catch((err) => console.error("Comment vote sync failed:", err));
  }

  function setActiveCategory(cat) {
    activeCategory = cat;
    activeTag = null;
    shouldAnimateFeed = true;

    if (categoryMenu) {
      categoryMenu.querySelectorAll("li").forEach((li) => {
        li.classList.toggle("active", li.dataset.category === cat);
      });
    }

    render();
  }

  function setActiveTag(tag) {
    activeTag = activeTag === tag ? null : tag;
    shouldAnimateFeed = true;
    render();
  }

  function isOwner(post) {
    return post && post.authorEmail === email;
  }

  function isCommentOwner(c) {
    return (
      (c && c.authorEmail === email) ||
      (!c.authorEmail && c.authorName === name)
    );
  }

  function animatePostsIn() {
    const cards = feed ? feed.querySelectorAll(".rf-post") : [];
    cards.forEach((card, i) => {
      card.classList.remove("post-in");
      window.setTimeout(
        () => {
          card.classList.add("post-in");
        },
        40 + i * 30,
      );
    });
  }

  function applyMediaFallback(mediaEl) {
    if (!mediaEl || mediaEl.dataset.fallbackApplied === "1") return;

    const slide = mediaEl.closest(".rf-media-slide");
    if (!slide) return;

    slide.innerHTML =
      '<div class="rf-media-unavailable" role="status" aria-live="polite">' +
      '<strong>Media unavailable</strong>' +
      '<span>This file could not be loaded on this device.</span>' +
      "</div>";

    mediaEl.dataset.fallbackApplied = "1";
  }

  function bindMediaLoadFallbacks(rootEl) {
    const root = rootEl || document;
    const mediaElements = root.querySelectorAll(".rf-media-slide img, .rf-media-slide video");

    mediaElements.forEach((mediaEl) => {
      if (mediaEl.dataset.errorBound === "1") return;

      if (mediaEl.tagName === "VIDEO") {
        mediaEl.addEventListener("error", () => applyMediaFallback(mediaEl), { once: true });
      } else {
        mediaEl.addEventListener("error", () => applyMediaFallback(mediaEl), { once: true });
      }

      mediaEl.dataset.errorBound = "1";
    });
  }

  function initMediaCarousels(rootEl) {
    const root = rootEl || document;
    bindMediaLoadFallbacks(root);

    root.querySelectorAll("[data-carousel]").forEach((carousel) => {
      const track = carousel.querySelector(".rf-media-track");
      if (!track) return;

      const slides = track.querySelectorAll(".rf-media-slide");
      if (slides.length <= 1) return;

      const prevBtn = carousel.querySelector("[data-carousel-prev]");
      const nextBtn = carousel.querySelector("[data-carousel-next]");
      const indexEl = carousel.querySelector("[data-carousel-index]");

      function getCurrentIndex() {
        const width = Math.max(track.clientWidth, 1);
        const idx = Math.round(track.scrollLeft / width) + 1;
        return Math.min(Math.max(idx, 1), slides.length);
      }

      function scrollToIndex(index) {
        const clamped = Math.min(Math.max(index, 1), slides.length);
        track.scrollTo({
          left: (clamped - 1) * track.clientWidth,
          behavior: "smooth",
        });
      }

      function updateUi() {
        const index = getCurrentIndex();
        if (indexEl) indexEl.textContent = String(index);
        if (prevBtn) prevBtn.disabled = index <= 1;
        if (nextBtn) nextBtn.disabled = index >= slides.length;
      }


      if (carousel.dataset.carouselBound !== "1") {
        if (prevBtn) {
          prevBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollToIndex(getCurrentIndex() - 1);
          });
        }

        if (nextBtn) {
          nextBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollToIndex(getCurrentIndex() + 1);
          });
        }

        track.addEventListener("scroll", updateUi, { passive: true });
        window.addEventListener("resize", updateUi);
        carousel.dataset.carouselBound = "1";
      }

      updateUi();
    });
  }

function handleDelete(postId) {
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx < 0) return;
    
    const isUserOwner = isOwner(posts[idx]);
    const isAdmin = userRole === "admin";
    
    if (!isUserOwner && !isAdmin) return; 

    showConfirmModal(
      {
        title: "Delete this post?",
        message: "This post will be moved to the admin trash bin.",
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
      },
      async () => {
        try {
          // 👇 THE CRITICAL CHANGE: Sending email and role in the body
          const res = await fetch(`/api/posts/${postId}`, { 
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              email: email, 
              role: userRole 
            })
          });

          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || "Failed to delete post.");
            return;
          }

          // If the server says OK, then we remove it from the screen
          posts.splice(idx, 1);

          Object.keys(votesByUser).forEach((userEmail) => {
            if (votesByUser[userEmail] && votesByUser[userEmail][postId] !== undefined) {
              delete votesByUser[userEmail][postId];
            }
          });
          saveJSON(VOTES_KEY, votesByUser);

          if (activePostId === postId) closeDetail();
          shouldAnimateFeed = true;
          render();
          showToast("Post moved to trash.");

        } catch (err) {
          console.error("Failed to delete post:", err);
          showToast("An error occurred while deleting.");
        }
      },
    );
  }

  function render() {
    updateFeedTitle();
    const filtered = applyFilters(posts, {
      activeCategory,
      activeTag,
      searchQuery,
      sortMode,
      bookmarks,
    });

    if (!feed || !feedEmpty) return;

    const isBookmarkMode = activeCategory === "__bookmarks__";

    if (filtered.length === 0) {
      feedEmpty.style.display = isBookmarkMode ? "none" : "block";
      if (bookmarksEmptyEl) bookmarksEmptyEl.style.display = isBookmarkMode ? "block" : "none";
      feed.innerHTML = "";
    } else {
      feedEmpty.style.display = "none";
      if (bookmarksEmptyEl) bookmarksEmptyEl.style.display = "none";
      if (isBookmarkMode) {
        feed.innerHTML = filtered.map(feedRenderer.renderBookmarkItem).join("");
      } else {
        feed.innerHTML = filtered.map(feedRenderer.renderPostCard).join("");
        initMediaCarousels(feed);
        if (shouldAnimateFeed) {
          animatePostsIn();
          shouldAnimateFeed = false;
        }
      }
    }

    feedRenderer.renderTagAreas(posts, activeTag);
  }

  function getPostById(id) {
    return posts.find((p) => p.id === id) || null;
  }

  function renderComments(options) {
    detailRenderer.renderComments(activePostId, options);
  }

  function renderDetail(options) {
    detailRenderer.renderDetail(activePostId, options);
    if (detailContent) initMediaCarousels(detailContent);
  }

  async function reloadPostsFromServer() {
    const res = await fetch("/api/posts");
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to refresh posts.");
    }

    posts = data;
    saveJSON(POSTS_KEY, posts);
    render();

    if (activePostId) {
      renderDetail({ animateComments: false });
    }
  }

  function syncComposerMediaInput() {
    if (!postMedia || typeof DataTransfer === "undefined") return;
    const dt = new DataTransfer();
    getComposerFiles().forEach((file) => dt.items.add(file));
    postMedia.files = dt.files;
  }

  function renderComposerMediaPreviews() {
    if (!mediaPreviewList) return;

    mediaPreviewList.innerHTML = "";
    if (!composerMediaItems.length) return;

    const toolbar = document.createElement("div");
    toolbar.className = "media-preview-toolbar";
    toolbar.innerHTML =
      `<span class="media-preview-count">${composerMediaItems.length} file${composerMediaItems.length === 1 ? "" : "s"} selected</span>` +
      '<button type="button" class="media-preview-clear-btn" data-clear-media>Clear all</button>';
    mediaPreviewList.appendChild(toolbar);

    composerMediaItems.forEach((mediaItem, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "media-preview-item";

      const isExisting = isComposerItemExisting(mediaItem);
      const previewUrl = isExisting ? mediaItem.url : URL.createObjectURL(mediaItem.file);
      const label = isExisting ? "Existing media" : `Selected media ${index + 1}`;

      const mediaType = isExisting
        ? (String(mediaItem.url || "").match(/\.(mp4|webm|mov)$/i) ? "video" : "image")
        : (mediaItem.file.type.startsWith("video/") ? "video" : "image");

      const mediaHtml = mediaType === "video"
        ? `<video src="${previewUrl}" class="media-thumb" muted preload="metadata"></video>`
        : `<img src="${previewUrl}" class="media-thumb" alt="${label}" />`;

      itemEl.innerHTML =
        mediaHtml +
        `<button type="button" class="media-preview-remove" data-remove-media-index="${index}" aria-label="Remove media">×</button>`;

      if (isExisting) {
        const badge = document.createElement("span");
        badge.className = "media-preview-badge";
        badge.textContent = "Existing";
        itemEl.appendChild(badge);
      }

      const mediaEl = itemEl.querySelector("img, video");
      if (mediaEl && !isExisting) {
        mediaEl.addEventListener("load", () => URL.revokeObjectURL(previewUrl), { once: true });
        mediaEl.addEventListener("loadeddata", () => URL.revokeObjectURL(previewUrl), { once: true });
        mediaEl.addEventListener("error", () => URL.revokeObjectURL(previewUrl), { once: true });
      }

      mediaPreviewList.appendChild(itemEl);
    });
  }

  // Wire up file input preview
  if (postMedia && mediaPreviewList) {
    postMedia.addEventListener("change", () => {
      const selectedFiles = Array.from(postMedia.files || []);
      if (selectedFiles.length) {
        const onlyExistingMedia = editingPostId && composerMediaItems.length > 0 && composerMediaItems.every(isComposerItemExisting);

        const newFileItems = selectedFiles.map((file) => ({
          kind: "file",
          id: makeId("media"),
          file,
        }));

        const nextItems = onlyExistingMedia && selectedFiles.length === 1
          ? newFileItems
          : [...composerMediaItems, ...newFileItems];

        composerMediaItems = nextItems.slice(0, 10);
        markComposerDirty();
      }
      syncComposerMediaInput();
      renderComposerMediaPreviews();
      // Reset input so selecting the same file again still triggers change.
      postMedia.value = "";
    });

    mediaPreviewList.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-media-index]");
      if (removeBtn) {
        const index = Number(removeBtn.getAttribute("data-remove-media-index"));
        if (Number.isInteger(index) && index >= 0 && index < composerMediaItems.length) {
          composerMediaItems.splice(index, 1);
          syncComposerMediaInput();
          renderComposerMediaPreviews();
          markComposerDirty();
        }
        return;
      }

      const clearBtn = e.target.closest("[data-clear-media]");
      if (clearBtn) {
        composerMediaItems = [];
        syncComposerMediaInput();
        renderComposerMediaPreviews();
        markComposerDirty();
      }
    });
  }

  async function createPostFromForm() {
    const title    = postTitle    ? postTitle.value.trim()    : "";
    const category = postCategory ? postCategory.value        : "General Questions";
    const tags     = normalizeTags(postTags ? postTags.value  : "");
    const body     = postBody     ? postBody.value.trim()     : "";
    if (!title || !body) return;

    try {
      const wasEditingId = editingPostId;

      if (wasEditingId) {
        const fd = new FormData();
        fd.append("title", title);
        fd.append("category", category);
        fd.append("body", body);
        fd.append("email", email);
        fd.append("role", userRole);
        tags.forEach((t) => fd.append("tags", t));
        fd.append("keptMediaUrls", JSON.stringify(getComposerKeptMediaUrls()));
        getComposerFiles().forEach((file) => fd.append("media", file));

        const res = await fetch(`/api/posts/${wasEditingId}`, {
          method: "PUT",
          body: fd,
        });
        const updatedPost = await res.json();

        if (!res.ok) {
          showToast(updatedPost.error || "Failed to update post.", "error");
          return;
        }

        try {
          await reloadPostsFromServer();
        } catch (refreshErr) {
          console.error("Failed to refresh posts after edit:", refreshErr);
          const idx = posts.findIndex((p) => p.id === wasEditingId);
          if (idx >= 0) {
            const existing = posts[idx];
            const nextPosts = posts.slice();
            nextPosts[idx] = {
              ...existing,
              ...updatedPost,
              authorAvatar: existing.authorAvatar,
            };
            posts = nextPosts;
            saveJSON(POSTS_KEY, posts);
            render();
          }
        }
      } else {
        const fd = new FormData();
        fd.append("title", title);
        fd.append("category", category);
        fd.append("body", body);
        fd.append("authorName", name);
        fd.append("authorEmail", email);
        tags.forEach((t) => fd.append("tags", t));
        getComposerFiles().forEach((f) => fd.append("media", f));

        const res = await fetch("/api/posts", { method: "POST", body: fd });
        const post = await res.json();

        if (!res.ok) {
          showToast(post.error || "Failed to create post.", "error");
          return;
        }

        posts.unshift(post);
        saveJSON(POSTS_KEY, posts);
      }

      shouldAnimateFeed = true;
      markComposerClean();
      closeComposer(true);
      render();
      if (window.refreshProfileData && typeof window.refreshProfileData === "function") {
        window.refreshProfileData();
      }
      if (activePostId && wasEditingId && activePostId === wasEditingId) {
        renderDetail({ animateComments: false });
      }
    } catch (err) {
      console.error("Failed to create/update post:", err);
    }
  }

  function closeSortMenu() {
    if (!sortDropdown || !sortBtn) return;
    sortDropdown.classList.remove("open");
    sortBtn.setAttribute("aria-expanded", "false");
  }

  window.AF_MAIN_EVENT_BINDINGS.bindMainPageEvents({
    user: { name, email },
    elements: {
      categoryMenu,
      sortBtn,
      sortMenu,
      sortDropdown,
      sortLabel,
      openComposerBtn,
      quickPostTitle,
      createFirstBtn,
      closeComposerBtn,
      cancelComposerBtn,
      composerOverlay,
      createPostForm,
      postTitle,
      titleCount,
      closeDetailBtn,
      detailOverlay,
      submitCommentBtn,
      commentText,
      commentForm,
      commentsList,
      feed,
      searchInput,
      searchHistoryEl,
    },
    actions: {
      setActiveCategory,
      openComposer,
      closeComposer,
      requestCloseComposer,
      createPostFromForm,
      closeDetail,
      render,
      renderComments,
      getPostById,
      showConfirmModal,
      isCommentOwner,
      findCommentById,
      getCommentUserVote,
      vote,
      voteComment,
      isRepliesCollapsed,
      setRepliesCollapsed,
      startEditPost,
      handleDelete,
      showReportModal,
      openDetail,
      setActiveTag,
      toggleBookmark,
      closeSortMenu,
      saveToHistory,
      renderHistory,
      getHistory,
    },
    state: {
      getActivePostId: () => activePostId,
      setShouldAnimateFeed: (value) => {
        shouldAnimateFeed = value;
      },
      setSearchQuery: (value) => {
        searchQuery = value;
      },
      getPosts: () => posts,
      setPosts: (nextPosts) => {
        posts = nextPosts;
      },
      setActiveCategoryValue: (value) => {
        activeCategory = value;
      },
      setSortMode: (value) => {
        sortMode = value;
      },
    },
    helpers: {
      refreshProfileData: window.refreshProfileData,
    },
    markComposerDirty,
  });

  // Load posts from the API, then render the page.
  async function initPosts() {
    try {
      const res  = await fetch("/api/posts");
      const data = await res.json();
      if (res.ok) {
        posts = data;
        // Save to localStorage so polling updates can merge properly
        saveJSON(POSTS_KEY, posts);
        shouldAnimateFeed = true;
      }
    } catch (err) {
      console.error("Failed to load posts:", err);
    }
    render();

    // Check if we arrived from the Bookmarks button on profile
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("bookmarks") === "1") {
      activeCategory = "__bookmarks__";
      updateFeedTitle();
      if (categoryMenu) {
        categoryMenu.querySelectorAll("li").forEach((li) => {
          li.classList.toggle("active", li.dataset.category === "__bookmarks__");
        });
      }
      render();
    }

    // Check if we need to open a specific post (from profile navigation)
    const openPostId = localStorage.getItem("af_open_post");
    if (openPostId) {
      localStorage.removeItem("af_open_post");
      setTimeout(() => {
        if (commentText) commentText.value = "";
        openDetail(openPostId);
      }, 100);
    }
  }

  initPosts();

  const bell = document.getElementById('notifBell');
  const dropdown = document.getElementById('notifDropdown');

  if (bell && dropdown) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
      window.AF_MAIN_UTILS.initializeNotifications();
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Expose refresh functions globally for real-time updates
  window.refreshFeed = async function() {
    try {
      // Reload posts from localStorage (which is updated by polling)
      const latestPosts = loadJSON(POSTS_KEY) || [];
      if (latestPosts.length > 0) {
        posts = latestPosts;
        render();
        console.log('Feed refreshed with', latestPosts.length, 'posts');
      }
    } catch (err) {
      console.error('Failed to refresh feed:', err);
    }
  };

  window.loadAllPosts = async function() {
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      if (res.ok) {
        posts = data;
        saveJSON(POSTS_KEY, posts);
        render();
      }
    } catch (err) {
      console.error("Failed to load posts:", err);
    }
  };

  if (window.AF_MAIN_UTILS) {
    window.AF_MAIN_UTILS.initializeNotifications();
    window.AF_MAIN_UTILS.startNotificationPolling();
  }
})();
