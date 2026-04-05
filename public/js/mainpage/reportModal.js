/*
  Report Modal Module
  This module provides a function to create and display a modal dialog for reporting a post. It handles the form submission, sends the report to the server, and shows appropriate success or error messages. It also includes accessibility features such as focus management and keyboard interactions
*/

(function () {
  function createReportModal({
    name,
    email,
    reportReasons,
    escapeHtml,
    showToast,
    getPostById,
    isOwner,
  }) {
    return function showReportModal(postId) {
      const post = getPostById(postId);
      if (!post || isOwner(post)) return;

      const existing = document.getElementById("afReportOverlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.id = "afReportOverlay";
      overlay.className = "af-report-overlay";

      overlay.innerHTML = `
        <div class="af-report-card" role="dialog" aria-modal="true" aria-labelledby="afReportTitle">
          <div class="af-report-header">
            <h3 id="afReportTitle" class="af-report-title">Report Post</h3>
            <button class="af-report-x" type="button" aria-label="Close">✕</button>
          </div>

          <p class="af-report-message">Why are you reporting this post?</p>

          <form class="af-report-form">
            <div class="af-report-options">
              ${reportReasons
                .map(
                  (reason, index) => `
                <label class="af-report-option">
                  <input type="radio" name="reportReason" value="${escapeHtml(reason)}" ${index === 0 ? "checked" : ""} />
                  <span>${escapeHtml(reason)}</span>
                </label>
              `,
                )
                .join("")}
            </div>

            <label class="af-report-details-wrap" for="afReportDetails">Additional details (optional)</label>
            <textarea id="afReportDetails" class="af-report-details" rows="4" maxlength="400" placeholder="Add any extra context here..."></textarea>

            <div class="af-report-actions">
              <button class="btn-secondary af-report-cancel" type="button" data-af-report-action="cancel">Cancel</button>
              <button class="btn-primary af-report-submit" type="submit">Submit Report</button>
            </div>
          </form>
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

      overlay.querySelector(".af-report-x").addEventListener("click", close);
      overlay
        .querySelector('[data-af-report-action="cancel"]')
        .addEventListener("click", close);

      overlay.querySelector(".af-report-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = e.currentTarget.querySelector('[type="submit"]');
        const reasonInput = overlay.querySelector('input[name="reportReason"]:checked');
        const detailsInput = overlay.querySelector("#afReportDetails");

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
        }

        try {
          const res = await fetch(`/api/posts/${postId}/report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reporterName: name,
              reporterEmail: email,
              reason: reasonInput ? reasonInput.value : reportReasons[0],
              details: detailsInput ? detailsInput.value.trim() : "",
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            showToast(data.error || "Failed to submit report.", "error");
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Report";
            }
            return;
          }

          close();
          showToast("Report submitted. Thank you.", "success");
        } catch (err) {
          console.error("Failed to submit report:", err);
          showToast("Failed to submit report.", "error");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Report";
          }
        }
      });

      document.body.appendChild(overlay);
      window.setTimeout(() => overlay.classList.add("open"), 0);
    };
  }

  window.AF_MAIN_REPORT_MODAL = {
    createReportModal,
  };
})();
