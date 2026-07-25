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
  const dailyResults = groupByDay(sorted);
  const average = Math.round(total / dailyResults.length);
  $("#total-glint").textContent = number.format(total);
  $("#claim-count").textContent = number.format(sorted.length);
  $("#card-count").textContent = number.format(cards.length);
  $("#largest-prize").textContent = number.format(largest);
  $("#insight-value").textContent = number.format(average);
  $("#latest-claim").textContent = `Latest active day · ${new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short",year:"numeric"}).format(new Date(dailyResults[dailyResults.length - 1].date))}`;
  $("#record-count").textContent = `${sorted.length} record${sorted.length === 1 ? "" : "s"}`;
  $("#updated-label").textContent = `Updated ${new Intl.DateTimeFormat("en-GB", {hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date())}`;

  const largestDay = Math.max(...dailyResults.map(day => day.glint));
  $("#prize-chart").innerHTML = dailyResults.map(day => {
    const height = Math.max(4, (day.glint / largestDay) * 145);
    const label = new Intl.DateTimeFormat("en-GB", {day:"2-digit",month:"short"}).format(new Date(day.date));
    const claimLabel = `${day.claims} claim${day.claims === 1 ? "" : "s"}`;
    return `<div class="bar-group" title="${number.format(day.glint)} Glint from ${claimLabel}"><span class="bar-value">${number.format(day.glint)}</span><div class="bar" style="height:${height}px"></div><span class="bar-label">${label} · ${day.claims}</span></div>`;
  }).join("");
  $("#claims-body").innerHTML = sorted.map(row => `<tr><td>${formatDate(row.claim_date)}</td><td class="glint-cell">✦ ${number.format(row.glint)}</td><td>#${escapeHtml(row.plot)}</td><td class="mono">${escapeHtml(row.card_uid)}</td><td><span class="claimed">Claimed</span></td></tr>`).join("");
  renderGuarantees(cards);
  $("#status").hidden = true;
  $("#dashboard-content").hidden = false;
}

function groupByDay(prizes) {
  const days = new Map();
  for (const prize of prizes) {
    const parsed = new Date(prize.claim_date);
    const key = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
    const current = days.get(key) || { date: `${key}T00:00:00.000Z`, glint: 0, claims: 0 };
    current.glint += Number(prize.glint || 0);
    current.claims += 1;
    days.set(key, current);
  }
  return [...days.values()].sort((a,b) => new Date(a.date) - new Date(b.date));
}

function groupByCard(prizes) {
  const cards = new Map();
  for (const prize of prizes) {
    const uid = prize.card_uid || "Unknown card";
    const current = cards.get(uid) || { uid, glint: 0, claims: 0, plots: new Set(), prizes: [], first: prize.claim_date, latest: prize.claim_date };
    current.glint += Number(prize.glint || 0);
    current.claims += 1;
    current.prizes.push(prize);
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
    return `<div class="guarantee-row" data-guarantee-card="${escapeHtml(card.uid)}">
      <div class="card-id"><strong>${escapeHtml(card.uid)}</strong><small>${card.claims} claim${card.claims === 1 ? "" : "s"} · Plot${card.plots.size === 1 ? "" : "s"} ${[...card.plots].map(plot => `<a class="plot-link" data-plot="${escapeHtml(plot)}" href="https://vapi.splinterlands.com/land/deeds/${encodeURIComponent(plot)}" target="_blank" rel="noopener noreferrer">#${escapeHtml(plot)} ↗</a>`).join(", ") || "—"}</small><small class="stake-age" data-card="${escapeHtml(card.uid)}">Checking continuous stake…</small></div>
      <div class="progress-cell"><div class="progress-meta"><span>${number.format(card.glint)} Glint</span><span>${percent.toFixed(percent >= 10 ? 0 : 1)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><div class="glint-split">Resolving current staking period…</div></div>
      <div class="guarantee-number"><strong>${passed ? "Threshold met" : number.format(remaining)}</strong><small>${passed ? `+${number.format(card.glint - GUARANTEE)} above` : "Glint remaining"}</small></div>
      <span class="threshold-status${passed ? " cleared" : ""}">${passed ? "✓ Passed 50K" : "Below guarantee"}</span>
    </div>`;
  }).join("");
  resolvePlotLinks();
  resolveStakeDates(cards);
}

async function resolvePlotLinks() {
  const links = [...document.querySelectorAll(".plot-link")];
  const plots = [...new Set(links.map(link => link.dataset.plot))];
  const routes = new Map();

  await Promise.all(plots.map(async plot => {
    try {
      const response = await fetch(`https://vapi.splinterlands.com/land/deeds/${encodeURIComponent(plot)}`);
      if (!response.ok) return;
      const payload = await response.json();
      const deed = payload?.data;
      if (!deed?.region_number) return;
      routes.set(plot, `https://splinterlands.com/land/overview/praetoria/${deed.region_number}/${plot}`);
    } catch {
      // Keep the public deed API as a fallback link.
    }
  }));

  for (const link of links) {
    const gameUrl = routes.get(link.dataset.plot);
    if (gameUrl) {
      link.href = gameUrl;
      link.title = `Open plot #${link.dataset.plot} in Splinterlands`;
    }
  }
}

