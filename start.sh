#!/bin/sh
# Initialize the SQLite database on first run (when volume is empty)
if [ ! -f /app/data/fleet.db ]; then
  echo "Initializing database from template..."
  cp /app/fleet.db.template /app/data/fleet.db
  echo "Database initialized."
fi

exec node server.js
