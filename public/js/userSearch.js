
(function () {
  function createUserSearchManager({
    userSearchDropdownEl,
    searchInput,
    escapeHtml,
    getAuthorAvatar,
    showToast,
    currentUserEmail,
    searchHistoryEl,
  }) {
    let searchTimeout = null;
    let isSearching = false;

    async function searchUsers(query) {
      if (!query || query.trim().length < 2) {
        hideDropdown();
        return;
      }

      const trimmedQuery = query.trim();
      
      try {
        isSearching = true;
        showLoading();
        
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(trimmedQuery)}`, {
          headers: {
            'x-user-email': currentUserEmail
          }
        });
        
        const data = await response.json();
        
        if (response.ok) {
          renderUsers(data.users || [], trimmedQuery);
        } else {
          showError(data.error || 'Failed to search users');
        }
      } catch (error) {
        console.error('User search error:', error);
        showError('Failed to search users');
      } finally {
        isSearching = false;
      }
    }

    function showLoading() {
      if (!userSearchDropdownEl) return;
      
      userSearchDropdownEl.innerHTML = `
        <div class="user-search-header">Users</div>
        <div class="user-search-loading">
          <span>Searching...</span>
        </div>
      `;
      userSearchDropdownEl.classList.add('show');
    }

    function showError(message) {
      if (!userSearchDropdownEl) return;
      
      userSearchDropdownEl.innerHTML = `
        <div class="user-search-header">Users</div>
        <div class="user-search-no-results">
          <span>${escapeHtml(message)}</span>
        </div>
      `;
      userSearchDropdownEl.classList.add('show');
    }

    function renderUsers(users, query) {
      if (!userSearchDropdownEl) return;

      if (users.length === 0) {
        userSearchDropdownEl.innerHTML = `
          <div class="user-search-header">Users</div>
          <div class="user-search-no-results">
            <span>No users found for "${escapeHtml(query)}"</span>
          </div>
        `;
        userSearchDropdownEl.classList.add('show');
        return;
      }

      userSearchDropdownEl.innerHTML = `
        <div class="user-search-header">Users</div>
      `;

      users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-search-item';
        
        const avatar = getAuthorAvatar(user.email);
        const followBtnClass = user.isFollowing ? 'unfollow' : 'follow';
        const followBtnText = user.isFollowing ? 'Following' : 'Follow';
        
        userItem.innerHTML = `
          <img 
            src="${avatar}" 
            alt="${escapeHtml(user.name)}" 
            class="user-search-avatar"
            onerror="this.src='/assets/default_pfp.png'"
          />
          <div class="user-search-info">
            <div class="user-search-name">${escapeHtml(user.name)}</div>
            <div class="user-search-email">${escapeHtml(user.email)}</div>
          </div>
          <div class="user-search-actions">
            <button 
              class="user-follow-btn ${followBtnClass}" 
              data-user-email="${escapeHtml(user.email)}"
              data-user-name="${escapeHtml(user.name)}"
            >
              ${followBtnText}
            </button>
          </div>
        `;

        // Handle profile navigation (click on user info area)
        const profileArea = userItem.querySelector('.user-search-info');
        const avatarArea = userItem.querySelector('.user-search-avatar');
        
        [profileArea, avatarArea].forEach(element => {
          element.style.cursor = 'pointer';
          element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateToProfile(user.email);
          });
        });

        // Handle follow/unfollow button
        const followBtn = userItem.querySelector('.user-follow-btn');
        followBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFollowToggle(user.email, user.name, user.isFollowing, followBtn);
        });

        userSearchDropdownEl.appendChild(userItem);
      });

      userSearchDropdownEl.classList.add('show');
      hideSearchHistory(); // Hide search history when showing user results
    }

    function navigateToProfile(userEmail) {
      hideDropdown();
      // Clear search input when navigating
      if (searchInput) {
        searchInput.value = '';
      }
      
      // Use the existing navigation utility if available, otherwise use window.location
      if (window.AF_MAIN_UTILS && window.AF_MAIN_UTILS.navigateWithFade) {
        window.AF_MAIN_UTILS.navigateWithFade(`/profile?user=${encodeURIComponent(userEmail)}`);
      } else {
        window.location.href = `/profile?user=${encodeURIComponent(userEmail)}`;
      }
    }

    async function handleFollowToggle(userEmail, userName, isCurrentlyFollowing, buttonElement) {
      if (!buttonElement) return;
      
      const originalText = buttonElement.textContent;
      buttonElement.disabled = true;
      buttonElement.textContent = isCurrentlyFollowing ? 'Unfollowing...' : 'Following...';

      try {
        const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
        const response = await fetch(`/api/users/${encodeURIComponent(userEmail)}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ followerEmail: currentUserEmail })
        });

        const data = await response.json();

        if (response.ok) {
          // Update button state
          if (isCurrentlyFollowing) {
            buttonElement.className = 'user-follow-btn follow';
            buttonElement.textContent = 'Follow';
          } else {
            buttonElement.className = 'user-follow-btn unfollow';
            buttonElement.textContent = 'Following';
          }

          // Show success message
          const actionText = isCurrentlyFollowing ? 'unfollowed' : 'followed';
          showToast(`Successfully ${actionText} ${userName}`, 'success');
        } else {
          throw new Error(data.error || 'Failed to update follow status');
        }
      } catch (error) {
        console.error('Follow toggle error:', error);
        showToast(error.message || 'Failed to update follow status', 'error');
        
        // Restore original button state
        buttonElement.textContent = originalText;
      } finally {
        buttonElement.disabled = false;
      }
    }

    function hideDropdown() {
      if (userSearchDropdownEl) {
        userSearchDropdownEl.classList.remove('show');
      }
    }

    function hideSearchHistory() {
      if (searchHistoryEl) {
        searchHistoryEl.classList.remove('show');
      }
    }

    function handleSearchInput() {
      const query = searchInput ? searchInput.value : '';
      
      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // If query is empty or too short, hide dropdown
      if (!query || query.trim().length < 2) {
        hideDropdown();
        return;
      }

      // Debounce search to avoid too many API calls
      searchTimeout = setTimeout(() => {
        searchUsers(query);
      }, 300);
    }

    function init() {
      if (!searchInput || !userSearchDropdownEl) {
        console.warn('User search elements not found');
        return;
      }

      // Listen for search input changes
      searchInput.addEventListener('input', handleSearchInput);

      // Hide dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userSearchDropdownEl.contains(e.target) && !searchInput.contains(e.target)) {
          hideDropdown();
        }
      });

      // Hide dropdown when pressing Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          hideDropdown();
        }
      });
    }

    return {
      init,
      searchUsers,
      hideDropdown,
      handleSearchInput,
    };
  }

  window.AF_USER_SEARCH = {
    createUserSearchManager,
  };
})();
