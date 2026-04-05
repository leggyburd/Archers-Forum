/*
  User Management Script
  This script handles the functionality of the user management page for admins,
  including loading users, searching, filtering, enabling/disabling, and deleting users.
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

  const usersList = document.getElementById("usersList");
  const msg = document.getElementById("userManagementMsg");
  const refreshBtn = document.getElementById("refreshUsersBtn");
  const searchInput = document.getElementById("searchUsers");
  const filterSelect = document.getElementById("filterUsers");

  let allUsers = [];
  let filteredUsers = [];

  function showMsg(text, kind) {
    if (!msg) return;
    msg.hidden = false;
    msg.className = `admin-msg ${kind || "info"}`;
    msg.textContent = text;
    setTimeout(() => clearMsg(), 5000);
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
    if (!ts) return "Unknown";
    const date = new Date(typeof ts === "number" ? ts : ts);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function updateStats() {
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(u => !u.isDisabled).length;
    const disabledUsers = allUsers.filter(u => u.isDisabled).length;
    const adminUsers = allUsers.filter(u => u.role === 'admin').length;

    document.getElementById("totalUsers").textContent = totalUsers;
    document.getElementById("activeUsers").textContent = activeUsers;
    document.getElementById("disabledUsers").textContent = disabledUsers;
    document.getElementById("adminUsers").textContent = adminUsers;
  }

  function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filterValue = filterSelect.value;

    filteredUsers = allUsers.filter(user => {
      // Search filter
      const matchesSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm);

      // Status filter
      let matchesFilter = true;
      if (filterValue === 'active') {
        matchesFilter = !user.isDisabled;
      } else if (filterValue === 'disabled') {
        matchesFilter = user.isDisabled;
      } else if (filterValue === 'admins') {
        matchesFilter = user.role === 'admin';
      }

      return matchesSearch && matchesFilter;
    });

    renderUsers();
  }

  function renderUsers() {
    if (!usersList) return;

    if (!filteredUsers || filteredUsers.length === 0) {
      usersList.innerHTML = `<p class="placeholder-text">No users found.</p>`;
      return;
    }

    usersList.innerHTML = filteredUsers
      .map((user) => {
        const statusBadge = user.isDisabled 
          ? '<span class="user-status disabled">Disabled</span>'
          : '<span class="user-status active">Active</span>';
        
        const roleBadge = user.role === 'admin'
          ? '<span class="user-role admin">Admin</span>'
          : '<span class="user-role user">User</span>';

        const canModify = user.email !== email && user.role !== 'admin';
        
        return `
          <article class="user-item" data-id="${escapeHtml(user.id)}">
            <div class="user-item-left">
              <img src="${escapeHtml(user.avatar)}" alt="Avatar" class="user-avatar" />
              <div class="user-info">
                <h4 class="user-name user-name-clickable" 
                    data-action="view" 
                    data-user-id="${escapeHtml(user.id)}"
                    title="Click to view user details">${escapeHtml(user.name)}</h4>
                <p class="user-email">${escapeHtml(user.email)}</p>
                <div class="user-meta">
                  ${roleBadge}
                  ${statusBadge}
                  <span class="user-date">Joined ${escapeHtml(formatDate(user.createdAt))}</span>
                </div>
              </div>
            </div>
            
            <div class="user-stats-mini">
              <div class="stat-mini">
                <span class="stat-mini-number">${user.followersCount}</span>
                <span class="stat-mini-label">Followers</span>
              </div>
              <div class="stat-mini">
                <span class="stat-mini-number">${user.followingCount}</span>
                <span class="stat-mini-label">Following</span>
              </div>
            </div>

            <div class="user-actions">
              ${canModify ? `
                <button class="btn-user-action btn-warning" 
                        data-action="warn"
                        data-user-id="${escapeHtml(user.id)}"
                        data-user-name="${escapeHtml(user.name)}"
                        title="Send warning">
                  Warn
                </button>
                <button class="btn-user-action btn-toggle-status" 
                        data-action="${user.isDisabled ? 'enable' : 'disable'}"
                        data-user-id="${escapeHtml(user.id)}"
                        data-user-name="${escapeHtml(user.name)}">
                  ${user.isDisabled ? 'Enable' : 'Disable'}
                </button>
                <button class="btn-user-action btn-delete-user btn-danger" 
                        data-action="delete"
                        data-user-id="${escapeHtml(user.id)}"
                        data-user-name="${escapeHtml(user.name)}">
                  Delete
                </button>
              ` : `
                <span class="user-protected">${user.email === email ? 'You' : 'Protected'}</span>
              `}
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadUsers() {
    clearMsg();
    try {
      if (usersList) {
        usersList.innerHTML = '<div class="loading-placeholder">Loading users...</div>';
      }

      const res = await fetch(`/api/users/admin/all?adminEmail=${encodeURIComponent(email)}`);
      const data = await res.json();
      
      if (!res.ok) {
        showMsg(data.error || "Failed to load users.", "error");
        return;
      }

      allUsers = data;
      filteredUsers = [...allUsers];
      updateStats();
      renderUsers();
    } catch (err) {
      console.error("Failed to load users:", err);
      showMsg("Failed to load users.", "error");
    }
  }

  async function toggleUserStatus(userId, action, userName) {
    try {
      const res = await fetch(`/api/users/${userId}/toggle-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        showMsg(data.error || `Failed to ${action} user.`, "error");
        return;
      }

      showMsg(`${userName} ${action}d successfully.`, "info");
      await loadUsers();
    } catch (err) {
      console.error(`Failed to ${action} user:`, err);
      showMsg(`Failed to ${action} user.`, "error");
    }
  }

  async function deleteUser(userId, userName) {
    try {
      const res = await fetch(`/api/users/${userId}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        showMsg(data.error || "Failed to delete user.", "error");
        return;
      }

      showMsg(`${userName} deleted successfully.`, "info");
      await loadUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
      showMsg("Failed to delete user.", "error");
    }
  }

  async function sendWarning(userId, userName, message) {
    try {
      const res = await fetch(`/api/users/${userId}/warn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          adminEmail: email,
          message: message 
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        showMsg(data.error || "Failed to send warning.", "error");
        return;
      }

      showMsg(`Warning sent to ${userName} successfully.`, "info");
    } catch (err) {
      console.error("Failed to send warning:", err);
      showMsg("Failed to send warning.", "error");
    }
  }

  function showUserDetails(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById("userDetailModal");
    const titleEl = document.getElementById("userDetailTitle");
    const bodyEl = document.getElementById("userDetailBody");

    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = `${user.name} - User Details`;
    
    const joinedDate = formatDate(user.createdAt);
    const statusText = user.isDisabled ? "Disabled" : "Active";
    const statusClass = user.isDisabled ? "disabled" : "active";
    
    bodyEl.innerHTML = `
      <div class="user-detail-grid">
        <div class="user-detail-avatar">
          <img src="${escapeHtml(user.avatar)}" alt="Avatar" class="detail-avatar" />
        </div>
        <div class="user-detail-info">
          <div class="detail-row">
            <label>Full Name:</label>
            <span>${escapeHtml(user.name)}</span>
          </div>
          <div class="detail-row">
            <label>Email:</label>
            <span>${escapeHtml(user.email)}</span>
          </div>
          <div class="detail-row">
            <label>Role:</label>
            <span class="user-role ${user.role}">${user.role === 'admin' ? 'Administrator' : 'User'}</span>
          </div>
          <div class="detail-row">
            <label>Status:</label>
            <span class="user-status ${statusClass}">${statusText}</span>
          </div>
          <div class="detail-row">
            <label>Joined:</label>
            <span>${joinedDate}</span>
          </div>
          <div class="detail-row">
            <label>Followers:</label>
            <span>${user.followersCount}</span>
          </div>
          <div class="detail-row">
            <label>Following:</label>
            <span>${user.followingCount}</span>
          </div>
        </div>
      </div>
    `;

    modal.style.display = "flex";
  }

  function showWarningModal(userId, userName) {
    const modal = document.getElementById("warningModal");
    const titleEl = document.getElementById("warningModalTitle");
    const userNameEl = document.getElementById("warningUserName");
    const messageEl = document.getElementById("warningMessage");
    const sendBtn = document.getElementById("sendWarning");

    if (!modal || !titleEl || !userNameEl || !messageEl || !sendBtn) return;

    titleEl.textContent = "Send Warning";
    userNameEl.textContent = userName;
    messageEl.value = "";
    modal.style.display = "flex";

    const closeModal = () => {
      modal.style.display = "none";
      sendBtn.onclick = null;
    };

    sendBtn.onclick = async () => {
      const message = messageEl.value.trim();
      if (!message) {
        showMsg("Please enter a warning message.", "error");
        return;
      }
      
      await sendWarning(userId, userName, message);
      closeModal();
    };

    // Setup close handlers
    document.getElementById("closeWarningModal").onclick = closeModal;
    document.getElementById("cancelWarning").onclick = closeModal;

    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const cancelBtn = document.getElementById("confirmCancel");
    const actionBtn = document.getElementById("confirmAction");

    if (!modal || !titleEl || !messageEl || !cancelBtn || !actionBtn) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.style.display = "flex";

    const closeModal = () => {
      modal.style.display = "none";
      actionBtn.onclick = null;
      cancelBtn.onclick = null;
    };

    actionBtn.onclick = () => {
      onConfirm();
      closeModal();
    };

    cancelBtn.onclick = closeModal;

    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  // Event Listeners
  if (usersList) {
    usersList.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      const userId = actionBtn.dataset.userId;
      const userName = actionBtn.dataset.userName;

      if (action === "view") {
        showUserDetails(userId);
      } else if (action === "warn") {
        showWarningModal(userId, userName);
      } else if (action === "enable" || action === "disable") {
        showConfirmModal(
          `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
          `Are you sure you want to ${action} ${userName}?`,
          () => toggleUserStatus(userId, action, userName)
        );
      } else if (action === "delete") {
        showConfirmModal(
          "Delete User",
          `Are you sure you want to permanently delete ${userName}? This action cannot be undone.`,
          () => deleteUser(userId, userName)
        );
      }
    });
  }

  // User detail modal close handler
  const userDetailModal = document.getElementById("userDetailModal");
  const closeUserDetail = document.getElementById("closeUserDetail");
  
  if (closeUserDetail && userDetailModal) {
    closeUserDetail.onclick = () => {
      userDetailModal.style.display = "none";
    };

    userDetailModal.onclick = (e) => {
      if (e.target === userDetailModal) {
        userDetailModal.style.display = "none";
      }
    };
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadUsers);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", applyFilters);
  }

  // Notification functionality
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

  // Initial load
  loadUsers();
})();
