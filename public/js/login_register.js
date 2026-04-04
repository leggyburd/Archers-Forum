/*
  Login/Register Page Script
  This script manages the login and registration page, handling form submissions, toggling password visibility, and navigating between the login and register forms with smooth transitions. 
*/

document.addEventListener("DOMContentLoaded", () => {
  function resetPageTransitionState() {
    document.body.classList.remove("is-leaving");
    document.body.classList.add("is-ready");
  }

  // Handle page fade transitions between login and register.
  resetPageTransitionState();
  window.addEventListener("pageshow", resetPageTransitionState);

  const links = document.querySelectorAll(".auth-toggle a");

  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href) return;

      e.preventDefault();

      // Trigger the exit transition.
      document.body.classList.add("is-leaving");

      // Navigate once the transition finishes.
      setTimeout(() => {
        window.location.href = href;
      }, 260);
    });
  });

  // Keep session data so other pages know who is logged in.
  function setSession(name, email, role, id) {
    localStorage.setItem("af_user", name);
    localStorage.setItem("af_user_email", email);
    localStorage.setItem("af_current_email", email);
    localStorage.setItem("af_user_role", role || "user");
    if (id) localStorage.setItem("af_user_id", id);
  }

  // Set up the active auth form.
  const form = document.getElementById("authForm");
  if (!form) return;

  const mode = form.dataset.mode; // Either "login" or "register".
  const msg  = document.getElementById("authMsg");

  // Wire up the password visibility toggle.
  const pwInput  = form.querySelector('input[name="password"]');
  const togglePw = document.getElementById("togglePw");

  if (pwInput && togglePw) {
    togglePw.dataset.state = "hidden";
    togglePw.src           = "/assets/show_pass.png";
    togglePw.alt           = "Show password";
    togglePw.style.cursor  = "pointer";

    togglePw.addEventListener("click", () => {
      const isHidden = pwInput.type === "password";
      if (isHidden) {
        pwInput.type   = "text";
        togglePw.src   = "/assets/hide_pass.png";
        togglePw.alt   = "Hide password";
        togglePw.dataset.state = "shown";
      } else {
        pwInput.type   = "password";
        togglePw.src   = "/assets/show_pass.png";
        togglePw.alt   = "Show password";
        togglePw.dataset.state = "hidden";
      }
    });
  }

  // Submit the form to either register or log in.
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.textContent = "";

    // Register flow.
    if (mode === "register") {
      const nameEl  = form.querySelector('input[name="name"]');
      const emailEl = form.querySelector('input[name="email"]');

      const name     = nameEl  ? nameEl.value.trim()  : "";
      const email    = emailEl ? emailEl.value.trim()  : "";
      const password = pwInput ? pwInput.value         : "";

      if (!name || !email || !password) {
        if (msg) msg.textContent = "Please fill in all fields.";
        return;
      }

      try {
        const res  = await fetch("/api/auth/register", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (msg) msg.textContent = data.error || "Registration failed.";
          return;
        }

        setSession(data.name, data.email, data.role, data.id);
        window.location.href = "/mainpage";
      } catch (err) {
        if (msg) msg.textContent = "Could not reach the server. Please try again.";
      }
    }

    // Login flow.
    if (mode === "login") {
      const emailEl = form.querySelector('input[name="email"]');

      const email    = emailEl ? emailEl.value.trim() : "";
      const password = pwInput ? pwInput.value        : "";

      try {
        const res  = await fetch("/api/auth/login", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (msg) msg.textContent = data.error || "Invalid email or password.";
          return;
        }

        setSession(data.name, data.email, data.role, data.id);
        window.location.href = "/mainpage";
      } catch (err) {
        if (msg) msg.textContent = "Could not reach the server. Please try again.";
      }
    }
  });
});

