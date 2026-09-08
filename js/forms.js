/* ==========================================================
   Lead forms (hero form, floor-plan form, popup form).

   Flow per form:
     1. validate name / phone / email
     2. POST lead to leadEndpoint (Apps Script)
     3. redirect to thank-you page (or show inline success)
   ========================================================== */
(function () {
  "use strict";

  const CFG = window.MAIA_CONFIG || {};
  const COUNTRY = CFG.countryCode || "91";

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function normalisePhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    if (d.length === 10) d = COUNTRY + d;
    return d;
  }
  const isValidPhone = (d) => /^91[6-9]\d{9}$/.test(d) || (d.length >= 11 && d.length <= 15);
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function setError(input, msg) {
    const field = input.closest(".field");
    let err = $(".field__error", field);
    if (!err) { err = document.createElement("span"); err.className = "field__error"; field.appendChild(err); }
    err.textContent = msg;
    field.classList.toggle("has-error", !!msg);
  }

  function showFormError(form, msg) {
    let box = $(".lead-form__error", form);
    if (!msg) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.className = "lead-form__error"; form.appendChild(box); }
    box.textContent = msg;
  }

  /* ---------- lead submission ---------- */
  async function submitLead(form, phoneDigits) {
    const fd = new FormData(form);
    const utm = {};
    new URLSearchParams(location.search).forEach((v, k) => { if (/^(utm_|gclid|fbclid)/i.test(k)) utm[k] = v; });
    const payload = {
      name: (fd.get("name") || "").trim(),
      phone: "+" + phoneDigits,
      email: (fd.get("email") || "").trim(),
      configuration: "4 BHK",
      project: CFG.project,
      source: form.dataset.form,          // hero | floorplan | popup
      page: location.href,
      utm: utm,
      submitted_at: new Date().toISOString()
    };
    Object.assign(payload, utm);           // also flatten utm_* to top level for Apps Script

    const btn = $('button[type="submit"]', form);
    btn.disabled = true; btn.textContent = "Submitting…";
    try {
      if (CFG.leadEndpoint && !/^REPLACE/.test(CFG.leadEndpoint)) {
        /* text/plain keeps this a "simple" request so Apps Script /exec accepts it cross-origin without a preflight */
        await fetch(CFG.leadEndpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      } else {
        console.info("[LEAD] (no leadEndpoint configured)", payload);
      }
      sessionStorage.setItem("maia_lead_done", "1");
      document.dispatchEvent(new CustomEvent("maia:lead", { detail: payload }));

      if (CFG.thankYouUrl) {
        sessionStorage.setItem("maia_ty", JSON.stringify({ name: payload.name, src: payload.source }));
        location.assign(CFG.thankYouUrl);
      } else {
        showSuccess(form);
      }
    } catch (e) {
      showFormError(form, "We could not submit your details. Please try again.");
      btn.disabled = false; btn.textContent = "Request Information";
    }
  }

  function showSuccess(form) {
    $(".lead-form__fields", form).hidden = true;
    const hint = $(".lead-form__hint", form); if (hint) hint.hidden = true;
    $(".lead-form__success", form).hidden = false;
    showFormError(form, "");
  }

  /* ---------- wire every lead form ---------- */
  $$("form.lead-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      showFormError(form, "");
      const name = $('[name="name"]', form), phone = $('[name="phone"]', form), email = $('[name="email"]', form);
      let ok = true;
      setError(name, name.value.trim().length < 2 ? "Please enter your full name." : ""); ok &= name.value.trim().length >= 2;
      const digits = normalisePhone(phone.value);
      setError(phone, isValidPhone(digits) ? "" : "Enter a valid 10-digit mobile number."); ok &= isValidPhone(digits);
      setError(email, isValidEmail(email.value.trim()) ? "" : "Enter a valid email address."); ok &= isValidEmail(email.value.trim());
      if (!ok) return;
      submitLead(form, digits);
    });
    /* clear inline errors while typing */
    $$("input", form).forEach((i) => i.addEventListener("input", () => setError(i, "")));
  });
})();
