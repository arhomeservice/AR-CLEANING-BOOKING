# AR Cleaning — Dispatch

React + Vite prototype. ALL FILES ARE AT THE TOP LEVEL (no src folder),
so uploading to GitHub is simple and can't lose a folder.

FIX FOR THE PREVIOUS BUILD ERROR
--------------------------------
The earlier repo was missing the src folder, so Vercel couldn't find the
entry file. This version has no src folder. Re-upload these files and it
will build.

RE-UPLOAD STEPS (GitHub website + Vercel)
-----------------------------------------
1. Open your GitHub repo (AR-CLEANING-BOOKING).
2. If the old files are still there, delete them first:
   - open each file (index.html, package.json, vite.config.js, and the src
     folder's files) → click the trash icon → Commit.
   - (Or just delete the repo and make a new empty one.)
3. Click "Add file → Upload files".
4. Unzip this download and drag ALL 6 files into the box:
      App.jsx  index.html  main.jsx  package.json  vite.config.js  .gitignore
   They should appear as a flat list (no folder).
5. Click "Commit changes".
6. In Vercel, the project redeploys automatically. If not, open the project
   → Deployments → "Redeploy".

Vercel settings (auto-detected, leave as-is):
   Framework: Vite   Build: npm run build   Output: dist

LOCAL PREVIEW (optional, needs Node.js)
---------------------------------------
   npm install
   npm run dev      # http://localhost:5173

NOTES
-----
- Bookings live in the browser session only (a refresh resets them).
  Shared, saved data needs a database — the next step.
- The map is simulated until a maps API key is added.
- Your staff list is the CLEANERS array near the top of App.jsx.
