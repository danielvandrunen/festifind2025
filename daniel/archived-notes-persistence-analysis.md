# Analysis: Persistence of "archived", "notes", and "favorite" Features

## Current State

### Favorite
- **Persistence:** Both in localStorage and in the database.
- **How:**
  - When toggled, the favorite status is updated in localStorage (`festifind-favorites`) and a POST request is sent to `/api/festivals/[id]/favorite` to update the database.
  - If the API call fails, the localStorage change is reverted.
- **Result:** Favorite is persistent across devices and sessions, as it is stored in the database.

### Archived
- **Persistence:** Only in localStorage.
- **How:**
  - When toggled, the archived status is updated in localStorage (`festifind-archived`) and a POST request is sent to `/api/festivals/[id]/archive` to update the database.
  - However, on page load, the code merges the API data with localStorage, so the localStorage value always takes precedence.
  - If the API call fails, the localStorage change is reverted.
- **Result:** If you use a different browser or device, or clear localStorage, the archived status is lost, even though the database is updated.

### Notes
- **Persistence:** Only in localStorage (and possibly only in UI state).
- **How:**
  - Notes are managed in the UI state and passed to the `onNoteChange` handler, but there is no evidence in the main codebase that notes are POSTed to `/api/festivals/[id]/notes` or persisted in the database.
  - The only reference to notes in localStorage is in a script, not in the main app code.
- **Result:** Notes are not persistent across devices or sessions unless localStorage is preserved, and may not be saved to the database at all.

---

## Why Is "Favorite" Persistent, But "Archived" and "Notes" Are Not?
- **Favorite:** The UI both updates localStorage and the database, and on page load, the database value is merged with localStorage, so the server value is always available.
- **Archived:** The UI updates both localStorage and the database, but on page load, the localStorage value is always used, so the server value is ignored unless localStorage is empty.
- **Notes:** There is no evidence that notes are POSTed to the API or loaded from the database; they appear to be only in UI state and possibly localStorage.

---

## Proposed Solution

### Goal
Make "archived" and "notes" persistent across devices and sessions, just like "favorite".

### Steps

1. **On Page Load:**
   - Fetch all festivals from the API.
   - Use the `archived` and `notes` values from the API/database as the source of truth.
   - Only use localStorage as a fallback if the user is offline or the API fails.

2. **On Toggle/Change:**
   - When the user toggles "archived" or updates "notes":
     - Optimistically update the UI.
     - Send a POST request to the appropriate API endpoint (`/api/festivals/[id]/archive` or `/api/festivals/[id]/notes`).
     - On success, update the UI state.
     - On failure, revert the UI state and optionally update localStorage as a fallback.

3. **Remove or Minimize Use of localStorage:**
   - Do not use localStorage as the primary source of truth for "archived" and "notes".
   - Optionally, use localStorage only for offline support or as a temporary cache.

4. **Update the UI Merge Logic:**
   - When merging API data with localStorage, prefer the API value for "archived" and "notes".

### Example Implementation Outline
- In your main festival page/component:
  - On load, fetch festivals from the API and use the `archived`, `favorite`, and `notes` fields from the API.
  - When toggling "archived" or updating "notes", send the change to the API and update the UI state only if the API call succeeds.

---

## Summary Table

| Feature   | Current Persistence | Should Be Persistent In | Fix Needed? |
|-----------|--------------------|------------------------|-------------|
| Favorite  | localStorage + DB  | DB                     | No          |
| Archived  | localStorage + DB  | DB                     | Yes         |
| Notes     | UI state/localStorage | DB                  | Yes         |

---

## Action Plan

1. **Refactor the code to use the database as the source of truth for "archived" and "notes".**
2. **Update the UI to only use localStorage as a fallback, not as the primary source.**
3. **Ensure all changes to "archived" and "notes" are sent to the API and persisted in the database.**
4. **Test persistence across devices and sessions to confirm the fix.**

---

*Prepared by AI code assistant, based on current codebase analysis.*
