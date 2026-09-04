// ============================================================
//  MAIA The Seven — Lead endpoint (Google Apps Script)
//  Flow: landing page (OTP-verified) → doPost → Sheet + Email + Leadrat
//
//  SETUP
//  1. Create a Google Sheet → Extensions → Apps Script → paste this file as Code.gs.
//  2. Project Settings → tick "Show appsscript.json in editor" → replace its
//     contents with server/appsscript.json (adds the external_request scope —
//     without it UrlFetchApp silently fails on live submissions).
//  3. Run AUTHORIZE_ME() once from the editor and accept the permission popup.
//  4. Run TEST_LEADRAT() → expect "Leadrat response code: 200".
//  5. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
//     Paste the /exec URL into js/config.js → leadEndpoint.
//  6. After any code change: Deploy → Manage deployments → Edit → New version.
// ============================================================

// ==================== CONFIG ====================
var SHEET_NAME   = "Leads";
var ADMIN_EMAIL  = "bhooshan.bng@gmail.com";
var PROJECT_NAME = "MAIA The Seven";

// ---- Leadrat CRM ----
var LEADRAT_URL      = "https://connect.leadrat.com/api/v1/integration/GoogleAds";
var LEADRAT_API_KEY  = "ZGMxMTE0ZjMtZTQ3Yy00M2I5LTg4MTEtMjdkYjg3MWRmMTVm";
var LEADRAT_CITY     = "Bangalore";
var LEADRAT_STATE    = "Karnataka";
var LEADRAT_LOCATION = "Basavanagudi";
var LEADRAT_BHK      = "4 BHK";     // single-typology project
// ================================================

function doPost(e) {
  try {
    var p = parseBody_(e);
    var tz = "Asia/Kolkata";

    var lead = {
      timestamp:     Utilities.formatDate(new Date(), tz, "dd-MM-yyyy HH:mm:ss"),
      name:          (p.name || "").trim(),
      phone:         normalisePhone_(p.phone),
      email:         (p.email || "").trim(),
      configuration: p.configuration || LEADRAT_BHK,
      source:        p.source || "Website",          // hero | floorplan | popup
      project:       p.project || PROJECT_NAME,
      page_url:      p.page || p.page_url || "",
      otp_verified:  String(p.otp_verified) === "true" ? "Yes" : "No",
      utm_source:    p.utm_source || "",
      utm_medium:    p.utm_medium || "",
      utm_campaign:  p.utm_campaign || "",
      utm_term:      p.utm_term || "",
      utm_content:   p.utm_content || ""
    };

    if (!lead.phone) throw new Error("phone missing");

    saveToSheet(lead);              // 1. Google Sheet
    sendEmailNotification(lead);    // 2. Email
    var lrCode = pushToLeadrat(lead); // 3. Leadrat CRM

    return ContentService.createTextOutput(JSON.stringify({ status: "success", leadrat: lrCode }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    logError("doPost failed: " + err + " | raw: " + (e && e.postData ? e.postData.contents : ""));
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("MAIA The Seven lead endpoint is live.");
}

// Accepts JSON body, form-encoded body, or query params.
function parseBody_(e) {
  var p = {};
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try { p = JSON.parse(raw); }
    catch (_) {
      raw.split("&").forEach(function (kv) {
        var i = kv.indexOf("="); if (i < 0) return;
        p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
      });
    }
  }
  if (e && e.parameter) Object.keys(e.parameter).forEach(function (k) { if (p[k] === undefined) p[k] = e.parameter[k]; });
  if (typeof p.utm === "string") { try { p.utm = JSON.parse(p.utm); } catch (_) {} }
  if (p.utm && typeof p.utm === "object") Object.keys(p.utm).forEach(function (k) { p[k] = p.utm[k]; });
  return p;
}

// "+91 98765 43210" / "919876543210" / "9876543210" → "9876543210"
function normalisePhone_(v) {
  var d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
  if (d.length === 11 && d.indexOf("0") === 0) d = d.slice(1);
  return d;
}

// ==================== 1. GOOGLE SHEET ====================
function saveToSheet(lead) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Name", "Phone", "Email", "Configuration", "Source", "Project",
                     "OTP Verified", "Page URL", "UTM Source", "UTM Medium", "UTM Campaign", "UTM Term", "UTM Content", "Leadrat"]);
    sheet.getRange(1, 1, 1, 15).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([lead.timestamp, lead.name, "'" + lead.phone, lead.email, lead.configuration, lead.source, lead.project,
                   lead.otp_verified, lead.page_url, lead.utm_source, lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content, ""]);
  lead._row = sheet.getLastRow();
}

