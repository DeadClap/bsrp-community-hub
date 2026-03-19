import { readFileSync } from "node:fs";

const title = "BSRP Staff Operations Desk";
const styleUrl = new URL("./staff.css", import.meta.url);
const dashboardScriptUrl = new URL("./staff-client.js", import.meta.url);
const loginScriptUrl = new URL("./staff-login-client.js", import.meta.url);
const appDashboardScriptUrl = new URL("./app-dashboard-client.js", import.meta.url);

function baseHead(titleText) {
  return `<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titleText}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/assets/staff.css" />
  </head>`;
}

function renderSiteHeader() {
  return `<header class="site-header">
    <a href="/dashboard" class="brand-link">BSRP Community Hub</a>
    <nav id="siteNav" class="site-nav" aria-label="Primary"></nav>
    <div class="site-header-meta">
      <a id="profileLink" href="/dashboard#account" class="header-profile">Profile</a>
      <button id="headerLogoutButton" type="button" class="header-logout">Sign out</button>
    </div>
  </header>`;
}

export function renderHomeHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  ${baseHead("BSRP Community Hub")}
  <body>
    <div class="auth-shell">
      <section class="auth-hero">
        <p class="eyebrow">BSRP Community Hub</p>
        <h1>Community operations, access, and identity in one place.</h1>
        <p class="hero-copy">
          Start with the shared login flow, then move into staff operations once your session has the right permissions.
        </p>
      </section>

      <section class="auth-card single-card">
        <p class="eyebrow">Navigation</p>
        <h2>Choose where to go next</h2>
        <div class="stack-actions centered-actions">
          <a href="/login" class="action-link">Sign in</a>
          <a href="/dashboard" class="action-link secondary">Open dashboard</a>
          <a href="/staff" class="action-link secondary">Open staff desk</a>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

export function renderAppDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  ${baseHead("BSRP Community Hub Dashboard")}
  <body>
    <div class="page-shell">
      ${renderSiteHeader()}

      <header class="hero hero-tight">
        <div>
          <p class="eyebrow">Your dashboard</p>
          <h1 id="dashboardUserName">Loading your dashboard...</h1>
          <p id="dashboardIntro" class="hero-copy">
            Pulling your memberships, linked identities, and recent activity now.
          </p>
        </div>
        <div class="operator-panel compact-panel">
          <p class="eyebrow">Session</p>
          <p id="dashboardUserMeta" class="operator-hint">Checking current account context.</p>
          <div id="dashboardActions" class="stack-actions">
            <a href="/staff" class="action-link secondary">Open staff desk</a>
            <a href="/" class="action-link secondary">Go home</a>
          </div>
        </div>
      </header>

      <main class="dashboard-grid">
        <section class="panel panel-wide" aria-labelledby="summaryTitle">
          <div class="panel-header">
            <p class="eyebrow">Summary</p>
            <h2 id="summaryTitle">Your platform snapshot</h2>
          </div>
          <div id="dashboardSummary" class="metrics"></div>
        </section>

        <section class="panel" id="account" aria-labelledby="accountTitle">
          <div class="panel-header">
            <p class="eyebrow">Role map</p>
            <h2 id="accountTitle">Departments and rank</h2>
          </div>
          <div id="dashboardMemberships" class="member-table"></div>
          <div id="dashboardAccessRequests" class="member-table"></div>
        </section>

        <section class="panel" id="profile" aria-labelledby="identityTitle">
          <div class="panel-header">
            <p class="eyebrow">Profile</p>
            <h2 id="identityTitle">Linked accounts and identities</h2>
          </div>
          <div id="dashboardLinkedAccounts" class="member-table"></div>
          <div id="dashboardPlayerProfiles" class="member-table"></div>
        </section>

        <section class="panel panel-wide" aria-labelledby="actionsTitle">
          <div class="panel-header">
            <p class="eyebrow">Next steps</p>
            <h2 id="actionsTitle">What you can do next</h2>
          </div>
          <div id="dashboardNextActions" class="pending-list"></div>
        </section>

        <section class="panel" aria-labelledby="auditTitle">
          <div class="panel-header">
            <p class="eyebrow">Audit</p>
            <h2 id="auditTitle">Recent account activity</h2>
          </div>
          <div id="dashboardAuditFeed" class="audit-feed"></div>
        </section>

        <section class="panel" aria-labelledby="opsTitle">
          <div class="panel-header">
            <p class="eyebrow">Operations</p>
            <h2 id="opsTitle">Recent in-game events</h2>
          </div>
          <div id="dashboardOperationsFeed" class="audit-feed"></div>
        </section>
      </main>
    </div>

    <script type="module" src="/assets/app-dashboard.js"></script>
  </body>
