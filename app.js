const API_BASE = "https://api.splinterlands.com/players/glint_bomb_prizes";
const $ = (selector) => document.querySelector(selector);
const number = new Intl.NumberFormat("en-GB");
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
let requestId = 0;

function formatDate(value) { return date.format(new Date(value)); }
function escapeHtml(value) { return String(value ?? "—").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

async function loadPlayer(username) {
  const id = ++requestId;
  const cleanName = username.trim();
  if (!cleanName) return;
  const button = $("button[type=submit]");
  button.disabled = true;
  $("#status").hidden = false;
  $("#status").className = "status";
  $("#status").textContent = `Fetching prizes for @${cleanName}…`;
  $("#dashboard-content").hidden = true;
  $("#player-heading").textContent = `@${cleanName}`;
  const url = `${API_BASE}?username=${encodeURIComponent(cleanName)}`;
  $("#api-link").href = url;
  history.replaceState(null, "", `?username=${encodeURIComponent(cleanName)}`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The API returned ${response.status}.`);
    const payload = await response.json();
    if (id !== requestId) return;
    const prizes = Array.isArray(payload) ? payload : (payload?.value ?? []);
    renderDashboard(prizes, cleanName);
  } catch (error) {
    $("#status").className = "status error";
    $("#status").textContent = `Unable to load this player. ${error.message}`;
  } finally { if (id === requestId) button.disabled = false; }
}

function renderDashboard(prizes, username) {
  if (!prizes.length) {
    $("#status").textContent = `No Glint Bomb prizes found for @${username}.`;
    return;
  }
  const sorted = [...prizes].sort((a,b) => new Date(b.claim_date) - new Date(a.claim_date));
  const total = sorted.reduce((sum,row) => sum + Number(row.glint || 0), 0);
  const largest = Math.max(...sorted.map(row => Number(row.glint || 0)));
  const plots = new Set(sorted.map(row => row.plot).filter(value => value != null));
  const average = Math.round(total / sorted.length);
  $("#total-glint").textContent = number.format(total);
  $("#claim-count").textContent = number.format(sorted.length);
  $("#plot-count").textContent = number.format(plots.size);
  $("#largest-prize").textContent = number.format(largest);
  $("#insight-value").textContent = number.format(average);
  $("#latest-claim").textContent = `Latest claim · ${formatDate(sorted[0].claim_date)}`;
  $("#record-count").textContent = `${sorted.length} record${sorted.length === 1 ? "" : "s"}`;
  $("#updated-label").textContent = `Updated ${new Intl.DateTimeFormat("en-GB", {hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date())}`;

  $("#prize-chart").innerHTML = sorted.slice().reverse().map((row, index) => {
    const height = Math.max(4, (Number(row.glint || 0) / largest) * 145);
    const label = new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short"}).format(new Date(row.claim_date));
    return `<div class="bar-group" title="${number.format(row.glint)} Glint"><span class="bar-value">${number.format(row.glint)}</span><div class="bar" style="height:${height}px"></div><span class="bar-label">${label}</span></div>`;
  }).join("");
  $("#claims-body").innerHTML = sorted.map(row => `<tr><td>${formatDate(row.claim_date)}</td><td class="glint-cell">✦ ${number.format(row.glint)}</td><td>#${escapeHtml(row.plot)}</td><td class="mono">${escapeHtml(row.card_uid)}</td><td><span class="claimed">Claimed</span></td></tr>`).join("");
  $("#status").hidden = true;
  $("#dashboard-content").hidden = false;
}

$("#search-form").addEventListener("submit", event => { event.preventDefault(); loadPlayer($("#username").value); });
const initialUsername = new URLSearchParams(location.search).get("username") || "doombot75";
$("#username").value = initialUsername;
loadPlayer(initialUsername);
