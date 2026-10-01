# Gmail SMTP for Poffu (Supabase) — step by step

Why: since June 3 2026, new free-tier Supabase projects can't customize auth
email templates while on Supabase's default email. Configuring any custom
SMTP unlocks template editing. Gmail's is free and takes ~5 minutes.

You do all of this yourself — it's your Google account and your Supabase
dashboard. Nothing here needs the app rebuilt.

---

## Part 1 — Create a Google App Password (5 min)

A normal Gmail password won't work for SMTP. You need a 16-character app
password (Google only issues these when 2-Step Verification is on).

1. Go to https://myaccount.google.com/security
2. Under "How you sign in to Google", make sure **2-Step Verification is ON**.
   If it's off, turn it on first (takes a minute, needs your phone).
3. Go to https://myaccount.google.com/apppasswords
   (if it asks you to sign in again, that's normal)
4. In the "App name" box type `Poffu` (or `Supabase`) and click **Create**.
5. Google shows a 16-character password like `abcd efgh ijkl mnop`.
   **Copy it now** — you can't see it again later.
   ⚠️ Treat it like a password: never paste it in chat, never commit it to
   the repo. Save it in your password manager.

## Part 2 — Plug it into Supabase (3 min)

1. Open the Supabase dashboard → select the **Poffu** project.
2. Go to **Authentication → SMTP Settings**
   (on some dashboard versions it's under **Project Settings → Auth** —
   same settings page either way).
3. Turn ON **"Enable custom SMTP"**. This is the important toggle — without
   it Supabase keeps using its own email and templates stay locked.
4. Fill in exactly:
   | Field          | Value                                  |
   |----------------|------------------------------------------|
   | Host           | `smtp.gmail.com`                         |
   | Port           | `587`                                    |
   | Username       | your full Gmail address                  |
   | Password       | the 16-character app password from Part 1|
   | Sender email   | the same Gmail address                   |
   | Sender name    | `Poffu`                                  |
5. Click **Save**.

## Part 3 — Paste the branded template (2 min)

Template editing is unlocked now.

1. Still in the dashboard: **Authentication → Email Templates → Confirm signup**.
2. Open the file `confirm-signup-email.html` in the repo root, copy the
   **entire** file, paste it into the **Message body** field, **Save**.
3. Suggested **Subject** line: `Your Poffu verification code: {{ .Token }}`

## Part 4 — Test it end to end

1. In the Poffu app, log out (Settings → Log out) so you're back at onboarding.
2. Continue with Email → use a **fresh** email address (one that has never
   signed up — a used address just signs in with no email sent).
3. Set any 6+ character password → Continue.
4. The app morphs to the 6-digit code screen. Check that inbox (and spam
   folder the first time). The code should arrive within a minute.
5. Enter the code → you're in.

## Troubleshooting

- **"Authentication failed" / SMTP error on save:** the app password is
  wrong or has spaces — copy it fresh from
  https://myaccount.google.com/apppasswords (remove spaces when pasting).
  If it still fails, revoke it there and create a new one.
- **No app-passwords page / option missing:** 2-Step Verification must be
  ON first (Part 1, step 2). Some Workspace/child accounts can't create app
  passwords at all — use a personal Gmail.
- **Email not arriving:** check spam first. Gmail allows ~500 sends/day;
  Supabase's own old limit no longer applies once custom SMTP is on.
  Supabase dashboard → Authentication → Logs shows send errors.
- **Template edits not taking effect:** make sure the "Enable custom SMTP"
  toggle (Part 2, step 3) is actually ON, and that you clicked Save on the
  template page.
- **Want a professional from-address later** (e.g. `noreply@yourdomain`):
  that's when you switch this same SMTP page to Resend with a verified
  domain. Same fields, different host/user/pass.

## When you're done

- [ ] App password created and stored in password manager
- [ ] Custom SMTP enabled + saved in Supabase
- [ ] Template pasted, subject set
- [ ] Fresh-email signup test: code received and verified in-app
