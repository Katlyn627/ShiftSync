# ShiftSync

A smart scheduling + shift swap platform for restaurants/hotels.

## Features

- ⚡ **Auto-generated schedules** based on forecasted sales, historical demand, employee availability, and labor budgets
- 🔥 **Burnout risk prediction** — detects doubles, clopens (close then open), and excessive consecutive days
- 🔄 **Intelligent shift swaps** with manager guardrails (role match, overtime check, availability check)
- 💰 **Real-time labor cost tracking** with budget vs. actual comparisons and daily/role breakdowns

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + MongoDB (Mongoose)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts

## Getting Started

### 1. Configure environment variables

The server reads a **`server/.env`** file. A template with every supported variable is provided at `server/.env.example`.

```bash
cp server/.env.example server/.env
```

Then open `server/.env` and fill in the values (see the inline comments in the file).  
The most important ones to set before first run:

| Variable | Purpose |
|---|---|
| `PORT` | Port the Express server listens on (default `3001`) |
| `JWT_SECRET` | Secret used to sign JWTs — **must** be set in production |
| `SESSION_SECRET` | Secret for the OAuth session cookie — **must** be set in production |
| `MONGODB_URI` | MongoDB connection string — **required** for the database to work (see below) |
| `CLIENT_URL` | Origin of the React frontend — used for the post-OAuth redirect |

### 2. Connect to MongoDB

ShiftSync stores all data in MongoDB. You can use either **MongoDB Atlas** (free cloud tier) or a **local MongoDB** instance.

#### Option A — MongoDB Atlas (recommended for new setups)

1. Sign up or log in at [https://cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a free **Shared** (M0) cluster (any cloud region).
3. Under **Database Access**, create a database user. For development you can use the built-in *Read and write to any database* role. For production, create a custom role with access scoped to only the `shiftsync` database — see [Atlas custom roles](https://www.mongodb.com/docs/atlas/security-add-mongodb-roles/) for steps. Note the username and password.
4. Under **Network Access**, add your IP address (click *Add Current IP Address*). For development only you may use `0.0.0.0/0` to allow all IPs — **never do this in production**.
5. On the cluster overview page click **Connect → Drivers**, select **Node.js**, and copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority
   ```
6. Paste the URI into `server/.env`, appending the database name `shiftsync`:
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/shiftsync?retryWrites=true&w=majority
   ```

#### Option B — Local MongoDB

If you have MongoDB installed locally (e.g. via [MongoDB Community Server](https://www.mongodb.com/try/download/community)):

```
MONGODB_URI=mongodb://localhost:27017/shiftsync
```

The database and collection are created automatically on first run — no manual setup required.

#### Auto-seeding demo data

When the server starts and the database is **empty**, it automatically seeds demo employees, availability, forecasts, and user accounts. The default demo login credentials are `<first-name-lowercase>` / `password123` (e.g. `alice` / `password123`).

To seed (or re-seed) the database without starting the full server:

```bash
cd server && npm run seed:mongodb
```

#### Troubleshooting: `querySrv ECONNREFUSED`

If you see an error like:

```
MongoDB connection attempt 1/5 failed: querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
```

your network is blocking DNS SRV record lookups, which are required by `mongodb+srv://` connection strings. Use the **Standard connection string** instead:

1. In Atlas, click **Connect → Drivers**.
2. Switch **Connection method** to **Standard connection string**.
3. Copy the URI (it begins with `mongodb://`, not `mongodb+srv://`).
4. Update `server/.env`:
   ```
   MONGODB_URI=mongodb://<user>:<password>@<host1>:27017,<host2>:27017/shiftsync?ssl=true&replicaSet=<rs>&authSource=admin
   ```
5. Re-run the seed: `cd server && npm run seed:mongodb`

#### Enabling Google OAuth

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create an **OAuth 2.0 Client ID** (application type: *Web application*).
2. Add the appropriate callback URL to **Authorised redirect URIs**:
   - **Local development:** `http://localhost:3001/api/auth/google/callback`
   - **Production:** `https://<your-deployed-domain>/api/auth/google/callback`
     *(standard HTTPS on port 443 — omit the port number; include it only for non-standard ports)*

   > **Important:** The callback is handled directly by the Express server on port **3001**, not through the Vite dev-server proxy on port 3000. Make sure this exact URL is registered in Google Cloud Console — registering the wrong port (e.g. 3000) is the most common cause of `Error 400: redirect_uri_mismatch`.

3. Copy the client ID and secret into `server/.env`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CLIENT_URL=http://localhost:3000
```

`GOOGLE_CALLBACK_URL` is **optional**. When omitted the server derives the callback URL automatically from the incoming request (works for both local dev and production without any extra configuration). Set it explicitly only when you need to override the derived URL (e.g. if your server is behind a tunnel or a non-standard host):

```
# Only needed to override the auto-derived URL:
GOOGLE_CALLBACK_URL=https://myapp.example.com/api/auth/google/callback
```

If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` are left blank the `/api/auth/google` endpoint returns a `503` and Google sign-in is hidden from the UI — local username/password login still works.

> **Note:** `server/.env` is listed in `.gitignore` and will never be committed. Never commit real secrets.

##### Troubleshooting `Error 400: redirect_uri_mismatch`

This error means the `redirect_uri` sent to Google does not match any URI registered in Google Cloud Console. Check these common causes:

| Cause | Fix |
|-------|-----|
| Registered `http://localhost:3000/…` (frontend port) instead of `http://localhost:3001/…` (backend port) | Update the registered URI in Google Cloud Console to use port **3001** |
| `GOOGLE_CALLBACK_URL` is set to `http://localhost:3001/…` in a production deployment | Remove the override so the URL is derived automatically, or set it to the correct production URL |
| Production URL registered in Google Cloud Console doesn't match the deployed domain | Register `https://<your-deployed-domain>/api/auth/google/callback` in Google Cloud Console |

When the server starts with Google OAuth configured it prints the effective callback URL to the console — use that value as a reference for what to register.

### 3. Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 4. Run development servers
```bash
# Terminal 1 – backend (port 3001)
cd server && npm run dev

# Terminal 2 – frontend (port 3000)
cd client && npm run dev
```

Open http://localhost:3000


### Run tests
```bash
cd server && npm test
cd client && npm test
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/employees | List employees |
| POST | /api/employees | Create employee |
| PUT | /api/employees/:id | Update employee |
| DELETE | /api/employees/:id | Delete employee |
| GET/POST | /api/employees/:id/availability | Get/set availability |
| GET | /api/schedules | List schedules |
| POST | /api/schedules/generate | Auto-generate schedule |
| GET | /api/schedules/:id/shifts | Get schedule shifts |
| GET | /api/schedules/:id/labor-cost | Get labor cost summary |
| GET | /api/schedules/:id/burnout-risks | Get burnout risk analysis |
| PUT | /api/schedules/:id | Update schedule (publish/draft) |
| PUT | /api/shifts/:id | Update a shift |
| GET | /api/swaps | List shift swap requests |
| POST | /api/swaps | Request a shift swap |
| PUT | /api/swaps/:id/approve | Approve swap |
| PUT | /api/swaps/:id/reject | Reject swap |
| GET/POST | /api/forecasts | Get/upsert forecasts |

<!-- original readme below -->
A smart scheduling + shift swap platform for restaurants/hotels.