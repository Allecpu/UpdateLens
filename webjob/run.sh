#!/bin/bash
echo "=== UpdateLens Monthly Data Refresh WebJob ==="
echo "Started at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Run the trigger script
node refresh-trigger.js

EXIT_CODE=$?

echo ""
echo "Finished at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Exit code: $EXIT_CODE"

exit $EXIT_CODE
