# MAIA The Seven — landing page replica (HTML / CSS / JS)

Static, framework-free rebuild of maia-seven.com with MSG91 mobile-OTP verification on
every lead form (hero form, floor-plan form, popup form). No Google tag, GA4, Ads
conversion, Meta pixel or any other tracker is loaded.

## Structure
```
index.html            page
css/style.css         all styles (responsive, palette sampled from the live site)
js/config.js          ← edit: MSG91 widget id/token, lead endpoint, popup timing
js/otp.js             MSG91 OTP flow + lead submission
js/main.js            nav, popup, slider, plan tabs/zoom, FAQ
images/               all image assets (placeholders until you run the localizer)
images/manifest.json  which image goes where
scripts/localize-images.py   pulls the real images off the live site
thank-you.html        redirect target after every verified submission
server/Code.gs        Apps Script: Google Sheet + email + Leadrat CRM
server/appsscript.json  manifest with the required OAuth scopes
privacy.html / terms.html   stubs linked from the footer
```

## 1. Get the real images
The live site is a React bundle, so its images are only discoverable at runtime.
```
pip install playwright requests && python -m playwright install chromium
python scripts/localize-images.py
```
It downloads every image into `images/source/` and walks you through mapping each
one to the filename the page expects (see `images/manifest.json`). Hero, gallery,
feature slides and floor plans are the ones that matter.

## 2. MSG91 OTP
1. MSG91 dashboard → OTP → Widgets → create a widget (SMS, 4-digit, your domain).
2. Copy **Widget ID** and **Token Auth** into `js/config.js`.
3. `otpLength` must equal the widget's OTP length.

Flow: submit → `sendOtp(91XXXXXXXXXX)` → inline 4-box OTP step (auto-advance, paste,
30 s resend timer, change number) → `verifyOtp` → lead POST with
`otp_verified:true` + access token → success state. Both the popup and inline forms
share the same code path.

## 3. Lead pipeline (after every verified submit)
Form → OTP → POST to Apps Script → **(1) Google Sheet "Leads"** → **(2) email to
bhooshan.bng@gmail.com** → **(3) Leadrat CRM** → browser redirects to **thank-you.html**.

Set up once:
1. New Google Sheet → Extensions → Apps Script → paste `server/Code.gs`.
2. Project Settings → "Show appsscript.json" → replace with `server/appsscript.json`
   (the `script.external_request` scope is what lets UrlFetchApp reach Leadrat).
3. Run `AUTHORIZE_ME()` and accept the popup. Then `TEST_LEADRAT()` → expect 200.
   `TEST_FULL_FLOW()` exercises Sheet + email + Leadrat together.
4. Deploy → Web app → Execute as **Me**, access **Anyone** → copy the `/exec` URL
   into `js/config.js` → `leadEndpoint`.
5. After any script edit: Deploy → Manage deployments → New version.

The Sheet gets a `Leadrat` column (OK / FAIL code) per lead; any non-200 response
is logged with the full Leadrat reply in a `Leadrat_Errors` tab, so a CRM outage
never loses a lead. Leadrat mapping mirrors the Vaishnavi Krishna Brindavan script
(mobile + countryCode 91, bhkType "4 BHK", subsource = hero/floorplan/popup,
location Basavanagudi, CampaignName = utm_campaign or "GoogleAds").

## Notes
- Fonts: the visible typeface on the live site is Inter (its `<head>` also links
  Playfair Display / Lato but they are not used in the rendered UI, so they are omitted).
- Only slide 1 of "Visionary Features" and FAQ answer 1 were visible in the reference
  capture; the remaining two slides and nine FAQ answers were written from the
  project's public details — edit freely.
- The location map is a plain Google Maps embed (no API key, no tracking); swap the
  `src` for the exact plot pin if you have it.
- Popup auto-opens after 12 s once per session (`autoPopupSeconds`; 0 disables).
