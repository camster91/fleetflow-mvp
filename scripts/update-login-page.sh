#!/bin/bash
set -e

SERVER="root@187.77.26.99"
SSH_KEY="$HOME/.ssh/hostinger"
LOGIN_PAGE="pages/auth/login.tsx"
TEMP_FILE="/tmp/login-page.tsx"

echo "Copying login page to server..."
scp -i "$SSH_KEY" "$LOGIN_PAGE" "$SERVER:$TEMP_FILE"

echo "Updating container..."
ssh -i "$SSH_KEY" "$SERVER" << EOF
set -e
CONTAINER_ID=\$(docker ps --filter 'name=p804488s4gs0k0kwc4080wg0' --format '{{.ID}}' | head -1)
if [ -z "\$CONTAINER_ID" ]; then
  echo "Error: Container not found"
  exit 1
fi

echo "Container ID: \$CONTAINER_ID"
echo "Copying login page to container..."
docker cp $TEMP_FILE \$CONTAINER_ID:/app/$LOGIN_PAGE

echo "Restarting container..."
docker restart \$CONTAINER_ID

echo "Waiting for container to restart..."
sleep 5

echo "Checking container status..."
docker ps --filter "id=\$CONTAINER_ID"

echo "Cleaning up..."
rm -f $TEMP_FILE

echo "Login page updated successfully!"
EOF

echo "Done!"