# FleetFlow Pro Deployment Script for Windows
# Run this script to build and deploy the application

param(
    [string]$Action = "help",
    [string]$Environment = "production",
    [string]$ImageTag = "fleetflow-pro:latest",
    [string]$ContainerName = "fleetflow-pro",
    [int]$Port = 3000
)

function Show-Help {
    Write-Host "FleetFlow Pro Deployment Script" -ForegroundColor Cyan
    Write-Host "================================"
    Write-Host ""
    Write-Host "Available commands:"
    Write-Host "  .\deploy.ps1 build           - Build Docker image"
    Write-Host "  .\deploy.ps1 run             - Run container locally"
    Write-Host "  .\deploy.ps1 stop            - Stop running container"
    Write-Host "  .\deploy.ps1 clean           - Remove containers and images"
    Write-Host "  .\deploy.ps1 deploy-coolify  - Generate Coolify deployment config"
    Write-Host "  .\deploy.ps1 deploy-vercel   - Generate Vercel deployment config"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Environment    Deployment environment (default: production)"
    Write-Host "  -ImageTag       Docker image tag (default: fleetflow-pro:latest)"
    Write-Host "  -ContainerName  Container name (default: fleetflow-pro)"
    Write-Host "  -Port           Host port (default: 3000)"
    Write-Host ""
}

function Build-Image {
    Write-Host "Building Docker image..." -ForegroundColor Green
    Write-Host "Image tag: $ImageTag" -ForegroundColor Yellow
    
    # Check if Docker is running
    try {
        docker version | Out-Null
    } catch {
        Write-Host "Error: Docker is not running or not installed." -ForegroundColor Red
        Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
        exit 1
    }
    
    # Build the image
    docker build -t $ImageTag .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker image built successfully!" -ForegroundColor Green
        Write-Host "  Image size:" (docker images $ImageTag --format "{{.Size}}")
    } else {
        Write-Host "✗ Docker build failed!" -ForegroundColor Red
        exit 1
    }
}

function Run-Container {
    Write-Host "Running container..." -ForegroundColor Green
    Write-Host "Container: $ContainerName" -ForegroundColor Yellow
    Write-Host "Port: $Port" -ForegroundColor Yellow
    
    # Stop existing container if running
    $existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
    if ($existing) {
        Write-Host "Stopping existing container: $existing" -ForegroundColor Yellow
        docker stop $ContainerName | Out-Null
        docker rm $ContainerName | Out-Null
    }
    
    # Run new container
    docker run -d `
        --name $ContainerName `
        --restart unless-stopped `
        -p "${Port}:3000" `
        $ImageTag
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Container started successfully!" -ForegroundColor Green
        Write-Host "  Access the app at: http://localhost:$Port" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Container logs:" -ForegroundColor Yellow
        Write-Host "  docker logs -f $ContainerName" -ForegroundColor Gray
        Write-Host "Stop container:" -ForegroundColor Yellow
        Write-Host "  docker stop $ContainerName" -ForegroundColor Gray
    } else {
        Write-Host "✗ Failed to start container!" -ForegroundColor Red
    }
}

function Stop-Container {
    Write-Host "Stopping container..." -ForegroundColor Yellow
    docker stop $ContainerName 2>$null
    docker rm $ContainerName 2>$null
    Write-Host "✓ Container stopped and removed" -ForegroundColor Green
}

function Clean-Images {
    Write-Host "Cleaning up Docker resources..." -ForegroundColor Yellow
    
    # Remove stopped containers
    $containers = docker ps -a --filter "ancestor=$ImageTag" --format "{{.ID}}"
    if ($containers) {
        Write-Host "Removing containers..." -ForegroundColor Yellow
        $containers | ForEach-Object { docker rm $_ 2>$null }
    }
    
    # Remove images
    $images = docker images $ImageTag --format "{{.ID}}"
    if ($images) {
        Write-Host "Removing images..." -ForegroundColor Yellow
        $images | ForEach-Object { docker rmi $_ 2>$null }
    }
    
    # Remove dangling images
    docker image prune -f 2>$null
    
    Write-Host "✓ Cleanup completed" -ForegroundColor Green
}

function Deploy-Coolify {
    Write-Host "Generating Coolify deployment configuration..." -ForegroundColor Green
    
    $coolifyConfig = @{
        "name" = "fleetflow-pro"
        "repository" = "https://github.com/your-username/fleetflow-mvp.git"
        "branch" = "main"
        "buildPack" = "dockerfile"
        "dockerfilePath" = "./Dockerfile"
        "port" = 3000
        "healthCheck" = @{
            "path" = "/"
            "interval" = 30
            "timeout" = 3
        }
        "environment" = @(
            @{
                "key" = "NODE_ENV"
                "value" = "production"
            },
            @{
                "key" = "PORT"
                "value" = "3000"
            }
        )
    }
    
    $configJson = $coolifyConfig | ConvertTo-Json -Depth 10
    $configJson | Out-File -FilePath "coolify-config.json" -Encoding UTF8
    
    Write-Host "✓ Coolify configuration saved to coolify-config.json" -ForegroundColor Green
    Write-Host ""
    Write-Host "To deploy to Coolify:" -ForegroundColor Cyan
    Write-Host "1. Push this repository to GitHub" -ForegroundColor Yellow
    Write-Host "2. In Coolify dashboard, click 'Add New Application'" -ForegroundColor Yellow
    Write-Host "3. Select 'Import from GitHub'" -ForegroundColor Yellow
    Write-Host "4. Choose this repository and main branch" -ForegroundColor Yellow
    Write-Host "5. Set Build Pack to 'Dockerfile'" -ForegroundColor Yellow
    Write-Host "6. Set Port to 3000" -ForegroundColor Yellow
    Write-Host "7. Add environment variables from .env.example" -ForegroundColor Yellow
    Write-Host "8. Click 'Deploy'" -ForegroundColor Yellow
}

function Deploy-Vercel {
    Write-Host "Generating Vercel deployment configuration..." -ForegroundColor Green
    
    $vercelJson = @{
        "version" = 2
        "builds" = @(
            @{
                "src" = "package.json"
                "use" = "@vercel/next"
            }
        )
        "routes" = @(
            @{
                "src" = "/(.*)"
                "dest" = "/"
            }
        )
        "env" = @{
            "NODE_ENV" = "production"
        }
    }
    
    $configJson = $vercelJson | ConvertTo-Json -Depth 10
    $configJson | Out-File -FilePath "vercel.json" -Encoding UTF8
    
    Write-Host "✓ Vercel configuration saved to vercel.json" -ForegroundColor Green
    Write-Host ""
    Write-Host "To deploy to Vercel:" -ForegroundColor Cyan
    Write-Host "1. Install Vercel CLI: npm i -g vercel" -ForegroundColor Yellow
    Write-Host "2. Run: vercel" -ForegroundColor Yellow
    Write-Host "3. Follow the prompts" -ForegroundColor Yellow
    Write-Host "4. For production: vercel --prod" -ForegroundColor Yellow
}

# Main script execution
switch ($Action.ToLower()) {
    "help" { Show-Help }
    "build" { Build-Image }
    "run" { Build-Image; Run-Container }
    "stop" { Stop-Container }
    "clean" { Clean-Images }
    "deploy-coolify" { Deploy-Coolify }
    "deploy-vercel" { Deploy-Vercel }
    default {
        Write-Host "Unknown action: $Action" -ForegroundColor Red
        Show-Help
    }
}