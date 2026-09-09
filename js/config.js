/* ==========================================================
   Site configuration — edit these values before going live.
   Nothing here is secret except what you choose to put in;
   the MSG91 auth key must stay on the server (see /server).
   ========================================================== */
window.MAIA_CONFIG = {
  /* MSG91 OTP Widget (Dashboard → OTP → Widget). Both values are safe
     to expose client-side; the widget is domain-locked in MSG91. */
  msg91: {
    widgetId: "366964654b69303233363033",
    tokenAuth: "563888T5rRWVhJ6a9a5915P1",
    countryCode: "91",          // default dial code for 10-digit Indian numbers
    otpLength: 4,               // must match the OTP length set on the widget
    resendAfterSeconds: 30
  },

  /* Google Apps Script web app URL (server/Code.gs). It fans the lead out to
     Google Sheet + email (bhooshan.bng@gmail.com) + Leadrat CRM.
     Leave empty to only log to console while testing. */
  leadEndpoint: "https://script.google.com/macros/s/AKfycbw87FpcpyMGQkuOUQ-P7DvnVNkBNUpLq_yuh-LYd-PCwnmkWelp39PSBDz9JGGA9k96/exec",

  /* Page to redirect to after a verified submission. Empty = inline success state. */
  thankYouUrl: "thank-you.html",

  /* Optional: an endpoint that re-verifies the MSG91 access token
     server-side before accepting the lead (see /server/verify-otp.js). */
  verifyEndpoint: "",

  /* Auto-open the enquiry popup after N seconds (0 = never). The popup
     is never re-opened once a lead has been submitted in this session. */
  autoPopupSeconds: 12,

  /* Fixed campaign fields sent with every lead. */
  project: "MAIA The Seven, Basavanagudi"
};
