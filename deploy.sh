#!/bin/bash

# FleetFlow Pro Deployment Script for Linux/macOS
# Run this script to build and deploy the application

# Default values
ACTION=${1:-help}
ENVIRONMENT=${2:-production}
IMAGE_TAG="fleetflow-pro:latest"
CONTAINER_NAME="fleetflow-pro"
PORT=3000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_help() {
    echo -e "${CYAN}FleetFlow Pro Deployment Script${NC}"
    echo -e "================================"
    echo ""
    echo -e "Available commands:"
    echo -e "  ./deploy.sh build           - Build Docker image"
    echo -e "  ./deploy.sh run             - Run container locally"
    echo -e "  ./deploy.sh stop            - Stop running container"
    echo -e "  ./deploy.sh clean           - Remove containers and images"
    echo -e "  ./deploy.sh deploy-coolify  - Generate Coolify deployment config"
    echo -e "  ./deploy.sh deploy-vercel   - Generate Vercel deployment config"
    echo ""
    echo -e "Options (set as environment variables):"
    echo -e "  IMAGE_TAG       Docker image tag (default: fleetflow-pro:latest)"
    echo -e "  CONTAINER_NAME  Container name (default: fleetflow-pro)"
    echo -e "  PORT            Host port (default: 3000)"
    echo ""
}

build_image() {
    echo -e "${GREEN}Building Docker image...${NC}"
    echo -e "${YELLOW}Image tag: $IMAGE_TAG${NC}"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running or not installed.${NC}"
        echo -e "${YELLOW}Please start Docker and try again.${NC}"
        exit 1
    fi
    
    # Build the image
    docker build -t "$IMAGE_TAG" .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Docker image built successfully!${NC}"
        echo -e "${YELLOW}  Image size: $(docker images $IMAGE_TAG --format "{{.Size}}")${NC}"
    else
        echo -e "${RED}✗ Docker build failed!${NC}"
        exit 1
    fi
}

run_container() {
    echo -e "${GREEN}Running container...${NC}"
    echo -e "${YELLOW}Container: $CONTAINER_NAME${NC}"
    echo -e "${YELLOW}Port: $PORT${NC}"
    
    # Stop existing container if running
    if docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" | grep -q "$CONTAINER_NAME"; then
        echo -e "${YELLOW}Stopping existing container: $CONTAINER_NAME${NC}"
        docker stop "$CONTAINER_NAME" > /dev/null 2>&1
        docker rm "$CONTAINER_NAME" > /dev/null 2>&1
    fi
    
    # Run new container
    docker run -d \
        --name "$CONTAINER_NAME" \
        --restart unless-stopped \
        -p "$PORT:3000" \
        "$IMAGE_TAG"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container started successfully!${NC}"
        echo -e "${CYAN}  Access the app at: http://localhost:$PORT${NC}"
        echo ""
        echo -e "${YELLOW}Container logs:${NC}"
        echo -e "  docker logs -f $CONTAINER_NAME"
        echo -e "${YELLOW}Stop container:${NC}"
        echo -e "  docker stop $CONTAINER_NAME"
    else
        echo -e "${RED}✗ Failed to start container!${NC}"
    fi
}

stop_container() {
    echo -e "${YELLOW}Stopping container...${NC}"
    docker stop "$CONTAINER_NAME" > /dev/null 2>&1
    docker rm "$CONTAINER_NAME" > /dev/null 2>&1
    echo -e "${GREEN}✓ Container stopped and removed${NC}"
}

clean_images() {
    echo -e "${YELLOW}Cleaning up Docker resources...${NC}"
    
    # Remove stopped containers
    containers=$(docker ps -a --filter "ancestor=$IMAGE_TAG" --format "{{.ID}}" 2>/dev/null || true)
    if [ -n "$containers" ]; then
        echo -e "${YELLOW}Removing containers...${NC}"
        echo "$containers" | xargs -r docker rm > /dev/null 2>&1
    fi
    
    # Remove images
    images=$(docker images "$IMAGE_TAG" --format "{{.ID}}" 2>/dev/null || true)
    if [ -n "$images" ]; then
        echo -e "${YELLOW}Removing images...${NC}"
        echo "$images" | xargs -r docker rmi > /dev/null 2>&1
    fi
    
    # Remove dangling images
    docker image prune -f > /dev/null 2>&1
    
    echo -e "${GREEN}✓ Cleanup completed${NC}"
}

deploy_coolify() {
    echo -e "${GREEN}Generating Coolify deployment configuration...${NC}"
    
    cat > coolify-config.json << EOF
{
  "name": "fleetflow-pro",
  "repository": "https://github.com/your-username/fleetflow-mvp.git",
  "branch": "main",
  "buildPack": "dockerfile",
  "dockerfilePath": "./Dockerfile",
  "port": 3000,
  "healthCheck": {
    "path": "/",
    "interval": 30,
    "timeout": 3
  },
  "environment": [
    {
      "key": "NODE_ENV",
      "value": "production"
    },
    {
      "key": "PORT",
      "value": "3000"
    }
  ]
}
EOF
    
    echo -e "${GREEN}✓ Coolify configuration saved to coolify-config.json${NC}"
    echo ""
    echo -e "${CYAN}To deploy to Coolify:${NC}"
    echo -e "${YELLOW}1. Push this repository to GitHub${NC}"
    echo -e "${YELLOW}2. In Coolify dashboard, click 'Add New Application'${NC}"
    echo -e "${YELLOW}3. Select 'Import from GitHub'${NC}"
    echo -e "${YELLOW}4. Choose this repository and main branch${NC}"
    echo -e "${YELLOW}5. Set Build Pack to 'Dockerfile'${NC}"
    echo -e "${YELLOW}6. Set Port to 3000${NC}"
    echo -e "${YELLOW}7. Add environment variables from .env.example${NC}"
    echo -e "${YELLOW}8. Click 'Deploy'${NC}"
}

deploy_vercel() {
    echo -e "${GREEN}Generating Vercel deployment configuration...${NC}"
    
    cat > vercel.json << EOF
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
EOF
    
    echo -e "${GREEN}✓ Vercel configuration saved to vercel.json${NC}"
    echo ""
    echo -e "${CYAN}To deploy to Vercel:${NC}"
    echo -e "${YELLOW}1. Install Vercel CLI: npm i -g vercel${NC}"
    echo -e "${YELLOW}2. Run: vercel${NC}"
    echo -e "${YELLOW}3. Follow the prompts${NC}"
    echo -e "${YELLOW}4. For production: vercel --prod${NC}"
}

# Main script execution
case "$ACTION" in
    help)
        show_help
        ;;
    build)
        build_image
        ;;
    run)
        build_image
        run_container
        ;;
    stop)
        stop_container
        ;;
    clean)
        clean_images
        ;;
    deploy-coolify)
        deploy_coolify
        ;;
    deploy-vercel)
        deploy_vercel
        ;;
    *)
        echo -e "${RED}Unknown action: $ACTION${NC}"
        show_help
        exit 1
        ;;
esac