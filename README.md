# REPS Scaling OS

Client dashboard for REPS: a leads pipeline, websites and pre-registration pages, launch emails and meetings for each client, plus the agency side for the REPS team.

Built with Next.js (React) and runs entirely on Cloudflare: Workers for hosting, D1 for the database and R2 for photos. The code lives on GitHub.

## Two modes

- **Example mode** (the default): the dashboard runs in the browser with the starting clients only (Physique X, Dailey Demolition, Shape Up with Gabby, Berri and Lean Body Academy, with their websites at the latest commit when the preview was built). Nothing is saved and anything you change resets when the page reloads. Good for a preview link.
- **Live mode**: real logins and data saved in Cloudflare D1. The deployed dashboard is always live; only the single-file preview uses example data.

## View it on GitHub Pages (no Cloudflare needed)

The `docs` folder holds the whole dashboard on example data as plain web pages. In the GitHub repo go to **Settings > Pages**, choose **Deploy from a branch**, pick your main branch and the `/docs` folder, and save. After a minute it's at `https://<your-username>.github.io/<repo-name>/`, with the onboarding form on its own at `.../onboarding.html`.

It's view-only example data: nothing is saved and it resets when the page reloads. After changing the code, run `npm run preview` to refresh `docs`.

## Put it online (GitHub + Cloudflare)

### 1. Preview link with example data

1. Push this folder to a GitHub repo (private is fine).
2. In the Cloudflare dashboard go to **Workers & Pages > Create > Import a repository** and pick the repo.
3. Set the **Build command** to `npx opennextjs-cloudflare build` and the **Deploy command** to `npx opennextjs-cloudflare deploy`. Leave the rest as it is.
4. Deploy. You get an address like `dashboard.<your-account>.workers.dev`, and every push to GitHub redeploys it.

The first deploy also creates the D1 database (`reps-scaling-os`) and the R2 bucket (`reps-scaling-os-uploads`) listed in `wrangler.jsonc`. In example mode they sit unused.

### 2. Switch on live mode

In the Worker's **Settings**:

