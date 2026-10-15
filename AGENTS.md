# StudyScotty

Mobile app for UCR students to find, post, and rate study spots and join study sessions.

## Stack
- Mobile: React Native, Expo Go, React Native Maps
- Backend: Django + Django REST Framework
- DB: SQLite (dev), PostgreSQL (deploy)

## Layout
- Scaffolded structure:
  - `mobile/`: Expo app (screens, components, API client)
  - `backend/config/`: Django settings and root URLs
  - `backend/accounts/`: Custom user model, authentication, and profiles
  - `backend/spots/`: Spots, photos, hours, reviews, favorites, and busyness reports
  - `backend/study_sessions/`: Study sessions, RSVPs, and attendance; use this name to distinguish it from Django's built-in sessions app
  - `backend/moderation/`: Abuse reports and session-creation restrictions
  - `backend/common/`: Shared utilities, including proximity checks
  - `docs/api-contract.md`: API contract
  - `docs/database.md`: Database design and entity relationships

## Commands
- After installing dependencies, run from `backend/`: `python manage.py runserver`, `python manage.py migrate`, `python manage.py test`.
- Run from `mobile/`: `npx expo start`.

## Week-one deliverables
- API contract: routes, authentication, request/response examples, status codes, validation errors, permissions, and pagination.
- Database design: entities, relationships, required fields, uniqueness constraints, deletion behavior, and session states and transitions.
- Runnable backend scaffold: project configuration, feature apps, custom user model, initial migrations, admin registration, and a health endpoint. Establish the custom user model before the initial migrations.
- Setup documentation: dependencies, environment variables, migrations, and instructions for reaching the backend from a physical phone.
- Agree on the contract and schema before feature implementation; week one does not require every endpoint to be implemented.

## Decisions to resolve
- Choose one busyness expiration period; the proposal currently specifies both one and two hours.
- Distinguish unknown opening hours from an explicit "always accessible" setting.
- Decide whether the one-active-or-upcoming-session limit applies to sessions a user creates, joins, or both.
- Define UCR email ownership verification.
- Define session lifecycle transitions, check-in windows, cancellation, and no-show behavior.
- Define RSVP capacity enforcement and duplicate-request behavior.
- Record agreed decisions in the API contract and database design; do not silently treat unresolved choices as settled requirements.

## Conventions
- API responses are JSON with snake_case fields. Document the agreed interface in `docs/api-contract.md` and keep it updated.
- When implementing proximity checks, put the shared check in `backend/common/proximity.py`; reuse it across busyness reports and session check-ins.
- Use local scheduled reminders for the MVP.
- Distinguish busyness reports from abuse reports in model names and API routes.

## Rules
- Include migrations and update `docs/database.md` when changing models. Changes to the agreed schema require PR review.
- Update `docs/api-contract.md` when changing the API interface.
- Never commit `.env` or secrets.
- Keep changes scoped to the feature you were asked about.
