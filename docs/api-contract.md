# StudyScotty API contract

## Implemented

Base path: `/api/v1/`. JSON response fields use snake_case.

### GET `/health/`

Public, read-only database connectivity check. Successful response: HTTP 200.

```json
{
  "status": "ok",
  "service": "studyscotty-api"
}
```

POST and other write methods return HTTP 405. Database failures result in a server error; the endpoint does not claim readiness if the database cannot be queried.

Django admin is available separately at `/admin/` and uses Django session authentication. There are no mobile authentication endpoints yet. The profile endpoint requires authentication through the configured DRF authenticators. Mobile login and credential transport remain pending; these endpoints do not implement or select a mobile token scheme.

## Reserved feature prefixes

These URL includes define feature ownership. Accounts implements `me/`, moderation implements the account actions below, and spots implements reviews, favorites, busyness check-ins, and read-only hours; other feature endpoints remain pending:

| Prefix | Owner app | Scope |
| --- | --- | --- |
| `/accounts/` | accounts | Registration, login, UCR verification, profile, courses |
| `/spots/` | spots | Reviews, favorites, busyness, and hours are implemented; spot list/detail, creation, and photos remain pending |
| `/study-sessions/` | study_sessions | Sessions, RSVPs, attendance |
| `/moderation/` | moderation | Account actions; abuse reports and creation restrictions remain pending |

## Contract work before feature implementation

For each endpoint, document the method/path, request and response examples, status codes, field validation, permissions, and side effects. Define authentication and error formatting. DRF's configured default pagination uses `count`, `next`, `previous`, and `results`, with a page size of 20; list views must opt into the appropriate generic views or pagination helper.

Resolve and document UCR email ownership verification, unknown versus always-accessible hours, busyness expiration (one versus two hours), session limit scope, session lifecycle/check-in windows, and atomic RSVP capacity enforcement and duplicate behavior. Other feature endpoints and payloads remain pending their relevant decisions.

## Account field alignment

The separate authentication branch targets email/password login with JWT bearer
tokens and signup with `username`, `email`, and `password`. That implementation
is not included in this profile branch. Its username is a display name and
email is its login identifier; this profile feature does not change that design.
First and last names are optional profile fields, each up to 150 characters;
signup does not need to collect them. There is no `full_name` field.

The existing `study_preferences` field is the profile bio/description, matching
the frontend input. There are no separate `bio` or `description` fields. Email changes, UCR ownership verification, and photo uploads remain
pending. Domain validation is not ownership verification. No OAuth provider is
implemented by this profile feature.

## Current user profile

### GET `/accounts/me/`

Requires an authenticated, active user. Returns only the caller's profile;
there is no user ID parameter and no public profile lookup. HTTP 200:

```json
{
  "username": "scotty",
  "email": "scotty@ucr.edu",
  "first_name": "Scotty",
  "last_name": "Highlander",
  "study_preferences": "Quiet spaces with outlets"
}
```

For an account without a `UserProfile` row, `study_preferences` is `""`.
GET does not create a profile or change the database. This is a single object,
with no pagination. Passwords, permissions, photo storage keys, and verification
timestamps are not returned.

### PATCH `/accounts/me/`

Same authentication and ownership rules as GET. Accepts a partial JSON object:

```json
{
  "username": "scotty_studies",
  "study_preferences": "Morning study sessions"
}
```

HTTP 200 returns the complete profile in the GET format. Omitted fields are
unchanged; an empty object is a successful no-op. Updates across `User` and
`UserProfile` are atomic. A missing profile is created only when a valid update
includes `study_preferences`. Signup may also create profiles; it need not do
so for this endpoint to work.

| Field | Update rules |
| --- | --- |
| `username` | Nonblank string; max 150 characters; unique using the existing database's comparison rules; Django Unicode username validator (letters, numbers, and `@ . + - _`). User ID and ownership stay the same. The separate email-login implementation uses email rather than username; under the current development basic authentication, credentials still use the updated username. |
| `first_name`, `last_name` | Strings up to 150 characters; empty strings allowed. |
| `study_preferences` | Profile bio/description shown as "Study preferences" in the frontend. String; no API length limit; empty string allowed. |
| `email` | Read-only; including it in PATCH returns 400, even if unchanged. |

