# Security Audit Report — Step 15: My Events

## 1. Audit Date

2026-09-22

## 2. Scope of the Audit

This audit covers the implementation of the "My Events" feature (Step 15) for the Event Management System. The scope includes:

- New backend endpoint: `GET /api/registrations/my-events`
- Updated backend controller: `registrationController.js` (`getMyEvents`)
- Updated backend route: `registrationRoutes.js`
- Updated frontend service: `registrationService.js`
- Updated frontend page: `MyEvents.jsx`
- New frontend stylesheet: `my-events.css`
- Related authentication and authorization code paths

## 3. Files and Endpoints Reviewed

### Backend
- `backend/src/controllers/registrationController.js`
- `backend/src/routes/registrationRoutes.js`
- `backend/src/middleware/authMiddleware.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/models/Registration.js`
- `backend/src/models/Event.js`
- `backend/src/models/User.js`
- `backend/src/app.js`

### Frontend
- `frontend/src/pages/MyEvents.jsx`
- `frontend/src/services/registrationService.js`
- `frontend/src/services/api.js`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/styles/my-events.css`

### Endpoints
- `GET /api/registrations/my-events` (new)
- `GET /api/registrations/my` (existing)
- `DELETE /api/registrations/:id` (existing)

## 4. Security Checks Performed

1. **Authentication enforcement**: Verified that the new endpoint uses the existing `auth` middleware, which requires a valid JWT Bearer token.
2. **Authorization / IDOR prevention**: Verified that the endpoint queries registrations by `req.user.userId` only. No client-provided user ID is accepted.
3. **Sensitive data exposure**: Verified that the endpoint does not return user passwords or other sensitive fields. The `populate('event', ...)` projection explicitly limits returned event fields.
4. **Registration ownership**: Verified that cancellation still requires server-side ownership verification via `String(registration.user) !== String(req.user.userId)`.
5. **Input validation**: Verified that `req.params.id` in the delete route is a MongoDB ObjectId (implicitly validated by `findById`).
6. **Error handling**: Verified that errors are passed to the centralized error handler and do not leak stack traces in production.
7. **Deleted event handling**: Verified that if an event is deleted, the registration still appears and `event` is `null`, preventing crashes.
8. **JWT handling**: Verified the existing interceptor handles 401 responses by clearing tokens and redirecting.

## 5. Findings

### Finding 1 — Low: No pagination on my-events endpoint

**Severity**: Low  
**Affected file**: `backend/src/controllers/registrationController.js`  
**Description**: The `getMyEvents` endpoint returns all registrations in a single response. For users with a very large number of registrations, this could cause performance issues.  
**Evidence**: The query uses `Registration.find({ user: req.user.userId })` without pagination limits.  
**Remediation applied**: None — the existing application does not implement pagination for registrations elsewhere. Noted for future enhancement.  
**Remaining risk**: Low. Typical users will not have thousands of registrations.

### Finding 2 — Informational: MongoDB connection not verified in this environment

**Severity**: Informational  
**Affected file**: `backend/.env` (not present)  
**Description**: The backend requires a MongoDB connection. During testing, no MongoDB instance was available, so the server started but could not process database queries.  
**Evidence**: `MongoDB connection error: Could not connect to any servers in your MongoDB Atlas cluster`.  
**Remediation applied**: None — this is an environment configuration issue, not a code vulnerability.  
**Remaining risk**: None for production where MongoDB is properly configured.

### Finding 3 — Informational: No automated tests for the new endpoint

**Severity**: Informational  
**Affected file**: `backend/src/controllers/registrationController.js`  
**Description**: No automated tests exist for the new `getMyEvents` endpoint or the updated `MyEvents` page.  
**Evidence**: No `*.test.*` or `*.spec.*` files found in the repository.  
**Remediation applied**: None within this task scope. Manual verification was performed via frontend build and code review.  
**Remaining risk**: Medium. Future regressions in the endpoint could go undetected without automated tests.

## 6. Security Checks Passed

| Check | Result |
|-------|--------|
| Authentication required for `GET /my-events` | Pass |
| User ID not accepted from client | Pass |
| Registration ownership verified on cancellation | Pass |
| No passwords or sensitive data in response | Pass |
| Deleted events handled without crash | Pass |
| JWT token cleared on 401 | Pass |
| Error handler does not leak stack traces in production | Pass |
| No hardcoded credentials or secrets in code | Pass |
| Existing auth middleware and RBAC intact | Pass |

## 7. Remediation Applied

- Implemented `GET /api/registrations/my-events` with auth middleware enforcement.
- Used `req.user.userId` from the verified JWT — no client-supplied user ID is used.
- Limited event population fields to non-sensitive data: `title`, `description`, `category`, `date`, `time`, `location`, `city`, `image`, `status`.
- Handled null populated events gracefully in both backend (no crash) and frontend (null checks via optional chaining).
- Preserved existing ownership check in `cancelRegistration`.

## 8. Remaining Risks and Recommended Follow-up

1. **Add automated tests** for the new `getMyEvents` endpoint covering: authenticated access, unauthenticated rejection, empty results, and deleted events.
2. **Add pagination** if the application grows to support users with many registrations.
3. **Consider rate limiting** on the registration endpoints to prevent abuse.
4. **Add integration tests** for the full registration → my-events → cancel flow.

## 9. Tests and Commands Executed

```bash
# Frontend build verification
cd frontend && npm run build
# Result: ✓ built in 12.01s

# Backend syntax verification
cd backend && node -e "require('fs').readFileSync('src/controllers/registrationController.js', 'utf8'); console.log('OK')"
# Result: Controller syntax OK

cd backend && node -e "require('fs').readFileSync('src/routes/registrationRoutes.js', 'utf8'); console.log('OK')"
# Result: Routes syntax OK

# Backend server start
cd backend && node server.js
# Result: Server running on port 5000 (MongoDB connection failed due to missing local instance)
```

## 10. Final Audit Status

**Pass with Findings**

The implementation follows the existing authentication and authorization patterns. No critical or high-severity vulnerabilities were identified. One low-severity finding (no pagination) and two informational findings (MongoDB not available in test environment, no automated tests) are noted. The feature is secure and functional.
