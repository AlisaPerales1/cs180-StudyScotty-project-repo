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

These URL includes define feature ownership. Accounts now implements `me/`; the remaining prefixes contain no feature endpoints yet:

| Prefix | Owner app | Scope |
| --- | --- | --- |
| `/accounts/` | accounts | Registration, login, UCR verification, profile, courses |
| `/spots/` | spots | Spots, photos, hours, reviews, favorites, busyness |
| `/study-sessions/` | study_sessions | Sessions, RSVPs, attendance |
| `/moderation/` | moderation | Abuse reports and creation restrictions |

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
