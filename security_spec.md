# Security Specification & Test Matrix

## 1. Data Invariants
1. **User Profile (`/users/{userId}`)**:
   - Only authenticated users whose `request.auth.uid == userId` can read or write their own user profile document.
   - Root document must validate `email` and `uid`. No user can tamper with another user's profile.
2. **Favorites (`/users/{userId}/favorites/{trackId}`)**:
   - A user can only access their own favorites subcollection (`request.auth.uid == userId`).
   - `trackId` must be a valid sanitized string ID (`^[a-zA-Z0-9_\\-]+$`).
   - `createdAt` must be server-timestamp verified (`request.time`).
3. **Playlists (`/users/{userId}/playlists/{playlistId}`)**:
   - Only the owning user can create, update, read, or delete their playlists.
   - `title` is required, non-empty, and max 100 characters.
4. **Default Deny**:
   - All other paths not explicitly allowed must be rejected immediately (`allow read, write: if false`).

## 2. The "Dirty Dozen" Threat Payloads
1. **Unauthenticated Read**: Anonymous/Unauthenticated user querying `/users/other_user_123` -> REJECT.
2. **Cross-User Profile Hijack**: User `user_A` attempting to write to `/users/user_B` -> REJECT.
3. **Ghost Fields Injection**: User sending unapproved field `{ hack: true, role: 'admin' }` -> REJECT via `hasOnly()`.
4. **Huge ID Poisoning Attack**: User creating path with 2KB junk character string -> REJECT via `isValidId()`.
5. **Timestamp Spoofing**: User providing a fake past/future client timestamp -> REJECT via `request.time` check.
6. **Malicious Empty Title**: Playlist create with `{ title: "" }` -> REJECT.
7. **Giant String Overflow**: Playlist create with 50,000-character description -> REJECT via `.size() <= 1000`.
8. **Cross-User Favorite Injection**: User `user_A` creating a favorite in `/users/user_B/favorites/track_1` -> REJECT.
9. **Blanket Collection Query**: Unauthenticated query over all `/users` -> REJECT.
10. **Track ID Injections**: Favorite creation with SQL or shell injection payload in ID -> REJECT via regex.
11. **Immutable Field Mutated**: Updating existing playlist document with altered `userUid` or altered `createdAt` -> REJECT.
12. **Unauthorized Deletion**: User `user_B` attempting to delete a playlist belonging to `user_A` -> REJECT.
