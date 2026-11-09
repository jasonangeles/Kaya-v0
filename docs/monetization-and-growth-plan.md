# Kaya: Monetization, Features & Content Plan

*Living document. Started November 8, 2026. Reference app reviewed: Worth it (getworthit.com).*

---

## 1. What Worth it is, and what it isn't

Worth it (Maxime Mazzone, Mazzone Apps) is the closest thing to Kaya on the market. It's worth knowing exactly how it positions itself, because its messaging is very disciplined.

**What it says it is**
- A *manual* net worth tracker: you type in totals, once a month.
- "No budgeting. No bank connection." It repeats this everywhere: hero, FAQ, App Store, blog.
- A *calm* monthly check-in: "one clear number", "a calmer view of your money".
- For people with money spread across banks, pensions, property, crypto and vehicles.

**What it says it isn't**
- Not a budgeting app (no categories, no transactions, no "explain your coffee").
- Not bank-sync (positioned as a privacy and reliability benefit, not a missing feature).
- Not daily "finance homework".

**Takeaway for Kaya:** we already say "no bank logins". We should borrow the *discipline* of the message: always say what Kaya is **and** what it isn't, in the same breath.

> Kaya is: one number for money spread across countries and currencies.
> Kaya isn't: a budget, a bank connection, or another app that judges your spending.

**Where Kaya is genuinely different (lean into these)**

| Kaya | Worth it |
|---|---|
| Built for money in **several countries** (PH + CA + crypto) | Multi-currency is a feature, not the story |
| **Passive income** tracking (dividends, interest) | Not a focus |
| **Liquid vs locked** view (what can I reach this week?) | Not present |
| Web app (PWA) **and** iOS planned, works offline | iOS / Mac / Android native |
| Filipino and global-Filipino audience: real PH banks and logos | Generic, UK/EU leaning |
| Free core today | Free tier is heavily limited (see the reviews below) |

---

## 2. Feature ideas worth "spinning" from Worth it

Ordered by value for effort. ✅ = Kaya already has it.

