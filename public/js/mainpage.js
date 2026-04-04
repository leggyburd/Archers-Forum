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

  const postTitle = document.getElementById("postTitle");
  const postCategory = document.getElementById("postCategory");
  const postTags = document.getElementById("postTags");
  const postBody = document.getElementById("postBody");
  const postMedia = document.getElementById("postMedia");
  const mediaPreviewList = document.getElementById("mediaPreviewList");
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

    createPostForm.reset();
    if (titleCount) titleCount.textContent = "0";

    if (prefillTitle && postTitle && titleCount) {
      postTitle.value = prefillTitle;
      titleCount.textContent = String(prefillTitle.length);
    }

    if (composerOverlay) openOverlay(composerOverlay);
    if (postTitle) postTitle.focus();
  }

  function closeComposer() {
    if (composerOverlay) closeOverlay(composerOverlay);
    if (postMedia) postMedia.value = "";
    if (mediaPreviewList) mediaPreviewList.innerHTML = "";
  }

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
    const post = posts[idx];
    
    if (direction === 'up' && current !== 'up') {
      window.AF_MAIN_UTILS.addNotification('like', myName, post.authorEmail, post.title, postId);
    }
    setUserVote(postId, next);
    saveJSON(VOTES_KEY, votesByUser);

    render();
    if (activePostId === postId) renderDetail({ animateComments: false });

    // Sync vote delta to the server (fire-and-forget; UI is already updated)
    fetch(`/api/posts/${postId}/vote`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ delta }),
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

  function initMediaCarousels(rootEl) {
    const root = rootEl || document;
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

  // Wire up file input preview
  if (postMedia && mediaPreviewList) {
    postMedia.addEventListener("change", () => {
      mediaPreviewList.innerHTML = "";
      Array.from(postMedia.files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const item = document.createElement("div");
        item.className = "media-preview-item";
        if (file.type.startsWith("video/")) {
          item.innerHTML = `<video src="${url}" class="media-thumb" muted preload="metadata"></video>`;
        } else {
          item.innerHTML = `<img src="${url}" class="media-thumb" alt="" />`;
        }
        mediaPreviewList.appendChild(item);
      });
    });
  }

  async function createPostFromForm() {
    const title    = postTitle    ? postTitle.value.trim()    : "";
    const category = postCategory ? postCategory.value        : "General Questions";
    const tags     = normalizeTags(postTags ? postTags.value  : "");
    const body     = postBody     ? postBody.value.trim()     : "";
    if (!title || !body) return;

    try {
      const fd = new FormData();
      fd.append("title",       title);
      fd.append("category",    category);
      fd.append("body",        body);
      fd.append("authorName",  name);
      fd.append("authorEmail", email);
      tags.forEach((t) => fd.append("tags", t));
      if (postMedia && postMedia.files) {
        Array.from(postMedia.files).forEach((f) => fd.append("media", f));
      }

      const res  = await fetch("/api/posts", { method: "POST", body: fd });
      const post = await res.json();

      if (res.ok) {
        posts.unshift(post);
        shouldAnimateFeed = true;
        closeComposer();
        render();
        if (window.refreshProfileData && typeof window.refreshProfileData === "function") {
          window.refreshProfileData();
        }
      }
    } catch (err) {
      console.error("Failed to create post:", err);
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
  });

  // Load posts from the API, then render the page.
  async function initPosts() {
    try {
      const res  = await fetch("/api/posts");
      const data = await res.json();
      if (res.ok) {
        posts = data;
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
      e.stopPropagation(); // Stop click from bubbling to document
      dropdown.classList.toggle('show');
      // Update badge/list immediately
      window.AF_MAIN_UTILS.renderNotifications();
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  window.AF_MAIN_UTILS.renderNotifications();
})();
