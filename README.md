# Field Notes

A full-stack personal blog with a public reading experience and a private writing studio. Local development stores posts in `data/posts.json`; Vercel deployments use a private Blob store for durable serverless storage.

## Run locally

```powershell
npm.cmd start
```

Then open [http://localhost:3000](http://localhost:3000). The writing studio is at [http://localhost:3000/studio](http://localhost:3000/studio).

The starter studio key is `portfolio`. Set your own before deploying:

```powershell
$env:ADMIN_KEY="choose-a-long-private-key"
npm.cmd start
```

You can also change the port with the `PORT` environment variable.

## Deploy to Vercel

The project includes a Vercel Function for the JSON API and rewrites for the studio and post URLs.

1. Import this repository in Vercel.
2. In the project dashboard, open **Storage**, create a **Blob** store with **Private** access, and connect it to this project.
3. In **Settings > Environment Variables**, add `ADMIN_KEY` with a long private value for Production, Preview, and Development.
4. Deploy. Open `/studio` on the deployed URL and sign in with your `ADMIN_KEY` value.

Until the first studio edit, the deployed site reads the starter posts from `data/posts.json`. The first create, update, or delete operation seeds the private Blob store with the resulting post list. Production reads bypass the Blob CDN cache so studio changes appear immediately.

Vercel serves files in `public/` from its CDN and runs `api/[...path].js` as the backend. Local development continues to use `data/posts.json`.

## Features

- Responsive dark-mode archive and dedicated post pages
- Automatic newest-first ordering and numbered entries
- Separate password-protected writing studio
- Create, edit, preview, publish, draft, feature, and delete posts
- Lightweight Markdown support for headings, quotes, lists, links, emphasis, and inline code
- JSON API with atomic file writes and server-side validation

## API

- `GET /api/posts` — published posts
- `GET /api/posts/:slug` — one published post
- `GET /api/posts?all=1` — all posts (requires `x-admin-key`)
- `POST /api/posts` — create a post (requires `x-admin-key`)
- `PUT /api/posts/:id` — update a post (requires `x-admin-key`)
- `DELETE /api/posts/:id` — delete a post (requires `x-admin-key`)
