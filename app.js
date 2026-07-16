const API_BASE = "https://api.splinterlands.com/players/glint_bomb_prizes";
const $ = (selector) => document.querySelector(selector);
const number = new Intl.NumberFormat("en-GB");
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const GUARANTEE = 50000;
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
  const cards = groupByCard(sorted);
  const average = Math.round(total / sorted.length);
  $("#total-glint").textContent = number.format(total);
  $("#claim-count").textContent = number.format(sorted.length);
  $("#card-count").textContent = number.format(cards.length);
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
  renderGuarantees(cards);
  $("#status").hidden = true;
  $("#dashboard-content").hidden = false;
}

function groupByCard(prizes) {
  const cards = new Map();
  for (const prize of prizes) {
    const uid = prize.card_uid || "Unknown card";
    const current = cards.get(uid) || { uid, glint: 0, claims: 0, plots: new Set(), first: prize.claim_date, latest: prize.claim_date };
    current.glint += Number(prize.glint || 0);
    current.claims += 1;
    if (prize.plot != null) current.plots.add(prize.plot);
    if (new Date(prize.claim_date) < new Date(current.first)) current.first = prize.claim_date;
    if (new Date(prize.claim_date) > new Date(current.latest)) current.latest = prize.claim_date;
    cards.set(uid, current);
  }
  return [...cards.values()].sort((a,b) => b.glint - a.glint);
}

function renderGuarantees(cards) {
  const cleared = cards.filter(card => card.glint >= GUARANTEE).length;
  $("#guarantee-summary").textContent = `${cleared} of ${cards.length} passed`;
  $("#guarantee-list").innerHTML = cards.map(card => {
    const remaining = Math.max(0, GUARANTEE - card.glint);
    const percent = Math.min(100, (card.glint / GUARANTEE) * 100);
    const passed = card.glint >= GUARANTEE;
    return `<div class="guarantee-row">
      <div class="card-id"><strong>${escapeHtml(card.uid)}</strong><small>${card.claims} claim${card.claims === 1 ? "" : "s"} · Plot${card.plots.size === 1 ? "" : "s"} ${[...card.plots].map(plot => `#${escapeHtml(plot)}`).join(", ") || "—"}</small></div>
      <div class="progress-cell"><div class="progress-meta"><span>${number.format(card.glint)} Glint</span><span>${percent.toFixed(percent >= 10 ? 0 : 1)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div></div>
      <div class="guarantee-number"><strong>${passed ? "Threshold met" : number.format(remaining)}</strong><small>${passed ? `+${number.format(card.glint - GUARANTEE)} above` : "Glint remaining"}</small></div>
      <span class="threshold-status${passed ? " cleared" : ""}">${passed ? "✓ Passed 50K" : "Below guarantee"}</span>
    </div>`;
  }).join("");
}

$("#search-form").addEventListener("submit", event => { event.preventDefault(); loadPlayer($("#username").value); });
const initialUsername = new URLSearchParams(location.search).get("username") || "doombot75";
$("#username").value = initialUsername;
loadPlayer(initialUsername);
