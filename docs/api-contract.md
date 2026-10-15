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

Django admin is available separately at `/admin/` and uses Django session authentication. There are no mobile authentication endpoints yet. Other API views default to requiring authentication; a mobile authentication strategy must be agreed before exposing feature routes.

## Reserved feature prefixes

These URL includes are scaffolded but contain no endpoints yet; requests to them currently return 404:

| Prefix | Owner app | Scope |
| --- | --- | --- |
| `/accounts/` | accounts | Registration, login, UCR verification, profile, courses |
| `/spots/` | spots | Spots, photos, hours, reviews, favorites, busyness |
| `/study-sessions/` | study_sessions | Sessions, RSVPs, attendance |
| `/moderation/` | moderation | Abuse reports and creation restrictions |

## Contract work before feature implementation

For each endpoint, document the method/path, request and response examples, status codes, field validation, permissions, and side effects. Define authentication and error formatting. DRF's configured default pagination uses `count`, `next`, `previous`, and `results`, with a page size of 20; list views must opt into the appropriate generic views or pagination helper.

Resolve and document UCR email ownership verification, unknown versus always-accessible hours, busyness expiration (one versus two hours), session limit scope, session lifecycle/check-in windows, and atomic RSVP capacity enforcement and duplicate behavior. Feature endpoints and payloads are deliberately pending these decisions.
