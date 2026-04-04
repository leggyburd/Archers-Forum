/*
  Comment Tree Utility Functions
*/

(function () {
  function ensureRepliesArray(comment) {
    if (!comment.replies) comment.replies = [];
  }

  function findCommentById(commentList, id) {
    for (let i = 0; i < (commentList || []).length; i++) {
      const comment = commentList[i];
      if (comment.id === id) return comment;

      const found = findCommentById(comment.replies || [], id);
      if (found) return found;
    }

    return null;
  }

  function deleteCommentById(commentList, id) {
    if (!commentList) return false;

    for (let i = 0; i < commentList.length; i++) {
      const comment = commentList[i];
      if (comment.id === id) {
        commentList.splice(i, 1);
        return true;
      }

      const deletedInReplies = deleteCommentById(comment.replies || [], id);
      if (deletedInReplies) return true;
    }

    return false;
  }

  function addReplyToComment(post, parentCommentId, replyObj) {
    if (!post) return false;

    post.comments = post.comments || [];
    const parent = findCommentById(post.comments, parentCommentId);
    if (!parent) return false;

    ensureRepliesArray(parent);
    parent.replies.push(replyObj);
    return true;
  }

  function countAllReplies(commentList) {
    let total = 0;

    (commentList || []).forEach((comment) => {
      total += 1;
      if (comment.replies && comment.replies.length > 0) {
        total += countAllReplies(comment.replies);
      }
    });

    return total;
  }

  function getPostReplyCount(post) {
    if (!post || !post.comments) return 0;
    return countAllReplies(post.comments);
  }

  window.AF_MAIN_COMMENT_TREE = {
    ensureRepliesArray,
    findCommentById,
    deleteCommentById,
    addReplyToComment,
    countAllReplies,
    getPostReplyCount,
  };
})();