Text is trimmed. Nulls and non-string field values are rejected. Unknown fields
(including `bio`, `description`, `id`, `user`, `password`, and privilege or verification
fields) return 400. Validation failures leave all fields unchanged. Existing
blank names and unverified accounts can use this endpoint; it does not claim
UCR ownership has been verified.

Validation failures use field names mapped to arrays of messages, for example:

```json
{"username": ["A user with that username already exists."]}
```

| Status | Meaning |
| --- | --- |
| 200 | Successful read or partial update. |
| 400 | Invalid fields, duplicate username, non-object body, or malformed JSON. Non-field errors use `non_field_errors`; parse errors use `detail`. |
| 403 | Unauthenticated with the current DRF default authenticator ordering, or session-authenticated writes without valid CSRF. A future mobile authenticator may instead return 401 with its authentication challenge. |
| 405 | Unsupported method (POST, PUT, DELETE); GET, PATCH, HEAD, and OPTIONS are supported. |
| 415 | Unsupported request content type. Send JSON for PATCH. |

Current authentication is inherited from DRF defaults (session and basic).
Session-authenticated PATCH requests require CSRF. The separate authentication feature
will configure its mobile authenticator globally when integrated; this view uses
`request.user` and needs no user identifier from the client. Login/signup and
UCR verification remain outside this profile implementation.

The mobile profile screen still uses its in-memory adapter until the mobile
credential flow is ready. Replace `getProfile`/`updateProfile` internals with
GET/PATCH calls to this route using those credentials; do not send the full
GET object back as PATCH because email is read-only. Frontend validation is
for feedback; API validation is authoritative.

### Read and edit the profile bio/description

Use the existing profile route; no separate bio or description URL is needed.
`GET /accounts/me/` returns the saved bio in `study_preferences`. To update only
that text, send `PATCH /accounts/me/` with:

```json
{"study_preferences": "CS student at UCR. I prefer quiet spaces and small study groups."}
```

HTTP 200 returns the full profile, including the saved `study_preferences`.
Names, username, and email stay unchanged. A missing `UserProfile` row is created
when this valid update is saved. An empty string clears the bio; omitting the
field leaves it unchanged. Leading/trailing whitespace is trimmed; internal
newlines and Unicode text are preserved. Nulls, numbers, booleans, arrays, and
objects return 400 with `study_preferences` field errors. The keys `bio` and
`description` are not aliases and return 400, avoiding duplicate sources of
truth. Existing authentication and ownership rules apply.

The frontend's existing multiline field is labeled "Study preferences"
and continues to use the same `study_preferences` key in `getProfile()` and
`updateProfile()`. It still uses the in-memory adapter until mobile credentials
and real profile requests are integrated; saving in the app currently does not
exercise these backend endpoints.

## Admin account moderation

These endpoints are implemented independently of report submission and mobile
signup/login. Admin means an authenticated user with `is_staff=true`,
`is_active=true`, and no effective account restriction. Developers assign staff
access out of band; these endpoints never grant privileges. A superuser must
also have `is_staff=true`. No extra moderator group is required.

All paths below are relative to `/api/v1/`. POST JSON only; session-authenticated
writes require CSRF. Current session/basic authentication is unchanged.

| Method/path | JSON body | Result |
| --- | --- | --- |
| POST `/moderation/users/{id}/suspend/` | `{"reason": "Repeated abuse", "ends_at": "2027-01-15T18:00:00Z"}` | Suspend until a future instant. |
| POST `/moderation/users/{id}/ban/` | `{"reason": "Continued abuse"}` | Ban indefinitely. |
| POST `/moderation/users/{id}/restore/` | `{}` or `{"reason": "Appeal accepted"}` | Lift the current moderation restriction. |

`reason` must be a nonblank string for suspend/ban; restoration allows an
optional blank reason. Reasons are trimmed. `ends_at` is required only for
suspend and accepts an ISO 8601 datetime; timezone offsets are normalized and
datetimes without an offset are interpreted as UTC. Prefer an explicit `Z` or
offset. The end must be strictly later than the server time at the write.
Unknown fields, including `performed_by`, `is_staff`, `state`, and `ends_at` on
ban/restore, return 400. The actor and action time are server-assigned.

Each successful POST returns HTTP 200 with one object, without pagination:

```json
{
  "user_id": 42,
  "state": "suspended",
  "ends_at": "2027-01-15T18:00:00Z"
}
```

`state` is `active`, `suspended`, or `banned`. `ends_at` is null for active or
banned accounts. This describes moderation state, separately from Django's
`is_active` flag. Restoration does not enable an account manually disabled via
that flag, change credentials/privileges, or lift session-creation restrictions.

