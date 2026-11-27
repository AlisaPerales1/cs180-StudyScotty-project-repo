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

Django admin is available separately at `/admin/` and uses Django session authentication. Mobile requests use JWT bearer authentication. DRF also retains session/basic authentication for existing development clients; use HTTPS outside local development.

## Reserved feature prefixes

These URL includes define feature ownership. Accounts implements signup/login, retained Google routes, and `me/`; moderation implements the account actions below; other feature endpoints remain pending:

| Prefix | Owner app | Scope |
| --- | --- | --- |
| `/accounts/` | accounts | Registration, login, UCR verification, profile, courses |
| `/spots/` | spots | Spots, photos, hours, reviews, favorites, busyness |
| `/study-sessions/` | study_sessions | Sessions, RSVPs, attendance |
| `/moderation/` | moderation | Account actions; abuse reports and creation restrictions remain pending |

## Contract work before feature implementation

For each endpoint, document the method/path, request and response examples, status codes, field validation, permissions, and side effects. Define authentication and error formatting. DRF's configured default pagination uses `count`, `next`, `previous`, and `results`, with a page size of 20; list views must opt into the appropriate generic views or pagination helper.

Resolve and document UCR email ownership verification, unknown versus always-accessible hours, busyness expiration (one versus two hours), session limit scope, session lifecycle/check-in windows, and atomic RSVP capacity enforcement and duplicate behavior. Other feature endpoints and payloads remain pending their relevant decisions.

## Account field alignment

Mobile signup accepts `username`, `email`, and `password`; email identifies login
and username remains an editable display name. Nonblank emails are unique
case-insensitively in the database. Signup normalizes email to lowercase.
First and last names are optional profile fields, each up to 150 characters;
signup does not need to collect them. There is no `full_name` field.

The existing `study_preferences` field is the profile bio/description, matching
the frontend input. There are no separate `bio` or `description` fields. Email changes, UCR ownership verification, and photo uploads remain
pending. Domain validation is not ownership verification. Google backend endpoints are retained below, but mobile Google entry points are deferred.

## Signup and login

### POST `/accounts/signup/`

Public; ignores any stale Authorization header. Request:

```json
{"username": "scotty", "email": "scotty@ucr.edu", "password": "a-strong-private-password"}
```

HTTP 201:

```json
{"message": "Account created successfully.", "user": {"id": 1, "username": "scotty", "email": "scotty@ucr.edu"}}
```

Username follows Django's username validator (unique, maximum 150 characters).
Email must be a valid `@ucr.edu` address, is trimmed/lowercased, and must be unique
case-insensitively. Password whitespace is preserved; Django's configured length,
common-password, numeric-password, and user-similarity checks apply. Passwords are
hashed and never returned. A successful signup does not authenticate the caller,
create a profile, or verify UCR email ownership. The mobile app returns to login.

HTTP 400 covers missing/invalid fields and duplicate email/username, including
signup races. Field errors map to message arrays, for example:
`{"email": ["An account with this email already exists."]}`.
Object-level errors use `non_field_errors`. No pagination applies.

### POST `/accounts/login/`

Public; ignores stale Authorization headers. Request:

```json
{"email": "scotty@ucr.edu", "password": "a-strong-private-password"}
```

HTTP 200:

```json
{"access": "<access-jwt>", "refresh": "<refresh-jwt>", "user": {"id": 1, "username": "scotty", "email": "scotty@ucr.edu"}}
```

Email matching is case-insensitive; password whitespace is significant. Unknown
email, incorrect password, or manually disabled user returns 400 with
`{"non_field_errors": ["Invalid email or password."]}`. A suspended/banned user
with correct credentials returns 403 with `detail`; expired suspensions and
restored accounts may log in. Validation errors use field arrays.

Send `Authorization: Bearer <access>` to protected endpoints. Access tokens use
SimpleJWT's five-minute lifetime. To keep this integration scoped, automatic
refresh is deferred: the existing response's refresh token is retained but there
is no refresh endpoint. The mobile client clears stored tokens and returns to
login on a protected 401. It does not attach old tokens to public signup/login.
Native tokens use SecureStore; browser tokens are in memory and reset on reload.
Profile has a local logout action that clears tokens; there is no server-side
logout/revocation endpoint, so a copied access token remains usable until expiry
unless account restrictions block it. Never log or commit tokens.

All auth POST routes return 405 for unsupported methods and 415 for unsupported
content types; malformed JSON returns 400. No list pagination applies.

