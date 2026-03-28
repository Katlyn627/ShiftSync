# Running ShiftSync on an Android / Samsung Phone

ShiftSync is a web application (React + Node.js). You do **not** install an `.apk` file — you open it in a browser, just like any website. The three options below go from easiest to most advanced.

---

## Option A — Deploy to Render.com (Recommended)

> ✅ Works from **anywhere** (home, work, mobile data). No PC needs to stay on.  
> 🆓 Render's free tier is enough for personal / demo use.

### What you'll need

| Tool | Where to get it |
|------|----------------|
| Git | Already installed if you cloned the repo |
| A GitHub account | You already have one (the repo owner) |
| A Render account | [render.com](https://render.com) — sign up free with your GitHub account |

---

### Step 1 — Sign up / log in to Render

1. Go to **[https://render.com](https://render.com)** on your PC.
2. Click **"Get Started for Free"** → sign in with **GitHub**.
3. Authorize Render to access your repositories when prompted.

---

### Step 2 — Create a new Web Service

1. From the Render dashboard click **"New +"** → **"Web Service"**.
2. Select **"Build and deploy from a Git repository"**.
3. Find **Katlyn627/ShiftSync** in the list and click **Connect**.

---

### Step 3 — Configure the service

Fill in these fields:

| Field | Value |
|-------|-------|
| **Name** | `shiftsync` (or anything you like) |
| **Region** | Pick the one closest to you |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm install --prefix server && npm install --prefix client && npm run build` |
| **Start Command** | `npm run start` |
| **Instance Type** | `Free` |

---

### Step 4 — Add environment variables

Scroll down to **"Environment Variables"** and add the following. Click **"Add Environment Variable"** for each row:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | A random string — use [generate-secret.vercel.app](https://generate-secret.vercel.app/32) to make one |
| `SESSION_SECRET` | Another random string (same generator) |
| `DB_PATH` | `./shiftsync.db` |

> **Google OAuth is optional.** Skip `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` if you only need username/password login. The Google sign-in button will be hidden automatically.

---

### Step 5 — Deploy

1. Click **"Create Web Service"** at the bottom.
2. Render will clone the repo, install dependencies, build the project, and start the server. This takes **3–5 minutes** the first time.
3. Watch the build log — when you see `ShiftSync server running on…` the deploy is done.
4. Your app URL appears at the top of the page, e.g.:  
   `https://shiftsync.onrender.com`

---

### Step 6 — Open on your Samsung / Android phone

1. Open **Chrome** on your phone.
2. Type your Render URL into the address bar (e.g., `https://shiftsync.onrender.com`).
3. Log in with any demo account:

   | Username | Password | Role |
   |----------|----------|------|
   | `alice` | `password123` | Manager |
   | `iris` | `password123` | Manager |
   | `quinn` | `password123` | Manager |

4. *(Optional)* Add it to your home screen: tap the **three-dot menu → "Add to Home screen"** in Chrome. It will behave like an installed app.

> ⚠️ **Free-tier cold starts:** Render spins down free services after 15 minutes of inactivity. The first request after idle may take 30–60 seconds. Paid plans (from $7/mo) eliminate this.

---

## Option B — Same WiFi / Local Network (No Internet Required)

> ✅ Good for demos at home where your phone and PC are on the same WiFi.  
> ❌ Does **not** work over mobile data or from a different network.

### What you'll need

- A Windows, Mac, or Linux PC with **Node.js 20+** installed  
  → Download from [nodejs.org](https://nodejs.org) (choose the LTS version)
- Your Android phone connected to the **same WiFi** as your PC

---

### Step 1 — Install Node.js on your PC

1. Go to **[https://nodejs.org](https://nodejs.org)**.
2. Download the **LTS** installer for your OS and run it. Accept all defaults.
3. Open a terminal / command prompt and confirm:
   ```
   node --version   # should print v20.x.x or higher
   npm --version    # should print 9.x.x or higher
   ```

---

### Step 2 — Download the project

**If you already cloned it**, skip to Step 3. Otherwise:

```bash
git clone https://github.com/Katlyn627/ShiftSync.git
cd ShiftSync
```

Or download the ZIP from GitHub:  
`Code → Download ZIP` → extract it somewhere easy like your Desktop.

---

### Step 3 — Install dependencies

Open a terminal **inside the `ShiftSync` folder** and run:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

---

### Step 4 — Configure the server

```bash
# Windows (Command Prompt)
copy server\.env.example server\.env

# Mac / Linux
cp server/.env.example server/.env
```

Open `server/.env` in any text editor. The defaults are fine for local use — you don't need to change anything to get started.

---

### Step 5 — Start the app

```bash
npm run dev
```

You'll see output like:

```
[server] ShiftSync server running on http://localhost:3001
[client] ➜  Local:   http://localhost:3000/
[client] ➜  Network: http://192.168.1.45:3000/     ← YOUR PC'S LOCAL IP
```

The **Network** line is the address you'll use on your phone. Copy it.

---

### Step 6 — Find your PC's local IP (if not shown)

**Windows:**
1. Press `Win + R`, type `cmd`, press Enter.
2. Run: `ipconfig`
3. Look for **"IPv4 Address"** under your WiFi adapter, e.g. `192.168.1.45`.

**Mac:**
1. Open **System Settings → Network → WiFi → Details**.
2. Copy the **IP address** shown.

---

### Step 7 — Open on your Android phone

1. Make sure your phone is on the **same WiFi** as your PC.
2. Open **Chrome** on your phone.
3. Enter the Network URL from Step 5, e.g.:  
   `http://192.168.1.45:3000`
4. Log in with `alice` / `password123`.

> Keep the terminal on your PC open while you use the app — closing it stops the server.

---

## Option C — Termux (Run Directly on Android) — Advanced

> ✅ Everything runs on your phone, no PC needed.  
> ⚠️ Requires comfort with command-line tools. Some packages may need manual fixes.

### What you'll need

- Samsung / Android phone with at least **4 GB RAM** recommended
- **Termux** — install from **F-Droid** (not the Play Store version, which is outdated):  
  [https://f-droid.org/packages/com.termux/](https://f-droid.org/packages/com.termux/)

---

### Step 1 — Install Termux from F-Droid

1. On your phone, go to [https://f-droid.org](https://f-droid.org) in Chrome.
2. Download and install the **F-Droid** app (you may need to allow installs from unknown sources in Settings).
3. Open F-Droid, search for **"Termux"**, and install it.

---

### Step 2 — Set up Node.js inside Termux

Open Termux and run these commands one at a time:

```bash
# Update package lists
pkg update && pkg upgrade -y

# Install Node.js and git
pkg install nodejs git -y

# Confirm versions
node --version
npm --version
```

---

### Step 3 — Clone and install the project

```bash
# Clone the repo (inside Termux)
git clone https://github.com/Katlyn627/ShiftSync.git
cd ShiftSync

# Install dependencies
npm install
npm install --prefix server
npm install --prefix client
```

> **Note on `better-sqlite3`:** This native module compiles from source. It may take several minutes and requires Python + build tools. If it fails, run:
> ```bash
> pkg install python clang make -y
> npm install --prefix server
> ```

---

### Step 4 — Configure environment

```bash
cp server/.env.example server/.env
```

The defaults are fine for local use.

---

### Step 5 — Build and start

Because Termux doesn't easily run two processes side-by-side, build the client first and let the server serve it:

```bash
# Build both server and client
npm run build

# Start just the server (it also serves the built client)
npm run start
```

The server starts on port `3001`.

---

### Step 6 — Open in Chrome on the same phone

1. Open **Chrome** on your phone.
2. Go to: `http://localhost:3001`
3. Log in with `alice` / `password123`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Render app loads but API calls fail | Check that `NODE_ENV=production` is set in Render env vars |
| Phone can't reach PC (Option B) | Confirm both devices are on the same WiFi; check PC firewall allows port 3000 |
| Windows firewall blocking | `Windows Defender Firewall → Allow an app → Add node.exe` |
| `better-sqlite3` build error in Termux | `pkg install python clang make -y` then re-run `npm install --prefix server` |
| Render deploy fails on build step | Check the Render build log; ensure **Build Command** matches exactly what's in Step 3 |
| App shows blank page after Render deploy | Hard-refresh Chrome: pull down on the page or `Ctrl+Shift+R` |
| Free Render instance is slow to wake | First request after 15 min idle takes ~30–60 s. This is normal on the free tier |

---

## Demo Login Accounts

All demo accounts use the password **`password123`**.

| Username | Role | Site |
|----------|------|------|
| `alice` | Manager | Bella Napoli (Restaurant, Chicago) |
| `iris` | Manager | The Blue Door (Restaurant, Austin) |
| `quinn` | Manager | Grand Pacific Hotel (Hotel, New York) |
| `yara` | Manager | Seaside Suites & Spa (Hotel, Miami) |

For all 32 accounts see [docs/demo-data.md](demo-data.md).
