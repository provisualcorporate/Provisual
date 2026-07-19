# Security Specification for ProVisual

## Data Invariants
1. An asset must belong to a valid folder.
2. Only the owner or an admin can upload or modify assets.
3. Assets must have at least one version (original).
4. Capture date and upload date must be valid timestamps.
5. Path IDs must be alphanumeric and length-limited.

## The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create an asset with `ownerId` of another user.
2. **Path Poisoning**: Attempt to use a 2MB string as a `folderId`.
3. **Invalid Data Type**: Send a string for `captureDate` instead of a timestamp.
4. **Missing Required Fields**: Create an asset without `versions`.
5. **Unauthorized Access**: User A attempts to read User B's private documents.
6. **Admin Escalation**: Regular user attempts to write to the `admins` collection.
7. **Quality Version Injection**: Attempt to add a malicious URL in a version.
8. **Immutability Breach**: Attempt to change `ownerId` after creation.
9. **Terminal State Bypass**: (If status existed) Attempt to change status after completion.
10. **Resource Exhaustion**: Send an extremely large array of versions.
11. **Spoofed Auth**: Attempt write with unverified email (if email verification required).
12. **Orphaned Write**: Create an asset with a non-existent `folderId`.

## Tests
Integration tests will be implemented in `firestore.rules.test.ts`.
