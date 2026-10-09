# REPS Scaling OS

Client dashboard for REPS: a leads pipeline, websites and pre-registration pages, launch emails and meetings for each client, plus the agency side for the REPS team.

Built with Next.js (React) and runs entirely on Cloudflare: Workers for hosting, D1 for the database and R2 for photos. The code lives on GitHub.

## Two modes

- **Example mode** (the default): the dashboard runs on built-in example data in the browser. Nothing is saved and anything you change resets when the page reloads. Good for a preview link.
- **Live mode**: real logins and data saved in Cloudflare D1. Switched on with the build variable `NEXT_PUBLIC_LIVE=true`.

## View it on GitHub Pages (no Cloudflare needed)

The `docs` folder holds the whole dashboard on example data as plain web pages. In the GitHub repo go to **Settings > Pages**, choose **Deploy from a branch**, pick your main branch and the `/docs` folder, and save. After a minute it's at `https://<your-username>.github.io/<repo-name>/`, with the onboarding form on its own at `.../onboarding.html`.

It's view-only example data: nothing is saved and it resets when the page reloads. After changing the code, run `npm run preview` to refresh `docs`.

## Put it online (GitHub + Cloudflare)

### 1. Preview link with example data

1. Push this folder to a GitHub repo (private is fine).
2. In the Cloudflare dashboard go to **Workers & Pages > Create > Import a repository** and pick the repo.
3. Set the **Build command** to `npx opennextjs-cloudflare build` and the **Deploy command** to `npx opennextjs-cloudflare deploy`. Leave the rest as it is.
4. Deploy. You get an address like `reps-scaling-os.<your-account>.workers.dev`, and every push to GitHub redeploys it.

The first deploy also creates the D1 database (`reps-scaling-os`) and the R2 bucket (`reps-scaling-os-uploads`) listed in `wrangler.jsonc`. In example mode they sit unused.

### 2. Switch on live mode

In the Worker's **Settings**:

1. Under **Build > Variables**, add `NEXT_PUBLIC_LIVE` = `true`. This is read when the app is built.
2. Under **Variables and Secrets**, add:
   - `ADMIN_EMAILS`: your REPS team emails, comma separated. These people can always sign in and see the agency side.
   - `RESEND_API_KEY` and `EMAIL_FROM`: sign-in and invite emails are sent through [Resend](https://resend.com). Verify your domain there first, then use an address on it, e.g. `REPS <hello@fitpreneuragency.com>`.
   - `ANTHROPIC_API_KEY` (from console.anthropic.com): Claude writes the sites, pre-reg pages, emails, amends and voice profiles. Without it, standard wording drawn from the answers is used.
   - `APP_URL` (optional): your dashboard's address, used in emailed links. Set it once you add a custom domain.
3. Redeploy (push to GitHub, or **Deployments > Retry**).

The app creates its own database table the first time it runs, so there's no SQL to run. Sign in at `/login` with an admin email and you'll get a link by email.

If emails aren't set up yet, sign-in links are written to the Worker's logs instead (**Workers > your worker > Logs**), so you can still get in while testing.

### 3. Custom domain

In the Worker's **Settings > Domains & Routes**, add e.g. `app.repsscaling.com`. If the domain's DNS is already on Cloudflare this takes a minute. Then set `APP_URL` to it.

## How logins work

- No passwords. People type their email and get a one-time sign-in link that expires in 30 minutes. Sessions last 30 days.
- REPS admins are the emails in `ADMIN_EMAILS`.
- Clients get their login when you press **Send to client** on their website or emails. They're emailed a sign-in link (valid 7 days) and only ever see their own account.
- Who can see and change what is checked on the server for every action (`lib/backend/core.ts`). Clients never see drafts, versions waiting for REPS approval, other clients, or the agency side.

## Work on it on your computer

```bash
npm install
npm run dev            # example mode at http://localhost:3000
```

To try live mode locally, copy `.env.example` to `.dev.vars`, then run `NEXT_PUBLIC_LIVE=true npm run cf:local`. This runs the real Cloudflare Worker with a local database and bucket. Sign-in links appear in the terminal.

## New client onboarding

Send new clients to `https://<your-dashboard>/onboarding` (REPS admins also have a **New client form** link in the sidebar).

When a client submits it:

1. A new account is created in the dashboard, named after their business.
2. Their answers are saved (table `onboarding_submissions`) and their logo and photos go into the `client-uploads` bucket.
3. Claude writes, in parallel: the website copy, the pre-registration page, and both launch email sequences (see below). The site and pre-registration page are built from the template with their colours, logo and photos.
4. The Website section gets two pages, **Homepage** and **Pre-registration**, as **Draft · REPS only**. The Emails section gets the 12 launch emails, also as a draft. Clients can't see drafts.
5. When you're happy, press **Send to client** in each section. The client is emailed a sign-in link to their account.

To have Claude write the copy, add `ANTHROPIC_API_KEY` (from console.anthropic.com) in Cloudflare. Without it, sites are still built using standard wording drawn from the client's answers. Each site is one API call.

Claude is told to use only facts from the form, so it never invents member counts, reviews or results. Sections with nothing to show (no programmes, no transformations, coaching with no app) are left off the site.

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

### Setting up the sync

1. In Cloudflare, add `MEETINGS_SECRET` (any long random string) and `REPS_EMAIL_DOMAINS` (e.g. `fitpreneuragency.com`, so your own team never matches as a client).
2. For each team member who hosts client calls: open script.google.com, start a new project, paste in `integrations/google-meet/Code.gs`, fill in the dashboard URL and secret, then run **setup** once and allow the permissions.
3. In Google Meet, turn on **Take notes with Gemini** (and transcripts) for client calls. You can set them to start automatically from Google Calendar.

The script checks the **Meet Recordings** folder in Drive every 15 minutes and sends each new Gemini doc to `/api/meetings/ingest`, with the guest list from the matching Calendar event. The notes doc and the transcript doc for the same call are merged into one meeting.

Gemini note-taking needs a Google Workspace plan that includes Gemini in Meet.

### The website template

`components/site/TemplateSite.tsx` and `components/site/template.css` draw the whole site from a `SiteSpec` (`lib/site/spec.ts`). `lib/site/compose.ts` turns onboarding answers and copy into a spec. To work on the design, run `npm run preview:template` and open `preview-dist/template.html`, which shows the template filled with example answers.

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
lib/demo/seed.json             Example clients, leads and sites
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
