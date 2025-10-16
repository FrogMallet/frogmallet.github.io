<script>
(() => {
  // ---------- Config ----------
  const STORAGE_KEY = "frogmallet_highscores_v1";
  const NAME_KEY    = "frogmallet_player_name";
  const MAX_ENTRIES = 10; // top N

  // ---------- Utils ----------
  const nowISO = () => new Date().toISOString();
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // ---------- API ----------
  const api = {
    getName() {
      return localStorage.getItem(NAME_KEY) || "";
    },
    setName(name) {
      localStorage.setItem(NAME_KEY, (name || "").trim().slice(0, 24));
    },
    submit(score, meta = {}) {
      // score must be a number
      const s = Number(score);
      if (!Number.isFinite(s)) return false;

      const name = api.getName() || "Anonymous Frog";
      const entry = {
        name,
        score: s,
        ts: nowISO(),
        meta: {
          version: meta.version || "1.0.0",
          mode: meta.mode || "live"
        }
      };

      const list = load();
      list.push(entry);
      // sort desc by score, tie-break by earlier timestamp
      list.sort((a, b) => (b.score - a.score) || (a.ts.localeCompare(b.ts)));
      // keep top N
      const trimmed = list.slice(0, MAX_ENTRIES);
      save(trimmed);

      // fire event in case you want a toast
      document.dispatchEvent(new CustomEvent("scores:updated", { detail: { added: entry, list: trimmed }}));
      return true;
    },
    top(n = MAX_ENTRIES) {
      return load().slice(0, n);
    },
    clear() {
      save([]);
      document.dispatchEvent(new CustomEvent("scores:updated", { detail: { cleared: true, list: [] }}));
    },
    render(selector = "#leaderboard", { showNameForm = true } = {}) {
      const el = document.querySelector(selector);
      if (!el) return;

      const rows = api.top().map((e, i) => `
        <tr>
          <td>#${i + 1}</td>
          <td>${escapeHtml(e.name)}</td>
          <td>${e.score}</td>
          <td>${new Date(e.ts).toLocaleString()}</td>
        </tr>
      `).join("");

      el.innerHTML = `
        <div class="fm-board">
          <div class="fm-board-head">
            <h2>Ribbit Rampage — High Scores</h2>
            ${showNameForm ? `
            <div class="fm-name">
              <label>Player name</label>
              <input id="fm-name-input" type="text" maxlength="24" value="${escapeAttr(api.getName())}" placeholder="Your name">
              <button id="fm-name-save">Save</button>
            </div>` : ``}
          </div>

          <table class="fm-table">
            <thead><tr><th>Rank</th><th>Name</th><th>Score</th><th>When</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" style="text-align:center;opacity:.7">No scores yet — go squish some flies!</td></tr>`}</tbody>
          </table>
        </div>
      `;

      if (showNameForm) {
        el.querySelector("#fm-name-save")?.addEventListener("click", () => {
          const v = el.querySelector("#fm-name-input")?.value || "";
          api.setName(v);
          // optional toast:
          // alert("Saved name!");
          api.render(selector, { showNameForm });
        });
      }
    }
  };

  // Basic styles (inline so it’s portable)
  const css = `
    .fm-board{border:2px solid #222;border-radius:16px;padding:16px;background:#0f0f0f;color:#eee}
    .fm-board-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .fm-board h2{margin:0;color:#a2ff00;font-size:1.25rem}
    .fm-name{display:flex;gap:8px;align-items:center}
    .fm-name input{background:#121212;border:1px solid #333;border-radius:10px;padding:6px 10px;color:#fff;min-width:220px}
    .fm-name button{padding:6px 10px;border-radius:10px;border:1px solid #333;background:#171717;color:#fff;cursor:pointer}
    .fm-table{width:100%;border-collapse:separate;border-spacing:0 8px;margin-top:12px}
    .fm-table th{font-weight:600;text-align:left;padding:8px 10px;border-bottom:1px solid #222}
    .fm-table td{padding:8px 10px;background:#121212}
    .fm-table tr td:first-child{border-top-left-radius:10px;border-bottom-left-radius:10px}
    .fm-table tr td:last-child{border-top-right-radius:10px;border-bottom-right-radius:10px}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function escapeHtml(s){return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]))}
  function escapeAttr(s){return String(s).replace(/"/g,"&quot;")}

  // expose
  window.FMHighscores = api;
})();
</script>
