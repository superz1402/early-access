# Waitlist System — Phase A Demand Tests

One reusable, plain-static waitlist system running two candidate tests for the
demand-driven venture (see `~/workspace/research/demand-venture-PLAN.md`, §4 Phase A).
No build step, no framework, no backend of our own. **Published 2026-11-06:**
repo `superz1402/early-access`, live at https://superz1402.github.io/early-access/
(branch-based GitHub Pages from `main`). Community posting remains a separate,
approval-gated step.

## The two tests

| Slug | Working name | Offer | Founding reward |
|---|---|---|---|
| `invoice-chaser` | **PaidChase** | AI service that chases freelancers'/small businesses' late invoices with polite, escalating, reply-aware follow-up sequences | $19/mo locked for life + first pilot slots |
| `no-show-killer` | **SlotGuard** | Reply-to-confirm reminders + one-tap reschedule + optional deposit link for appointment businesses (clinics, salons, studios) | Founding price locked for life + free pilot month |

## Files

```
waitlist/
├── index.html                  Landing page linking both tests
├── invoice-chaser/index.html   PaidChase page (body data-candidate="invoice-chaser")
├── no-show-killer/index.html   SlotGuard page (body data-candidate="no-show-killer")
├── assets/styles.css           The one shared stylesheet
├── assets/waitlist.js          The one shared script (endpoint config + per-candidate config)
└── README.md                   This file
```

To add a third candidate later: add one entry to `CANDIDATES` in `waitlist.js`,
copy a candidate folder, change `data-candidate` and the copy. Nothing else.

Serve locally for a preview with any static server, e.g.
`python3 -m http.server 8000` from this folder, then open
`http://localhost:8000/`, `/invoice-chaser/`, `/no-show-killer/`.

## How it works

- **Per-candidate config** (`CANDIDATES` in `waitlist.js`): slug, working name,
  referral-code prefix (`PC` / `SG`), and the role/problem-fit options that fill
  the form's select. Page copy is static HTML; behaviour is config-driven.
- **Form fields captured per signup:** `email`, `role` (problem fit — a qualified
  signal, not just an address), `pilot_interest` (checkbox, captured distinctly —
  pilot requests are a separate GO metric), `referral_code`, `referred_by`,
  `source`, `candidate`.
- **Source tagging:** link each community post with `?src=<tag>`
  (e.g. `?src=reddit-smallbusiness`) and the tag is stored with the signup, so we
  can tell *which community / problem statement* pulled, not just how many came.
- **Referral mechanics:** on submit, the page generates a unique referral code
  (prefix + 6 unambiguous characters), and swaps the form for a share view showing
  the signup's place in line and their personal link (`<page>?ref=CODE`, source tag
  carried through). A visitor arriving via that link has `referred_by` captured
  automatically. A returning email gets the *same* response, code and position as
  a new one (no list-probing, per the TerminalSkills blueprint).
- **Honeypot:** a hidden `website` field silently drops bot submissions.

## Double opt-in — read this before counting anything

Page copy and the post-submit state both say it plainly: **only confirmed emails
count.** A signup is a vote only after the owner clicks the confirmation link in
the inbox email; referrals are credited only when the referred person confirms.
This keeps the metric honest and kills referral gaming with fake addresses.

The front end implements the *state* ("check your inbox to confirm" + place in
line + share view). Sending the confirmation email, and flipping a signup to
`confirmed`, happens in the capture backend — wired 2026-11-06, see the wiring
record below. A signup that has not completed confirmation still counts as
**zero** toward the GO threshold.

## Capture backend — zero-backend, with a demo/fallback mode

The shared script POSTs each submission to the single `FORM_ENDPOINT` constant
at the top of `assets/waitlist.js`, using the `FIELD_MAP` entry IDs next to it.

**Wiring is DONE (2026-11-06)** — the endpoint and all seven entry IDs below
are the real values of the live "Early Access Waitlist" Google Form, whose
responses land in the linked "Waitlist Responses" Sheet. Submissions are also
mirrored to the browser's `localStorage` (key
`demandVentureWaitlistSubmissions`) so the code-generation / place-in-line /
share flow works without a page reload; the Sheet is the source of truth.

