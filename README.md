# Growdeskmedia website

This package contains:

```
index.html          <- the website (frontend). Open this directly, or serve it via the backend.
server/
  server.js         <- the backend that receives quote-form leads
  package.json       <- backend dependencies
  .env.example       <- copy to .env and fill in your details
  .gitignore
  leads.json         <- created automatically once your first lead comes in
```

The quote form on the website ("Get a Quote" popup) submits to the backend at
`/api/lead`. The backend saves every submission to `server/leads.json` and,
if you set up Gmail credentials, emails you a notification at
**growdeskmedia@gmail.com** for every new lead.

---

## 1. Run it on your own computer

You need [Node.js](https://nodejs.org) installed (version 18 or newer).

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` in any text editor and fill in:
- `SMTP_USER` / `SMTP_PASS` — your Gmail address and a **Gmail App Password**
  (instructions are inside `.env.example`). Skip this if you don't need
  email alerts yet — the form will still work and leads still get saved.
- `ADMIN_KEY` — make up your own password. You'll use it to view leads later.

Then start the server:

```bash
npm start
```

Open **http://localhost:3000** in your browser — that's your website, now
backed by a real server. Fill out the "Get a Quote" popup to test it. You
should see a new entry appear in `server/leads.json`, and (if email is
configured) a notification email should land in growdeskmedia@gmail.com
within a few seconds.

To view all captured leads at any time, visit:

```
http://localhost:3000/api/leads?key=YOUR_ADMIN_KEY
```

(replace `YOUR_ADMIN_KEY` with whatever you put in `.env`)

If you also configure PostgreSQL, you can fetch customer records from the
`customers` table with the protected endpoints below:

```
http://localhost:3000/api/customers?key=YOUR_ADMIN_KEY
http://localhost:3000/api/customers/123?key=YOUR_ADMIN_KEY
```

To save a new customer into PostgreSQL, send a POST request with `key` and
JSON body fields like `name`, `email`, `phone`, `company`, `address`,
`city`, `state`, `country`, `website`, or `notes`:

```
POST http://localhost:3000/api/customers?key=YOUR_ADMIN_KEY
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+911234567890",
  "company": "Growdesk Media",
  "notes": "New marketing customer"
}
```

Your `.env` should include:

```
PGHOST=localhost
PGPORT=5432
PGUSER=your_pg_user
PGPASSWORD=your_pg_password
PGDATABASE=your_pg_database
PGSSL=false
```

The backend reads customer details from your database only when all four
PostgreSQL variables are set.

---

## 2. Put it online (so real visitors can use it)

Right now this only works on your own computer. To make the site live on
the internet, you need to host it somewhere. The simplest free/cheap options
for a small Node.js app like this:

**Option A — Render.com (easiest, has a free tier)**
1. Create a free account at render.com and connect it to a GitHub repo
   containing this folder (or use Render's manual deploy).
2. Create a new "Web Service", point it at the `server` folder.
3. Build command: `npm install` — Start command: `npm start`
4. Add the same variables from `.env` under Render's "Environment" tab
   (SMTP_USER, SMTP_PASS, ADMIN_KEY, NOTIFY_EMAIL).
5. Render gives you a live URL like `https://growdeskmedia.onrender.com`
   — that's your live site.

**Option B — Railway.app** works almost identically to Render.

**Option C — A VPS (e.g. Hostinger, DigitalOcean)** if you want a custom
domain like `growdeskmedia.com` from the start: install Node.js on the
server, upload this folder, run `npm install && npm start` (ideally kept
alive with `pm2 start server.js`), and point your domain at the server.

Once it's live, you can buy a domain (e.g. from GoDaddy or Hostinger) and
point it at whichever host you choose — then share `growdeskmedia.com`
instead of a long Render/Railway URL.

If you'd like, tell me which option you'd prefer and I can walk you through
the exact steps for that one.

---

## 3. What's already set up on the frontend

- Brand renamed to **Growdeskmedia** throughout (nav, footer, copyright).
- SEO tags added to `<head>` targeting: Media agency Bilaspur, Branding
  agency Bilaspur, Growdesk media, Reel shoot Bilaspur, Social media
  marketing agency, Social media agency.
- Contact details wired in: phone `+91 94060 31522` (click-to-call) and
  `growdeskmedia@gmail.com` (click-to-email), plus a WhatsApp link
  (`wa.me/919406031522`) on the form's success screen.
- The "Tell us what you want to grow next" form now opens as a **popup**
  (triggered by any "Get a Quote" button) instead of sitting on the page,
  and closes via the × button, clicking outside it, or the Esc key.
- The form's final step submits to your backend instead of just faking a
  success message.

## 4. Editing content later

- Text, colors, and sections all live in `index.html` — it's a single
  self-contained file (HTML, CSS and JS together).
- To change the phone number or email, search for `9406031522` and
  `growdeskmedia@gmail.com` in `index.html` and `server/.env`.
- To add more form fields, you'll need to update three places: the HTML
  input in `index.html`, the `payload` object in the `submitForm()`
  JavaScript function (same file), and the `lead` object in
  `server/server.js`.
