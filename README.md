# AR Cleaning — Dispatch (prototype)

A booking + deployment + driver-schedule tool built with React + Vite.
This is the mock-data prototype (no database yet). Follow either path below to
put it online with a permanent link.

--------------------------------------------------------------------
OPTION A — No terminal needed (GitHub website + Vercel)   ← easiest
--------------------------------------------------------------------
You'll need two free accounts: github.com and vercel.com

1.  Go to github.com → "New repository".
    - Name it:  ar-cleaning-dispatch
    - Keep it Private, click "Create repository".

2.  On the new repo page click "uploading an existing file".
    - Unzip the project on your computer first.
    - Drag the FOLDER CONTENTS (index.html, package.json, vite.config.js,
      the src folder, .gitignore) into the upload box.
    - Do NOT upload node_modules or dist if they exist.
    - Click "Commit changes".

3.  Go to vercel.com → "Add New… → Project".
    - Click "Continue with GitHub", authorize it.
    - Find "ar-cleaning-dispatch" and click "Import".

4.  Vercel auto-detects Vite. Leave everything default and click "Deploy".
    - Build Command:   npm run build
    - Output Dir:      dist
    (Vercel fills these in for you.)

5.  Wait ~1 minute. Vercel gives you a link like
    https://ar-cleaning-dispatch.vercel.app
    Share it with your staff. It works on phone and desktop.

To update later: edit the file on GitHub (or re-upload), and Vercel
redeploys automatically.

--------------------------------------------------------------------
OPTION B — With terminal (faster if you have Node.js installed)
--------------------------------------------------------------------
1.  Install Node.js from nodejs.org (LTS version) if you don't have it.
2.  Unzip the project, open a terminal in the folder, then:

        npm install
        npm run dev        # preview locally at http://localhost:5173

3.  To deploy:

        npm install -g vercel
        vercel             # answer the prompts, accept defaults

    Vercel prints your live URL when it finishes.

--------------------------------------------------------------------
Notes
--------------------------------------------------------------------
- This prototype stores bookings only in the browser session; a refresh
  resets them. Real persistence + logins come when we connect a database.
- The map is simulated until a maps API key is added.
- Staff team is set in src/App.jsx (the CLEANERS list). Areas and price
  rules are near the top of the same file if you want to tweak them.
