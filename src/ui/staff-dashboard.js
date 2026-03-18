import { readFileSync } from "node:fs";

const title = "BSRP Staff Operations Desk";
const styleUrl = new URL("./staff.css", import.meta.url);
const scriptUrl = new URL("./staff-client.js", import.meta.url);

export function renderStaffDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/assets/staff.css" />
  </head>
  <body>
    <div class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Community command center</p>
          <h1>Staff Operations Desk</h1>
          <p class="hero-copy">
            Review pending Discord sign-ins, search current members, and keep an eye on the latest audit activity from one screen.
          </p>
        </div>
        <div class="operator-panel">
          <label for="actorUserId">Acting staff user</label>
          <input id="actorUserId" name="actorUserId" type="number" min="1" value="1" />
          <label for="reviewNotes">Default review note</label>
          <textarea id="reviewNotes" name="reviewNotes" rows="3">Approved from the staff desk</textarea>
          <button id="refreshDashboard" type="button">Refresh dashboard</button>
          <p class="operator-hint">Seed mode defaults to staff user <strong>1</strong>.</p>
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

    <script type="module" src="/assets/staff.js"></script>
  </body>
</html>`;
}

export const staffDashboardStyles = readFileSync(styleUrl, "utf8");
export const staffDashboardScript = readFileSync(scriptUrl, "utf8");
