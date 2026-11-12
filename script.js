const API_URL =
  "https://script.google.com/macros/s/AKfycby9Q9OeoHV7uS7pOIdxiNGg5U4zXMrR0Cr4Wgi-H0HV8hO_q12h2oZU0GfwiZSC6gSrXA/exec";

const CACHE_KEY = "kegiatan_cache_v7";
const DEFAULT_PROGRAM = "PMASS";

const PROGRAM_INFO = {
  PMASS: {
    title: "PMASS",
    subtitle: "Pertanian Modern Agriculture Advance Agriculture",
    description:
      "Pendekatan terpadu untuk perakitan dan pengelolaan tanaman pangan — dari persiapan tanam hingga panen di setiap lokasi.",
  },
  RMPIK: {
    title: "RMPIK",
    subtitle: "Klinik Modernisasi Pertanian",
    description:
      "Pendampingan dan penerapan teknologi pertanian modern — dari persiapan tanam hingga panen di setiap lokasi.",
  },
  KMP: {
    title: "KMP",
    subtitle: "Kolaborasi Modernisasi Ketahanan",
    description:
      "Sinergi lintas sektor untuk mempercepat adopsi inovasi pertanian berkelanjutan — dari persiapan tanam hingga panen di setiap lokasi.",
  },
  PROBEN: {
    title: "Produksi Benih",
    subtitle: "Pusat Produksi Benih Tanaman Pangan",
    description:
      "Penyediaan dan pengelolaan produksi benih tanaman pangan — dari perencanaan hingga panen benih bersertifikat di setiap lokasi.",
  },
};

const ICON_MAP = {
  "Persiapan Tanam": "icon/Persiapan Tanam.svg",
  "Persemaian": "icon/Persemaian.svg",
  "Tanam": "icon/Tanam.svg",
  "Pemupukan": "icon/Pemupukan.svg",
  "Perawatan": "icon/Perawatan.svg",
  "Panen": "icon/Panen.svg",
};

async function loadData() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.rows)) throw new Error("Data tidak valid");
    const payload = {
      rows: json.rows,
      stats: Array.isArray(json.stats) ? json.stats : [],
    };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch (e) { }
    return payload;
  } catch (err) {
    const cached = readCache();
    if (cached) return cached;
    throw err;
  }
}

function readCache() {
  try {
    for (const key of [CACHE_KEY, "kegiatan_cache_v6", "kegiatan_cache_v5"]) {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.rows) && parsed.rows.length) {
        return {
          rows: parsed.rows,
          stats: Array.isArray(parsed.stats) ? parsed.stats : [],
        };
      }
      if (Array.isArray(parsed) && parsed.length) {
        return { rows: parsed, stats: [] };
      }
    }
  } catch (e) { }
  return null;
}

function normalize(rows) {
  const out = {};
  const stageMap = {};

  for (const r of rows) {
    if (!r || typeof r !== "object") continue;

    const program = r.program ? String(r.program).trim().toUpperCase() : DEFAULT_PROGRAM;
    const kom = r.komoditas ? String(r.komoditas).trim() : "";
    const loc = r.lokasi ? String(r.lokasi).trim() : "";
    const nomor = r.nomor != null ? String(r.nomor).trim() : "";
    const nama = r.nama ? String(r.nama).trim() : "";
    const sub = r.sub ? String(r.sub).trim() : "";
    const desk = r.deskripsi ? String(r.deskripsi).trim() : "";
    const gambar = r.gambar ? String(r.gambar).trim() : "";

    if (!program || !kom || !loc) continue;
    if (!nomor && !sub) continue;

    out[program] = out[program] || {};
    out[program][kom] = out[program][kom] || {};
    out[program][kom][loc] = out[program][kom][loc] || [];

    const key = `${program}|${kom}|${loc}`;

    if (nomor) {
      let stage = out[program][kom][loc].find((s) => String(s.nomor) === nomor);
      if (!stage) {
        stage = { nomor, nama, subs: [] };
        out[program][kom][loc].push(stage);
      }
      stageMap[key] = stage;
    }

    if (sub) {
      const stage = stageMap[key];
      if (stage) {
        stage.subs.push({ nama: sub, desk, imgs: driveIds(gambar) });
      }
    }
  }

  return out;
}

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

