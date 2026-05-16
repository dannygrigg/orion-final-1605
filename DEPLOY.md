# Deploying the Orion site

Static site — no build step. Just static HTML, CSS and a few JS files served as-is.

## Phase 1 · Quick preview deploy (30 seconds, free, no Git needed)

This puts the site at a random Netlify URL so you can test before touching any real domains.

1. Open https://app.netlify.com/drop in your browser
2. Sign in (or create a free account)
3. Drag the **entire `orion-onepage` folder** onto the drop zone
4. Wait ~10 seconds — Netlify gives you a URL like `https://nostalgic-tesla-abc123.netlify.app`
5. Open the URL — everything should work: nav, ROI calculator, carousels, FAQs

What to test:

- [ ] Hero copy, nav, smooth scroll, mobile burger menu
- [ ] ROI engine sliders update outputs live
- [ ] FAQ accordions open/close
- [ ] Products page sticky tab bar tracks scroll
- [ ] News page YouTube embeds load
- [ ] Carousel below case studies on homepage auto-advances
- [ ] Sketch form submission → check for FormSubmit activation email at `info@orionmis.co.uk`
- [ ] ROI calculator "email me this estimate" → same activation email if not already done
- [ ] `admin-media.html` opens, lets you edit slots, exports JSON

## Phase 2 · Custom test subdomain (optional, 15 min)

If you want a nicer URL than `nostalgic-tesla-abc123.netlify.app`:

### Option A · Rename the Netlify subdomain (free, instant)

1. In Netlify dashboard → site settings → **Change site name**
2. Use something like `orion-helix-staging` → site lives at `https://orion-helix-staging.netlify.app`

### Option B · Use a subdomain of orionmis.co.uk (free, 15 min, needs DNS access)

1. In Netlify dashboard → **Domain management** → **Add custom domain** → `new.orionmis.co.uk`
2. In your domain registrar's DNS panel, add a **CNAME record**:
   ```
   Name: new
   Value: orion-helix-staging.netlify.app
   TTL: 3600
   ```
3. Wait 5–15 min for DNS to propagate
4. Netlify auto-issues SSL — site is live at `https://new.orionmis.co.uk`

The main `orionmis.co.uk` keeps running untouched.

## Phase 3 · Connect to Git (when you're happy with everything)

Switches from one-off drag-deploys to automatic deploy-on-push.

1. Create a new GitHub repo (private if you like)
2. In the `orion-onepage` folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-org>/<your-repo>.git
   git push -u origin main
   ```
3. In Netlify dashboard → **Site settings → Build & deploy → Link to Git repository**
4. Select the GitHub repo
5. From now on, every `git push` triggers an auto-deploy

## Phase 4 · Go live (when fully signed off)

1. In Netlify dashboard → **Domain management** → **Add custom domain** → `orionmis.co.uk` and `www.orionmis.co.uk`
2. Update the apex DNS record at your registrar to point at Netlify:
   - For `orionmis.co.uk` → A record `75.2.60.5` (Netlify's load balancer)
   - For `www.orionmis.co.uk` → CNAME `orion-helix-staging.netlify.app`
3. Netlify issues SSL automatically
4. Old site stops resolving once DNS propagates (5 min to a few hours)

**Worth doing before the flip:**

- Activate FormSubmit on both forms (one-time email click after first submission from the new domain)
- Decide if you want to keep admin pages at `admin-media.html` or move them somewhere harder to guess
- Optional: add Netlify Identity for password-protecting `admin-media.html`

## Files in this site

```
orion-onepage/
├── index.html              ← homepage
├── products.html           ← products (11 categories + Solutions)
├── news.html               ← news + YouTube + social wall
├── sketch.html             ← sketch upload form
├── admin-media.html        ← media manager (internal, noindex)
├── media-carousel.js       ← carousel widget (loaded by every page)
├── media.json              ← carousel content config
├── netlify.toml            ← Netlify config (security headers, caching)
├── robots.txt              ← blocks admin from search crawlers
├── .gitignore              ← when you go to Git
├── DEPLOY.md               ← this file
└── email-assets/
    ├── email-signature.html
    └── email-small-wins.html
```

## Form / external service notes

- **Sketch form + ROI "email me this estimate"**: both use FormSubmit (free, no backend). On first submission from a new domain, you'll receive an activation email at `info@orionmis.co.uk` — click "Activate" once and it's live for that domain.
- **YouTube embeds (news page)**: no auth needed, just video IDs in `news.html`.
- **Cloudinary (not yet integrated)**: for direct file upload from the media admin, we'd add ~30 min of work once you've created a Cloudinary free account and given me the cloud name + unsigned upload preset name.

## If anything breaks

- **Carousel doesn't load**: open browser DevTools → Network tab → check that `media-carousel.js` and `media.json` both return 200. If `media.json` returns 404, the file is missing from the deploy.
- **Form submits but no email arrives**: check spam folder. First submission triggers a FormSubmit activation email which must be clicked once.
- **Admin doesn't save**: drafts are stored in browser localStorage — clearing browser data wipes them. Always use **Export media.json** to persist.

## Hosting cost summary

| Tier | Cost | What you get |
|---|---|---|
| Netlify free | £0 | 100 GB/month bandwidth, 300 build minutes, free SSL, custom domain |
| FormSubmit free | £0 | Unlimited submissions, 10 MB per submission, attachments via email |
| YouTube embeds | £0 | unlimited views |
| Cloudinary free (optional, future) | £0 | 25 credits/month — covers small-medium media use |

So end-to-end this is **£0/month** until you outgrow the free tiers. For an Orion-scale marketing site, that's likely never.
