# Add Password Input for HTE Registration

## Goal Description
Implement a password field for HTE users during registration, allow them to set their own password, and ensure the login flow validates these credentials. Also bind the HTE account appropriately with trainee and OJT instructor workflow.

## User Review Required
[!IMPORTANT]
- Confirm the UI design changes for the HTE registration form (e.g., placement of password fields, validation rules).
- Approve the backend API change to accept a `password` field in the `register_hte` endpoint, with proper hashing via Django's user model.

## Open Questions
[!QUESTION]
- Should the password be optional (fallback to random) if not provided?
- Desired password policy (minimum length, complexity)?

## Proposed Changes
---
### Backend (`auth_views.py`)
- Modify `register_hte` to read `password` from request data.
- If provided, use it when creating the user via `User.objects.create_user(..., password=password)`.
- If not provided, retain random password generation.
- Ensure password is validated (e.g., min 8 characters) before user creation.
- Update docstring/comments.
---
### Frontend (`Register.tsx`)
- In the HTE step flow, add password and confirm password inputs.
- Include validation to ensure passwords match and meet policy.
- Pass `password` field in the registration API payload when role is 'hte'.
- Adjust UI to hide password fields for other roles.
---
### API Service (`authApi.ts`)
- Ensure the `registerEmployee` function includes `password` when role is 'hte'.
---
### Tests
- Add unit test for `register_hte` handling supplied password.
- Add front-end component test for password field visibility.
---
## Verification Plan
### Automated Tests
- Run existing backend tests to ensure no regressions.
- Add new test cases for HTE registration with password.
- Run front-end smoke test to verify UI updates.
### Manual Verification
- Manually register an HTE with a password, then login via the login page.
- Verify that the password works and that the HTE can be bound to trainee/instructor as per existing flow.
