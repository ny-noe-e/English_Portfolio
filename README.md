# Field Notes

A full-stack personal blog with a public reading experience and a private writing studio. It uses only Node.js built-ins and stores posts in `data/posts.json`, so there is no database or dependency installation required.

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
