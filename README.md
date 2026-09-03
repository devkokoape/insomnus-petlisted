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

Sheet tab `Applications` columns: `time | address | handle | post | status`

Demo wallets (for UI states, not sent):

- ending `0000` → kennel full
- ending `9f0c` → already seen
- ending `dead` → network error

## Links

- Game: https://insomnus.xyz
- Docs: https://docs.insomnus.xyz
- X: [@insomnusxyz](https://x.com/insomnusxyz)
- Pinned apply post: https://x.com/insomnusxyz/status/2094810680948097106
