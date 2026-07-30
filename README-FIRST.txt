BIG IRON WEBSITE EDITOR — INSTALLATION

This package adds a no-code editor for the public homepage.

FILES INCLUDED
- app/page.tsx
- app/admin/site-editor/page.tsx
- app/api/admin/site-content/route.ts
- lib/site-content.ts
- site-content.sql

STEP 1 — COPY THE FILES
Unzip this package into the root of your music-requests project:
  ~/Projects/music-requests

The folders in the ZIP already match the correct project folders.

Terminal option:
  cd ~/Projects/music-requests
  unzip -o ~/Downloads/big-iron-site-editor.zip

STEP 2 — CREATE THE SUPABASE TABLE
1. Open your Supabase project.
2. Open SQL Editor.
3. Create a new query.
4. Paste everything from site-content.sql.
5. Click Run.

STEP 3 — RESTART THE APP
  cd ~/Projects/music-requests
  rm -rf .next
  npm run dev

STEP 4 — OPEN THE EDITOR
Public homepage:
  http://localhost:3000

Website editor:
  http://localhost:3000/admin/site-editor

Use your existing Big Iron admin login. After saving in the editor,
the public homepage updates without editing code or redeploying.

IMPORTANT
The image fields accept a public image URL. Direct image uploading can be
added later with Supabase Storage.
