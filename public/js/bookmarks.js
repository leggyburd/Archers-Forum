/*
  Bookmarks Page Script
  This script manages the bookmarks page, allowing users to view their bookmarked posts, remove bookmarks, and navigate to the post details. It interacts with localStorage to save and load the user's bookmarks, and fetches post data from the server to display the bookmarked posts.
*/

(function () {
  function applySavedTheme() {
    const savedTheme = localStorage.getItem("af_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  applySavedTheme();

  function resetPageTransitionState() {
    document.body.classList.remove("is-leaving");
    document.body.classList.add("is-ready");
  }

  resetPageTransitionState();
  window.addEventListener("pageshow", resetPageTransitionState);

  const name = localStorage.getItem("af_user");
  const email = localStorage.getItem("af_user_email");

  if (!name || !email) {
    window.location.href = "/login";
    return;
  }

  const BOOKMARKS_KEY = AF_STORAGE.bookmarksKey(email);
  const list = document.getElementById("bookmarkPostsList");
  const msg = document.getElementById("bookmarkMsg");
  const refreshBtn = document.getElementById("refreshBookmarksBtn");
  const logoutBtn = document.getElementById("bookmarksLogoutBtn");

  function showMsg(text, kind) {
    if (!msg) return;
    msg.hidden = false;
    msg.className = `admin-msg ${kind || "info"}`;
    msg.textContent = text;
  }

  function clearMsg() {
    if (!msg) return;
    msg.hidden = true;
    msg.textContent = "";
  }

  function escapeHtml(str) {
    return String(str || "")
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

  function loadBookmarkIds() {
    const ids = AF_STORAGE.load(BOOKMARKS_KEY, []);
    return Array.isArray(ids) ? ids : [];
  }

  function saveBookmarkIds(ids) {
    AF_STORAGE.save(BOOKMARKS_KEY, ids);
  }

  function removeBookmark(postId) {
    const ids = loadBookmarkIds();
    const next = ids.filter((id) => id !== postId);
    saveBookmarkIds(next);
  }

  function openPost(postId) {
    localStorage.setItem("af_open_post", postId);
    window.location.href = "/mainpage";
  }

  function renderBookmarkRows(bookmarkedPosts) {
    if (!list) return;

    if (!bookmarkedPosts.length) {
      list.innerHTML = `
        <article class="reported-item">
          <h3 class="reported-title">No bookmarks yet</h3>
          <p class="reported-meta">Save posts from the main page and they will appear here.</p>
        </article>
      `;
      return;
    }

    // Always use the main feed post card renderer for consistency
    const feedRenderer = window.AF_MAIN_FEED_RENDERER.createFeedRenderer({
      getUserVote: () => null,
      getPostById: () => null,
      getPostReplyCount: () => 0,
      isOwner: () => false,
      isBookmarked: () => true,
      escapeHtml,
      categorySlug: () => "",
      getProfileHref: () => "#",
      getAuthorAvatar: (authorEmail, serverAvatar) => {
        if (typeof serverAvatar === "string" && serverAvatar.trim() !== "") {
          return serverAvatar;
        }
        const stored = authorEmail
          ? localStorage.getItem(`af_profile_avatar_${authorEmail}`)
          : null;
        return stored || "/assets/default_pfp.png";
      },
      formatDate,
      userRole: "user"
    });
    list.innerHTML = bookmarkedPosts.map(feedRenderer.renderPostCard).join("");
  }

  async function loadBookmarks() {
    clearMsg();

    try {
      const res = await fetch("/api/posts");
      const posts = await res.json();
      if (!res.ok) {
        showMsg("Failed to load posts.", "error");
        return;
      }

      const byId = new Map((posts || []).map((p) => [p.id, p]));
      const bookmarkIds = loadBookmarkIds();
      const bookmarkedPosts = bookmarkIds
        .map((id) => byId.get(id))
        .filter(Boolean);

      renderBookmarkRows(bookmarkedPosts);
    } catch (err) {
      showMsg("Failed to load bookmarks.", "error");
    }
  }

  if (list) {
    list.addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;

      const postId = card.getAttribute("data-id");
      const actionBtn = e.target.closest("[data-action]");

      if (!actionBtn) {
        openPost(postId);
        return;
      }

      const action = actionBtn.getAttribute("data-action");
      if (action === "open") {
        openPost(postId);
        return;
      }

      if (action === "remove") {
        removeBookmark(postId);
        loadBookmarks();
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadBookmarks);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("af_user");
      localStorage.removeItem("af_user_email");
      localStorage.removeItem("af_user_role");
      window.location.href = "/login";
    });
  }

  loadBookmarks();
})();
