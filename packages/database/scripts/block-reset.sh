#!/usr/bin/env bash
# SAFEGUARD: Never allow prisma migrate reset in this project
# It drops ALL data without recovery.

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ⛔  BLOCKED  ⛔                          ║"
echo "║                                                              ║"
echo "║  'prisma migrate reset' DESTROYS ALL DATA.                  ║"
echo "║  There is NO undo. There is NO backup.                      ║"
echo "║                                                              ║"
echo "║  If you need to fix schema drift, use:                      ║"
echo "║    npm run db:migrate        (create new migration)         ║"
echo "║    npm run db:push           (push schema changes)          ║"
echo "║                                                              ║"
echo "║  If you MUST reset (you really shouldn't):                  ║"
echo "║    1. npm run db:backup      (save current data)            ║"
echo "║    2. Manually run: prisma migrate reset --force            ║"
echo "║    3. npm run db:restore     (restore your backup)          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
exit 1
