/*
  Main Page UI Utilities
  This module provides utility functions for the main page UI, including a confirm modal and toast notifications. These functions can be used across different components of the main page to provide consistent user feedback and confirmation dialogs
*/

(function () {
  function showConfirmModal(
    { title, message, confirmText, cancelText, danger },
    onConfirm,
  ) {
    const escapeHtml = window.AF_MAIN_UTILS.escapeHtml;
    const existing = document.getElementById("afConfirmOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "afConfirmOverlay";
    overlay.className = "af-confirm-overlay";

    overlay.innerHTML = `
      <div class="af-confirm-card" role="dialog" aria-modal="true" aria-labelledby="afConfirmTitle">
        <div class="af-confirm-header">
          <h3 id="afConfirmTitle" class="af-confirm-title">${escapeHtml(
            title || "Confirm",
          )}</h3>
          <button class="af-confirm-x" type="button" aria-label="Close">✕</button>
        </div>

        <p class="af-confirm-message">${escapeHtml(message || "")}</p>

        <div class="af-confirm-actions">
          <button class="af-confirm-btn" type="button" data-af-action="cancel">${escapeHtml(
            cancelText || "Cancel",
          )}</button>
          <button
            class="af-confirm-btn ${
              danger ? "af-confirm-btn--danger" : "af-confirm-btn--primary"
            }"
            type="button"
            data-af-action="confirm"
          >
            ${escapeHtml(confirmText || "Confirm")}
          </button>
        </div>
      </div>
    `;

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    function close() {
      overlay.classList.remove("open");
      window.setTimeout(() => overlay.remove(), 140);
      document.removeEventListener("keydown", onKey);
    }

    document.addEventListener("keydown", onKey);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector(".af-confirm-x").addEventListener("click", close);
    overlay
      .querySelector('[data-af-action="cancel"]')
      .addEventListener("click", close);

    overlay
      .querySelector('[data-af-action="confirm"]')
      .addEventListener("click", () => {
        close();
        if (typeof onConfirm === "function") onConfirm();
      });

    document.body.appendChild(overlay);
    window.setTimeout(() => overlay.classList.add("open"), 0);

    const confirmBtn = overlay.querySelector('[data-af-action="confirm"]');
    if (confirmBtn) confirmBtn.focus();
  }

  function showToast(message, type) {
    const toastType = type || "info";
    let stack = document.getElementById("afToastStack");

    if (!stack) {
      stack = document.createElement("div");
      stack.id = "afToastStack";
      stack.className = "af-toast-stack";
      document.body.appendChild(stack);
    }

    const toast = document.createElement("div");
    toast.className = `af-toast af-toast--${toastType}`;
    toast.textContent = String(message || "");

    stack.appendChild(toast);
    window.setTimeout(() => toast.classList.add("open"), 0);

    window.setTimeout(() => {
      toast.classList.remove("open");
      window.setTimeout(() => toast.remove(), 180);
    }, 2800);
  }

  window.AF_MAIN_UI = {
    showConfirmModal,
    showToast,
  };
})();
