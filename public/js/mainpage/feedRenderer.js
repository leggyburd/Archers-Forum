/*
  Main Page Feed Renderer
  This module is responsible for rendering the list of posts on the main page, as well as the tag areas and bookmark items. It provides funct      const canEditPost = isOwner(post);
      const canDeletePost = isOwner(post) || userRole === 'admin';

      const actionsHtml = `
        <div class="rf-actions">
          ${repliesHtml}
          ${bookmarkHtml}
          ${
            canEditPost || canDeletePost
              ? `
                ${canEditPost ? `<button class="rf-action rf-edit" type="button" onclick="event.stopPropagation(); window.startEditPost('${post.id}')">Edit</button>` : ''}
                ${canDeletePost ? `<button class="rf-action rf-danger" type="button" data-action="delete"><svg class="rf-trashcan-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span class="rf-delete-text">Delete</span></button>` : ''}
                `
              : ""
          }ate the HTML for each post card, tag chip, and bookmark item, using the provided utility functions and data accessors
*/

(function () {
  function createFeedRenderer({
    allTagsChips,
    trendingTags,
    noTagsText,
    noTrendingText,
    getVotesByUser,
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
    userRole
  }) {
    function renderMediaCarousel(mediaUrls) {
      if (!mediaUrls || !mediaUrls.length) return "";

      const slidesHtml = mediaUrls
        .map((url, index) => {
          const mediaHtml = url.match(/\.(mp4|webm|mov)$/i)
            ? `<video src="${escapeHtml(url)}" class="rf-media-thumb" muted preload="metadata" controls></video>`
            : `<img src="${escapeHtml(url)}" class="rf-media-thumb" alt="Post media ${index + 1}" loading="lazy" />`;

          return `<div class="rf-media-slide">${mediaHtml}</div>`;
        })
        .join("");

      const controlsHtml = mediaUrls.length > 1
        ? `
            <button class="rf-media-nav rf-media-nav--prev" type="button" data-carousel-prev aria-label="Previous media">‹</button>
            <button class="rf-media-nav rf-media-nav--next" type="button" data-carousel-next aria-label="Next media">›</button>
            <div class="rf-media-count"><span data-carousel-index>1</span> / <span data-carousel-total>${mediaUrls.length}</span></div>
          `
        : "";

      return `
        <div class="rf-media-carousel" data-carousel>
          <div class="rf-media-track">${slidesHtml}</div>
          ${controlsHtml}
        </div>
      `;
    }

    function renderTagAreas(allPosts, activeTag) {
      if (!allTagsChips || !trendingTags || !noTagsText || !noTrendingText) return;

      const usageCounts = new Map();
      const upvoteCountsByPost = new Map();
      const votesByUser = getVotesByUser() || {};

      Object.keys(votesByUser).forEach((userEmail) => {
        const perUser = votesByUser[userEmail];
        if (!perUser) return;

        Object.keys(perUser).forEach((postId) => {
          if (perUser[postId] === "up") {
            upvoteCountsByPost.set(postId, (upvoteCountsByPost.get(postId) || 0) + 1);
          }
        });
      });

      const popularityByTag = new Map();

      allPosts.forEach((post) => {
        const tags = post.tags || [];
        const postUpvotes = upvoteCountsByPost.get(post.id) || 0;

        tags.forEach((tag) => {
          usageCounts.set(tag, (usageCounts.get(tag) || 0) + 1);
          popularityByTag.set(tag, (popularityByTag.get(tag) || 0) + postUpvotes);
        });
      });

      const tagsSorted = Array.from(usageCounts.entries())
        .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
        .map(([tag]) => tag);

      allTagsChips.innerHTML = "";
      if (tagsSorted.length === 0) {
        noTagsText.style.display = "block";
        allTagsChips.appendChild(noTagsText);
      } else {
        noTagsText.style.display = "none";
        tagsSorted.slice(0, 12).forEach((tag) => {
          const btn = document.createElement("button");
          btn.className = "chip tag-chip" + (activeTag === tag ? " selected" : "");
          btn.type = "button";
          btn.dataset.tag = tag;
          btn.textContent = "#" + tag;
          allTagsChips.appendChild(btn);
        });
      }

      const trendingSorted = Array.from(usageCounts.keys())
        .map((tag) => ({
          tag,
          popularity: popularityByTag.get(tag) || 0,
          usage: usageCounts.get(tag) || 0,
        }))
        .sort((a, b) => {
          if (b.popularity !== a.popularity) return b.popularity - a.popularity;
          if (b.usage !== a.usage) return b.usage - a.usage;
          return a.tag.localeCompare(b.tag);
        })
        .map((entry) => entry.tag);

      trendingTags.innerHTML = "";
      if (trendingSorted.length === 0) {
        noTrendingText.style.display = "block";
        trendingTags.appendChild(noTrendingText);
      } else {
        noTrendingText.style.display = "none";
        trendingSorted.slice(0, 6).forEach((tag) => {
          const btn = document.createElement("button");
          btn.className = "chip tag-chip" + (activeTag === tag ? " selected" : "");
          btn.type = "button";
          btn.dataset.tag = tag;
          btn.textContent = "#" + tag;
          trendingTags.appendChild(btn);
        });
      }
    }

    function renderPostCard(post) {
      const previewLen = 220;
      const preview = post.body.length > previewLen ? post.body.slice(0, previewLen) + "..." : post.body;

      const userVote = getUserVote(post.id);
      const upActive = userVote === "up" ? "active" : "";
      const downActive = userVote === "down" ? "active" : "";

      const tags = post.tags || [];
      const tagsHtml = tags.length
        ? `<div class="rf-tags">${tags
            .map(
              (tag) =>
                `<button class="rf-tag tag-chip${window.activeTag === tag ? ' selected' : ''}" type="button" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`,
            )
            .join("")}</div>`
        : "";

      const currentPost = getPostById(post.id) || post;
      const replyCount = getPostReplyCount(currentPost);
      const repliesHtml = `
        <button class="rf-replies" type="button" data-action="open-detail" title="View replies">
          <img src="/assets/chat_bubble.png" alt="Replies" class="rf-replies-icon">
          ${replyCount} ${replyCount === 1 ? "reply" : "replies"}
        </button>
      `;

      const reportTopHtml = !isOwner(post) && userRole !== 'admin'
        ? '<button class="rf-top-right-action" type="button" data-action="report" aria-label="Report post" title="Report post"><img src="/assets/report_button.png" alt="" /></button>'
        : "";

      const bookmarked = isBookmarked(post.id);
      const bookmarkSvg = bookmarked
        ? `<svg class="rf-bookmark-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
        : `<svg class="rf-bookmark-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
      const bookmarkHtml = `<button class="rf-bookmark-btn${bookmarked ? ' bookmarked' : ''}" type="button" data-action="bookmark" aria-label="${bookmarked ? 'Remove bookmark' : 'Bookmark post'}" title="${bookmarked ? 'Remove bookmark' : 'Bookmark'}">${bookmarkSvg}<span class="rf-bookmark-text">${bookmarked ? 'Bookmarked' : 'Bookmark'}</span></button>`;

      const canEditPost = isOwner(post);
      const canDeletePost = isOwner(post) || userRole === 'admin';

      const actionsHtml = `
        <div class="rf-actions">
          ${repliesHtml}
          ${bookmarkHtml}
          ${
            canEditPost || canDeletePost
              ? `
                ${canEditPost ? `<button class="rf-action rf-edit" type="button" onclick="event.stopPropagation(); window.startEditPost('${post.id}')">Edit</button>` : ''}
                ${canDeletePost ? `<button class="rf-action rf-danger" type="button" data-action="delete"><svg class="rf-trashcan-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span class="rf-delete-text">Delete</span></button>` : ''}
                `
              : ""
          }
        </div>
      `;

      return `
        <article class="rf-post" data-id="${escapeHtml(post.id)}">
          <aside class="rf-vote">
            <button class="rf-vote-btn ${upActive}" type="button" data-action="upvote" aria-label="Upvote">▲</button>
            <div class="rf-score" title="Score">${post.score || 0}</div>
            <button class="rf-vote-btn ${downActive}" type="button" data-action="downvote" aria-label="Downvote">▼</button>
          </aside>

          <div class="rf-main">
            ${reportTopHtml}
            <div class="rf-meta">
              <span class="rf-pill rf-pill--${categorySlug(post.category)}">
                ${escapeHtml(post.category)}
              </span>
              <span class="rf-meta-sep">•</span>
              <a class="rf-author-link" href="${getProfileHref(post.authorEmail)}">
                <img class="rf-author-avatar" src="${getAuthorAvatar(post.authorEmail, post.authorAvatar)}" alt="" />
                <span class="rf-author">${escapeHtml(post.authorName)}</span>
              </a>
              <span class="rf-meta-sep">•</span>
              <time class="rf-time">${escapeHtml(formatDate(post.createdAt))}</time>
            </div>

            <h4 class="rf-title">${escapeHtml(post.title)}</h4>
            <p class="rf-body">${escapeHtml(preview)}</p>

            ${renderMediaCarousel(post.mediaUrls)}

            ${tagsHtml}
            ${actionsHtml}
          </div>
        </article>
      `;
    }

    function renderBookmarkItem(post) {
      // Render the bookmarked post using the same layout as a regular post
      return renderPostCard(post);
    }

    return {
      renderTagAreas,
      renderPostCard,
      renderBookmarkItem,
    };
  }

  window.AF_MAIN_FEED_RENDERER = {
    createFeedRenderer,
  };
})();
