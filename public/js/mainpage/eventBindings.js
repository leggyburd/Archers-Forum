/*
  Main Page Event Bindings
  This module binds all the necessary event listeners for the main page, including category selection, sorting, post creation, comment interactions, and search functionality
*/

(function () {
  function bindMainPageEvents(ctx) {
    const {
      elements,
      actions,
      state,
      helpers,
    } = ctx;

    const {
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
    } = elements;

    const {
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
      isRepliesCollapsed,
      setRepliesCollapsed,
      vote,
      voteComment,
      handleDelete,
      showReportModal,
      openDetail,
      setActiveTag,
      toggleBookmark,
      closeSortMenu,
      saveToHistory,
      renderHistory,
      getHistory,
    } = actions;

    const {
      getActivePostId,
      setShouldAnimateFeed,
      setSearchQuery,
      getPosts,
      setPosts,
      setActiveCategoryValue,
      setSortMode,
    } = state;

    const { refreshProfileData } = helpers;

    if (categoryMenu) {
      categoryMenu.querySelectorAll("li").forEach((li) => {
        li.addEventListener("click", () => setActiveCategory(li.dataset.category));
      });
    }

    if (sortBtn && sortMenu && sortDropdown) {
      sortBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = sortDropdown.classList.toggle("open");
        sortBtn.setAttribute("aria-expanded", String(isOpen));
      });

      sortMenu.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", () => closeSortMenu());

      sortMenu.querySelectorAll(".dropdown-item").forEach((item) => {
        item.addEventListener("click", () => {
          sortMenu
            .querySelectorAll(".dropdown-item")
            .forEach((i) => i.classList.remove("selected"));
          item.classList.add("selected");

          setSortMode(item.dataset.value);
          if (sortLabel) sortLabel.textContent = item.textContent;

          closeSortMenu();
          setShouldAnimateFeed(true);
          render();
        });
      });
    }

    if (openComposerBtn) {
      openComposerBtn.addEventListener("click", () =>
        openComposer(quickPostTitle ? quickPostTitle.value.trim() : ""),
      );
    }

    if (quickPostTitle) {
      quickPostTitle.addEventListener("click", () => {
        const currentText = quickPostTitle.value.trim();
        openComposer(currentText);
        quickPostTitle.value = "";
      });
    }

    if (createFirstBtn) {
      createFirstBtn.addEventListener("click", () => openComposer(""));
    }

    if (closeComposerBtn) closeComposerBtn.addEventListener("click", closeComposer);
    if (cancelComposerBtn) cancelComposerBtn.addEventListener("click", closeComposer);

    if (composerOverlay) {
      composerOverlay.addEventListener("click", (e) => {
        if (e.target === composerOverlay) closeComposer();
      });
    }

    if (createPostForm) {
      createPostForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createPostFromForm();
      });
    }

    if (postTitle && titleCount) {
      postTitle.addEventListener("input", () => {
        titleCount.textContent = String(postTitle.value.length);
      });
    }

    if (closeDetailBtn) closeDetailBtn.addEventListener("click", closeDetail);

    if (detailOverlay) {
      detailOverlay.addEventListener("click", (e) => {
        if (e.target === detailOverlay) closeDetail();
      });
    }

    if (submitCommentBtn) {
      submitCommentBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!commentText) return;

        const text = commentText.value.trim();
        if (!text) return;

        const activePostId = getActivePostId();
        const post = getPostById(activePostId);
        if (!post) return;

        submitCommentBtn.disabled = true;
        submitCommentBtn.textContent = "Posting...";

        setShouldAnimateFeed(false);

        try {
          const res = await fetch(`/api/posts/${activePostId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              body: text,
              authorName: ctx.user.name,
              authorEmail: ctx.user.email,
            }),
          });
          const updatedPost = await res.json();

          if (res.ok) {
            const myName = localStorage.getItem("af_user");
            window.AF_MAIN_UTILS.addNotification('comment', myName, post.authorEmail, post.title, activePostId);
            const posts = getPosts();
            const idx = posts.findIndex((p) => p.id === activePostId);
            if (idx >= 0) {
              const nextPosts = posts.slice();
              nextPosts[idx] = updatedPost;
              setPosts(nextPosts);
            }
            commentText.value = "";
            renderComments();
            render();
            if (typeof refreshProfileData === "function") refreshProfileData();
          }
        } catch (err) {
          console.error("Failed to post comment:", err);
        }

        submitCommentBtn.disabled = false;
        submitCommentBtn.textContent = "Post Comment";
      });
    }

    if (commentForm) {
      commentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (submitCommentBtn) submitCommentBtn.click();
      });
    }

    if (commentsList) {
      commentsList.addEventListener("click", async (e) => {
        const actionEl = e.target.closest("[data-action]");
        const commentEl = e.target.closest("[data-comment-id]");
        if (!actionEl || !commentEl) return;

        e.preventDefault();
        e.stopPropagation();

        const action = actionEl.getAttribute("data-action");
        const commentId = commentEl.getAttribute("data-comment-id");

        const activePostId = getActivePostId();
        const post = getPostById(activePostId);
        if (!post) return;

        setShouldAnimateFeed(false);

        if (action === "reply") {
          const form = commentEl.querySelector(".reply-form:not(.comment-edit-form)");
          if (!form) return;

          if (form.hasAttribute("hidden")) {
            form.removeAttribute("hidden");
            const ta = form.querySelector(".reply-text");
            if (ta) ta.focus();
          } else {
            form.setAttribute("hidden", "");
          }
          return;
        }

        if (action === "cancel-reply") {
          const form = commentEl.querySelector(".reply-form:not(.comment-edit-form)");
          if (!form) return;

          const ta = form.querySelector(".reply-text");
          if (ta) ta.value = "";
          form.setAttribute("hidden", "");
          return;
        }

        if (action === "edit-comment") {
          const editForm = commentEl.querySelector(".comment-edit-form");
          const bodyEl = commentEl.querySelector(".comment-body");
          if (!editForm || !bodyEl) return;

          bodyEl.setAttribute("hidden", "");
          editForm.removeAttribute("hidden");

          const editTa = editForm.querySelector(".edit-comment-text");
          if (editTa) {
            editTa.focus();
            editTa.setSelectionRange(editTa.value.length, editTa.value.length);
          }
          return;
        }

        if (action === "upvote-comment") {
          voteComment(commentId, "up");
          return;
        }

        if (action === "downvote-comment") {
          voteComment(commentId, "down");
          return;
        }

        if (action === "toggle-replies") {
          const collapsed = isRepliesCollapsed(commentId);
          setRepliesCollapsed(commentId, !collapsed);
          renderComments({ animate: false });
          return;
        }

        if (action === "cancel-edit") {
          const editForm = commentEl.querySelector(".comment-edit-form");
          const bodyEl = commentEl.querySelector(".comment-body");
          if (!editForm || !bodyEl) return;

          const target = findCommentById(post.comments || [], commentId);
          const editTa = editForm.querySelector(".edit-comment-text");
          if (editTa && target) editTa.value = target.body || "";

          editForm.setAttribute("hidden", "");
          bodyEl.removeAttribute("hidden");
          return;
        }

        if (action === "save-edit") {
          const editForm = commentEl.querySelector(".comment-edit-form");
          const bodyEl = commentEl.querySelector(".comment-body");
          if (!editForm || !bodyEl) return;

          const target = findCommentById(post.comments || [], commentId);
          if (!target || !isCommentOwner(target)) return;

          const editTa = editForm.querySelector(".edit-comment-text");
          const text = (editTa ? editTa.value : "").trim();
          if (!text) return;

          try {
            const res = await fetch(`/api/posts/${activePostId}/comments/${commentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                body: text,
                authorEmail: ctx.user.email,
              }),
            });
            const updatedPost = await res.json();

            if (res.ok) {
              const posts = getPosts();
              const idx = posts.findIndex((p) => p.id === activePostId);
              if (idx >= 0) {
                const nextPosts = posts.slice();
                nextPosts[idx] = updatedPost;
                setPosts(nextPosts);
              }

              editForm.setAttribute("hidden", "");
              bodyEl.removeAttribute("hidden");
              renderComments();
              render();
              if (typeof refreshProfileData === "function") refreshProfileData();
            }
          } catch (err) {
            console.error("Failed to edit comment:", err);
          }
          return;
        }

        if (action === "submit-reply") {
          const form = commentEl.querySelector(".reply-form:not(.comment-edit-form)");
          if (!form) return;

          const ta = form.querySelector(".reply-text");
          const text = (ta ? ta.value : "").trim();
          if (!text) return;

          try {
            const res = await fetch(`/api/posts/${activePostId}/comments`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                body: text,
                authorName: ctx.user.name,
                authorEmail: ctx.user.email,
                parentCommentId: commentId,
              }),
            });
            const updatedPost = await res.json();

            if (res.ok) {
              const posts = getPosts();
              const idx = posts.findIndex((p) => p.id === activePostId);
              if (idx >= 0) {
                const nextPosts = posts.slice();
                nextPosts[idx] = updatedPost;
                setPosts(nextPosts);
              }

              if (ta) ta.value = "";
              form.setAttribute("hidden", "");

              renderComments();
              render();
              if (typeof refreshProfileData === "function") refreshProfileData();
            }
          } catch (err) {
            console.error("Failed to post reply:", err);
          }
          return;
        }

        if (action === "delete-comment") {
          const target = findCommentById(post.comments || [], commentId);
          if (!target || !isCommentOwner(target)) return;

          showConfirmModal(
            {
              title: "Delete comment?",
              message: "This will permanently remove your comment and its replies.",
              confirmText: "Delete",
              cancelText: "Cancel",
              danger: true,
            },
            async () => {
              try {
                const res = await fetch(
                  `/api/posts/${activePostId}/comments/${commentId}`,
                  { method: "DELETE" },
                );
                const updatedPost = await res.json();

                if (res.ok) {
                  const posts = getPosts();
                  const idx = posts.findIndex((p) => p.id === activePostId);
                  if (idx >= 0) {
                    const nextPosts = posts.slice();
                    nextPosts[idx] = updatedPost;
                    setPosts(nextPosts);
                  }
                  renderComments();
                  render();
                  if (typeof refreshProfileData === "function") refreshProfileData();
                }
              } catch (err) {
                console.error("Failed to delete comment:", err);
              }
            },
          );
        }

      });
    }

    if (feed) {
      feed.addEventListener("click", (e) => {
        const card = e.target.closest(".rf-post");
        if (!card) return;

        if (e.target.closest(".rf-author-link")) return;

        const postId = card.getAttribute("data-id");

        const tagBtn = e.target.closest("[data-tag]");
        if (tagBtn && tagBtn.dataset.tag) {
          setActiveTag(tagBtn.dataset.tag);
          return;
        }

        const actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
          const action = actionBtn.getAttribute("data-action");
          if (action === "upvote") vote(postId, "up");
          if (action === "downvote") vote(postId, "down");
          if (action === "delete") handleDelete(postId);
          if (action === "report") showReportModal(postId);
          if (action === "bookmark") toggleBookmark(postId);
          if (action === "open-detail") openDetail(postId);
          return;
        }

        openDetail(postId);
      });
    }

    document.addEventListener("click", (e) => {
      const chip = e.target.closest(".tag-chip");
      if (!chip || !chip.dataset.tag) return;

      const inTagAreas =
        chip.closest("#allTagsChips") ||
        chip.closest("#trendingTags") ||
        chip.closest("#detailContent");

      if (!inTagAreas) return;
      setActiveTag(chip.dataset.tag);
    });

    document.querySelectorAll(".collapse-head").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-collapse-target");
        const body = document.getElementById(targetId);
        if (!body) return;

        const isOpen = body.classList.contains("open");
        if (isOpen) {
          body.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
        } else {
          body.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        setSearchQuery(searchInput.value);
        setShouldAnimateFeed(true);
        render();
      });

      searchInput.addEventListener("focus", () => {
        renderHistory();
        if (getHistory().length > 0 && searchHistoryEl) {
          searchHistoryEl.classList.add("show");
        }
      });

      searchInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;

        const val = searchInput.value.trim();
        if (val) saveToHistory(val);

        if (searchHistoryEl) searchHistoryEl.classList.remove("show");
        searchInput.blur();

        try {
          const url = val ? `/api/posts?search=${encodeURIComponent(val)}` : "/api/posts";
          const res = await fetch(url);
          const data = await res.json();
          if (res.ok) {
            setPosts(data);
            setActiveCategoryValue("All");
            if (categoryMenu) {
              categoryMenu.querySelectorAll("li").forEach((li) => {
                li.classList.toggle("active", li.dataset.category === "All");
              });
            }
            setShouldAnimateFeed(true);
            render();
          }
        } catch (err) {
          console.error("Search failed:", err);
        }
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrapper") && searchHistoryEl) {
          searchHistoryEl.classList.remove("show");
        }
      });
    }
  }

  window.AF_MAIN_EVENT_BINDINGS = {
    bindMainPageEvents,
  };
})();
