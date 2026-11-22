# Avalytics by Divigner

A portal on top of Tavus for Divigner and its clients.

- **Divigner staff** add clients, link each client's Tavus avatars by searching for them by name, hand out embed codes, manage users and roles, and see talk time across every client.
- **Clients** sign in to their own branded portal and see their avatars, how much talk time they have used (this month, this quarter, this year, or any dates), their conversations and transcripts, and their embed codes.

System prompts, faces, knowledge and tools stay in Tavus. This app reads the list of avatars and deployments, and changes exactly one thing on a linked avatar: where Tavus sends its call events.

This folder is self-contained. It does not share code or a database with the CRM in the rest of the repository, and can be moved to its own repository as is.

## What is built

| Area | Status |
|---|---|
| Sign-in, invitations, password reset | Built |
| Divigner users, roles and an editable permissions table | Built |
| Clients, with name, time zone, brand colour and logo | Built |
| Tavus list sync, search by name (typo-tolerant), link and unlink avatars | Built, tested against a mock Tavus |
| Embed codes for each deployment | Built |
| Support desk: tickets, replies, internal notes, assignment, priority, attached files, email in and out | Built, tested against a mock email service |
| Glass Health for clinical avatars: each client's own Glass key (stored encrypted, never shown again), a signed address the avatar's tool calls, and Glass questions, tokens, estimated cost and waiting time beside talk time | Built, tested against a mock Glass. One live check against the real Glass API on a local stack. Not yet connected to a real avatar (see below) |
| Call events from Tavus (webhook) and an hourly backup check | Built, tested against a mock Tavus |
| Talk time totals, by avatar and by day, per client time zone | Built |
| Client dashboard, conversations and transcripts | Built |
| Activity log | Built |
| Packages, and each client's subscription through Stripe (subscribe, change package, payment method, cancel, invoices) | Built, tested against a mock Stripe |
| Usage against the package: one warning email, pause at the limit, automatic resume | Built, tested against mock Tavus and email |
| Extra minutes: a one-time $10, $20 or $50 payment on Stripe adds minutes to the current period without changing package | Built, tested against a mock Stripe |
| Extra minutes for a custom whole-dollar amount, within a range staff set | Built |
| Invoices filtered by period, and downloaded together as a ZIP with a summary spreadsheet | Built, tested against a mock Stripe |
| Client file for staff: one list of every client, contacts, notes, account details | Built |
| Finance for staff: recurring revenue, revenue by source, month and client, costs and profit | Built; costs are entered by staff |
| Client logo upload with an editor (size, position, background, remove white box), saved as PNG | Built |
| Avatar detail read live from Tavus: prompt, knowledge, guardrails, objectives, tools, skills, face, models, with PAL, face and conversation IDs shown throughout | Built, tested against a mock Tavus |
| Text-message notices | Placeholder: recorded as skipped until a text provider is connected |
| Concurrency limit per package | Shown to clients; not yet enforced in Tavus |
| Enhancements store | Not yet |
| Transcript summaries and the questions each visitor asked | Built, tested against a mock Claude API |
| Questions inbox: answer once, added to the avatar's Tavus knowledge | Built, tested against a mock Tavus |
| Branded transcript PDF for each call | Built |
| Export one or many transcripts: ZIP download, device share sheet, private link, email to yourself | Built, email tested against a mock email service |
| Save an export to Dropbox or Google Drive | Built, tested against stand-ins; each needs its own key (see below) |
| Monthly questions email | Not yet |
| Change history, Tavus rollouts, support requests | Not yet |
| Financial reports and forecast | Not yet |

## How it fits together

```
Visitor talks to an avatar on a client's website
        │
        ▼
Tavus ──► tavus-webhook/<avatar token>   checks the signature
              │
              ▼
        ingest_tavus_event()             stores the event once, updates the
              │                          conversation, recomputes the day
              ▼
  conversations ─► usage_daily ─► dashboards
```

