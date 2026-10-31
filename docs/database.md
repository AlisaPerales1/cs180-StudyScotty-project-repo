# Database architecture

## Implemented schema

The backend implements the 15 domain tables in the supplied [ERD](erd.dbml). Django models and migrations are the executable schema. DBML names are conceptual; Django uses app-prefixed table names such as `spots_spot`.

| App | Models | Main relationships |
| --- | --- | --- |
| accounts | User, UserProfile, Course, UserCourse | One profile per user; unique user/course membership |
| spots | Spot, SpotPhoto, OpeningHours, Review, Favorite, BusynessReport | Spot creator, photo uploader, review author, favorites, and busyness reporter |
| study_sessions | StudySession, RSVP, SessionCheckIn | Session creator/spot/course; unique session/user RSVP; optional check-in busyness report |
| moderation | AbuseReport, SessionCreationRestriction | Session reports, reporters/reviewers, restricted users, and lifting admins |

All relationships to users use `settings.AUTH_USER_MODEL`. Django's built-in auth, group, permission, admin, and login-session tables also exist. They are omitted from the ERD.

`User` retains `AbstractUser` and username/password login. Email is now required by model/admin validation, without introducing email uniqueness or enforcing a UCR domain. Existing users are not rewritten or automatically verified. Passwords use Django hashing. Profiles are explicit one-to-one records; creating a user does not automatically create a profile. The profile API reads a missing profile as empty study preferences and creates the row on a valid preferences update. Profile updates do not change the schema.

Optional text uses empty strings following Django conventions, including inherited first/last names, descriptions, storage keys, comments, and cancellation reasons. Unknown noise and amenity values remain SQL NULL, as in the ERD. Photos are storage references; no upload provider is configured.

## Database connection and setup

The connection is configured by `config/database.py`, used by `config/settings.py`, and reads `DATABASE_URL` from the environment or `backend/.env`. Blank/unset URLs select `backend/db.sqlite3`. Local environment files and the SQLite database are ignored by Git.

From `backend/`:

```sh
source .venv/bin/activate
python -m pip install -r requirements.txt
# First-time setup only; preserve your existing .env if already present:
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

For PostgreSQL, provision a database and set this in `backend/.env`, replacing the example values:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/studyscotty?sslmode=require
```

Use the SSL configuration required by your provider, then run the same migrations. The PostgreSQL driver is already in `requirements.txt`. Persistent connections use a 600-second maximum age outside debug mode and health checks on reuse. Set a private secret, `DJANGO_DEBUG=false`, and explicit hosts for deployment. Never commit connection credentials.

`GET /api/v1/health/` checks the configured database with `SELECT 1`. A PostgreSQL URL selects that server; it does not provision it or copy existing SQLite data.

## Database constraints

- Unique username and course code; one profile per user; unique user/course, user/favorite-spot, and session/RSVP-user pairs.
- Latitude between -90 and 90; longitude between -180 and 180; review ratings between 1 and 5.
- Enumerated noise, hours, busyness, session, RSVP, check-in, and abuse-report values are enforced by database checks as well as model choices.
- Opening weekdays are 0=Monday through 6=Sunday. Same-day intervals must end after opening; next-day intervals end at or before the opening clock time. Equal clock times plus `closes_next_day=true` represents 24 hours. Multiple intervals per weekday are allowed; overlap detection and holiday exceptions are not implemented.
- Session capacity is positive; session end follows start and is at most two hours later.
- Busyness expiry follows report time. Expiration must be supplied explicitly; no one-hour/two-hour default is assumed.
- Restriction end follows start. Reviewer/time and restriction-lifter/time fields must be filled or empty together.
- IANA spot timezone validation runs during model validation. With `USE_TZ=true`, Django date/time fields represent timezone-aware instants; opening-hour `time` values are local wall-clock times in the spot timezone.

Composite indexes cover spot/report time, session spot/start, course/start, and creator/status. Django also indexes foreign keys.

## Deletion policy selected for this implementation

These are conservative implementation defaults for PR review; the source ERD did not specify deletion behavior.

- UserProfile and UserCourse cascade with their user. UserCourse also cascades with its course.
- Spot creator, photo uploader, review author, busyness reporter, session creator, RSVP user, and check-in user use PROTECT. Referenced users cannot be deleted until their dependent records are deliberately handled.
- Photos, opening hours, reviews, favorites, and busyness reports cascade with their spot; favorites also cascade with their user.
- A StudySession protects its spot and course. RSVPs and check-ins cascade with their session.
- A check-in protects its linked BusynessReport, preventing removal of an attached report.
- Abuse reports protect their session, reporter, and reviewer. SessionCreationRestriction protects its user and lifting admin. This preserves moderation records.

Use account deactivation instead of casually deleting users with history. There is no automatic retention/deletion job.

## Validation and feature boundaries

`SessionCheckIn.clean()` rejects a linked report whose spot or reporter differs from the session spot or check-in user. Django admin calls model validation. Ordinary `save()`, `objects.create()`, bulk operations, and queryset updates do not automatically run `full_clean()`; future write services must validate and transact linked records together, including locking if they can be edited concurrently. Do not treat this cross-table check as a database constraint.

This change creates the storage schema, not feature endpoints. GPS proximity, check-in authorization/windows, atomic RSVP capacity enforcement, email verification/reset on email changes, local reminder scheduling, no-show expiration, and automatic moderation blocks still require feature services. No background process changes session states merely because time passes.

## Decisions still pending

- UCR ownership verification, email login/uniqueness, and blank emails on any existing accounts.
- Whether reviews are limited to one per user per spot; no such unique constraint is currently imposed.
- One-hour versus two-hour busyness freshness; callers must specify expiry.
- Whether the one-active/upcoming-session limit applies to creation, participation, or both.
- Whether the creator consumes an RSVP/capacity slot; session transitions, duplicate check-ins, and cancellation/rejoin policies.
- Automatic restriction thresholds/duration, moderation retention, photo provider, and any revisions to the conservative deletion policy.

## Verification

From `backend/`:

```sh
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Tests exercise database constraints, relationship uniqueness, deletion protection/cascades, linked check-in model validation, and SQLite/PostgreSQL connection URL parsing. Live PostgreSQL verification requires a provisioned server and has not been performed as part of local SQLite setup.
