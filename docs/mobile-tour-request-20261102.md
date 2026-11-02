# Mobile tour enquiry page — 2 November 2026

Public route: `/request`. Uses the existing public site layout, brand palette, local Maldives image and shared LeadForm/API client. The form starts with name and telephone; email, direction and wishes are inside an optional disclosure. Existing forms keep their expanded default. Context is added only to the submitted comment, not the visitor's textarea.

Required personal-data/response-purpose consent and optional marketing remain independent, unchecked and linked to the existing documents. Submission uses `/api/leads/`, credentials omitted, with the current consent version. Errors remain visible and preserve entered values; success is announced only after a successful API response.

The page is linked from the footer and included in the sitemap and both positive page-analytics catalogues. Floating chat and mobile enquiry controls are hidden on this route so they cannot obscure its form.

## Verification

- `npx tsc --noEmit`: passed.
- Production Next.js build: passed; `/request` prerendered.
- Existing consent, public-form API and page-reading tests: 12 passed.
- Browser QA used the actual React page/form/header/footer components in an isolated fixture with Next image/link/navigation adapters and a mocked API. No production lead was sent.
- Desktop, 390 px and 320 px frames inspected. No horizontal overflow (content widths 375/305 px, excluding browser scrollbar). Main inputs are 52 px high with 16 px text.
- Empty name and missing mandatory consent blocked submission. Optional marketing stayed false.
- Mocked first API response returned a visible error; name and phone remained. Retry with email/direction/wishes succeeded and preserved all payload fields, source context and consent version. Requests used credentials `omit`.
- Screenshot: `previews/mobile-tour-request-20261102.jpg` (390 px frame, empty form).

## Deployment

Changes must be pulled and the backend and frontend containers rebuilt on the existing flypenza.ru server. No migrations are needed. Live CRM delivery and notifications have not been tested by this local verification.
