/* ==========================================================
   Site configuration — edit these values before going live.
   ========================================================== */
window.MAIA_CONFIG = {
  /* Default dial code prepended to 10-digit Indian numbers. */
  countryCode: "91",

  /* Google Apps Script web app URL (server/Code.gs). It fans the lead out to
     Google Sheet + email (bhooshan.bng@gmail.com) + Leadrat CRM.
     Leave empty to only log to console while testing. */
  leadEndpoint: "https://script.google.com/macros/s/AKfycbw87FpcpyMGQkuOUQ-P7DvnVNkBNUpLq_yuh-LYd-PCwnmkWelp39PSBDz9JGGA9k96/exec",

  /* Page to redirect to after submission. Empty = inline success state. */
  thankYouUrl: "thank-you.html",

  /* Auto-open the enquiry popup after N seconds (0 = never). The popup
     is never re-opened once a lead has been submitted in this session. */
  autoPopupSeconds: 12,

  /* Fixed campaign fields sent with every lead. */
  project: "MAIA The Seven, Basavanagudi"
};
