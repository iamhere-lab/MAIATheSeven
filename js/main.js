/* ==========================================================
   MAIA The Seven — page behaviour (no tracking of any kind)
   ========================================================== */
(function () {
  "use strict";
  const CFG = window.MAIA_CONFIG || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- mobile nav ---------- */
  const nav = $("#nav"), burger = $(".nav__burger");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
  });
  $$(".nav__links a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("is-open")));

  /* ---------- enquiry modal ---------- */
  const modal = $("#enquiry-modal");
  let lastFocus = null;
  function openModal() {
    lastFocus = document.activeElement;
    modal.classList.add("is-open"); modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const first = $("input", modal); if (first) setTimeout(() => first.focus(), 60);
  }
  function closeModal() {
    modal.classList.remove("is-open"); modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocus) lastFocus.focus();
  }
  $$("[data-open-modal]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); openModal(); }));
  $$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });

  /* auto popup (once per session, never after a submitted lead) */
  if (CFG.autoPopupSeconds > 0 && !sessionStorage.getItem("maia_popup_shown")) {
    setTimeout(() => {
      if (sessionStorage.getItem("maia_lead_done")) return;
      sessionStorage.setItem("maia_popup_shown", "1");
      if (!modal.classList.contains("is-open")) openModal();
    }, CFG.autoPopupSeconds * 1000);
  }
  document.addEventListener("maia:lead", (e) => {
    if (e.detail && e.detail.source === "popup") setTimeout(closeModal, 2500);
  });

  /* ---------- features slider ---------- */
  $$("[data-slider]").forEach((slider) => {
    const slides = $$(".slide", slider), dots = $("[data-dots]", slider);
    let i = 0, timer;
    slides.forEach((_, k) => {
      const d = document.createElement("button");
      d.setAttribute("aria-label", "Go to slide " + (k + 1));
      d.addEventListener("click", () => go(k));
      dots.appendChild(d);
    });
    function go(k) {
      i = (k + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle("is-active", j === i));
      $$("button", dots).forEach((d, j) => d.classList.toggle("is-active", j === i));
      restart();
    }
    function restart() { clearInterval(timer); timer = setInterval(() => go(i + 1), 7000); }
    $("[data-prev]", slider).addEventListener("click", () => go(i - 1));
    $("[data-next]", slider).addEventListener("click", () => go(i + 1));
    go(0);
  });

  /* ---------- plans: view toggle & type tabs ---------- */
  $$(".seg__btn").forEach((b) => b.addEventListener("click", () => {
    $$(".seg__btn").forEach((x) => x.classList.toggle("is-active", x === b));
    $$("[data-view-panel]").forEach((p) => (p.hidden = p.dataset.viewPanel !== b.dataset.view));
  }));
  const PLANS = { a: { img: "images/floor-plan-a.jpg", sba: "4,400 Sq.Ft", carpet: "3,150 Sq.Ft" },
                  b: { img: "images/floor-plan-b.jpg", sba: "4,950 Sq.Ft", carpet: "3,540 Sq.Ft" } };
  $$(".plans__tab").forEach((t) => t.addEventListener("click", () => {
    $$(".plans__tab").forEach((x) => x.classList.toggle("is-active", x === t));
    const p = PLANS[t.dataset.plan];
    $("[data-plan-img]").src = p.img; $("[data-sba]").textContent = p.sba; $("[data-carpet]").textContent = p.carpet;
    resetZoom();
  }));

  /* ---------- plans: zoom & pan on the (protected) preview ---------- */
  const canvas = $("[data-plan-canvas]"), planImg = $("[data-plan-img]");
  let scale = 1, tx = 0, ty = 0, drag = null;
  function apply() { planImg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; }
  function resetZoom() { scale = 1; tx = 0; ty = 0; apply(); }
  $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
    const z = b.dataset.zoom;
    if (z === "in") scale = Math.min(3, scale + .25);
    else if (z === "out") scale = Math.max(.5, scale - .25);
    else return resetZoom();
    apply();
  }));
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX - tx, y: e.clientY - ty }; canvas.classList.add("is-dragging"); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
  ["pointerup", "pointercancel"].forEach((ev) => canvas.addEventListener(ev, () => { drag = null; canvas.classList.remove("is-dragging"); }));

  /* ---------- FAQ: one open at a time ---------- */
  const acc = $("[data-accordion]");
  if (acc) acc.addEventListener("toggle", (e) => {
    if (e.target.open) $$("details", acc).forEach((d) => { if (d !== e.target) d.open = false; });
  }, true);

  /* ---------- smooth anchor offset for sticky nav ---------- */
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href"); if (id.length < 2) return;
    const el = $(id); if (!el) return;
    e.preventDefault();
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }));
})();
