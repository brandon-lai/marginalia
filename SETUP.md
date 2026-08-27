# Connecting your vault

Fifteen minutes, most of it Chrome. Nothing here writes to `brain/` until you
press Accept on a proposal.

---

## 1. The vault and the database

```bash
cd ~/Documents/Dev/marginalia
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
BRAIN_PATH=/Users/you/Library/CloudStorage/GoogleDrive-you@gmail.com/My Drive/brain-frontend/brain
BRAIN_REPO=/Users/you/Library/CloudStorage/GoogleDrive-you@gmail.com/My Drive/brain-frontend
DATABASE_URL=postgres://you@localhost:5432/marginalia
CAPTURE_SECRET=paste-the-output-of-openssl-rand-hex-32
```

`BRAIN_PATH` is the `brain/` directory itself, **not** the repo root. Point it at
the repo root by mistake and the app refuses to start rather than indexing 500
files of Quartz source — that is deliberate.

Then:

```bash
createdb marginalia          # local Postgres; brew services start postgresql@16 if it is not running
npm run db:init              # applies the schema, idempotent
npm run dev                  # http://localhost:3117
```

Check `http://localhost:3117/api/health`. You want `"mode": "vault"` and your
real note count. If it says `"mode": "demo"`, `BRAIN_PATH` did not take.

## 2. The Chrome extension

1. `chrome://extensions` → turn on **Developer mode** (top right).
2. **Load unpacked** → select the `extension/` folder in this repo.
3. Click **Details** → **Extension options**.
4. Endpoint stays `http://localhost:3117`. Paste the same `CAPTURE_SECRET`
   value into the secret field. Save.
5. Press **Test connection**. It should say `Connected. Vault has N notes,
   secret accepted.`

Shortcuts, if Chrome did not already assign them (`chrome://extensions/shortcuts`):

| Key | Does |
|---|---|
| `Cmd+Shift+S` | Save the selection, with the reaction field already focused |
| `Cmd+Shift+D` | Save the page to read later |
| right-click a link | Save that link to read later |

## 3. Extraction (optional, but it is the point)

Add to `.env.local` and restart:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Without it, the review gate still works end to end but serves a pre-written
proposal set, labelled as canned on screen. With it, extraction calls
`claude-opus-5` and reads your `brain/CLAUDE.md` from disk **at request time** —
so editing `CLAUDE.md` in Obsidian changes how notes get written on the next
run, with no deploy and no second copy to drift.

---

## Your first loop

1. Read something in Chrome. Select a paragraph that matters.
2. `Cmd+Shift+S`. Type why it matters. Enter.
   That reaction is not optional decoration — it is what separates a note from
   a bookmark, and extraction weights it as the framing.
3. The capture is already in `brain/Inbox/` before anything else happens. If
   the app is closed it queues in the extension and flushes when you open it;
   the toolbar badge shows how many are waiting.
4. Open `http://localhost:3117`. The source is in the list.
5. Read it in-app, highlight more, watch the related-notes panel for
   "am I about to write something I already have?"
6. When you are done with the source, hit **Extract & review**.
7. Read each proposal against the highlights it came from, check the MOC diff,
   edit the markdown if you want. **Accept** writes the note, updates the MOC,
   rewrites Recently Added, and commits.

Push is a toggle on the review screen, defaulted on. It is plain `git push`,
never `npx quartz sync` — sync pulls Quartz's upstream `v4` branch into `main`
and drags in unrelated generator changes.

---

## Backing out

Nothing is one-way.

- **Undo an accepted note:** `git -C "$BRAIN_REPO" revert HEAD`, or just delete
  the file and `git checkout` the MOC. Every accept is one commit touching the
  note, its MOC and `index.md`.
- **Stop the app writing at all:** comment out `BRAIN_PATH`. It falls back to
  the bundled demo vault and every write path refuses with a reason.
- **Throw away the database:** `dropdb marginalia && createdb marginalia &&
  npm run db:init`. You lose your read-later list, highlight positions and
  proposal history. You lose zero notes — files are truth for anything that is
  knowledge, and the database only holds your relationship to it.
- **Rebuild the derived cache:** `npm run db:rebuild`.

## When it goes wrong

| Symptom | Cause |
|---|---|
| `/api/health` says `"mode": "demo"` | `BRAIN_PATH` unset or not picked up. Restart the dev server. |
| App refuses to start, complains about `BRAIN_PATH` | It is set but is not a vault — usually the repo root instead of `brain/`. |
| Extension says "Could not reach localhost:3117" | App is not running. Captures queue; they flush on their own. |
| Extension says the secret was rejected | `CAPTURE_SECRET` in `.env.local` and the options page differ. |
| Accept is disabled with "no vault configured" | Same as row one. |
| A proposal is refused for a duplicate basename | Working as intended — basenames are globally unique across the vault, and `markdownLinkResolution: "shortest"` makes a collision ambiguous everywhere. Rename it. |
| Reader shows "This page did not extract" | Paywall, login wall or a JS-rendered page. Use "open in Chrome and use the extension", or paste the text — it gets cached against the source, so your highlights survive the page going dead. |

## Going to the phone later (M5)

The database was never local, so there is no migration. Point `DATABASE_URL` at
a Supabase pooler connection string, deploy, turn on Supabase Auth, and swap
`FsVaultStore` for a GitHub Contents API implementation behind the same
`VaultStore` interface. Capture from iOS is a share-sheet Shortcut that POSTs to
`/api/capture` — no iOS app, no Safari extension.
