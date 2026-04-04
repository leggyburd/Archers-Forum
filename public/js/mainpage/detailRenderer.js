/*
  Detail Renderer Module
  Responsible for rendering the post detail view and its comments, as well as handling related interactions like voting, replying, and deleting
*/

(function () {
  function createDetailRenderer({
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
    userRole
  }) {
    function renderMediaCarousel(mediaUrls) {
      if (!mediaUrls || !mediaUrls.length) return "";

      const slidesHtml = mediaUrls
        .map((url, index) => {
          const mediaHtml = url.match(/\.(mp4|webm|mov)$/i)
            ? `<video src="${escapeHtml(url)}" class="rf-media-full" controls preload="metadata"></video>`
            : `<img src="${escapeHtml(url)}" class="rf-media-full" alt="Post media ${index + 1}" loading="lazy" />`;

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
        <div class="rf-media-carousel rf-media-carousel--detail" data-carousel>
          <div class="rf-media-track">${slidesHtml}</div>
          ${controlsHtml}
        </div>
      `;
    }

    function renderComments(activePostId, options = {}) {
      const post = getPostById(activePostId);
      if (!post || !commentsList) return;

      const shouldAnimate = options.animate !== false;
      commentsList.classList.toggle("comments-list--no-animate", !shouldAnimate);

      post.comments = post.comments || [];
      commentsList.innerHTML = "";

      if (post.comments.length === 0) {
        commentsList.innerHTML = '<p class="placeholder-text">No comments yet.</p>';
        return;
      }

      function buildReplyTree(replies) {
        const nodes = (replies || []).map((reply) => {
          const node = { ...reply, replies: [] };
          ensureRepliesArray(node);
          return node;
        });

        const byId = new Map();
        nodes.forEach((node) => {
          if (node.id) byId.set(node.id, node);
        });

        const roots = [];
        nodes.forEach((node) => {
          const parentId = node.replyToId ? String(node.replyToId) : null;
          if (parentId && byId.has(parentId)) {
            byId.get(parentId).replies.push(node);
          } else {
            roots.push(node);
          }
        });

        return roots;
      }

      function countReplyNodes(nodes) {
        return (nodes || []).reduce(
          (total, node) => total + 1 + countReplyNodes(node.replies || []),
          0,
        );
      }

      function renderCommentNode(comment, depth) {
        ensureRepliesArray(comment);

        const canDelete = isCommentOwner(comment) || userRole === 'admin';
        const indentClass = depth > 0 ? "comment comment--reply" : "comment";
        const commentUserVote = getCommentUserVote(comment.id);
        const commentUpActive = commentUserVote === "up" ? "active" : "";
        const commentDownActive = commentUserVote === "down" ? "active" : "";
        const editedLabel = comment.editedAt
          ? `<span class="comment-edited">edited ${escapeHtml(formatDate(comment.editedAt))}</span>`
          : "";
        const replyingToLabel = depth > 0 && comment.replyToName
          ? `<div class="comment-replying-to">Replying to ${escapeHtml(comment.replyToName)}</div>`
          : "";

        const childReplies = depth === 0
          ? buildReplyTree(comment.replies || [])
          : (comment.replies || []);
        const replyCount = countReplyNodes(childReplies);
        const hasReplies = replyCount > 0;
        const collapsed = hasReplies && isRepliesCollapsed(comment.id);
        const collapseLabel = collapsed
          ? `Show replies (${replyCount})`
          : `Hide replies (${replyCount})`;

        const repliesHtml = childReplies
          .map((reply) => renderCommentNode(reply, depth + 1))
          .join("");

        return `
          <div class="${indentClass}" data-comment-id="${escapeHtml(comment.id)}">
            <div class="comment-meta">
              <a class="comment-author-link" href="${getProfileHref(comment.authorEmail)}">
                <img class="rf-author-avatar" src="${getAuthorAvatar(comment.authorEmail, comment.authorAvatar)}" alt="" />
                <span class="comment-author">${escapeHtml(comment.authorName)}</span>
              </a>
              <span>${escapeHtml(formatDate(comment.createdAt))}</span>
              ${editedLabel}
            </div>

            ${replyingToLabel}
            <div class="comment-body">${escapeHtml(comment.body)}</div>

            <div class="comment-actions-row">
              <div class="comment-vote-group">
                <button class="comment-btn comment-btn--vote ${commentUpActive}" type="button" data-action="upvote-comment" aria-label="Upvote comment">▲</button>
                <span class="comment-score">${comment.score || 0}</span>
                <button class="comment-btn comment-btn--vote ${commentDownActive}" type="button" data-action="downvote-comment" aria-label="Downvote comment">▼</button>
              </div>
              ${hasReplies ? `<button class="comment-btn comment-btn--toggle" type="button" data-action="toggle-replies">${escapeHtml(collapseLabel)}</button>` : ""}
              <button class="comment-btn" type="button" data-action="reply">Reply</button>
              ${
                canDelete
                  ? '<button class="comment-btn" type="button" data-action="edit-comment">Edit</button><button class="comment-btn comment-btn--danger" type="button" data-action="delete-comment">Delete</button>'
                  : ""
              }
            </div>

            <div class="reply-form comment-edit-form" hidden>
              <textarea class="reply-text edit-comment-text" rows="3" placeholder="Edit your comment...">${escapeHtml(comment.body)}</textarea>
              <div class="reply-actions">
                <button class="comment-btn" type="button" data-action="save-edit">Save</button>
                <button class="comment-btn" type="button" data-action="cancel-edit">Cancel</button>
              </div>
            </div>

            <div class="reply-form" hidden>
              <textarea class="reply-text" rows="2" placeholder="Write a reply..."></textarea>
              <div class="reply-actions">
                <button class="comment-btn" type="button" data-action="submit-reply">Reply</button>
                <button class="comment-btn" type="button" data-action="cancel-reply">Cancel</button>
              </div>
            </div>

            ${repliesHtml ? `<div class="comment-replies" ${collapsed ? "hidden" : ""}>${repliesHtml}</div>` : ""}
          </div>
        `;
      }

      commentsList.innerHTML = post.comments
        .map((comment) => renderCommentNode(comment, 0))
        .join("");
    }

    function renderDetail(activePostId, options = {}) {
      const post = getPostById(activePostId);
      if (!detailContent) return;

      if (!post) {
        detailContent.innerHTML = '<p class="placeholder-text">Post not found.</p>';
        if (commentsList) commentsList.innerHTML = "";
        return;
      }

      const userVote = getUserVote(post.id);
      const upActive = userVote === "up" ? "active" : "";
      const downActive = userVote === "down" ? "active" : "";

      const tags = post.tags || [];
      const tagsHtml = tags.length
        ? `<div class="rf-tags">
            ${tags
              .map(
                (tag) =>
                  `<button class="rf-tag tag-chip" type="button" data-tag="${escapeHtml(
                    tag,
                  )}">#${escapeHtml(tag)}</button>`,
              )
              .join("")}
          </div>`
        : "";

      const detailActionsHtml = isOwner(post) || userRole === 'admin'
        ? '<div class="rf-actions"><button class="rf-action rf-danger" type="button" id="detailDeleteBtn">Delete</button></div>'
        : "";

      const detailReportTopHtml = !isOwner(post) && userRole === 'admin'
        ? '<button class="rf-top-right-action" type="button" id="detailReportBtn" aria-label="Report post" title="Report post"><img src="/assets/report_button.png" alt="" /></button>'
        : "";

      detailContent.innerHTML = `
        <article class="rf-post rf-post--detail" data-id="${escapeHtml(post.id)}">
          <aside class="rf-vote">
            <button class="rf-vote-btn ${upActive}" type="button" id="detailUpBtn" aria-label="Upvote">▲</button>
            <div class="rf-score" title="Score">${post.score || 0}</div>
            <button class="rf-vote-btn ${downActive}" type="button" id="detailDownBtn" aria-label="Downvote">▼</button>
          </aside>

          <div class="rf-main">
            ${detailReportTopHtml}
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
            <div class="rf-body rf-body--full">${escapeHtml(post.body)}</div>

            ${renderMediaCarousel(post.mediaUrls)}

            ${tagsHtml}
            ${detailActionsHtml}
          </div>
        </article>
      `;

      const detailUpBtn = document.getElementById("detailUpBtn");
      const detailDownBtn = document.getElementById("detailDownBtn");
      const detailReportBtn = document.getElementById("detailReportBtn");
      const detailDeleteBtn = document.getElementById("detailDeleteBtn");

      if (detailUpBtn) detailUpBtn.addEventListener("click", () => vote(post.id, "up"));
      if (detailDownBtn) detailDownBtn.addEventListener("click", () => vote(post.id, "down"));
      if (detailReportBtn) detailReportBtn.addEventListener("click", () => showReportModal(post.id));
      if (detailDeleteBtn) detailDeleteBtn.addEventListener("click", () => handleDelete(post.id));

      detailContent.querySelectorAll(".tag-chip").forEach((btn) => {
        btn.addEventListener("click", () => setActiveTag(btn.dataset.tag || null));
      });

      renderComments(activePostId, { animate: options.animateComments !== false });
    }

    return {
      renderComments,
      renderDetail,
    };
  }

  window.AF_MAIN_DETAIL_RENDERER = {
    createDetailRenderer,
  };
})();
