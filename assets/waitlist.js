"use strict";
/* ==========================================================================
   WAITLIST SYSTEM — shared script for all candidate tests.
   Patterns borrowed (see README for licences): Prelaunchr (referral code +
   tiered status reward, MIT), Waitly (referral fields in the schema from
   day one, MIT), TerminalSkills waitlist blueprint (double opt-in before
   credit, Apache-2.0), Launchfold (source tagging, MIT).
   ========================================================================== */

/* --------------------------------------------------------------------------
   BACKEND WIRING — DONE (2026-11-06).
   FORM_ENDPOINT points at the live "Early Access Waitlist" Google Form and
   FIELD_MAP carries its real entry.* IDs (see README.md field-mapping table).
   Submissions are POSTed to the form (and mirrored to localStorage so the
   share/position flow works without a page reload).
   -------------------------------------------------------------------------- */
const FORM_ENDPOINT = "https://docs.google.com/forms/d/e/1FAIpQLSfKWjiTSgW-U3b3oB8-ctdlw_BSQptu_9asodj2MwemV2fFhw/formResponse";

const FIELD_MAP = {
  email:          "entry.900050223",
  role:           "entry.373892372",
  pilot_interest: "entry.1758703500",
  referral_code:  "entry.2115769678",
  referred_by:    "entry.289201833",
  source:         "entry.525161559",
  candidate:      "entry.1427438401"
};

/* --------------------------------------------------------------------------
   PER-CANDIDATE CONFIG. Each page sets <body data-candidate="<slug>">.
   -------------------------------------------------------------------------- */
const CANDIDATES = {
  "invoice-chaser": {
    slug: "invoice-chaser",
    name: "PaidChase",
    codePrefix: "PC",
    roles: [
      "Freelancer / solo consultant",
      "Agency owner",
      "Small business owner (services / trades)",
      "Bookkeeper / operations",
      "Other"
    ]
  },
  "no-show-killer": {
    slug: "no-show-killer",
    name: "SlotGuard",
    codePrefix: "SG",
    roles: [
      "Dental / medical clinic",
      "Salon / spa / barbershop",
      "Physio / wellness / fitness studio",
      "Other appointment-based business"
    ]
  }
};

const STORAGE_KEY = "demandVentureWaitlistSubmissions";

function sanitizeTag(value, fallback) {
  const clean = String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 60);
  return clean || fallback;
}

function loadSubmissions() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveSubmission(record) {
  const all = loadSubmissions();
  all.push(record);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) { /* storage unavailable — backend POST is the source of truth */ }
  return all;
}

function generateReferralCode(prefix, existing) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = prefix + "-";
    const bytes = new Uint8Array(6);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      for (let i = 0; i < bytes.length; i++) code += alphabet[bytes[i] % alphabet.length];
    } else {
      for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  } while (existing.some(function (s) { return s.referral_code === code; }));
  return code;
}

function postToBackend(record) {
  if (!FORM_ENDPOINT) {
    return; // No endpoint configured: localStorage only (should not happen — endpoint is wired).
  }
  const body = new URLSearchParams();
  body.set(FIELD_MAP.email, record.email);
  body.set(FIELD_MAP.role, record.role);
  body.set(FIELD_MAP.pilot_interest, record.pilot_interest ? "Yes" : "No");
  body.set(FIELD_MAP.referral_code, record.referral_code);
  body.set(FIELD_MAP.referred_by, record.referred_by || "");
  body.set(FIELD_MAP.source, record.source);
  body.set(FIELD_MAP.candidate, record.candidate);
  // Google Forms returns no CORS headers; no-cors = fire-and-forget.
  window.fetch(FORM_ENDPOINT, { method: "POST", mode: "no-cors", body: body })
    .catch(function () { /* localStorage copy already saved */ });
}

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("waitlist-form");
  if (!form) return; // Index page has no form.

  const slug = document.body.getAttribute("data-candidate");
  const config = CANDIDATES[slug];
  if (!config) return;

  const params = new URLSearchParams(window.location.search);
  const referredBy = sanitizeTag(params.get("ref"), "");
  const source = sanitizeTag(params.get("src"), "direct");

  form.querySelector('[name="candidate"]').value = config.slug;
  form.querySelector('[name="referred_by"]').value = referredBy;
  form.querySelector('[name="source"]').value = source;

  // Role / problem-fit options come from the per-candidate config.
  const roleSelect = form.querySelector('[name="role"]');
  config.roles.forEach(function (role) {
    const opt = document.createElement("option");
    opt.value = role;
    opt.textContent = role;
    roleSelect.appendChild(opt);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (form.querySelector('[name="website"]').value) return; // Honeypot.

    const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
    const role = roleSelect.value;
    const pilotInterest = form.querySelector('[name="pilot_interest"]').checked;
    if (!email || email.indexOf("@") === -1 || !role) {
      form.reportValidity();
      return;
    }

    const existing = loadSubmissions();
    // Same response for a new or returning email (no list probing): a
    // returning signup gets their original code and position back.
    let record = null;
    for (let i = 0; i < existing.length; i++) {
      if (existing[i].email === email && existing[i].candidate === config.slug) {
        record = existing[i];
        break;
      }
    }
    let position;
    if (record) {
      position = existing.filter(function (s) { return s.candidate === config.slug; })
        .indexOf(record) + 1;
    } else {
      record = {
        candidate: config.slug,
        email: email,
        role: role,
        pilot_interest: pilotInterest,
        referral_code: generateReferralCode(config.codePrefix, existing),
        referred_by: referredBy,
        source: source,
        confirmed: false, // Double opt-in: counts only after inbox confirmation.
        submitted_at: new Date().toISOString()
      };
      const all = saveSubmission(record);
      position = all.filter(function (s) { return s.candidate === config.slug; }).length;
      postToBackend(record);
    }

    // Referral link points back at this page, carrying the new code.
    const pageUrl = window.location.origin + window.location.pathname;
    const referralLink = pageUrl + "?ref=" + encodeURIComponent(record.referral_code) +
      (source !== "direct" ? "&src=" + encodeURIComponent(source) : "");

    document.getElementById("position-number").textContent = "#" + position;
    const linkInput = document.getElementById("referral-link");
    linkInput.value = referralLink;
    document.getElementById("copy-referral").addEventListener("click", function () {
      linkInput.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(referralLink);
      } else {
        document.execCommand("copy");
      }
      this.textContent = "Copied";
    });

    form.hidden = true;
    const panel = document.getElementById("success-panel");
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});
