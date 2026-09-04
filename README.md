# Insomnus · Petlisted Application

Single landing page for the Insomnus Gen 1 petlist.

Structure follows [KidStoryHood](https://kidstoryhood.com/#slip) (hero → what is this → application slip → map → FAQ). Visual language is Insomnus: dungeon stone, Alagard / VT323, blood red `#c02627`, gold `#c5a46d`.

## Local

Open `index.html` in a browser, or:

```bash
npx --yes serve .
```

Then go to http://localhost:3000/

## Form intake

Applications POST to a Google Apps Script web app.

1. Open the petlist Google Sheet
2. Extensions → Apps Script
3. Paste `tools/petlist-apply.gs`
4. Deploy → New deployment → Web app
   - Execute as: Me
   - Who has access: Anyone
5. Paste the URL into `APPLY_SCRIPT` in `app.js`

Sheet tab `Applications` columns: `time | address | handle | post | ref | xid | status`  
Sheet tab `Users` (X logins): `time | xid | handle | name | pfp`

## Database (Supabase Free)

Data is stored in Supabase, not the Google Sheet.

1. Open [SQL editor](https://supabase.com/dashboard/project/murnfprvourhkmieuref/sql/new)
2. Paste and run `schema.sql`
3. Keep `SUPABASE_SECRET_KEY` only in `tools/script-properties.txt` (gitignored) and `server.py`

Local API:

- `POST /xauth` — Connect X, save `users`
- `POST /apply` — save `applications`
- `GET /board` — ranked leaderboard

## Connect X

People must log in with X so handles, ranks, and referrals are verified.

1. Create an app at [developer.x.com](https://developer.x.com/)
2. User authentication → OAuth 2.0
   - Type: Web App
   - Callback URLs:
     - `http://localhost:3000/`
     - `http://127.0.0.1:3000/`
     - your live Pages URL
   - Scopes: `tweet.read` `users.read` `offline.access`
3. Copy the **OAuth 2.0 Client ID** into `X_CLIENT_ID` in `app.js`
4. Apps Script → Project Settings → Script properties:
   - `X_CLIENT_ID` = same Client ID
   - `X_CLIENT_SECRET` = Client Secret (if the app is confidential)
5. Paste the latest `tools/petlist-apply.gs` and **Deploy → New deployment**

Until Client ID is set, Connect X shows a setup note instead of opening Twitter.

Leaderboard scores (same in `app.js` and the Apps Script):

- Follow +10
- Quote / reply the pin +30
- Seal the slip +50
- Each referral (someone applies with your X handle) +100

`GET` the web app with `?board=1` to read the ranked list.

Referral is the referrer's **X username**, not a random code. Links look like:

```
http://localhost:3000/?ref=yourname
```

Redeploy the Apps Script after updating `tools/petlist-apply.gs` so `ref` is stored.

Demo wallets (for UI states, not sent):

- ending `0000` → kennel full
- ending `9f0c` → already seen
- ending `dead` → network error

## Links

- Game: https://insomnus.xyz
- Docs: https://docs.insomnus.xyz
- X: [@insomnusxyz](https://x.com/insomnusxyz)
- Pinned apply post: https://x.com/insomnusxyz/status/2094810680948097106