Transitions and duplicate handling:

- Active accounts can be suspended or banned. Restoring an active account is a
  successful no-op, including when its last suspension has expired.
- A suspended account can be banned, restored, or given a replacement expiry.
  Suspending it with the exact current expiry is a successful no-op.
- A banned account can be restored. Repeating a ban is a successful no-op;
  attempting to suspend it returns 409 until restored.
- No-ops still validate the request body and target permissions, but create no
  history and do not replace the existing reason.
- At `now >= ends_at`, the latest suspension no longer blocks access. No job or
  database update is required, and superseded restrictions never reactivate.

Admins cannot act on themselves, staff accounts, or superusers. Users and their
content are preserved. State changes append an audit row with target, actor,
action, reason, timestamp, and suspension expiry. Existing sessions/RSVPs are
not automatically cancelled; those lifecycle decisions remain pending.

| Status | Meaning |
| --- | --- |
| 200 | Action applied or valid no-op. |
| 400 | Missing/invalid fields, invalid expiry, non-object body, or malformed JSON. Field errors map to arrays; parse errors use `detail`. |
| 403 | Anonymous under current authenticator ordering; non-admin, disabled/restricted actor, protected target, or missing session CSRF. Permission errors use `detail`. Future mobile authentication may return 401 for missing credentials. |
| 404 | Target user does not exist. |
| 405 | Unsupported method; only POST and OPTIONS are supported. |
| 409 | Cannot suspend a banned account; error uses `detail`. |
| 415 | Unsupported request content type. |

`moderation.permissions.IsUnrestrictedUser` is the default DRF permission and
is also explicitly used by the current profile endpoint. It checks fresh user
flags and the latest moderation action on every protected request, so existing
session/basic credentials lose API access immediately after restriction and
can work again after expiry/restoration. The public health endpoint remains
accessible. Views that override permissions must retain this check when they
require unrestricted accounts; future JWT integration must enforce it for
protected requests and check account state when issuing/refreshing tokens.
These actions do not implement login, credential revocation, or an appeal API.

The audit history is read-only in Django admin. The report queue, report review
endpoints, and moderation history API remain future work.

## Spot reviews, favorites, busyness, and hours

Paths are relative to `/api/v1/spots/`. Every endpoint requires an
authenticated, unrestricted account (`IsUnrestrictedUser`), like the profile
endpoint: anonymous, disabled, suspended, and banned users receive 403 under the
current authenticator ordering. Writes accept JSON only (415 otherwise), and
session-authenticated writes require CSRF. An unknown `{spot_id}` returns 404.

Request bodies are strict: unknown or read-only keys return 400 with
`"Unknown field."` or `"This field is read-only."`, and values must have the
documented JSON type (for example, `"4"` and `true` are not ratings). Errors use
the same field-name-to-message-array format as the profile endpoint. The author,
reporter, favorite owner, spot, and all timestamps come from the request URL,
the authenticated user, and the server clock, never from the body.

Spot list/detail routes (`""` and `{spot_id}/`) are reserved for the spot map
feature and are not part of this section.

### Reviews

| Method/path | Result |
| --- | --- |
| GET `{spot_id}/reviews/` | 200, paginated (`count`, `next`, `previous`, `results`), newest first. |
| POST `{spot_id}/reviews/` | 201 with the created review. |
| GET `{spot_id}/reviews/summary/` | 200 with the rating summary below. |
| PATCH `reviews/{review_id}/` | 200 with the updated review; author only (403 otherwise). |
| DELETE `reviews/{review_id}/` | 204; author only (403 otherwise). |

POST and PATCH accept `rating` (JSON integer 1 to 5; required on POST) and
`comment` (string, optional, trimmed, up to 2000 characters; defaults to `""`).
PATCH is partial; PUT returns 405. Review object:

```json
{
  "id": 12,
  "spot": 1,
  "author": {"username": "scotty", "first_name": "Scotty", "last_name": "Highlander"},
  "rating": 4,
  "comment": "Quiet upstairs.",
  "created_at": "2026-11-13T21:05:00Z",
  "updated_at": "2026-11-13T21:05:00Z",
  "is_author": true
}
```

`is_author` tells the app whether to show edit/delete controls. Summary
(`average` is null and every count is 0 when a spot has no reviews):

