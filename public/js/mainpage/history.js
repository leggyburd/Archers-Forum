/*
  Search History Manager
  This module manages the search history functionality, including saving search terms to localStorage, rendering the search history dropdown, and handling interactions such as selecting a term or clearing the history
*/

(function () {
  function createHistoryManager({
    historyKey,
    searchHistoryEl,
    searchInput,
    escapeHtml,
    onSelectTerm,
  }) {
    function getHistory() {
      return JSON.parse(localStorage.getItem(historyKey) || "[]");
    }

    function renderHistory() {
      if (!searchHistoryEl) return;

      const history = getHistory();
      if (history.length === 0) {
        searchHistoryEl.classList.remove("show");
        searchHistoryEl.innerHTML = "";
        return;
      }

      searchHistoryEl.innerHTML = `
        <div class="history-header">
          <span>Recent Searches</span>
          <button class="clear-history-btn" id="clearHistoryBtn">Clear all</button>
        </div>
      `;

      history.forEach((term) => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
          <span class="history-text">${escapeHtml(term)}</span>
          <span class="delete-history" data-term="${escapeHtml(term)}">x</span>
        `;

        item.addEventListener("click", (e) => {
          if (e.target.classList.contains("delete-history")) {
            e.stopPropagation();
            removeFromHistory(term);
            return;
          }

          if (searchInput) searchInput.value = term;
          if (typeof onSelectTerm === "function") onSelectTerm(term);

          searchHistoryEl.classList.remove("show");
        });

        searchHistoryEl.appendChild(item);
      });

      const clearBtn = document.getElementById("clearHistoryBtn");
      if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          clearAllHistory();
        });
      }
    }

    function saveToHistory(term) {
      const t = String(term || "").trim();
      if (!t) return;

      let history = getHistory();
      history = history.filter((item) => item !== t);
      history.unshift(t);
      history = history.slice(0, 5);

      localStorage.setItem(historyKey, JSON.stringify(history));
      renderHistory();
    }

    function removeFromHistory(term) {
      let history = getHistory();
      history = history.filter((item) => item !== term);
      localStorage.setItem(historyKey, JSON.stringify(history));
      renderHistory();
    }

    function clearAllHistory() {
      localStorage.removeItem(historyKey);
      if (searchHistoryEl) {
        searchHistoryEl.classList.remove("show");
        searchHistoryEl.innerHTML = "";
      }
    }

    return {
      getHistory,
      renderHistory,
      saveToHistory,
      removeFromHistory,
      clearAllHistory,
    };
  }

  window.AF_MAIN_HISTORY = {
    createHistoryManager,
  };
})();
