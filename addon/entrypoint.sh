#!/bin/sh
set -e

# MongoDB data lives on the HA persistent volume
mkdir -p /data/mongodb

echo "[entrypoint] Starting MongoDB..."
mongod \
  --dbpath /data/mongodb \
  --bind_ip 127.0.0.1 \
  --port 27017 \
  --quiet \
  --logpath /proc/1/fd/1 \
  --logappend \
  &
MONGOD_PID=$!

# Wait for MongoDB to accept connections (up to 30s)
for i in $(seq 1 30); do
  mongosh --quiet --eval "db.ping()" >/dev/null 2>&1 && echo "[entrypoint] MongoDB ready" && break
  echo "[entrypoint] Waiting for MongoDB... ($i)"
  sleep 1
done

# Start Node.js app
node dist/index.js &
NODE_PID=$!

# Forward SIGTERM/SIGINT to both processes and wait
cleanup() {
  echo "[entrypoint] Shutting down..."
  kill "$NODE_PID"  2>/dev/null || true
  kill "$MONGOD_PID" 2>/dev/null || true
  wait "$NODE_PID"  2>/dev/null || true
  wait "$MONGOD_PID" 2>/dev/null || true
}
trap cleanup TERM INT

wait "$NODE_PID"
cleanup