### Wiring record — live Google Form values

`FORM_ENDPOINT` (the form's POST URL — public URL with `/viewform` replaced
by `/formResponse`):

```
https://docs.google.com/forms/d/e/1FAIpQLSfKWjiTSgW-U3b3oB8-ctdlw_BSQptu_9asodj2MwemV2fFhw/formResponse
```

Field-mapping table (`FIELD_MAP` in `assets/waitlist.js` → form field):

   | # | Form question | Type | Stored as | `entry.*` ID |
   |---|---|---|---|---|
   | 1 | Email | Short answer | `email` | `entry.900050223` |
   | 2 | Role | Short answer (the page's select value is posted as text) | `role` | `entry.373892372` |
   | 3 | Pilot interest | Short answer ("Yes"/"No" is posted) | `pilot_interest` | `entry.1758703500` |
   | 4 | Referral code | Short answer | `referral_code` | `entry.2115769678` |
   | 5 | Referred by | Short answer | `referred_by` | `entry.289201833` |
   | 6 | Source | Short answer | `source` | `entry.525161559` |
   | 7 | Candidate | Short answer | `candidate` | `entry.1427438401` |

Confirmation email (what makes double opt-in real): a Google Apps Script
`onFormSubmit` setup on the form emails each signup a personal confirmation
link (a token pre-filled into the separate "Waitlist Confirm" form); a signup
counts as confirmed only when that confirm form is submitted with their token.
Until a signup is confirmed that way, do not report it as demand — see
"Double opt-in" above.

(For reference, the values were obtained the standard way: ⋮ menu → "Get
pre-filled link" in the form editor, reading the `entry.NNNNNNNNN` parameter
names out of the generated URL, then pasting them into `FIELD_MAP`.)

## GO / NO-GO metrics this system captures

Pre-registered in the plan (14 days per test, from first community post):

- **GO** = ≥ **30 confirmed** (double-opted-in) signups **and** ≥ **5 explicit
  pilot requests** (`pilot_interest = Yes`) from the target role, per candidate.
- **NO-GO** = anything less. Candidate is killed; learning is logged. Raw page
  views, unconfirmed emails, and out-of-role signups never count.

The captured fields support exactly this read: filter the Sheet by `candidate`
+ `confirmed`, count `pilot_interest`, and break results down by `source`
(which community converted) and `role` (problem fit). Referral performance is
readable from `referred_by` counts per `referral_code` (confirmed referrals
only). Orientation benchmark from the study: good waitlists convert cold
traffic at roughly 8–20%.

## Patterns borrowed — licence notes

All patterns below were *studied and re-implemented in original code*; no code
was copied verbatim. Full study: `~/workspace/research/github-study/03-waitlist-validation.md`.

| Source | Licence | Pattern adopted |
|---|---|---|
| harrystech/prelaunchr | MIT | Unique referral code per signup + a published, tiered *status* reward (here: founding price / pilot slot, not prizes) |
| revokslab/waitly | MIT | Referral fields (`referral_code`, `referred_by`) in the data model from day one; list stored where the owner already looks (Sheet) |
| TerminalSkills/skills (waitlist blueprint) | Apache-2.0 | Referrals credited only after the referee confirms; same response for new/existing emails; position computed, not stored |
| Kzl-ll/launchfold-lite | MIT | Positioning brief before the page; per-placement **source tagging** on the form; honeypot |
| vnatividade/pipe-venture-builder | Licence not visible — workflow studied, no code used | Pre-registered GO/NO-GO threshold + follow-up plan, or the test doesn't ship; disclose true availability state ("in development") |
| gripati/Hunch | MIT (per README) | Honesty gate: no invented testimonials, user counts, or scarcity anywhere on the pages |

## Follow-up loop (designed up front, per the study)

1. Confirmation email immediately on signup (wiring step 5 above).
2. Status/share moment instead of a dead "thanks": the success panel shows
   place in line + referral link.
3. At decision time: contact **confirmed** members in order — pilot requests
   first, then by referral count, then earliest signup — with the GO/NO-GO
   outcome stated honestly either way.