function normalizeStats(list) {
  const out = {};
  for (const s of list) {
    if (!s) continue;
    const program = s.program ? String(s.program).trim().toUpperCase() : DEFAULT_PROGRAM;
    const k = s.komoditas ? String(s.komoditas).trim() : "";
    const l = s.lokasi ? String(s.lokasi).trim() : "";
    if (!program || !k || !l) continue;

    out[program] = out[program] || {};
    out[program][k] = out[program][k] || {};
    out[program][k][l] = {
      progress: clamp(s.progress),
      progressAnggaran: clamp(s.progressAnggaran),
      progressTarget: clamp(s.progressTarget),
      pagu: Math.max(0, Number(s.pagu) || 0),
      realisasi: Math.max(0, Number(s.realisasi) || 0),
      target: Math.max(0, Number(s.target) || 0),
      realisasiTarget: Math.max(0, Number(s.realisasiTarget) || 0),
      satuan: s.satuan ? String(s.satuan).trim() : "",
    };
  }
  return out;
}

function driveIds(text) {
  const str = String(text || "");
  const ids = [];
  const re = /(?:\/d\/|[?&]id=)([\w-]{10,})/g;
  let m;
  while ((m = re.exec(str))) ids.push(m[1]);
  return [...new Set(ids)];
}