</html>`;
}

export function renderStaffDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  ${baseHead(title)}
  <body>
    <div class="page-shell">
      ${renderSiteHeader()}

      <header class="hero hero-tight">
        <div>
          <p class="eyebrow">Community command center</p>
          <h1>Staff Operations Desk</h1>
          <p class="hero-copy">
            Review pending Discord sign-ins, search current members, and keep an eye on the latest audit activity from one screen.
          </p>
        </div>
        <div class="operator-panel compact-panel">
          <p class="eyebrow">Operator session</p>
          <h2 id="currentUserName">Loading staff session...</h2>
          <p id="currentUserMeta" class="operator-hint">Checking your active permissions now.</p>
          <label for="reviewNotes">Default review note</label>
          <textarea id="reviewNotes" name="reviewNotes" rows="3">Approved from the staff desk</textarea>
          <div class="stack-actions">
            <button id="refreshDashboard" type="button">Refresh dashboard</button>
          </div>
        </div>
      </header>

      <main class="dashboard-grid">
        <section class="panel panel-wide metrics-panel" aria-labelledby="metricsTitle">
          <div class="panel-header">
            <p class="eyebrow">Snapshot</p>
            <h2 id="metricsTitle">Live membership overview</h2>
          </div>
          <div id="metrics" class="metrics"></div>
        </section>

        <section class="panel panel-wide" aria-labelledby="pendingTitle">
          <div class="panel-header row-between">
            <div>
              <p class="eyebrow">Queue</p>
              <h2 id="pendingTitle">Pending member reviews</h2>
            </div>
            <span id="pendingCount" class="pill">0 pending</span>
          </div>
          <div id="pendingList" class="pending-list"></div>
        </section>

        <section class="panel" aria-labelledby="memberTitle">
          <div class="panel-header">
            <p class="eyebrow">Directory</p>
            <h2 id="memberTitle">Member search</h2>
          </div>
          <label class="field-label" for="memberSearch">Search by name, status, or Discord account</label>
          <input id="memberSearch" type="search" placeholder="Search command staff, pending applicants, Discord IDs..." />
          <div id="memberTable" class="member-table"></div>
        </section>

        <section class="panel" aria-labelledby="detailTitle">
          <div class="panel-header">
            <p class="eyebrow">Focus</p>
            <h2 id="detailTitle">Selected member detail</h2>
          </div>
          <div id="memberDetail" class="member-detail empty-state">Select a member to inspect memberships, accounts, and recent actions.</div>
        </section>

        <section class="panel panel-wide" aria-labelledby="auditTitle">
          <div class="panel-header row-between">
            <div>
              <p class="eyebrow">Trace</p>
              <h2 id="auditTitle">Recent audit activity</h2>
            </div>
            <span class="pill accent">Immutable log</span>
          </div>
          <div id="auditFeed" class="audit-feed"></div>
        </section>
      </main>
    </div>

    <template id="emptyCardTemplate">
      <article class="empty-card">
        <h3>All caught up</h3>
        <p>No pending member reviews right now.</p>
      </article>
    </template>

    <div id="reviewModal" class="modal-shell hidden" aria-hidden="true">
      <div class="modal-backdrop" data-close-modal="true"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reviewModalTitle">
        <p class="eyebrow">Member review</p>
        <h2 id="reviewModalTitle">Confirm member update</h2>
        <p id="reviewModalBody" class="hero-copy">Review this action before it is applied.</p>
        <label for="modalReviewNotes">Review note</label>
        <textarea id="modalReviewNotes" rows="4">Approved from the staff desk</textarea>
        <div class="stack-actions">
          <button id="confirmReviewAction" type="button">Confirm action</button>
          <button id="cancelReviewAction" type="button" class="action-button secondary">Cancel</button>
        </div>
      </div>
    </div>

    <script type="module" src="/assets/staff.js"></script>
  </body>
</html>`;
}

export function renderStaffLoginHtml({ oauthEnabled = false } = {}) {
  const oauthCopy = oauthEnabled
    ? '<button id="oauthLoginButton" type="button" class="action-button">Continue with Discord</button>'
    : '<p class="operator-hint">Discord OAuth is disabled in the current environment.</p>';

  return `<!DOCTYPE html>
<html lang="en">
  ${baseHead("BSRP Community Hub Login")}
  <body>
    <div class="auth-shell">
      <section class="auth-hero">
        <p class="eyebrow">Platform access</p>
        <h1>Sign in to the community hub</h1>
        <p class="hero-copy">
          This login creates a site-wide platform session. Staff-only tools will unlock automatically when your account has the right permissions.
        </p>
      </section>

      <section class="auth-card">
        <div class="auth-card-block">
          <p class="eyebrow">Preferred</p>
          <h2>Discord sign-in</h2>
          <p class="operator-hint">This creates your shared platform session and returns you to the page you were trying to reach.</p>
          ${oauthCopy}
        </div>

        <div class="auth-divider"><span>or</span></div>

        <form id="directLoginForm" class="auth-card-block auth-form">
          <p class="eyebrow">Local testing</p>
          <h2>Direct Discord lookup</h2>
          <label for="discordId">Discord ID</label>
          <input id="discordId" name="discordId" type="text" value="discord-chief" required />
          <label for="username">Username</label>
          <input id="username" name="username" type="text" value="chiefharper" required />
          <button type="submit" class="action-button secondary">Create local session</button>
          <p class="operator-hint">Seed mode uses <code>discord-chief</code> and <code>chiefharper</code> by default.</p>
        </form>

        <p id="loginFeedback" class="login-feedback" data-variant="info">Sign in to continue.</p>
      </section>
    </div>

    <script type="module" src="/assets/staff-login.js"></script>
  </body>
</html>`;
}

export function renderStaffForbiddenHtml(user) {
  return `<!DOCTYPE html>
<html lang="en">
  ${baseHead(`${title} Access Denied`)}
  <body>
    <div class="auth-shell">
      <section class="auth-card single-card">
        <p class="eyebrow">Access denied</p>
        <h1>This account is signed in, but it does not have staff desk access.</h1>
        <p class="hero-copy">${user.displayName} still has a valid platform session. You can stay in the app and use non-staff areas while staff permissions are pending or restricted.</p>
        <div class="stack-actions centered-actions">
          <a href="/dashboard" class="action-link">Go to dashboard</a>
          <a href="/" class="action-link secondary">Go home</a>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

export const staffDashboardStyles = readFileSync(styleUrl, "utf8");
export const staffDashboardScript = readFileSync(dashboardScriptUrl, "utf8");
export const staffLoginScript = readFileSync(loginScriptUrl, "utf8");
export const appDashboardScript = readFileSync(appDashboardScriptUrl, "utf8");