```json
{"spot": 1, "average": 4.0, "review_count": 4, "counts": {"1": 0, "2": 0, "3": 1, "4": 2, "5": 1}}
```

Whether a user may review a spot only once is still pending (see
`docs/database.md`). Until the team decides, repeated reviews are accepted and no
uniqueness constraint is added.

### Favorites

| Method/path | Result |
| --- | --- |
| GET `favorites/` | 200, the caller's favorites only, paginated, newest first. |
| GET `{spot_id}/favorite/` | 200 with the favorite, or 404 with `{"detail": "This spot is not in your favorites."}`. |
| PUT `{spot_id}/favorite/` | 201 when created, 200 when it already existed. Idempotent. |
| DELETE `{spot_id}/favorite/` | 204, including when the spot was not a favorite. |

PUT accepts `{}` or `{"opening_reminder_enabled": true|false}` (JSON boolean).
A new favorite defaults to `false`; omitting the field on an existing favorite
leaves it unchanged. There is at most one favorite per user and spot, enforced
by the existing database constraint. Favorite object:

```json
{"spot": {"id": 1, "name": "Rivera Library"}, "opening_reminder_enabled": false, "created_at": "2026-11-13T21:05:00Z"}
```

`opening_reminder_enabled` only records the user's choice. Reminders themselves
are local notifications scheduled by the app (AGENTS.md); the server sends none.
When the app removes a favorite it should also cancel that spot's local
reminders.

### Busyness check-ins

| Method/path | Result |
| --- | --- |
| GET `{spot_id}/busyness/` | 200 with the current summary. |
| POST `{spot_id}/busyness/` | 201 with the created report, or 400 if the caller is too far away. |

POST body:

```json
{"level": "some_seats", "latitude": 33.97412, "longitude": -117.32818, "accuracy": 12.5}
```

`level` is `empty`, `some_seats`, or `packed`. `latitude` (-90 to 90) and
`longitude` (-180 to 180) are required JSON numbers; `accuracy` is the GPS
accuracy in meters (a number of at least 0, optional, nullable). Coordinates are
used only for the proximity check and are not stored.

The server checks proximity with `common/proximity.py`: the caller must be within
100 m of the spot, forgiving up to 50 m of reported GPS error. Too far returns
400 with a `location` message that includes the approximate distance:

```json
{"location": ["You are about 656 m from this spot. Move within 100 m to report how busy it is."]}
```

The server sets `reported_at` to now and `expires_at` one hour later.
**Provisional:** the proposal gives both about one and about two hours; one hour
matches the mobile app until the team records a decision. Report object (the
reporter is not exposed):

```json
{"id": 31, "spot": 1, "level": "packed", "reported_at": "2026-11-13T21:05:00Z", "expires_at": "2026-11-13T22:05:00Z"}
```

GET summary over unexpired reports only. The latest report sets `level`; `level`
null means Unknown (no current reports), and the app shows the report's age from
`reported_at`:

```json
{
  "spot": 1,
  "level": "some_seats",
  "reported_at": "2026-11-13T21:05:00Z",
  "expires_at": "2026-11-13T22:05:00Z",
  "report_count": 3,
  "counts": {"empty": 0, "some_seats": 1, "packed": 2}
}
```

Positions are client-reported, so the proximity check deters casual misuse but
does not prove presence. There is no rate limit on repeated check-ins yet.
Session check-ins should reuse `common/proximity.py` when implemented.

### Hours

GET `{spot_id}/hours/` returns 200 (read-only; other methods return 405):

```json
{
  "spot": 1,
  "hours_status": "scheduled",
  "timezone": "America/Los_Angeles",
  "opening_hours": [
    {"weekday": 0, "opens_at": "08:00:00", "closes_at": "12:00:00", "closes_next_day": false},
    {"weekday": 4, "opens_at": "20:00:00", "closes_at": "02:00:00", "closes_next_day": true}
  ]
}
```

`hours_status` is `unknown`, `always_accessible`, or `scheduled`. Intervals are
listed only for `scheduled` spots, sorted by weekday (0 = Monday) and opening
time, using the rules in `docs/database.md`. Setting hours belongs to spot
creation and is not part of this endpoint.

The mobile app still uses in-memory adapters (`api/reviews.js`,
`api/favorites.js`, `api/busyness.js`, `api/spots.js`) until mobile credentials
are integrated; they use these field names so they can switch to these routes.
