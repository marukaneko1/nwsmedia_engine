# Mail-tester — Fixes for nwsmediaemail.com (Google Workspace)

You’re sending from **Google** (maru@, general@, info@). Mail-tester reported **7.8/10** — fix SPF and DMARC to get to ~10/10.

---

## 1. SPF — Allow Google to send for your domain

**Problem:**  
`nwsmediaemail.com does not allow your server 209.85.208.179 to use maru@nwsmediaemail.com`  
Your domain has no SPF record (or it doesn’t include Google), so receiving servers don’t trust your mail.

**Fix:** Add one SPF TXT record for the root of your domain.

1. In your DNS (wherever **nwsmediaemail.com** is managed — e.g. Namecheap, Google Domains, Cloudflare):
   - Go to **DNS** / **Advanced DNS** for `nwsmediaemail.com`.
2. Add (or edit) a **TXT** record:
   - **Host / Name:** `@` (or leave blank for root)
   - **Value:**
     ```text
     v=spf1 include:_spf.google.com ~all
     ```
3. Save. Wait 15–60 minutes (up to 48h for full propagation).
4. Send another test from **maru@nwsmediaemail.com** (or general@ / info@) to the mail-tester address and re-check the score.

**If you later send from another service** (e.g. Instantly, Mailchimp), add its include before `~all`, for example:
```text
v=spf1 include:_spf.google.com include:other-service.com ~all
```

---

## 2. DMARC — Policy and reporting

**Problem:**  
“You do not have a DMARC record” — some receivers use this for trust and placement.

**Fix:** Add one DMARC TXT record.

1. In the same DNS panel for **nwsmediaemail.com**:
2. Add a **TXT** record:
   - **Host / Name:** `_dmarc` (some panels want `_dmarc.nwsmediaemail.com`)
   - **Value (start with monitoring only):**
     ```text
     v=DMARC1; p=none; rua=mailto:maru@nwsmediaemail.com
     ```
     This means: “Don’t reject or quarantine yet; send aggregate reports to maru@nwsmediaemail.com.”
3. Save. Propagates like SPF.

After a few weeks, if everything looks good, you can tighten to `p=quarantine` (or later `p=reject`) if you want. For now `p=none` is fine and gets you the “DMARC present” check on mail-tester.

---

## 3. Optional improvements (for later)

- **HTML obfuscation (-1.162):** Mail-tester said “10% to 20% HTML obfuscation.” Sending plainer HTML (or more plain text) can help. Not critical for 7.8 → 10.
- **List-Unsubscribe:** If you do cold email at scale, some providers like Gmail expect a `List-Unsubscribe` header. You can add this when you send via an ESP (e.g. Instantly) that supports it.
- **SPF HELO:** “HELO does not publish an SPF Record” is a minor check; fixing SPF for the domain (step 1) is what matters.

---

## After you fix

1. **SPF:** Add `v=spf1 include:_spf.google.com ~all` for `@`.
2. **DMARC:** Add `v=DMARC1; p=none; rua=mailto:maru@nwsmediaemail.com` for `_dmarc`.
3. Wait ~1 hour (or up to 24h if your DNS is slow).
4. Send one more test from **maru@** (or general@ / info@) to the unique address on [mail-tester.com](https://www.mail-tester.com/).
5. Open the report again — you should see “You’re properly authenticated” and a DMARC line; score should be close to 10/10.

Your DKIM is already valid (Google handles that for Workspace), so no change needed there.

---

## Quick reference — DNS for nwsmediaemail.com

| Type | Host   | Value |
|------|--------|--------|
| TXT  | `@`    | `v=spf1 include:_spf.google.com ~all` |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:maru@nwsmediaemail.com` |

Use **general@** or **info@** in `rua=mailto:...` if you prefer to receive DMARC reports there.
