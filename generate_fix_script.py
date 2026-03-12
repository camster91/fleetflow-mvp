import base64
import os
import sys

# Files to update with their paths relative to project root
files = [
    ("components/onboarding/OnboardingModal.tsx", "components/onboarding/OnboardingModal.tsx"),
    ("hooks/useSubscription.ts", "hooks/useSubscription.ts"),
    ("pages/pricing.tsx", "pages/pricing.tsx"),
    ("components/VehicleDetailModal.tsx", "components/VehicleDetailModal.tsx"),
    ("pages/dashboard.tsx", "pages/dashboard.tsx"),
]

# Container ID
container_id = "401d41ad0530"

print("#!/bin/bash")
print("set -e")
print(f'CONTAINER="{container_id}"')
print("")

for local_path, container_path in files:
    # Read file content
    with open(local_path, 'rb') as f:
        content = f.read()
    # Encode to base64
    encoded = base64.b64encode(content).decode('ascii')
    # Write command to decode and write inside container
    print(f'echo "Updating {container_path}..."')
    print(f'docker exec $CONTAINER sh -c "cat > /app/{container_path} << \'EOF\'"')
    # We can't directly embed binary? We'll use base64 decode
    print(f'docker exec $CONTAINER sh -c "echo \\"{encoded}\\" | base64 -d > /app/{container_path}"')
    print("")

print('echo "All files updated. Restarting container..."')
print(f'docker restart {container_id}')
print('echo "Done!"')