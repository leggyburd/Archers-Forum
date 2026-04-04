/*
  Storage Utility Module
  This module provides a simple interface for saving, loading, and removing JSON-serializable data in localStorage. It includes error handling to prevent issues with corrupted data and provides a method to clear all stored data for testing or demo purposes. The storage keys are versioned to allow for future changes without breaking existing data
*/

const AF_STORAGE = {
  VERSION: "v7",

  KEYS: {
    POSTS: "af_posts_v7",
    VOTES: "af_votes_v7",
  },

  bookmarksKey(email) {
    return `af_bookmarks_${email}`;
  },

  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = JSON.parse(raw);
      return data ?? fallback;
    } catch (e) {
      return fallback;
    }
  },

  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  clearAll() {
    Object.values(this.KEYS).forEach((k) => localStorage.removeItem(k));
  },
};

