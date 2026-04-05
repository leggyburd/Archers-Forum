/*
  Admin Page Script
  This script handles the functionality of the admin page, including loading reported posts, resolving reports, deleting posts, and managing the trash. It also includes utility functions for rendering the reported posts and formatting dates. 
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
  const role = localStorage.getItem("af_user_role") || "user";

  if (!name || !email) {
    window.location.href = "/login";
    return;
  }

  if (role !== "admin") {
    window.location.href = "/mainpage";
    return;
  }

  const list = document.getElementById("reportedPostsList");
  const msg = document.getElementById("adminMsg");
  const tabReported = document.getElementById("tabReported");
  const tabTrash = document.getElementById("tabTrash");
  const reportedSection = document.getElementById("reportedSection");
  const trashSection = document.getElementById("trashSection");
  const trashList = document.getElementById("trashPostsList");
  const refreshTrashBtn = document.getElementById("refreshTrashBtn");
  const refreshBtn = document.getElementById("refreshReportsBtn");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const backLink = document.getElementById("adminBackLink");

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

  function renderReportedPosts(posts) {
    if (!list) return;

    if (!posts || posts.length === 0) {
      list.innerHTML = "<p class=\"placeholder-text\">No reported posts right now.</p>";
      return;
    }

    list.innerHTML = posts
      .map((p) => {
        const reports = (p.reports || [])
          .map((r) => `
            <div class=\"report-row\">
              <strong>${escapeHtml(r.reason)}</strong> by ${escapeHtml(r.reporterName)} (${escapeHtml(r.reporterEmail)}) on ${escapeHtml(formatDate(r.createdAt))}
              ${r.details ? `<div>Details: ${escapeHtml(r.details)}</div>` : ""}
            </div>
          `)
          .join("");

        return `
          <article class=\"reported-item\" data-id=\"${escapeHtml(p.id)}\">
            <div class=\"reported-top\">
              <h3 class=\"reported-title\">${escapeHtml(p.title || "Untitled Post")}</h3>
              <div class="reported-top-actions">
                <span class="rf-pill">${p.reportCount || 0} reports</span>
                <button class="btn-toggle-report" type="button" data-action="toggle" aria-expanded="false">View Details</button>
              </div>
            </div>
            <div class=\"reported-meta\">${escapeHtml(p.authorName)} (${escapeHtml(p.authorEmail)}) • ${escapeHtml(formatDate(p.createdAt))}</div>
            <div class="reported-collapsible">
              <div class="reported-body">${escapeHtml(p.body || "")}</div>
              <div class="report-block">
                <h4>Report Details</h4>
                ${reports}
              </div>
              <div class="report-actions">
                <button class="btn-secondary" type="button" data-action="resolve">Mark Resolved</button>
                <button class="rf-action rf-danger" type="button" data-action="delete">Delete Post</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadReportedPosts() {
    clearMsg();
    try {
      const res = await fetch(`/api/posts/reported?adminEmail=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || "Failed to load reported posts.", "error");
        return;
      }
      renderReportedPosts(data);
    } catch (err) {
      showMsg("Failed to load reported posts.", "error");
    }
  }

  async function resolveReports(postId) {
    try {
      const res = await fetch(`/api/posts/${postId}/reports/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || "Failed to resolve reports.", "error");
        return;
      }
      showMsg("Reports marked as resolved.", "info");
      await loadReportedPosts();
    } catch (err) {
      showMsg("Failed to resolve reports.", "error");
    }
  }

  async function deletePost(postId) {
    try {
      const res = await fetch(`/api/posts/${postId}/reports/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.error || "Failed to delete post.", "error");
        return;
      }
      showMsg("Post deleted.", "info");
      await loadReportedPosts();
    } catch (err) {
      showMsg("Failed to delete post.", "error");
    }
  }

  if (list) {
    list.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("[data-action]");
      const card = e.target.closest("[data-id]");
      if (!actionBtn || !card) return;

      const postId = card.getAttribute("data-id");
      const action = actionBtn.getAttribute("data-action");

      if (action === "toggle") {
        const expanded = card.classList.toggle("is-expanded");
        actionBtn.textContent = expanded ? "Hide Details" : "View Details";
        actionBtn.setAttribute("aria-expanded", String(expanded));
        return;
      }

      if (action === "resolve") {
        await resolveReports(postId);
      }

      if (action === "delete") {
        await deletePost(postId);
      }
    });
  }

  if (tabReported && tabTrash) {
    tabReported.addEventListener("click", () => {
      tabReported.classList.add("active");
      tabTrash.classList.remove("active");
      reportedSection.style.display = "block";
      trashSection.style.display = "none";
      loadReportedPosts();
    });

    tabTrash.addEventListener("click", () => {
      tabTrash.classList.add("active");
      tabReported.classList.remove("active");
      trashSection.style.display = "block";
      reportedSection.style.display = "none";
      loadTrashPosts();
    });
  }

  async function loadTrashPosts() {
    try {
      const res = await fetch(`/api/posts/deleted/all?adminEmail=${encodeURIComponent(email)}`);
      const posts = await res.json();
      if (!res.ok) return;

      if (posts.length === 0) {
        trashList.innerHTML = '<p class="placeholder-text">The trash is empty!</p>';
        return;
      }

      trashList.innerHTML = posts.map(p => `
        <article class="reported-item">
          <div class="reported-top">
            <h3 class="reported-title">${escapeHtml(p.title)}</h3>
            <button class="rf-action btn-secondary" onclick="restorePost('${p.id}')">Restore</button>
          </div>
          <div class="reported-meta">Deleted Post by ${escapeHtml(p.authorName)}</div>
        </article>
      `).join('');
    } catch (err) { console.error(err); }
  }

  window.restorePost = async function(postId) {
    if (!confirm("Restore this post?")) return;
    try {
      const res = await fetch(`/api/posts/${postId}/restore`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: email })
      });
      if (res.ok) {
        alert("Post Restored!");
        loadTrashPosts();
      }
    } catch (err) { console.error(err); }
  };

  if (refreshBtn) refreshBtn.addEventListener("click", loadReportedPosts);
  if (refreshTrashBtn) refreshTrashBtn.addEventListener("click", loadTrashPosts);
  
  loadReportedPosts();

  if (backLink) {
    backLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/profile";
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("af_user");
      localStorage.removeItem("af_user_email");
      localStorage.removeItem("af_user_role");
      window.location.href = "/login";
    });
  }

  loadReportedPosts();

  const bell = document.getElementById('notifBell');
  const dropdown = document.getElementById('notifDropdown');

  if (bell && dropdown) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
      if (window.AF_MAIN_UTILS) window.AF_MAIN_UTILS.initializeNotifications();
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('show');
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  if (window.AF_MAIN_UTILS) {
    window.AF_MAIN_UTILS.initializeNotifications();
    window.AF_MAIN_UTILS.startNotificationPolling();
  }
})();
