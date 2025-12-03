# FestiFind Research Clearing Feature Fix

This document explains how to fix and use the "Clear All Research Data" feature in the admin utilities.

## Background

The feature is designed to clear research data from both the client and server, but it was failing because the server-side functionality was missing a database function.

## Fix Steps

1. **Apply the Database Migration**

First, we need to create the missing database function that clears research references:

```bash
# Run the migration script
node apply-research-function.js
```

This will create the `clear_festival_research_references` function in the database.

2. **Test the Clearing Functionality**

To verify the fix works:

```bash
# Test the clear research functionality
node test-clear-research.js
```

This script will:
- Count festivals with research references before clearing
- Count entries in the festival_research table before clearing
- Call the RPC function to clear everything
- Verify all research data was removed

## Using the Feature

After applying the fix, you can use the "Clear All Research Data" button in the admin utilities page:

1. Navigate to `/admin-utilities` in the application
2. Click the "Clear All Research Data (Client & Server)" button
3. Wait for the success message

## Technical Details

The fix implements a proper database function (`clear_festival_research_references`) that:

1. Updates all festivals to remove research_id and research_status references
2. Deletes all entries from the festival_research table

The API endpoint now has proper fallback mechanisms in case the RPC function isn't available:
- It will try to update the festivals table directly
- It will try to clear the festival_research table directly
- It performs validation to ensure the clearing was successful

## Troubleshooting

If you encounter any issues:

1. Check the browser console for client-side errors
2. Check the server logs for backend errors
3. Run the test script to diagnose any database connectivity issues

If the RPC function still fails, the API will fall back to direct table updates, which should work in most cases. 