const thumb = (id, w) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
const $ = (id) => document.getElementById(id);

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const nice = (s) => {
  const str = String(s).trim();
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const pad2 = (n) => String(n).padStart(2, "0");
const arrowSVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M17 7H9M17 7v8" /></svg>`;

let DATA = {};
let STATS = {};
let loadingPromise = null;

const state = { view: "dashboard", program: null, kom: 0, loc: 0, stage: 0 };
const EXIT_MS = 250;

const progData = () => (state.program ? DATA[state.program] || {} : {});

const koms = () => {
  const pd = progData();
  return Object.keys(pd).filter((k) => Object.keys(pd[k] || {}).length > 0);
};

const locs = () => {
  const kom = koms()[state.kom];
  if (!kom) return [];
  return Object.keys(progData()[kom] || {});
};

const stages = () => {
  const kom = koms()[state.kom];
  const loc = locs()[state.loc];
  if (!kom || !loc) return [];
  return (progData()[kom] && progData()[kom][loc]) || [];
};

function hasData() {
  return Object.keys(DATA).some((p) => Object.keys(DATA[p] || {}).length > 0);
}

function buildKoms() {
  const box = $("komTabs");
  box.replaceChildren();
  const list = koms();

  list.forEach((name, i) => {
    const b = el("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.appendChild(el("span", "", name));

    b.addEventListener("click", () => selectKom(i));
    b.addEventListener("keydown", (e) => {
      const n = list.length;
      const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      selectKom(to);
      box.children[to]?.focus();
    });

    box.appendChild(b);
  });

  syncKoms();
}

function syncKoms() {
  [...$("komTabs").children].forEach((b, i) => {
    const on = i === state.kom;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

function buildLocs() {
  const box = $("locTabs");
  box.replaceChildren();
  const list = locs();

  list.forEach((name, i) => {
    const b = el("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.appendChild(el("span", "", nice(name)));

    const arrow = el("span", "arrow");
    arrow.innerHTML = arrowSVG;
    b.appendChild(arrow);

    b.addEventListener("click", () => selectLoc(i));
    b.addEventListener("keydown", (e) => {
      const n = list.length;
      const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      selectLoc(to);
      box.children[to]?.focus();
    });

    box.appendChild(b);
  });

  syncLocs();
}

function syncLocs() {
  [...$("locTabs").children].forEach((b, i) => {
    const on = i === state.loc;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

function buildRail() {
  const box = $("rail");
  box.replaceChildren();

  stages().forEach((s, i) => {
    const b = el("button");
    b.type = "button";
    b.id = `stage-tab-${i}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", "stage");

    const label = el("span", "label");
    const num = el("span", "n", pad2(s.nomor));
    const title = el("span", "t");
    title.appendChild(document.createTextNode(s.nama));

    const iconKey = Object.keys(ICON_MAP).find(
      (k) => k.toLowerCase() === s.nama.toLowerCase()
    );
    if (iconKey) {
      const img = document.createElement("img");
      img.src = ICON_MAP[iconKey];
      img.alt = "";
      img.className = "stage-icon";
      title.appendChild(img);
    }

    label.append(num, title);
    const arrow = el("span", "arrow");
    arrow.innerHTML = arrowSVG;
    b.append(label, arrow);

    b.addEventListener("click", () => selectStage(i));
    b.addEventListener("keydown", (e) => {
      const n = stages().length;
      const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      selectStage(to);
      box.children[to]?.focus();
    });

    box.appendChild(b);
  });

  box.scrollLeft = 0;
  syncRail(true);
}

function syncRail(scroll = true) {
  const box = $("rail");

  [...box.children].forEach((b, i) => {
    const on = i === state.stage;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && scroll) {
      b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  });

  const active = box.children[state.stage];
  const stageEl = $("stage");
  if (active && stageEl) stageEl.setAttribute("aria-labelledby", active.id);
}

function renderStage() {
  const list = stages();
  const s = list[state.stage];

  if (!s) {
    $("stageCount").textContent = "";
    $("subs").replaceChildren();
    $("emptyMsg").hidden = false;
    return;
  }

  $("stageCount").textContent = `Tahap ${pad2(state.stage + 1)} / ${pad2(list.length)}`;

  const ul = $("subs");
  ul.replaceChildren();
  ul.hidden = !s.subs.length;
  $("emptyMsg").hidden = s.subs.length > 0;

  s.subs.forEach((sub, i) => ul.appendChild(subItem(sub, i)));
}

function buildStats() {
  const wrap = $("stats");
  if (!state.program) { wrap.hidden = true; return; }

  const kom = koms()[state.kom];
  const loc = locs()[state.loc];
  const s = kom && loc ? (STATS[state.program] && STATS[state.program][kom] && STATS[state.program][kom][loc]) : null;

  if (!s) { wrap.hidden = true; return; }

  wrap.hidden = false;

  const p = clamp(s.progress);
  const pa = clamp(s.progressAnggaran);
  const pt = clamp(s.progressTarget);

  $("progFill").style.width = p + "%";
  $("progVal").textContent = p + "%";
  $("budgetFill").style.width = pa + "%";
  $("budgetPct").textContent = pa + "%";
  $("targetFill").style.width = pt + "%";
  $("targetPct").textContent = pt + "%";

  $("paguVal").textContent = formatRupiah(s.pagu);
  $("realisasiVal").textContent = formatRupiah(s.realisasi);
  $("targetVal").textContent = formatAmount(s.target, s.satuan);
  $("realisasiTargetVal").textContent = formatAmount(s.realisasiTarget, s.satuan);
}

function formatRupiah(n) {
  const v = Math.max(0, Number(n) || 0);
  return "Rp " + v.toLocaleString("id-ID");
}

function formatAmount(n, satuan) {
  const v = Math.max(0, Number(n) || 0);
  const formatted = v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return satuan ? `${formatted} ${satuan}` : formatted;
}

function buildGallery(sub) {
  const wrap = el("div", "gallery");

  sub.imgs.forEach((fileId, idx) => {
    const b = el("button", "gallery__item");
    b.type = "button";
    b.setAttribute("aria-label", `Perbesar foto ${sub.nama} (${idx + 1} dari ${sub.imgs.length})`);

    const img = el("img");
    img.alt = `${sub.nama} — foto ${idx + 1}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.onload = () => { img.classList.add("is-loaded"); b.classList.add("is-loaded"); };
    img.onerror = () => { b.classList.add("is-broken"); img.remove(); };
    img.src = thumb(fileId, 600);

    b.appendChild(img);
    b.addEventListener("click", () => openLightbox(fileId, sub.nama, sub.imgs, idx));
    wrap.appendChild(b);
  });

  return wrap;
}

function subItem(sub, i) {
  const id = `sub-${state.program}-${state.kom}-${state.loc}-${state.stage}-${i}`;
  const li = el("li");
  li.style.setProperty("--i", i);

  const btn = el("button", "sub__btn");
  btn.type = "button";
  btn.id = `${id}-btn`;
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", id);

  btn.appendChild(el("span", "sub__num", pad2(i + 1)));
  btn.appendChild(el("span", "sub__name", sub.nama));

  if (sub.imgs.length) {
    const badge = el("span", "sub__badge");
    badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4 4 3 3-2 4 3"/></svg>`;
    badge.appendChild(document.createTextNode(String(sub.imgs.length)));
    btn.appendChild(badge);
  }

  btn.appendChild(el("span", "sub__plus"));

  const panel = el("div", "sub__panel");
  panel.id = id;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-labelledby", btn.id);

  const inner = el("div", "sub__inner");
  inner.appendChild(el("p", "sub__desc" + (sub.desk ? "" : " is-empty"), sub.desk || "Deskripsi belum tersedia."));
  if (sub.imgs.length) inner.appendChild(buildGallery(sub));
  panel.appendChild(inner);

  btn.addEventListener("click", () => {
    const wasOpen = btn.getAttribute("aria-expanded") === "true";
    $("subs").querySelectorAll(".sub__btn").forEach((b) => {
      b.setAttribute("aria-expanded", "false");
      b.parentElement.classList.remove("is-open");
    });
    btn.setAttribute("aria-expanded", String(!wasOpen));
    li.classList.toggle("is-open", !wasOpen);
  });

  li.append(btn, panel);
  return li;
}

function swap(update, { rail = false } = {}) {
  update();
  if (rail) { syncLocs(); buildRail(); } else { syncRail(); }
  renderStage();
  buildStats();
}

function selectStage(i) {
  if (i === state.stage) return;
  swap(() => { state.stage = i; });
}

function selectLoc(i) {
  if (i === state.loc) return;
  swap(() => { state.loc = i; state.stage = 0; }, { rail: true });
}

function selectKom(i) {
  if (i === state.kom) return;
  state.kom = i;
  state.loc = 0;
  state.stage = 0;
  syncKoms();
  buildLocs();
  buildRail();
  renderStage();
  buildStats();
}

function openProgram(program, push = true) {
  state.program = program;
  state.view = "program";
  state.kom = 0;
  state.loc = 0;
  state.stage = 0;

  $("view-dashboard").hidden = true;
  $("view-program").hidden = false;

  const info = PROGRAM_INFO[program] || { title: program, subtitle: "", description: "" };
  $("programKicker").textContent = info.subtitle;
  $("programTitle").textContent = info.title;
  $("programDesc").textContent = info.description;

  window.scrollTo(0, 0);
  if (push) {
    try { history.pushState({ program }, "", "#" + program.toLowerCase()); } catch (e) { }
  }

  ensureData().then((ok) => {
    if (!ok || state.program !== program) return;
    buildKoms();
    buildLocs();
    buildRail();
    renderStage();
    buildStats();
  });
}

function closeProgram(push = true, scrollTo = "programs") {
  state.view = "dashboard";
  state.program = null;
  state.kom = 0;
  state.loc = 0;
  state.stage = 0;

  $("view-dashboard").hidden = false;
  $("view-program").hidden = true;

  if (push) {
    try { history.pushState({}, "", window.location.pathname + window.location.search); } catch (e) { }
  }

  if (scrollTo) {
    setTimeout(() => {
      document.getElementById(scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function navigateTo(sectionId) {
  if (state.view === "program") {
    closeProgram(true, sectionId);
  } else {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function restoreFromHash() {
  const hash = (window.location.hash || "").replace("#", "").toUpperCase();
  if (hash === "PMASS" || hash === "RMPIK" || hash === "KMP" || hash === "PROBEN") {
    openProgram(hash, false);
  }
}

const lb = $("lightbox");
const lbImg = $("lbImg");
const lbTitle = $("lbTitle");
const lbCounter = $("lbCounter");
const lbPrev = $("lbPrev");
const lbNext = $("lbNext");
const lbError = $("lbError");

let lbState = { imgs: [], idx: 0, alt: "" };
let lastFocus = null;
const preloaded = new Set();

function openLightbox(fileId, alt, imgs = [], idx = 0) {
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  lbState.imgs = Array.isArray(imgs) && imgs.length ? imgs : [fileId];
  lbState.idx = Math.max(0, Math.min(idx, lbState.imgs.length - 1));
  lbState.alt = alt;
  renderLightbox();
  lb.showModal();
}

function renderLightbox() {
  const { imgs, idx, alt } = lbState;
  const fileId = imgs[idx];

  lb.classList.add("is-loading");
  lbImg.classList.remove("is-loaded");
  lbError.hidden = true;

  lbImg.onload = () => {
    lbImg.classList.add("is-loaded");
    lb.classList.remove("is-loading");
  };
  lbImg.onerror = () => {
    lb.classList.remove("is-loading");
    lbError.hidden = false;
  };

  lbImg.alt = `${alt} — foto ${idx + 1}`;
  lbImg.src = thumb(fileId, 2000);

  lbTitle.textContent = alt;
  lbCounter.textContent = `${pad2(idx + 1)} / ${pad2(imgs.length)}`;

  const multi = imgs.length > 1;
  lbPrev.hidden = !multi;
  lbNext.hidden = !multi;
  lbPrev.disabled = idx === 0;
  lbNext.disabled = idx === imgs.length - 1;

  const dotsBox = $("lbDots");
  if (dotsBox) {
    dotsBox.replaceChildren();
    if (multi) {
      imgs.forEach((_, i) => {
        const dot = el("button", "lightbox__dot" + (i === idx ? " is-active" : ""));
        dot.type = "button";
        dot.setAttribute("aria-label", `Ke foto ${i + 1}`);
        dot.addEventListener("click", () => { lbState.idx = i; renderLightbox(); });
        dotsBox.appendChild(dot);
      });
      dotsBox.hidden = false;
    } else {
      dotsBox.hidden = true;
    }
  }

  preloadNeighbors();
}

function preloadNeighbors() {
  const { imgs, idx } = lbState;
  [idx - 1, idx + 1].forEach((i) => {
    if (i < 0 || i >= imgs.length) return;
    const id = imgs[i];
    if (preloaded.has(id)) return;
    preloaded.add(id);
    const img = new Image();
    img.decoding = "async";
    img.src = thumb(id, 2000);
  });
}

function lightboxStep(dir) {
  if (lb.classList.contains("is-closing")) return;
  const { imgs, idx } = lbState;
  if (imgs.length <= 1) return;
  const next = idx + dir;
  if (next < 0 || next >= imgs.length) return;
  lbState.idx = next;
  renderLightbox();
}

function closeLightbox() {
  if (!lb.open || lb.classList.contains("is-closing")) return;
  lb.classList.add("is-closing");
  setTimeout(() => {
    lb.close();
    lb.classList.remove("is-closing");
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
    lastFocus = null;
  }, EXIT_MS);
}

$("lbClose").addEventListener("click", closeLightbox);
lbPrev.addEventListener("click", () => lightboxStep(-1));
lbNext.addEventListener("click", () => lightboxStep(1));
lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
lb.addEventListener("cancel", (e) => { e.preventDefault(); closeLightbox(); });

document.addEventListener("keydown", (e) => {
  if (!lb.open) return;
  if (e.key === "ArrowLeft") lightboxStep(-1);
  else if (e.key === "ArrowRight") lightboxStep(1);
});

const toTop = $("toTop");
const siteHeader = $("top");

function updateScrollUI() {
  const y = window.scrollY || document.documentElement.scrollTop;
  if (toTop) toTop.classList.toggle("is-visible", y > 480);
  if (siteHeader) siteHeader.classList.toggle("is-stuck", y > 8);
}

window.addEventListener("scroll", updateScrollUI, { passive: true });
window.addEventListener("resize", updateScrollUI);

toTop?.addEventListener("click", (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll('[data-nav]').forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo(a.dataset.nav);
  });
});

document.querySelectorAll(".brand").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (state.view === "program") {
      closeProgram();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});

document.querySelectorAll(".program-card").forEach((card) => {
  card.addEventListener("click", () => {
    const program = card.dataset.program;
    if (program) openProgram(program);
  });
});

$("backBtn").addEventListener("click", () => closeProgram(true, "programs"));

window.addEventListener("popstate", () => {
  const hash = (window.location.hash || "").replace("#", "").toUpperCase();
  if (hash === "PMASS" || hash === "RMPIK" || hash === "KMP" || hash === "PROBEN") {
    openProgram(hash, false);
  } else if (state.view === "program") {
    closeProgram(false);
  }
});

const yearEl = $("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const retryBtn = $("retryBtn");

function setState(cls, text) {
  const main = $("kegiatan");
  if (!main) return;
  main.classList.remove("is-loading", "is-error");
  if (cls) main.classList.add(cls);
  main.setAttribute("aria-busy", String(cls === "is-loading"));

  const t = $("status")?.querySelector(".status__text");
  if (t) t.textContent = text || "";
  if (retryBtn) retryBtn.hidden = cls !== "is-error";
}

function ensureData() {
  if (hasData()) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    setState("is-loading", "Memuat data…");
    try {
      const payload = await loadData();
      DATA = normalize(payload.rows);
      STATS = normalizeStats(payload.stats || []);
      if (!hasData()) {
        setState("is-error", "Belum ada data kegiatan.");
        loadingPromise = null;
        return false;
      }
      setState("");
      return true;
    } catch (err) {
      setState("is-error", "Data kegiatan belum bisa dimuat. Periksa koneksi lalu coba lagi.");
      loadingPromise = null;
      return false;
    }
  })();

  return loadingPromise;
}

retryBtn.addEventListener("click", () => {
  loadingPromise = null;
  ensureData().then((ok) => {
    if (ok && state.view === "program") {
      buildKoms();
      buildLocs();
      buildRail();
      renderStage();
      buildStats();
    }
  });
});

ensureData().then((ok) => {
  if (ok) restoreFromHash();
  updateScrollUI();
});