async function resolveStakeDates(cards) {
  const results = await Promise.all(cards.map(async card => {
    const target = document.querySelector(`.stake-age[data-card="${CSS.escape(card.uid)}"]`);
    const row = document.querySelector(`.guarantee-row[data-guarantee-card="${CSS.escape(card.uid)}"]`);
    if (!target || !row) return { passed: false };

    try {
      const response = await fetch(`https://api2.splinterlands.com/cards/history?id=${encodeURIComponent(card.uid)}`);
      if (!response.ok) throw new Error("History unavailable");
      const payload = await response.json();
      const history = Array.isArray(payload) ? payload : (payload?.value ?? []);
      const stakeEvents = history
        .filter(event => event.transfer_type === "land_stake" || event.transfer_type === "land_unstake")
        .sort((a,b) => new Date(b.transfer_date) - new Date(a.transfer_date));
      const latestEvent = stakeEvents[0];

      if (!latestEvent) {
        target.textContent = "Stake date unavailable";
        setGuaranteeUnavailable(row, card);
        return { passed: false };
      }
      if (latestEvent.transfer_type === "land_unstake") {
        target.textContent = `Not currently staked · streak reset ${formatShortDate(latestEvent.transfer_date)}`;
        target.classList.add("stake-warning");
        setGuaranteeProgress(row, 0, card.glint, card.glint, false);
        return { passed: false };
      }

      const stakedAt = new Date(latestEvent.transfer_date);
      const anniversary = new Date(stakedAt);
      anniversary.setUTCDate(anniversary.getUTCDate() + 365);
      const elapsed = Math.max(0, Math.floor((Date.now() - stakedAt.getTime()) / 86400000));
      const remaining = Math.max(0, 365 - elapsed);
      target.textContent = remaining
        ? `Staked ${formatShortDate(stakedAt)} · ${elapsed}/365 days · ${remaining} remaining`
        : `365 days reached ${formatShortDate(anniversary)}`;
      target.title = `365-day anniversary: ${formatShortDate(anniversary)}`;
      if (!remaining) target.classList.add("stake-complete");
      const currentGlint = card.prizes
        .filter(prize => new Date(prize.claim_date) >= stakedAt)
        .reduce((sum, prize) => sum + Number(prize.glint || 0), 0);
      const previousGlint = card.glint - currentGlint;
      const passed = currentGlint >= GUARANTEE;
      setGuaranteeProgress(row, currentGlint, previousGlint, card.glint, passed);
      return { passed };
    } catch {
      target.textContent = "Stake date unavailable";
      setGuaranteeUnavailable(row, card);
      return { passed: false };
    }
  }));
  const passed = results.filter(result => result?.passed).length;
  $("#guarantee-summary").textContent = `${passed} of ${cards.length} passed current streak`;
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function setGuaranteeProgress(row, currentGlint, previousGlint, lifetimeGlint, passed) {
  const remaining = Math.max(0, GUARANTEE - currentGlint);
  const percent = Math.min(100, (currentGlint / GUARANTEE) * 100);
  row.querySelector(".progress-meta").innerHTML = `<span>${number.format(currentGlint)} current-streak Glint</span><span>${percent.toFixed(percent >= 10 ? 0 : 1)}%</span>`;
  row.querySelector(".progress-fill").style.width = `${percent}%`;
  row.querySelector(".glint-split").innerHTML = `<span>Current ${number.format(currentGlint)}</span><span>Previous ${number.format(previousGlint)}</span><span>Lifetime ${number.format(lifetimeGlint)}</span>`;
  row.querySelector(".guarantee-number").innerHTML = `<strong>${passed ? "Threshold met" : number.format(remaining)}</strong><small>${passed ? `+${number.format(currentGlint - GUARANTEE)} above` : "Glint remaining"}</small>`;
  const status = row.querySelector(".threshold-status");
  status.className = `threshold-status${passed ? " cleared" : ""}`;
  status.textContent = passed ? "✓ Passed 50K" : "Below guarantee";
}

function setGuaranteeUnavailable(row, card) {
  row.querySelector(".glint-split").innerHTML = `<span>Lifetime ${number.format(card.glint)}</span><span>Current period unavailable</span>`;
}

$("#search-form").addEventListener("submit", event => { event.preventDefault(); loadPlayer($("#username").value); });
const initialUsername = new URLSearchParams(location.search).get("username") || "doombot75";
$("#username").value = initialUsername;
loadPlayer(initialUsername);
