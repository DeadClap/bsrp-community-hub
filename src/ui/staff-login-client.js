const statusMessages = {
  pending: "Your Discord account is linked, but it still needs staff approval before staff tools will unlock.",
  signed_out: "Your platform session has ended.",
};

const oauthButton = document.querySelector("#oauthLoginButton");
const directLoginForm = document.querySelector("#directLoginForm");
const feedback = document.querySelector("#loginFeedback");
const params = new URLSearchParams(window.location.search);
const returnTo = params.get("returnTo") || "/dashboard";

function setFeedback(message, variant = "info") {
  feedback.textContent = message;
  feedback.dataset.variant = variant;
}

async function startDiscordOAuth() {
  setFeedback("Sending you to Discord...", "info");

  const response = await fetch(`/api/auth/discord/authorize?returnTo=${encodeURIComponent(returnTo)}`, {
    credentials: "same-origin",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Unable to start Discord OAuth.");
  }

  window.location.assign(payload.authorizationUrl);
}

async function handleDirectLogin(event) {
  event.preventDefault();
  const formData = new FormData(directLoginForm);
  const discordId = String(formData.get("discordId") || "").trim();
  const username = String(formData.get("username") || "").trim();

  const response = await fetch("/api/auth/discord/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ discordId, username }),
  });
  const payload = await response.json();

  if (response.status === 202) {
    setFeedback(payload.message || statusMessages.pending, "warn");
    return;
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Unable to create a platform session.");
  }

  window.location.assign(returnTo);
}

oauthButton?.addEventListener("click", async () => {
  try {
    await startDiscordOAuth();
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

directLoginForm?.addEventListener("submit", async (event) => {
  try {
    await handleDirectLogin(event);
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

const status = params.get("status");
if (statusMessages[status]) {
  setFeedback(statusMessages[status], status === "signed_out" ? "info" : "warn");
}