- `supabase/migrations` — tables, row-level security, and the SQL functions the app calls.
- `supabase/functions` — server functions (Deno):
  - `tavus-sync` copies PALs and deployments from Tavus.
  - `tavus-webhook` receives call events.
  - `tavus-backfill` re-checks recent conversations in case a webhook was missed.
  - `avatar-link` links and unlinks avatars, and sets the avatar's webhook in Tavus.
  - `user-invite` invites people.
  - `conversation-insights` summarises new transcripts with Claude and lists the questions asked.
  - `knowledge-publish` sends a client's answers to Tavus as a knowledge document on each avatar.
  - `knowledge-page` is the page Tavus reads those answers from (public, reached only by a long random address).
  - `billing` starts a Stripe checkout, opens Stripe's billing page, changes package, and cancels or resumes a subscription.
  - `stripe-webhook` keeps subscriptions and invoices in step with Stripe.
  - `usage-check` compares talk time with each client's package: one warning email, a pause at the limit, a resume when there is room.
  - `tavus-pal` reads everything Tavus holds about one avatar for the staff detail page, with keys and header values removed.
  - `invoice-export` zips a period's invoice PDFs from Stripe with a summary CSV.
  - `support-notify` emails the other side when someone replies on a support ticket (never an internal note). The app calls it after each reply and a schedule catches anything missed.
  - `support-inbound` receives email sent to the support address from Resend and files it on the right ticket, or opens a new one. It accepts mail only from the address of someone who could have written the same thing in the app.
  - `export-share` turns an export a person uploaded into a private link that expires after 7 days, emails that link to the person who asked, and (on a schedule) removes old export files.
- `src` — the React app. `src/lib/api.ts` is every read and write the screens make.

Who can see what is enforced in the database, not in the screens. A client user can only ever read rows for their own client, whatever the app asks for.

### Glass Health

A clinical avatar can look up published evidence through the client's **own** Glass Health account. This app sits in between so every question is counted.

```
The avatar's tool (Tavus, API delivery, HMAC auth)
        │
        ▼
glass-consult/<avatar token>     checks Tavus's signature with the avatar's secret
        │
        ├─► glass_read_key()     the client's key, from Supabase Vault
        ├─► Glass Health         POST /v2/messages, not streamed, short spoken answer
        ▼
glass_record_call()              tokens, seconds and estimated cost, per conversation
        │
        ▼
  glass_calls ─► Glass Health page, dashboard, conversations
```