### Retained Google backend routes (mobile UI deferred)

The original Google implementation remains for follow-up work. Mobile Google
buttons/linking are disabled, and the native Google module is loaded only when
that feature is explicitly enabled in code. Completing the native config plugin,
iOS URL scheme/client setup, and development-build verification is required before
enabling it; it cannot run in Expo Go. Ordinary signup/login works in Expo Go.

- POST `/accounts/google/`: public, body `{"id_token": "<google-id-token>"}`.
  Requires backend `GOOGLE_WEB_CLIENT_ID`. The token is verified against that
  audience, and must carry a subject and a verified `@ucr.edu` email. An existing
  linked identity must match the stored email and be active/unrestricted. New
  identities create a user with an unusable password and one GoogleIdentity row
  atomically. HTTP 200 returns the same tokens/user shape as password login.
  Email matches alone never automatically link an existing local account.
- POST `/accounts/google/link/`: requires JWT authentication and an unrestricted
  account, body `{"id_token": "<google-id-token>", "password": "<local-password>"}`.
  Requires the correct local password and a verified Google email matching the
  caller. HTTP 200 returns `message` and, for a newly created link, `user`.
  Repeating the same link returns 200 with a message and creates no extra row.

Google routes return 400 for missing token/password, 401 for invalid Google tokens
(or missing/invalid JWT on linking), 403 for unverified/non-UCR/mismatching email,
incorrect/unusable local password, disabled or restricted account, 409 for an
existing local email requiring explicit linking, conflicting identity, or a
concurrent creation/link conflict, and 503 if Google configuration is absent.
Provider errors use `error`; authentication/permission failures use `detail`.
UCR ownership verification policy remains unresolved: neither password signup nor
the retained Google routes marks `UserProfile.email_verified_at`.

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
| `username` | Nonblank string; max 150 characters; unique using the existing database's comparison rules; Django Unicode username validator (letters, numbers, and `@ . + - _`). User ID and ownership stay the same. Mobile login uses email rather than username; development basic authentication still uses the updated username. |
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
| 401 | Missing, invalid, or expired credentials; includes a Bearer authentication challenge. |
| 403 | Disabled/restricted account or session-authenticated write without valid CSRF. |
| 405 | Unsupported method (POST, PUT, DELETE); GET, PATCH, HEAD, and OPTIONS are supported. |
| 415 | Unsupported request content type. Send JSON for PATCH. |

Authentication uses `Authorization: Bearer <access>`. Session/basic authentication
remains available; session-authenticated PATCH requires CSRF. UCR email ownership
verification is pending and is not implied by successful signup/login.

The mobile profile adapter now calls GET/PATCH with the stored bearer token.
Only editable fields are sent on PATCH; email stays read-only.

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
`updateProfile()`. It uses the authenticated profile adapter; saved changes persist in the backend.

## Admin account moderation

These endpoints are implemented independently of report submission and mobile
signup/login. Admin means an authenticated user with `is_staff=true`,
`is_active=true`, and no effective account restriction. Developers assign staff
access out of band; these endpoints never grant privileges. A superuser must
also have `is_staff=true`. No extra moderator group is required.

All paths below are relative to `/api/v1/`. POST JSON only; session-authenticated
writes require CSRF. JWT bearer, session, and basic authentication are supported.

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
| 401 | Missing, invalid, or expired credentials; includes a Bearer authentication challenge. |
| 403 | Non-admin, disabled/restricted actor, protected target, or missing session CSRF. Permission errors use `detail`. |
| 404 | Target user does not exist. |
| 405 | Unsupported method; only POST and OPTIONS are supported. |
| 409 | Cannot suspend a banned account; error uses `detail`. |
| 415 | Unsupported request content type. |

`moderation.permissions.IsUnrestrictedUser` is the default DRF permission and
is also explicitly used by the current profile endpoint. It checks fresh user
flags and the latest moderation action on every protected request, so existing
JWT/session/basic credentials lose API access immediately after restriction and
can work again after expiry/restoration. The public health endpoint remains
accessible. Views that override permissions must retain this check when they
require unrestricted accounts; JWT login checks account state before issuing tokens. Refresh is deferred; any future refresh endpoint must repeat that check.
These actions do not implement login, credential revocation, or an appeal API.

The audit history is read-only in Django admin. The report queue, report review
endpoints, and moderation history API remain future work.