// ==================== 2. EMAIL ====================
function sendEmailNotification(lead) {
  try {
    var subject = "New Lead: " + (lead.name || "Website Enquiry") + " - " + lead.project + " (" + lead.source + ")";
    var body = "Hello,\n\nYou have received a new OTP-verified lead.\n\n" +
      "Name: "          + lead.name + "\n" +
      "Phone: +91 "     + lead.phone + "\n" +
      "Email: "         + lead.email + "\n" +
      "Configuration: " + lead.configuration + "\n" +
      "Form: "          + lead.source + "\n" +
      "Project: "       + lead.project + "\n" +
      "OTP Verified: "  + lead.otp_verified + "\n" +
      "Page: "          + lead.page_url + "\n" +
      "UTM: "           + [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(String).join(" / ") + "\n" +
      "Time (IST): "    + lead.timestamp + "\n\n" +
      "— IamHere Lead System";
    MailApp.sendEmail(ADMIN_EMAIL, subject, body, { name: "MAIA Seven Leads" });
  } catch (err) {
    logError("Email failed: " + err);
  }
}

// ==================== 3. LEADRAT CRM ====================
function pushToLeadrat(lead) {
  try {
    var now = new Date(), tz = "Asia/Kolkata";
    var payload = {
      name: lead.name || "",
      mobile: lead.phone || "",
      countryCode: "91",
      email: lead.email || "",
      project: lead.project || PROJECT_NAME,
      city: LEADRAT_CITY,
      state: LEADRAT_STATE,
      location: LEADRAT_LOCATION,
      propertyType: "Flat",
      bhkType: lead.configuration || LEADRAT_BHK,
      notes: "Source: " + (lead.source || "Website") +
             " | OTP verified: " + (lead.otp_verified || "-") +
             " | Config: " + (lead.configuration || "-") +
             " | Page: " + (lead.page_url || "-"),
      subsource: lead.source || "Website",           // hero / floorplan / popup
      submittedDate: Utilities.formatDate(now, tz, "dd-MM-yy"),
      submittedTime: Utilities.formatDate(now, tz, "HH:mm:ss"),
      additionalProperties: {
        EnquiredFor: "Buy",
        BHKType: lead.configuration || LEADRAT_BHK,
        LandingPage: lead.page_url || "",
        OTPVerified: lead.otp_verified || ""
      },
      CampaignName: lead.utm_campaign || "GoogleAds",
      AgencyName: "IamHere"
    };

    var code = leadratPost_(payload);
    // Some Leadrat endpoints expect the object wrapped in an array — retry that shape once.
    if (code !== 200) code = leadratPost_([payload]);

    markLeadratStatus_(lead, code);
    return code;

  } catch (err) {
    logLeadratError("EXCEPTION", String(err), lead);
    markLeadratStatus_(lead, "EXC");
  }
}

function leadratPost_(payload) {
  var res = UrlFetchApp.fetch(LEADRAT_URL, {
    method: "post",
    contentType: "application/json",
    headers: { "API-Key": LEADRAT_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) logLeadratError(code, res.getContentText(), payload);
  return code;
}

function markLeadratStatus_(lead, code) {
  try {
    if (!lead._row) return;
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
      .getRange(lead._row, 15).setValue(code === 200 ? "OK" : "FAIL " + code);
  } catch (_) {}
}

// ==================== LOGGING ====================
function logLeadratError(code, body, payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Leadrat_Errors") || ss.insertSheet("Leadrat_Errors");
    if (sheet.getLastRow() === 0) sheet.appendRow(["Timestamp", "HTTP Code", "Response", "Payload"]);
    sheet.appendRow([new Date(), code, body, JSON.stringify(payload)]);
  } catch (_) {}
}
function logError(msg) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Errors") || ss.insertSheet("Errors");
    sheet.appendRow([new Date(), msg]);
  } catch (_) {}
}

// ==================== ONE-TIME HELPERS ====================
// ⚠️ RUN THIS FIRST from the editor — forces the permission popup for Sheets + Mail + UrlFetch.
function AUTHORIZE_ME() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  UrlFetchApp.fetch("https://www.google.com", { muteHttpExceptions: true });
  MailApp.sendEmail(ADMIN_EMAIL, "✅ Auth Test - " + PROJECT_NAME, "Permissions granted. Lead emails will work now.");
}

// Sends a dummy lead to Leadrat only. Expect 200; check Leadrat for "Test Lead IamHere".
function TEST_LEADRAT() {
  var code = pushToLeadrat({ name: "Test Lead IamHere", phone: "9988776655", email: "test@iamhere.in",
                             configuration: LEADRAT_BHK, source: "Integration Test", project: PROJECT_NAME,
                             page_url: "test", otp_verified: "Yes" });
  Logger.log("Leadrat response code: " + code);
}

// Simulates a full landing-page submission (Sheet + Email + Leadrat).
function TEST_FULL_FLOW() {
  var fake = { postData: { contents: JSON.stringify({ name: "Test Lead IamHere", phone: "+919988776655", email: "test@iamhere.in",
               source: "hero", project: PROJECT_NAME, page: "https://example.com/?utm_campaign=test", otp_verified: true,
               utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "test" } }) } };
  Logger.log(doPost(fake).getContent());
}