- Divigner turns Glass on for a client (the client's file, **Glass Health** tab). The client's admin then enters the key in their portal. Nobody can read it back; the app shows its last four characters.
- The question and the answer are not stored, only the counts.
- Glass bills by the question, in tokens, so usage is shown in questions and tokens, not minutes. Glass has no usage API, so the account total is only in the client's Glass console; this app shows the part the avatars used.
- The estimated cost uses two settings, `glass.input_cents_per_million` and `glass.output_cents_per_million`. They start at 0 (no estimate). Prices are data, not code.
- **Connecting an avatar is still a manual step.** In Tavus, give the avatar a tool (for example `consult_clinical_evidence`, with a required `question` string and an optional `language` of `en` or `es`) with `delivery.api.url` set to `<functions URL>/glass-consult/<the avatar's webhook token>`, `auth` of `{ "type": "hmac", "secret": "<the avatar's callback secret>" }`, a `timeout` of 60 and `on_resolve` of `generate_response`. The token and secret are in `avatar_secrets`, readable by the service role only. A button that sets this up is not built yet, and the address has not been called by a real Tavus avatar.

### Agencies

There are three views in the one app: Divigner's, an agency's, and a client's.

- **Divigner** creates agencies on the Agencies page, sets how each pays (a one-time fee or a subscription, with the amount entered there), gives each a look, and invites its first Owner.
- **An agency** is a company that runs Avalytics for its own clients under its own name. Its staff use the same pages and the same roles Divigner's staff do, limited to the agency's clients. They change their own look on the Brand page.
- **A client** belongs either to Divigner or to one agency, and sees the name and look of whoever it belongs to.

What keeps them apart, in `supabase/migrations/20261122001100_agencies.sql`:

- A staff profile with `agency_id` set is agency staff; a client with `agency_id` set is the agency's. `app.can_access_client()` requires the two to match, so every table already scoped by client follows.
- Divigner's staff cannot open an agency's clients or see their names. `agency_usage()` gives them each agency's counts and minutes, and nothing else.
- The team list, the activity log, packages, and the Tavus catalogue are each owner's own. Roles are shared by everyone, so only Divigner changes them. Settings hold Divigner's own rates and are Divigner's alone.

An agency's look is data, not code: seven colours for the light version, seven for the dark, and a switch for gentle motion (`agencies.theme`, checked by `app.valid_theme()` so it can hold nothing but colours). `src/lib/brand.ts` works out every other colour from those and keeps text readable. Divigner's own look stays in `src/index.css`.

The sign-in page wears an agency's look when it is opened at the agency's own address (`agencies.domain`), or with `?agency=<short name>` on any address. Locally, the demo agency is at `http://avanew.localhost:5180/login`.

Not built yet: an agency's own Tavus account and its own payment account. Until they are, the functions that use Divigner's Tavus or Stripe account refuse an agency's staff and clients with "not connected for your agency yet", so nothing of an agency's ever runs on Divigner's accounts. Emails and texts are still signed with the one `BRAND_NAME` of the project.

## Run it on your computer

You need Node 22 and Docker.

```bash
cd avatar-analytics
npm install
npm run db:start            # local Supabase (first run downloads images)
npx supabase status         # prints the URL and keys used below
```

Create two settings files from the examples:

- `.env.local` from `.env.example`. Add a line `SUPABASE_SERVICE_ROLE_KEY=…` as well; the tests and the sample-data script use it.
- `supabase/functions/.env` from `supabase/functions/.env.example`. For local work set `TAVUS_API_BASE=http://127.0.0.1:54398/v2` so nothing touches the real Tavus account, and `PUBLIC_FUNCTIONS_URL=http://127.0.0.1:54399/functions/v1`.

Then, in three terminals:

```bash
npm run mock-tavus          # a stand-in for the Tavus API
npm run functions           # the server functions
npm run dev                 # the app, at http://127.0.0.1:5180
```

To open the app from another device or a hosted preview, run `npm run dev:shared` in place of `npm run dev`. It serves the app, the local Supabase API and the local functions through the one address.

Load sample clients, avatars and two months of calls:

```bash
npm run seed
```

Sign in as `owner@divigner.test` (Divigner) or `dana@northline.test` (a client). The script prints the password. Invitation emails sent locally appear at http://127.0.0.1:54324.

## Tests

```bash
npm run lint
npm run typecheck           # the app and the server functions
npm test                    # unit tests
npm run test:integration    # database rules and server functions (needs db:start)
npm run e2e                 # the app in a browser, incl. accessibility (needs db:start)
```

The integration and browser tests empty the local database and reload sample data. They work through the local Docker database, so they cannot touch a hosted project.

`npm run functions` points Anthropic and Glass Health at stand-ins, and the local `supabase/functions/.env` does the same for Tavus, Stripe and Resend, so the tests never call the real services.

The browser tests check every page against WCAG 2.2 AA with axe, in light and dark, on a desktop and a phone.

## Putting it online

1. Create a Supabase project and link it: `npx supabase link --project-ref <ref>`.
2. Apply the database: `npx supabase db push`.
3. In the Supabase dashboard, under Authentication:
   - turn **off** "Allow new users to sign up" (people are invited);
   - set the Site URL to where the app will run, and add `<that URL>/accept-invite` to the redirect URLs.
4. Set the server settings (see `supabase/functions/.env.example`):
   ```bash
   npx supabase secrets set TAVUS_API_KEY=… ANTHROPIC_API_KEY=… APP_URL=https://… CRON_SECRET=…
   ```
   Without `ANTHROPIC_API_KEY` everything else works; transcripts simply wait for their summary. `INSIGHTS_MODEL` chooses the model. The default is `claude-haiku-5-5`, the low-cost one; set a larger model if summaries need more nuance.
   Optional extras for transcript exports:
   - **Email to me** needs `RESEND_API_KEY` and `EMAIL_FROM` on the server (a [Resend](https://resend.com) account with your sending domain verified).
   - **Save to Dropbox** needs `VITE_DROPBOX_APP_KEY` on the app (a Dropbox app with this site's address in its allowed domains).
   - **Save to Google Drive** needs `VITE_GOOGLE_CLIENT_ID` on the app (a Google OAuth web client with this site as an authorised JavaScript origin and the Drive API enabled). The app asks only for permission to add files.
   Each button stays hidden until its setting exists. Download, share and private links need nothing extra. Add a daily schedule for `export-share` (same form as the ones below) to remove export files after 7 days.
   Billing (start with Stripe **test mode** keys):
   - `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` from a Stripe webhook endpoint pointing at `<functions URL>/stripe-webhook` with the events `checkout.session.completed`, `customer.subscription.*` and `invoice.*`.
   - In Stripe, create a product with a recurring monthly price for each package, then add the packages under **Packages** in the admin area with those price IDs. Prices live in Stripe and in the database, not in this code.
   - For a one-time setup fee on a client's first checkout, add a setting `billing.setup_fee_price_id` whose value is the Stripe price ID of the fee.
   - Extra minutes need no Stripe product: the amounts and the price per extra minute are settings on the Packages page, and each purchase is a one-time Checkout payment. Add `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired` to the webhook's events. Turn on the payment methods you want (PayPal, Google Pay, Apple Pay, Link) in Stripe under Settings, Payment methods; Checkout then offers them.
   - Turn on the customer portal in Stripe (Settings, Billing, Customer portal) so "Payment method" works.
   - Schedule `usage-check` every 10 minutes (same form as the schedules below). It also runs whenever a call ends.
   - **Support desk email.** Replies are emailed with `RESEND_API_KEY` and `EMAIL_FROM`. Schedule `support-notify` every 5 minutes (same form as the schedules below). To let people answer those emails, and email new tickets in, add a receiving address in Resend, set `SUPPORT_INBOUND_ADDRESS` to it, add a Resend webhook for `email.received` that points at `<functions URL>/support-inbound`, and set `RESEND_WEBHOOK_SECRET` to that webhook's signing secret. Without these the desk works in the app and by outgoing email only. Receiving email has been tested against a stand-in for Resend, not the real service.
   - **Glass Health.** Nothing to set: each client's key is entered in the app. Enter Glass's current rates in the two `glass.*` settings if you want an estimated cost. Ask Glass about higher rate limits before a client with busy avatars goes live; the standard limit is per account, per minute.
5. Deploy the functions: `npx supabase functions deploy`.
6. Deploy the app (for example on Vercel, with this folder as the root directory) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set. Leave `VITE_FUNCTIONS_URL` unset.
7. **Create the Owner.** In the SQL editor, name the email address that will be the Owner:
   ```sql
   insert into public.settings (key, value, description)
   values ('bootstrap.owner_email', '"you@example.com"', 'The first Owner. Removed once they exist.');
   ```
   Then add that person in the Supabase dashboard (Authentication → Users → Add user). They become the Owner, and the setting is removed. Nobody else is ever given access by signing up; everyone after the Owner is invited from inside the app.
8. Schedule the sync and the backup check. In the SQL editor, with the `pg_cron` and `pg_net` extensions enabled:
   ```sql
   select cron.schedule('tavus-sync', '*/15 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/tavus-sync',
       headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb)
   $$);
   select cron.schedule('tavus-backfill', '7 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/tavus-backfill',
       headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb)
   $$);
   -- Catches any summary the webhook did not start, and retries failures.
   select cron.schedule('conversation-insights', '*/10 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/conversation-insights',
       headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb)
   $$);
   -- Retries answers Tavus was not ready to accept (it re-reads a page at most once an hour).
   select cron.schedule('knowledge-publish', '23 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/knowledge-publish',
       headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb)
   $$);
   ```

## Check these against the real Tavus account first

Everything Tavus-related was built from the public API reference (docs.tavus.io) and tested against `tests/mock-tavus.mjs`. Before relying on the numbers, link one test avatar on the real account, make one call through its embed, and confirm:

1. **The webhook arrives and is signed.** The avatar should change from "Waiting for first call" to "Reporting calls", and the call should appear under Conversations with the right length.
2. **Calls started through a deployment use the PAL's default webhook.** The docs say a conversation that does not set its own `callback_url` inherits the PAL's. If a client's site starts conversations through its own code with its own `callback_url`, those calls will not reach the webhook; the hourly backup check picks them up if Tavus lists them with a `pal_id`.
3. **`pal_id` on listed conversations.** The backup check matches conversations to avatars by `pal_id`. Its result includes `unattributed`, the number of recent conversations Tavus listed with no `pal_id`.
4. **Timing.** Talk time is the time between `system.pal_joined` and `system.shutdown`, rounded to the nearest 6 seconds with a 30-second minimum, which is how Tavus's pricing page describes billing. Both numbers are settings (`usage.round_to_seconds`, `usage.minimum_seconds`). Compare a few calls with the Tavus invoice.

6. **Pausing works.** When a client's minutes run out the app sets each of their deployments to `inactive` with a JSON Patch on `/status`, and back to `active` on resume. Confirm on one test deployment that the patch is accepted and that an inactive deployment stops new calls.
5. **Answers reach the avatar.** Answer one question in a client's Questions page, then check in Tavus that the avatar has a new knowledge document named after it and that the avatar uses the answer on the next call. The answers are published as a web page that Tavus crawls; the app adds that document to the PAL's `document_ids` and asks Tavus to re-read it when an answer changes.

Linking an avatar replaces its PAL-level `callback_url`. If the PAL already sends events somewhere else, the app says so and asks before replacing it, saves the old address, and restores it when the avatar is unlinked.
