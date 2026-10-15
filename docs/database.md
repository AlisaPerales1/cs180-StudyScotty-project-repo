# Database architecture

## Implemented foundation

SQLite is the local default. `DATABASE_URL` selects PostgreSQL for deployment. Django migrations are the source of truth; do not maintain separate SQL schemas for each database.

`AUTH_USER_MODEL = "accounts.User"` is configured before the first migration. The initial custom model extends Django's `AbstractUser` without additional fields. It currently uses Django's username/password semantics and standard admin, permissions, and group relationships. Django handles password hashing. UCR verification and mobile authentication are not implemented, and creating a user does not verify university membership.

The `accounts` initial migration creates the user table. Built-in Django apps provide admin, authentication, content-type, and session tables. The other feature apps have no domain models or tables yet.

## Proposed entities — review before implementing

| App | Candidate entity | Relationships / decisions |
| --- | --- | --- |
| accounts | User, Course, UserCourse | User-to-course membership; verification and profile fields pending |
| spots | Spot | Creator user; coordinates, tags, location details |
| spots | SpotPhoto | Spot and uploader; storage provider pending |
| spots | OpeningHours | Spot; timezone and weekly/overnight hours representation pending |
| spots | Review | Spot and author; decide review uniqueness policy |
| spots | Favorite | Unique user/spot pair |
| spots | BusynessReport | Spot and reporter; timestamp and freshness rule pending |
| study_sessions | StudySession | Creator, spot, course, start/end, capacity, lifecycle state |
| study_sessions | RSVP | Unique session/user pair; enforce capacity atomically |
| moderation | AbuseReport | Reporter and reported session; review status |

These are design candidates, not implemented models or a finalized schema. Before writing their migrations, specify field types, required values, indexes, database constraints, and deletion behavior. Use `settings.AUTH_USER_MODEL` for model relationships to users.

## Open architecture decisions

- UCR email verification and whether email becomes a unique login identifier.
- Busyness freshness: the proposal specifies both one hour and two hours.
- Unknown hours versus explicitly always-accessible spots.
- Whether the single-session limit covers creation, participation, or both.
- Session states and transitions, check-in windows, proximity rules, cancellation, and no-show restrictions.
- Concurrent RSVP capacity enforcement, duplicate requests, and attendance representation.
- Photo storage, moderation retention, and user/spot deletion behavior.

Add model migrations and update this document as decisions are agreed. Changes to the agreed schema require PR review.