1. Under **Variables and Secrets**, add:
   - `ADMIN_EMAILS`: the agency login's email (e.g. `james@fitpreneuragency.com`). It sees the agency side and every client account.
   - `ADMIN_PASSWORD` (as a secret): the agency login's password. At least 10 characters; a few random words works well.
   - `RESEND_API_KEY` and `EMAIL_FROM`: sign-in and invite emails are sent through [Resend](https://resend.com). Verify your domain there first, then use an address on it, e.g. `REPS <hello@fitpreneuragency.com>`.
   - `ANTHROPIC_API_KEY` (from console.anthropic.com): Claude writes the sites, pre-reg pages, emails, amends and voice profiles. Without it, standard wording drawn from the answers is used.
   - `APP_URL` (optional): your dashboard's address, used in emailed links. Set it once you add a custom domain.
2. Redeploy (push to GitHub, or **Deployments > Retry**).

The app creates its own database table the first time it runs, so there's no SQL to run. The first time an admin signs in, it adds the starting clients in `lib/starter.ts` (Physique X, Dailey Demolition, Shape Up with Gabby, Berri and Lean Body Academy), connects each website to its GitHub repo and pulls the latest commit. Open the dashboard and sign in with the agency email and password. Then give clients their own logins in **Agency > Logins**.

If emails aren't set up yet, sign-in links are written to the Worker's logs instead (**Workers > your worker > Logs**), so you can still get in while testing.

### 3. Custom domain

In the Worker's **Settings > Domains & Routes**, add e.g. `app.repsscaling.com`. If the domain's DNS is already on Cloudflare this takes a minute. Then set `APP_URL` to it.

## How logins work

Everyone signs in on the home page with an email and password.

- **Agency login:** the email in `ADMIN_EMAILS` with the `ADMIN_PASSWORD` secret. Full access to the agency side and every client account.
- **Client logins:** made in **Agency > Logins**. Add their name, email and a password (or press **Make one**), and tick the client accounts they can see, e.g. Kate Dailey with Dailey Demolition only. A client login only ever sees the accounts ticked. Edit a login to change its accounts or set a new password; remove it to stop them signing in.
- Passwords are stored only as salted PBKDF2 hashes. After 8 wrong passwords for one email, sign-in for that email pauses for 15 minutes.
- Sessions last 30 days in a secure, HttpOnly cookie.

The emailed sign-in links below still work for invites (when you send a client their website or emails), so a client without a password can still get in that way.


- No passwords. People type their email and get a one-time sign-in link that expires in 30 minutes. Sessions last 30 days.
- REPS admins are the emails in `ADMIN_EMAILS`.
- Clients get their login when you press **Send to client** on their website or emails. They're emailed a sign-in link (valid 7 days) and only ever see their own account.
- Who can see and change what is checked on the server for every action (`lib/backend/core.ts`). Clients never see drafts, versions waiting for REPS approval, other clients, or the agency side.

## Work on it on your computer

```bash
npm install
npm run dev            # example mode at http://localhost:3000
```

To try live mode locally, copy `.env.example` to `.dev.vars`, then run `npm run cf:local`. This runs the real Cloudflare Worker with a local database and bucket. Sign-in links appear in the terminal.

## New client onboarding

Onboarding happens in two parts.

**1. The client fills in the intake form** at `https://<your-dashboard>/onboarding` (REPS admins also have **Client intake form** in the sidebar). It only asks about them and their brand: contact details, address, time zone, their domain, brand, audience, results and reviews, story and photos. When they submit it:

- their sub account is created straight away,
- their answers are saved (Agency · Onboarding shows them),
- Claude writes the first design of their website with their branding and saves it as **"Client Name - Website Page.html"** for the team to review in the **CRM - Website Designs** Claude Project (see *Website designs in Claude* below). Nothing appears in the client's Website section until the final design is committed to their site repo. It uses the look they picked on the form (Arena, Studio or Pulse; "Not sure" picks by headline style: serif goes Studio, condensed goes Arena, bold goes Pulse), with the pricing section marked "to be added" until the launch setup is built.

**2. The REPS team fills in the launch setup** in **Agency · Launch setup**, which lists every sub account still waiting (with a count in the sidebar). It holds the offer and pricing, features and app screenshots, programmes, the free guide, and the app launch (date, website link, pre-reg offer and code). **Save** as you go; **Save and build launch** then:

- rewrites the website with the offer and pricing, and adds the pre-registration page,
- writes both launch email sequences (in the client's voice if their calls are in),
- updates drafts in place. If the client has already seen something, the website gets a new version waiting in Approvals, and the emails keep their copy but take the new date, link and code.

To have Claude write the copy, add `ANTHROPIC_API_KEY` in Cloudflare. Without it, standard wording drawn from the answers is used. Claude is told to use only facts from the form, so it never invents member counts, reviews or results.

### Website designs

- **Arena** (`components/site/ArenaSite.tsx`, `arena.css`). Black, loud and athletic, after Centr, Ladder and Physique X: huge capitals with a highlighter bar, a light grid that moves behind the hero, a stage of five phones whose screens scroll, a numbered feature list beside a phone that follows along, poster programmes that reveal details on hover, a drag-to-compare before and after, and a striped closing band.
- **Studio** (`components/site/StudioSite.tsx`, `studio.css`). Light, warm and editorial, after Lean with Lilly, Harriet Harper, Sweat and Shreddy: italic serif accents, soft shapes that drift and change shape behind the hero, arch photos, floating feature chips, a turning text badge, numbers in circles, features around a central phone, and a moving row of phones whose screens scroll.
- Arena and Studio share `components/site/kit.tsx` and `kit.css` (phones, marquees, counters, scroll reveals, the email sign-up).
- The REPS team can switch a generated site between looks from the **Website look** panel in Website. A draft changes straight away; a site the client has seen gets a new version in Approvals. Rebuilding the launch keeps the chosen look.
- **Pulse** (`components/site/PulseSite.tsx`, `pulse.css`). Inspired by EvolveYou, Ladder, Sweat, Centr, Shreddy and similar app-launch sites: a dark campaign hero with a slowly moving glow in the brand colours, phones whose screens scroll through the app, a feature showcase where the phone follows the feature you're on, marquees for highlights and reviews, numbers that count up, and hover effects on buttons, cards, photos and plans. Without app screenshots the phones show a stand-in app screen built from the feature names. Motion switches off for people who ask their device for less motion.
- **Shape Up** (`TemplateSite.tsx`, `template.css`), the original design. Sites saved before Pulse keep it.

Both draw from the same `SiteSpec` (`lib/site/spec.ts`), so comments, amends and approvals work the same on either.

## Launch: pre-registration page and emails

Most clients follow the same path: buy the Reps app, complete onboarding, get a pre-registration page, then a website that sells the app. The form's **Your app launch** step asks for the launch date, website address, pre-registration offer and code, how long the offer stays open (4, 5 or 7 days) and the size of their email list.

**Pre-registration page** (`components/site/PreRegSite.tsx`, `lib/site/prereg.ts`): the same look as their site, with a launch countdown and a name, email and phone form. It posts to `/api/forms` with `source: "prereg"`, so sign-ups land in Leads as **Pre-reg page** and are added to the client's pre-reg group in MailerLite.

**Two 6-email sequences** (`lib/emails/`), written by Claude in the client's tone from their answers:

| | Pre-registration list | General email list |
|---|---|---|
| Who | People who signed up on the pre-reg page | Everyone else on their list |
| Emails 1 and 2 | Warm-ups, 7 and 3 days before launch | Same |
| Emails 3 to 6 | Launch day, day 2, then the last two days of the offer, each with a button to the website | Same days |
| Price | The launch offer and code | Full price, never a discount |

Send times are worked out from the launch date (`lib/emails/schedule.ts`), so changing the date in **Agency · Emails** moves every email and the countdown.

**Client Emails section** (`/emails`): read each email as it will look in the inbox, click any line (subject, preview text, heading, a paragraph, the button) to comment, then **Request changes** or **Approve emails**. It works like the website: Claude makes a revised version from the comments, it waits for REPS approval, then the client sees it.

**Agency Emails** (`/agency/emails`): every client's launch status, launch date, pre-reg sign-ups, next send and MailerLite state. Open a client to approve or reject a revision, **Edit emails** directly (in a draft the edit is saved in place; after the client has seen them it becomes a new version for you to approve), change the launch date, website link and code, or retry MailerLite scheduling.

### MailerLite

When the client approves, `lib/server/mailerlite.ts` creates each email as a MailerLite campaign and schedules it for its send time. Each client has their own MailerLite account: open the client in **Agency · Emails** and press **Connect MailerLite** to add their API key, sender and group IDs. The key is stored on the server and never shown again.

- The from email must be a verified sender in their MailerLite account.
- MailerLite can't exclude a group from a campaign, so for the general list create a segment "in general group and not in pre-reg group" and use its id. Without one, the general group is used.
- Sending our designed HTML needs MailerLite's Advanced plan (tick **Send our email design**). On other plans the campaigns are created with the subject only, for the team to paste the content in MailerLite's editor.
- Without settings, approval still works and the email shows **Not connected** in Agency · Emails, with a **Schedule in MailerLite** button for once it's set up.

This has been written against MailerLite's API docs but not yet tested on a real account, so try it on a test client first.

## Meetings (Google Meet transcripts)

Every client call lands in the CRM from Google Meet's Gemini notes and transcripts.

- **Client accounts** (`/meetings`): a full history of their calls with REPS. Each call shows the summary, details and next steps, plus the whole transcript, which can be searched.
- **Agency · Meetings** (`/agency/meetings`): every call. Calls are matched to a client by attendee email, then by the client's name in the call title. Calls that don't match wait under **Not matched**. Assigning one also remembers that person's email, so their next calls match on their own. You can hide a call from the client (e.g. internal sales notes), delete one, or **Add a call** by pasting notes or a transcript.
- **Client voice**: each client gets a voice profile built from their calls, covering how they talk, phrases they use and things to avoid. It rebuilds after every new call, and you can edit it. It feeds into their launch emails and email amends, and **Rewrite emails in this voice** in Agency · Emails rewrites all 12 as a new version for you to approve. If someone had a call with you before onboarding (e.g. the sales call), it moves into their new account when they submit the form, and their emails are written in their voice from the start.

### Tasks from calls

When a call comes in for a client, Claude pulls out the actions agreed on it (falling back to Gemini's "Suggested next steps" without Claude). They land in **Agency · Tasks** under **To review**, grouped by call, with the likely owner outlined.

- Click **Sam, Alyza, James, Client or AI** to assign a task, or **Dismiss** it. You can edit the wording first.
- Assigned tasks move to **Open**, where you can filter by person or client, set due dates, reassign and tick them off.
- Tasks assigned to **Client** appear in the client's own **Tasks** section, where they can tick them off. You see that straight away.
- **Find tasks** on a call in Agency · Meetings pulls tasks from it again (e.g. a call added before tasks existed). **+ Add task** adds one by hand.
- Tasks for **AI** are listed for now. Having Claude carry them out is a next step.

The team names live in `lib/tasks/types.ts`.

### Setting up the sync

1. In Cloudflare, add `MEETINGS_SECRET` (any long random string) and `REPS_EMAIL_DOMAINS` (e.g. `fitpreneuragency.com`, so your own team never matches as a client).
2. For each team member who hosts client calls: open script.google.com, start a new project, paste in `integrations/google-meet/Code.gs`, fill in the dashboard URL and secret, then run **setup** once and allow the permissions.
3. In Google Meet, turn on **Take notes with Gemini** (and transcripts) for client calls. You can set them to start automatically from Google Calendar.

The script checks the **Meet Recordings** folder in Drive every 15 minutes and sends each new Gemini doc to `/api/meetings/ingest`, with the guest list from the matching Calendar event. The notes doc and the transcript doc for the same call are merged into one meeting.

Gemini note-taking needs a Google Workspace plan that includes Gemini in Meet.

### Working on the website designs

`lib/site/compose.ts` turns the answers and copy into a `SiteSpec`. To see a generated site in the preview, submit the Client intake form with **Fill with example answers**, then open the Website designs card in Launch setup.

## Websites updated from Claude (GitHub)

A client's website can live in its own GitHub repo, e.g. `repshealth/physique-x-site`, holding the site as plain, self-contained HTML files (`index.html` is the homepage, one `.html` file per other page). Whenever the site is changed in Claude and pushed, the new version appears in the client's Website section, as real pages they can click through and pin comments on.

**Connect it:** open the client's **Website** as REPS, and under **Updates from Claude** press **Connect GitHub repo**. Enter the repo and branch, and choose whether updates wait for you in **Approvals** (the default) or go straight to the client. **Check for updates** pulls the latest version on demand.

**Make it automatic (live mode):** in Cloudflare add `GITHUB_WEBHOOK_SECRET` (any long random string), plus `GITHUB_TOKEN` if the site repos are private (a fine-grained token with read access to their contents). Then in the site repo on GitHub go to **Settings > Webhooks > Add webhook**:
- Payload URL: `https://<your-dashboard>/api/github`
- Content type: `application/json`
- Secret: the same `GITHUB_WEBHOOK_SECRET`
- Events: just the push event

**In the client's Claude project**, add this to the project instructions:

> This client's website lives in the GitHub repo repshealth/physique-x-site. Whenever you change the website, save it as plain, self-contained HTML (index.html for the homepage, one .html file per other page, CSS in the file, images as full https links) and push it to the main branch with a one-line commit message saying what changed. Don't push anything else to that repo.

The pages are shown in a locked-down frame, so their scripts can't touch the dashboard. Links and forms inside them don't navigate away from the preview.

## Agency side and approvals

REPS admins see an **Agency** section above the client account in the sidebar, with a dark top bar so it's always clear which side you're on. Client logins never see it.

- **Overview** (`/agency`): every client's leads in one report. KPIs, a table of clients (leads, calls, show rate, purchases, revenue, website status) and the combined pipeline. Use the client menu to focus on one client. Each row links straight into that client's Leads or Website.
- **Approvals** (`/agency/approvals`): website amends waiting for you, with a count in the sidebar.

How an amend works:

1. The client leaves pinned comments on their site and presses **Request changes**. Each comment records the section and words it was pinned on.
2. For sites built from the template, Claude reads the comments and edits the site's text (and colours or headline style if asked). It never changes photos or invents facts; anything it can't do is flagged as **Needs you**.
3. The revised version is saved as *pending*. The client still sees the old version with "your changes are with the REPS team".
4. In Approvals you see the revised and current versions side by side (changed words outlined), every change with the comment that asked for it, and anything that still needs a person.
5. **Approve and send to client** publishes the new version and the client can review and approve it. **Reject** discards it and shows the client your message instead.

Sites made from screenshots can't be edited automatically, so their change requests appear in Approvals as a checklist for the team.

Without `ANTHROPIC_API_KEY`, amends fall back to simple rules: comments that give the exact new wording in quotes (e.g. `Change this to "Home & gym plans"`) are applied, and everything else goes to Needs you.

## Preview without running anything

`npm run preview` builds `preview-dist/reps-scaling-os.html`: the whole app on example data in one file you can double-click. The onboarding form works there too, keeping everything in memory until you reload.

## Connect a website form

Point any form on a client's site at `https://<your-dashboard>/api/forms`:

```html
<form action="https://<your-dashboard>/api/forms" method="post">
  <input type="hidden" name="client" value="physique-x">
  <input type="hidden" name="source" value="magnet">        <!-- quiz, magnet, survey, ads or news -->
  <input type="hidden" name="form" value="Starter guide">
  <input type="hidden" name="page" value="/">
  <input type="hidden" name="_redirect" value="https://example.com/thank-you">
  <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
  <input name="name" placeholder="First name">
  <input name="email" type="email" required>
  <input name="answers[Main goal]" placeholder="Main goal">
  <button>Send it to me</button>
</form>
```

Or from JavaScript:

```js
fetch('https://<your-dashboard>/api/forms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client: 'physique-x', source: 'magnet', form: 'Starter guide', page: location.pathname,
    utm_campaign: new URLSearchParams(location.search).get('utm_campaign'),
    name, email, answers: { 'Main goal': goal },
  }),
});
```

A new email creates a lead in **New lead**. A repeat submission adds to that lead's timeline instead of creating a duplicate. Email is also how Calendly bookings and Stripe payments will be matched to leads.

## Project layout

```
app/
  (app)/leads, website, emails, meetings   Client account screens
  (app)/agency/...             Agency: overview, approvals, emails, meetings, onboarding answers
  login/                       Emailed sign-in link
  api/rpc/                     Every dashboard action (checked against who is signed in)
  api/auth/                    Sign-in links, sessions, sign out
  api/forms/                   Endpoint website and pre-reg forms post to
  api/upload/, api/files/      Onboarding photos in and out of R2
  api/meetings/ingest/         Google Meet notes and transcripts come in here
components/                    Screens, sidebar, top bar, shared state
lib/backend/                   core.ts (every action and its access rules), demo.ts (example data), live.ts (browser to /api/rpc)
lib/server/                    Cloudflare: D1 store, sign-in, Claude, MailerLite, emails
lib/starter.ts                 The clients the dashboard starts with (Physique X, Dailey Demolition, Shape Up with Gabby, Berri, Lean Body Academy)
lib/demo/*.json                Their latest website commits, for the preview
lib/site/                      Website and pre-registration page: specs, copy, amends
lib/emails/                    Launch emails: schedule, copy, amends, HTML for MailerLite
lib/meetings/                  Meetings: Gemini doc parser, client matching, voice profile
integrations/google-meet/      Apps Script that sends Gemini notes and transcripts to the CRM
migrations/                    The D1 table (also created automatically)
wrangler.jsonc                 Cloudflare settings: database and bucket
```

## Next steps

- **Calendly webhook** at `/api/calendly`: booked and cancelled calls move leads to Call booked. Webhooks need a paid Calendly plan on the client's account.
- **Stripe webhook** at `/api/stripe`: payments move leads to Purchased and fill in revenue.
- **MailerLite webhook**: opens and clicks move leads to Nurturing.
- Host each approved site at its own address from the same spec (e.g. `/s/<client>`), with its starter-guide form already posting to `/api/forms`.
- Email the REPS team when a new onboarding form arrives.
- Let REPS edit a website draft's wording in the dashboard before sending it (emails already have this), and upload a new photo from Approvals.
- Host the pre-registration page at its own address (e.g. `/p/<client>`), like the site.
- Email the client when a new version is sent, and REPS when changes are requested.
- Upload screenshot-based site versions (like Kieran's) from the dashboard. In live mode, sites currently come from the onboarding form.
- Rate limiting on the public endpoints (`/api/forms`, `/api/upload`, the onboarding form) before sending ad traffic to them. Cloudflare's own rate limiting rules can do this without code.
- Real date filtering behind "Last 30 days", plus manual "Add lead".


## Website designs in Claude

New clients' websites are reviewed and finished in the **CRM - Website Designs** Claude Project before anything shows in their Website section.

1. When a client submits the intake form, the dashboard renders their page as one standalone HTML file (`lib/site/render/`), named **"Client Name - Website Page.html"**. Building the launch later updates it and adds **"Client Name - Pre-registration Page.html"**.
2. Each file is stored for download and, when `DESIGNS_REPO` is set (e.g. `repshealth/website-designs`) with a `GITHUB_TOKEN` that can write to it, committed to that repo. Add the repo to the Claude Project once (Project knowledge, Add from GitHub) and sync it to pull in new designs.
3. In Agency, Launch setup, each client has a **Website designs** card: Preview, Download, Open in GitHub, and a Website look switcher that redraws the file.
4. When the design is right, commit the final page to the client's site repo, `repshealth/<client-slug>-site` by default (`SITES_GITHUB_OWNER` changes the owner), as `index.html` (and `pre-register.html`). The site is connected to that repo automatically. The first commit appears in the Website section straight away, for the REPS team only until you press Send to client.

For pushes to reach the dashboard without pressing Check for updates, add one webhook on the repshealth organisation (Settings, Webhooks) pointing at `/api/github` with the `GITHUB_WEBHOOK_SECRET`, so every client site repo is covered.

The exported pages work on their own: the moving parts (feature showcase, FAQ, counters, before and after slider, countdown, forms) run from a small script in `lib/site/render/runtime.js`, and forms post leads to `/api/forms`. `npm run renderer` rebuilds `renderer.gen.js` after changing a design; `npm run build` and `npm run preview` do it automatically.

## Lead sources and answers

- **Source filters on the Leads board** come from the client's own forms. When a site is synced from GitHub, the dashboard reads its pages for the forms that send leads (a `form: '…'` name in the page's script, a `data-form` attribute, or a hidden `form` input), so a new form shows as a filter as soon as it's committed, before its first lead. Forms that leads have come through are added too, with a count each.
- **Answers are kept per form.** A lead who does the quiz and then the calorie calculator shows two blocks in their details, one per form with its date, and a lead shows under each form's filter they've used.

## Stripe (payments and revenue)

Each client's Stripe account can send payment updates to `/api/stripe/<client-slug>`, e.g. `/api/stripe/physique-x`.

- **Set up:** open the client's **Leads** page as the agency and press **Stripe**. Give the client the webhook address shown there, with these events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`. Paste the signing secret (`whsec_…`) they send back and save.
- **What it does:** each payment is matched to a lead by email (or Stripe customer) and moves them to Purchased with their total paid, plan, subscription status, monthly value and renewal date. Refunds and cancellations update it. People who pay without filling in a form are added as new leads with the source Stripe. The Revenue box shows the total and the monthly recurring revenue from active subscriptions.
- **Past payments:** add a read-only restricted key (`rk_live_…`, with read access to Customers, Charges and Subscriptions) and press **Import past payments**. It recalculates totals, so it's safe to run again.
- Events are signature-checked with the client's own secret, and each event is only applied once. Until the secret is saved, the address accepts events and ignores them, so Stripe doesn't report errors during setup.
