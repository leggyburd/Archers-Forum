/*
  Feed Filters Module
  This module provides functions to filter and sort the list of posts based on the user's selected category, tag, search query, and sort mode. It also computes the feed title based on the filters selected by the user
*/

(function () {
  function applyFilters(list, { activeCategory, activeTag, searchQuery, sortMode, bookmarks }) {
    let out = list.slice();

    if (activeCategory === "__bookmarks__") {
      out = out.filter((post) => bookmarks && bookmarks.has(post.id));
    } else if (activeCategory && activeCategory !== "All") {
      out = out.filter((post) => post.category === activeCategory);
    }

    if (activeTag) {
      out = out.filter((post) => (post.tags || []).includes(activeTag));
    }

    const q = String(searchQuery || "").trim().toLowerCase();
    if (q) {
      out = out.filter((post) => {
        const hay = [
          post.title,
          post.body,
          post.category,
          (post.tags || []).join(" "),
          post.authorName,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (sortMode === "newest") out.sort((a, b) => b.createdAt - a.createdAt);
    if (sortMode === "oldest") out.sort((a, b) => a.createdAt - b.createdAt);
    if (sortMode === "top") out.sort((a, b) => (b.score || 0) - (a.score || 0));

    return out;
  }

  function computeFeedTitle({ activeCategory, activeTag }) {
    if (activeCategory === "__bookmarks__") return "Bookmarks";
    let title = "All Posts";
    if (activeCategory && activeCategory !== "All") title = activeCategory;
    if (activeTag) title += ` · #${activeTag}`;
    return title;
  }

  window.AF_MAIN_FEED_FILTERS = {
    applyFilters,
    computeFeedTitle,
  };
})();
