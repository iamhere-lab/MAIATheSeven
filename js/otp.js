/* ==========================================================
   MSG91 Mobile OTP verification for all lead forms
   (hero form, floor-plan form, popup form).

   Flow per form:
     1. validate name / phone / email
     2. window.sendOtp(91XXXXXXXXXX)         → show OTP step
     3. window.verifyOtp(code)               → returns access token
     4. POST lead + access token to endpoint → show success state

   Requires https://verify.msg91.com/otp-provider.js loaded before this file.
   ========================================================== */
(function () {
  "use strict";

  const CFG = window.MAIA_CONFIG || {};
  const OTP = CFG.msg91 || {};
  const OTP_LEN = OTP.otpLength || 4;
  let widgetReady = false;

  /* ---------- init MSG91 widget once ---------- */
  function initWidget() {
    if (typeof window.initSendOTP !== "function") {
      console.warn("[OTP] MSG91 otp-provider.js not loaded yet.");
      return;
    }
    if (!OTP.widgetId || OTP.widgetId.startsWith("REPLACE")) {
      console.warn("[OTP] Set msg91.widgetId / tokenAuth in js/config.js");
      return;
    }
    window.initSendOTP({
      widgetId: OTP.widgetId,
      tokenAuth: OTP.tokenAuth,
      exposeMethods: true,     // gives us window.sendOtp / verifyOtp / retryOtp
      success: function () {}, // unused in headless mode
      failure: function () {}
    });
    widgetReady = true;
  }
  if (document.readyState === "complete") initWidget();
  else window.addEventListener("load", initWidget);

  /* ---------- helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function normalisePhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.length === 10) d = (OTP.countryCode || "91") + d;
    if (d.length === 12 && d.startsWith("0")) d = d.slice(1);
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

  function msgFromMsg91(err) {
    if (!err) return "Something went wrong. Please try again.";
    if (typeof err === "string") return err;
    return err.message || err.msg || (err.data && err.data.message) || "Verification failed. Please try again.";
  }

  /* ---------- OTP step UI ---------- */
  function renderOtpStep(form, phoneDigits) {
    const step = $(".otp-step", form);
    const pretty = "+" + phoneDigits.slice(0, 2) + " " + phoneDigits.slice(2, 7) + " " + phoneDigits.slice(7);
    step.innerHTML = `
      <h3 class="otp-step__title">Verify your mobile number</h3>
      <p class="otp-step__sub">Enter the ${OTP_LEN}-digit code sent to <strong>${pretty}</strong></p>
      <div class="otp-step__boxes" role="group" aria-label="One-time password">
        ${Array.from({ length: OTP_LEN }).map((_, i) =>
          `<input type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" aria-label="Digit ${i + 1}" autocomplete="${i === 0 ? "one-time-code" : "off"}" />`).join("")}
      </div>
      <button type="button" class="btn btn--dark btn--block" data-verify>Verify &amp; Submit</button>
      <div class="otp-step__meta">
        <button type="button" data-edit>Change number</button>
        <span data-resend-wrap>Resend in <span data-timer>${OTP.resendAfterSeconds || 30}</span>s</span>
      </div>`;
    step.hidden = false;

    const boxes = $$(".otp-step__boxes input", step);
    boxes[0].focus();
    boxes.forEach((b, i) => {
      b.addEventListener("input", (e) => {
        const v = e.target.value.replace(/\D/g, "");
        if (v.length > 1) { // pasted full code
          v.split("").slice(0, OTP_LEN).forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
          (boxes[Math.min(v.length, OTP_LEN) - 1] || b).focus();
          return;
        }
        e.target.value = v;
        if (v && boxes[i + 1]) boxes[i + 1].focus();
        if (boxes.every((x) => x.value)) $("[data-verify]", step).click();
      });
      b.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !b.value && boxes[i - 1]) boxes[i - 1].focus();
      });
    });

    /* resend timer */
    let left = OTP.resendAfterSeconds || 30;
    const timer = $("[data-timer]", step);
    const wrap = $("[data-resend-wrap]", step);
    const tick = setInterval(() => {
      left -= 1; timer.textContent = left;
      if (left <= 0) {
        clearInterval(tick);
        wrap.innerHTML = `<button type="button" data-resend>Resend OTP</button>`;
        $("[data-resend]", step).addEventListener("click", () => {
          showFormError(form, "");
          window.retryOtp("11", () => renderOtpStep(form, phoneDigits), (err) => showFormError(form, msgFromMsg91(err))); // "11" = SMS channel
        });
      }
    }, 1000);

    $("[data-edit]", step).addEventListener("click", () => {
      clearInterval(tick);
      step.hidden = true; step.innerHTML = "";
      $(".lead-form__fields", form).hidden = false;
      showFormError(form, "");
    });

    $("[data-verify]", step).addEventListener("click", () => {
      const code = boxes.map((x) => x.value).join("");
      if (code.length !== OTP_LEN) { showFormError(form, `Please enter the ${OTP_LEN}-digit code.`); return; }
      const btn = $("[data-verify]", step);
      btn.disabled = true; btn.textContent = "Verifying…";
      window.verifyOtp(code,
        (data) => {
          clearInterval(tick);
          const token = (data && (data.message || data.accessToken || data.token)) || data;
          submitLead(form, phoneDigits, token);
        },
        (err) => {
          btn.disabled = false; btn.innerHTML = "Verify &amp; Submit";
          boxes.forEach((x) => (x.value = "")); boxes[0].focus();
          showFormError(form, msgFromMsg91(err) || "Incorrect code. Please try again.");
        });
    });
  }

  /* ---------- lead submission ---------- */
  async function submitLead(form, phoneDigits, accessToken) {
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
      otp_verified: true,
      otp_access_token: accessToken,
      utm: utm,
      submitted_at: new Date().toISOString()
    };
    Object.assign(payload, utm);           // also flatten utm_* to top level for Apps Script

    const btn = $("[data-verify]", form); if (btn) { btn.disabled = true; btn.textContent = "Submitting…"; }
    try {
      if (CFG.verifyEndpoint) {
        const v = await fetch(CFG.verifyEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
        if (!v.ok) throw new Error("Server could not verify OTP");
      }
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
      if (btn) { btn.disabled = false; btn.innerHTML = "Verify &amp; Submit"; }
    }
  }

  function showSuccess(form) {
    $(".otp-step", form).hidden = true;
    $(".lead-form__fields", form).hidden = true;
    const hint = $(".lead-form__hint", form); if (hint) hint.hidden = true;
    $(".lead-form__success", form).hidden = false;
    showFormError(form, "");
    sessionStorage.setItem("maia_lead_done", "1");
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

      if (!widgetReady || typeof window.sendOtp !== "function") {
        showFormError(form, "OTP service is not configured yet. Add your MSG91 widget ID in js/config.js.");
        return;
      }
      const btn = $('button[type="submit"]', form);
      btn.disabled = true; btn.textContent = "Sending OTP…";
      window.sendOtp(digits,
        () => {
          btn.disabled = false; btn.textContent = "Request Information";
          $(".lead-form__fields", form).hidden = true;
          renderOtpStep(form, digits);
        },
        (err) => {
          btn.disabled = false; btn.textContent = "Request Information";
          showFormError(form, msgFromMsg91(err));
        });
    });
    /* clear inline errors while typing */
    $$("input", form).forEach((i) => i.addEventListener("input", () => setError(i, "")));
  });
})();
