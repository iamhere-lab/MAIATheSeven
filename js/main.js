/* ==========================================================
   MAIA The Seven — page behaviour.
   Header menu, enquiry popup (auto + on click), lightbox,
   amenity and location tabs, FAQ. Lead capture and OTP live
   in otp.js; this file adds no tracking of its own.
   ========================================================== */
(function () {
  "use strict";
  var CFG = window.MAIA_CONFIG || {};
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ss(key, val) {
    try {
      if (val === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  /* ---------- header section menu ---------- */
  var nav = $("#site-nav"), toggle = $(".nav-toggle");
  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle("is-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }
  if (nav) {
    if (toggle) toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target) && toggle && !toggle.contains(e.target)) setMenu(false);
    });
    var links = $$("a", nav);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) { l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id); });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      links.forEach(function (l) { var s = $(l.getAttribute("href")); if (s) io.observe(s); });
    }
  }

  /* ---------- enquiry popup ---------- */
  var layer = $("#enquiry-modal");
  var modalTitle = layer ? $(".js-modal-title", layer) : null;
  var lastFocus = null, formStarted = false;
  var INTENTS = {
    general:    { title: "Unlock price & floor plans", button: "Get Price Sheet & Floor Plans" },
    price:      { title: "Get the complete price sheet", button: "Send Me the Price Sheet" },
    floor_plan: { title: "Download the floor plans", button: "Send Me the Floor Plans" },
    site_visit: { title: "Book your private site visit", button: "Reserve My Visit Slot" },
    callback:   { title: "Request a call back", button: "Call Me Back" }
  };
  function isOpen() { return layer && !layer.hidden; }
  function openEnquiry(intent, auto) {
    if (!layer) return;
    var it = INTENTS[intent] || INTENTS.general;
    if (modalTitle) modalTitle.textContent = it.title;
    var btn = $('.lead-form__fields button[type="submit"]', layer);
    if (btn && !btn.disabled) btn.textContent = it.button;
    if (!isOpen()) lastFocus = document.activeElement;
    layer.hidden = false;
    document.documentElement.classList.add("modal-open");
    ss("maia_popup_shown", "1");
    var first = $('input[name="name"]', layer);
    if (first && !auto && !$(".lead-form__fields", layer).hidden) setTimeout(function () { first.focus(); }, 40);
  }
  function closeEnquiry() {
    if (!isOpen()) return;
    layer.hidden = true;
    document.documentElement.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if (layer) {
    layer.addEventListener("click", function (e) {
      if (e.target === layer || e.target.closest("[data-close]")) closeEnquiry();
    });
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest(".js-open-enquiry");
    if (!el) return;
    e.preventDefault();
    openEnquiry(el.getAttribute("data-intent") || "general", false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (isOpen()) closeEnquiry(); else setMenu(false);
  });
  document.addEventListener("focusin", function (e) { if (e.target.closest && e.target.closest("form.lead-form")) formStarted = true; });

  /* auto popup: once per session, never after a submitted lead or once a form is in use */
  var delay = Number(CFG.autoPopupSeconds);
  if (layer && delay > 0 && !ss("maia_popup_shown") && !ss("maia_lead_done")) {
    setTimeout(function () {
      if (ss("maia_lead_done") || ss("maia_popup_shown") || formStarted || isOpen()) return;
      if ($("dialog[open]")) return;
      openEnquiry("general", true);
    }, delay * 1000);
  }
  document.addEventListener("maia:lead", function (e) {
    if (e.detail && e.detail.source === "popup" && !CFG.thankYouUrl) setTimeout(closeEnquiry, 2500);
  });

  /* ---------- gallery lightbox ---------- */
  var lb = $("#lightbox");
  if (lb) {
    var lbImg = $("img", lb), lbCap = $("figcaption", lb), lbItems = [], lbIndex = 0;
    var lbShow = function (i) {
      lbIndex = (i + lbItems.length) % lbItems.length;
      var el = lbItems[lbIndex], cap = el.getAttribute("data-caption") || "";
      lbImg.src = el.getAttribute("data-full");
      lbImg.alt = cap; lbCap.textContent = cap;
    };
    $$(".js-lightbox").forEach(function (el) {
      el.addEventListener("click", function () {
        lbItems = $$(".js-lightbox"); lbShow(lbItems.indexOf(el));
        if (typeof lb.showModal === "function") lb.showModal(); else window.open(el.getAttribute("data-full"), "_blank");
      });
    });
    $(".lb-prev", lb).addEventListener("click", function () { lbShow(lbIndex - 1); });
    $(".lb-next", lb).addEventListener("click", function () { lbShow(lbIndex + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.closest("[data-close]")) lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") lbShow(lbIndex + 1);
      if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
    });
  }

  /* ---------- amenity + location tabs ---------- */
  function wireTabs(tabSel, panelSel) {
    var tabs = $$(tabSel);
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (o) {
          o.classList.toggle("is-active", o === t);
          o.setAttribute("aria-selected", o === t ? "true" : "false");
        });
        $$(panelSel).forEach(function (p) {
          var on = p.id === t.getAttribute("data-target");
          p.hidden = !on; p.classList.toggle("is-active", on);
        });
      });
    });
  }
  wireTabs(".am-tab", ".am-panel");
  wireTabs(".loc-tab", ".loc-panel");

  /* ---------- FAQ: one open at a time ---------- */
  var acc = $("[data-accordion]");
  if (acc) acc.addEventListener("toggle", function (e) {
    if (e.target.open) $$("details", acc).forEach(function (d) { if (d !== e.target) d.open = false; });
  }, true);
})();
