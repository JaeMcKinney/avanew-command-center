# Divigner Avatar Analytics

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
| Call events from Tavus (webhook) and an hourly backup check | Built, tested against a mock Tavus |
| Talk time totals, by avatar and by day, per client time zone | Built |
| Client dashboard, conversations and transcripts | Built |
| Activity log | Built |
| Talk-time and concurrency limits, overage email and pause | Not yet |
| Stripe billing, invoices, enhancements store | Not yet |
| Transcript summaries, questions inbox, branded PDF | Not yet |
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
- `src` — the React app. `src/lib/api.ts` is every read and write the screens make.

Who can see what is enforced in the database, not in the screens. A client user can only ever read rows for their own client, whatever the app asks for.

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

The browser tests check every page against WCAG 2.2 AA with axe, in light and dark, on a desktop and a phone.

## Putting it online

1. Create a Supabase project and link it: `npx supabase link --project-ref <ref>`.
2. Apply the database: `npx supabase db push`.
3. In the Supabase dashboard, under Authentication:
   - turn **off** "Allow new users to sign up" (people are invited);
   - set the Site URL to where the app will run, and add `<that URL>/accept-invite` to the redirect URLs.
4. Set the server settings (see `supabase/functions/.env.example`):
   ```bash
   npx supabase secrets set TAVUS_API_KEY=… APP_URL=https://… CRON_SECRET=…
   ```
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
   ```

## Check these against the real Tavus account first

Everything Tavus-related was built from the public API reference (docs.tavus.io) and tested against `tests/mock-tavus.mjs`. Before relying on the numbers, link one test avatar on the real account, make one call through its embed, and confirm:

1. **The webhook arrives and is signed.** The avatar should change from "Waiting for first call" to "Reporting calls", and the call should appear under Conversations with the right length.
2. **Calls started through a deployment use the PAL's default webhook.** The docs say a conversation that does not set its own `callback_url` inherits the PAL's. If a client's site starts conversations through its own code with its own `callback_url`, those calls will not reach the webhook; the hourly backup check picks them up if Tavus lists them with a `pal_id`.
3. **`pal_id` on listed conversations.** The backup check matches conversations to avatars by `pal_id`. Its result includes `unattributed`, the number of recent conversations Tavus listed with no `pal_id`.
4. **Timing.** Talk time is the time between `system.pal_joined` and `system.shutdown`, rounded to the nearest 6 seconds with a 30-second minimum, which is how Tavus's pricing page describes billing. Both numbers are settings (`usage.round_to_seconds`, `usage.minimum_seconds`). Compare a few calls with the Tavus invoice.

Linking an avatar replaces its PAL-level `callback_url`. If the PAL already sends events somewhere else, the app says so and asks before replacing it, saves the old address, and restores it when the avatar is unlinked.
