# StudyScotty

Mobile app for UCR students to discover and share study spots and organize study sessions.

## Stack

- Mobile: JavaScript, React Native, Expo SDK 57, Expo Router, React Native Maps.
- Device modules: Expo Location, Camera, and Notifications (installed; feature flows pending).
- API: Python, Django 5.2, Django REST Framework.
- Database: SQLite locally; PostgreSQL via `DATABASE_URL` for deployment.

## Prerequisites

Use Node.js 22.13 or newer and Python 3.12 or newer. The scaffold was verified with Node 22 and Python 3.13. Install Expo Go with support for SDK 57 on your phone.

## Backend

From the repository root:

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

If `.env` already exists, edit it instead of overwriting it. Windows users can activate the environment with `.venv\Scripts\activate`.

- Health check: `http://localhost:8000/api/v1/health/`
- Django admin: `http://localhost:8000/admin/`

Feature apps live in `accounts/`, `spots/`, `study_sessions/`, and `moderation/`. Shared API utilities live in `common/`; Django configuration lives in `config/`.

## Mobile

In another terminal, from the repository root:

```sh
cd mobile
npm ci
cp .env.example .env
npm start
```

Scan the QR code with Expo Go, or use `npm run ios` / `npm run android` with a simulator or emulator. `npm run web` provides a browser preview; the native map has a browser fallback.

Discover shows a UCR campus map. Study Circles and Profile provide starting screens for feature work. Profile checks connectivity to the health endpoint and offers a retry button.

### Connect a physical phone

1. Connect the phone and computer to the same Wi-Fi network.
2. Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to `http://YOUR_COMPUTER_LAN_IP:8000/api/v1`.
3. Add that IP to the comma-separated `DJANGO_ALLOWED_HOSTS` in `backend/.env`.
4. Start Django with `runserver 0.0.0.0:8000`, then restart Expo after changing environment variables.
5. Open `http://YOUR_COMPUTER_LAN_IP:8000/api/v1/health/` in the phone's browser to check connectivity. If it fails, check firewall access and Wi-Fi client isolation.

Use `localhost` for the iOS simulator and `10.0.2.2` for the Android emulator. The backend environment example allows both; if you already have a backend `.env`, add `10.0.2.2` to `DJANGO_ALLOWED_HOSTS`. Expo's tunnel option only tunnels Metro; it does not expose Django. Public `EXPO_PUBLIC_*` variables are bundled into the app: never put secrets in them.

## Checks

From `backend/`, with the environment activated:

```sh
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

From `mobile/`:

```sh
npm run lint
npm run typecheck
npm run check
```

JavaScript files use TypeScript's `checkJs` for static checks; app code remains JavaScript.

The installed Expo dependency tree currently reports 29 npm audit advisories (19 high, 10 moderate), including transitive dependencies. Compatible `npm audit fix` updates were applied; remaining suggested fixes require breaking dependency changes. Reassess these before deployment.

## Database and deployment configuration

Leaving `DATABASE_URL` blank uses the ignored local `backend/db.sqlite3`. To use PostgreSQL, create a database and set a URL such as `postgresql://USER:PASSWORD@HOST:5432/studyscotty`. The PostgreSQL driver is included. Apply the same migrations with `python manage.py migrate`.

Before deployment, set `DJANGO_DEBUG=false`, a unique random `DJANGO_SECRET_KEY`, explicit allowed hosts, and the required database SSL options in `DATABASE_URL`. Hosting, production serving, HTTPS, and photo storage are still to be selected; Django's development server is for local use.

## Project documents

- [Agent guidance](AGENTS.md)
- [API contract and pending decisions](docs/api-contract.md)
- [Database architecture](docs/database.md)

This is the initial scaffold. Registration/login, UCR verification, spot CRUD, photo upload, ratings, favorites, busyness, session/RSVP logic, and reminder flows are not implemented yet.