| Idea | What it is | Kaya spin | Free or Plus |
|---|---|---|---|
| Monthly **Check-in flow** | A guided list: "these balances may be stale, confirm or update" | "Kaya check-in": 2-minute monthly ritual + streak (we already have streaks) | Free |
| **Market vs Money** | How much growth came from markets vs your own contributions | "Did *you* grow it, or did the market?" Great social content too | Plus |
| **Milestones** with projected date | Next milestone, % progress, estimated date | Milestones in PHP *and* your home currency ("₱2M by March") | Free (1), Plus (unlimited) |
| **Year-end Recap** ("Wrapped") | A story of your year | **Kaya Year in Review**: shareable cards, privacy-safe (percentages only). Big viral moment every December | Free (it's marketing) |
| **Privacy share mode** | Hide amounts, keep % and charts when sharing | "Share your progress" cards for Instagram and TikTok, no amounts shown. ✅ hide-amounts exists, extend to share cards | Free |
| **Home screen widget** | Net worth on the home/lock screen | iOS app only (not possible for a PWA) | Plus |
| **Spreadsheet import** | Start from Excel/CSV | ✅ CSV import exists, add a template + "move from your spreadsheet" guide | Free |
| **All-time highs / month-over-month** | Small indicators per asset | Cheap to add, makes the app feel alive | Free |
| **Investment performance (TWR)** | Real returns excluding deposits | Later, power-user feature | Plus |
| **Tags & notes** | Group accounts freely ("Retirement", "Kids") | Useful for families and OFWs ("Pera ni Nanay") | Free |
| **Use without login** | Start without an account | Lowers sign-up friction. Kaya could allow local-only mode, account only for sync | Free |
| **Localization** | French for them | **Filipino/Taglish** copy option for Kaya | Free |

**Kaya-only ideas (no competitor has these)**
- **Remittance view:** "How much can I send home this month?" uses the liquid balance plus the FX rate.
- **Family / household:** shared view with a partner or parents (paid tier candidate).
- **AI coach** (already on your list): local or private, explains your month in plain words. Clear Plus feature because it has a real running cost.

---

## 3. How Worth it makes money (and what it teaches)

From the App Store listing (US, November 2026):
- Free to download, with in-app purchases.
- **Monthly Premium $4.99**, **Yearly Premium $24.99** (with free trial).
- **Lifetime "Membership" $44.99–$59.99** (one-time).
- Premium unlocks "unlimited assets and insights", so the free tier limits how many assets you can add.
- About **20 ratings** in the US store after several years: a small, loyal niche, not a mass-market app.

The most useful review, from an unhappy user:
> "Looks ok but with the paywall, the free version is pretty useless. Not good enough to move my spreadsheet over yet."

**Lesson:** limiting the *core* (number of assets) makes the free version feel broken, and people go back to spreadsheets. Kaya should keep the core unlimited and charge for *extras*.

---

## 4. Their blog and social: what to take from it

The three blog posts ("How I track my net worth manually", "Net worth tracking for anxious people", "A simpler YNAB alternative") are written for **search and AI answers**: question-style headings ("What app tracks net worth with manual entry?"), comparison tables, FAQs, and the product name repeated in the answers. You're right that they're SEO first, but the *ideas* in them are good, and they translate directly to short social posts.

*(The Instagram account couldn't be loaded here, since Instagram blocks automated access. Send screenshots of the 8 posts if you want them analysed.)*

**Repurpose as Kaya social posts (carousels / reels)**
1. "Net worth = what you own − what you owe." The one-slide explainer.
2. "Your 5-minute monthly money check-in" (step-by-step reel in the app).
3. "Money anxiety? Start with one number." (calm, gentle tone; their best-written post).
4. "Budget apps vs net worth trackers: which one are you?" (comparison carousel).
5. "Pesos, dollars, sats: how to see it all in one total." (Kaya's unique angle).
6. "Liquid vs locked: could you reach your money in an emergency?"
7. "Did you grow your money, or did the market?" (once Market vs Money exists).
8. "Why Kaya will never ask for your bank login." (privacy trust post).
9. "OFW edition: tracking money in two countries." (community and niche).
10. December: "Your year in money" Recap template (UGC driver).

**Later, for search (low effort):** one landing page per question people actually search, e.g. *"net worth tracker Philippines"*, *"track money in multiple currencies"*, *"manual net worth tracker no bank sync"*. Each page is a short version of the matching social post.

---

## 5. Monetization models: honest assessment

| Model | Pros | Cons | Verdict |
|---|---|---|---|
| **Donations only** (tip jar / Ko-fi) | Zero friction, good karma, fits "privacy-first, no ads" | Only a small fraction of users ever give. Unpredictable. Hard to justify ongoing work. | ❌ Not alone. ✅ OK as a *small extra* early on |
| **Patreon-style supporter** | Feels generous, community vibe | Same economics as donations unless it unlocks something | ✅ as the *tone* of a paid tier, not a separate platform |
| **Freemium + "Kaya Plus" subscription** | Predictable income. Free core keeps growth going. Industry standard for finance apps. | Must keep the free version genuinely good. Subscription fatigue. | ✅ **Recommended main model** |
| **Lifetime unlock** (one-time) | Answers "I hate subscriptions". Good early cash. Honest if the app ever "finishes". | Lifetime users never pay again, so price it at about 2–3 years of yearly | ✅ **Offer alongside the subscription** |
| **Paywall from day one** | Filters for serious users, higher revenue per user | Kills growth for a new, unknown app. Worth it's own reviews show the backlash. | ❌ Not for Kaya now |
| **Referral rewards** (months of Plus) | Turns users into marketers, which matches your social strategy | Needs Plus to exist first. Watch for abuse. | ✅ **Phase 3** |
| **Ads / selling data** | – | Destroys the privacy promise | ❌ Never |

### On the "lifecycle" worry
It's a real and healthy question. Two honest points:
1. **Subscriptions pay for ongoing costs, not just new features.** Sync, backups, live FX and crypto rates, an AI coach and support all cost money every month, so charging monthly stays fair even when feature work slows down.
2. **A "finished" app is fine.** Many great apps reach a stable state and move to maintenance and polish. That's exactly when a **lifetime option** is the honest choice, and when you can evolve (household plan, advisor export, new countries) or start the next product. You don't owe anyone endless features; you owe them reliability and their data.

---

## 6. Recommended plan

### Phase 1 · Now (PWA, growing to the first ~1,000 users)
- Keep Kaya **free**. No paywall.
- Add a soft **"Support Kaya"** option in Settings (tip jar, e.g. Ko-fi or Stripe Payment Link). Copy: *"Kaya is free and ad-free. If it helps you, you can chip in to keep it running."* Expect little money; the real value is signal (who cares enough to pay).
- Ship the habit features: **Check-in flow, Milestones, Share cards, Year in Review** (all free; they drive growth).
- Grow the email list (consent system is done) and post on social weekly.

### Phase 2 · iOS launch: "Kaya Plus"
- Free forever: unlimited accounts, all currencies, history, passive income, liquidity, backup/export, lock.
- **Kaya Plus** (positioned as *"support Kaya + get the extras"*):
  - AI money coach, Market vs Money, investment performance
  - Home and lock screen widgets
  - Custom themes (the color themes we built and hid)
  - Unlimited milestones, advanced insights, early access to new features
- **14-day free trial**.
- **Suggested pricing** (validate before launch):
  - Philippines: ₱99/month · ₱799/year · ₱1,990 lifetime
  - Canada / US: $3.99/month · $24.99/year · $49.99 lifetime
- On iOS, digital upgrades must use Apple's in-app purchase (Apple takes 15% under its Small Business Program). On the web, use Stripe. Supabase stores the "plus" flag for both.

### Phase 3 · Growth loops
- **Referrals:** both people get 1 month of Plus when a friend signs up and does a first check-in.
- **Year in Review** every December, built to be shared.
- **Household plan** (two people, one shared view) as a higher tier.

### Before taking any money
- Register the business (you planned to do this once there are paying customers; do it just *before* turning payments on).
- Add Terms of Service and a refund policy, and update the privacy policy with the payment providers (Stripe and/or Apple).
- Set up sales tax collection (Stripe Tax handles GST/HST and others; Apple handles it on iOS).
- *Not legal or tax advice. Check with an accountant when you get there.*

---

## 7. Future vertical: AI finance coach (parked idea)

*Noted November 8, 2026. Reference: cfosilvia.com (an AI finance assistant built on its own model).*

Once Kaya has an engaged user base, a **finance coach** could grow into its own product line, not just a Plus feature.

- **Why Kaya is well placed:** users already keep a monthly picture of everything they own and owe, across countries. That's the context a coach needs, without bank linking.
- **How it could start:** the in-app AI coach in Kaya Plus (Phase 2) answers "explain my month", "am I on track for my milestone?" and "how much can I safely send home?".
- **How it could grow:** a standalone coaching tier or app, with deeper planning (goals, retirement, OFW return planning), check-ins, and possibly human-reviewed advice later.
- **Guardrails to keep:**
  - **Privacy first:** keep it opt-in, minimise the data sent, and consider an on-device or private model.
  - **Education, not regulated advice:** check the licensing rules in Canada and the Philippines before giving personalised investment advice.
  - **Keep trust:** never sell data or push financial products for commission.

---

## 8. My honest take

- **Don't rely on donations.** Keep a tip jar early because it's kind and cheap to add, but plan for **freemium + Plus + lifetime**. It's the model that fits a privacy-first finance app with real running costs.
- **Never paywall the core.** Worth it's biggest complaint is exactly that. Kaya's free version should be the best free net worth tracker for multi-country money. Plus is for extras and for supporting the app.
- **Your edge isn't features, it's the audience.** Filipinos (and other families) with money in more than one country are underserved. Every feature, post and price should speak to them first.
- **Monetize after habit.** People pay for an app they already open every month. Ship the check-in, milestones and recap first, then introduce Plus with the iOS launch.
