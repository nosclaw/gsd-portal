#!/bin/bash
set -e

# GSD Portal — Staging Deployment Script
# Usage: ./docker/scripts/deploy-staging.sh [--skip-build] [--skip-transfer] [--dry-run]

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
cd "$PROJECT_ROOT"

# Load config
source docker/.deploy/config.staging

SSH_CMD="ssh -i $DEPLOY_KEY -o StrictHostKeyChecking=accept-new -p $DEPLOY_PORT $DEPLOY_USER@$DEPLOY_HOST"
IMAGE_NAME="staging-gsd-portal/web"
IMAGE_TAR="docker/.deploy/images/gsd-portal-staging.tar.gz"
LOG_DIR="docker/.deploy/logs/staging"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"

SKIP_BUILD=false
SKIP_TRANSFER=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-transfer) SKIP_TRANSFER=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

log "=== GSD Portal Staging Deployment ==="
log "Server: $DEPLOY_USER@$DEPLOY_HOST"
log "Remote path: $DEPLOY_PATH"

# 1. Test SSH
log "Testing SSH connection..."
$SSH_CMD "echo 'SSH OK'" 2>&1 || { log "ERROR: SSH connection failed"; exit 1; }

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN — would deploy to $DEPLOY_PATH"
  log "Image: $IMAGE_NAME:latest"
  exit 0
fi

# 2. Build image (linux/amd64 for x86_64 server)
if [ "$SKIP_BUILD" = false ]; then
  log "Building Docker image for linux/amd64..."
  docker buildx build \
    --platform linux/amd64 \
    -t "$IMAGE_NAME:latest" \
    -f Dockerfile \
    --load \
    . 2>&1 | tee -a "$LOG_FILE"

  if ! docker image inspect "$IMAGE_NAME:latest" > /dev/null 2>&1; then
    log "ERROR: Docker image build failed"
    exit 1
  fi
  log "Build complete"
fi

# 3. Export image
if [ "$SKIP_TRANSFER" = false ]; then
  log "Exporting image to tar..."
  mkdir -p "$(dirname $IMAGE_TAR)"
  docker save "$IMAGE_NAME:latest" | gzip > "$IMAGE_TAR"
  IMAGE_SIZE=$(du -h "$IMAGE_TAR" | cut -f1)
  log "Image exported: $IMAGE_SIZE"

  # 4. Create remote directory
  log "Preparing remote server..."
  $SSH_CMD "sudo mkdir -p $DEPLOY_PATH/.storage $DEPLOY_PATH/.deploy/images && sudo chown -R $DEPLOY_USER:$DEPLOY_USER /opt/runtime"

  # 5. Rsync compose + env + ws-proxy
  log "Syncing files to server..."
  rsync -avz --progress \
    -e "ssh -i $DEPLOY_KEY -p $DEPLOY_PORT" \
    docker/compose.staging.yml \
    docker/.env.staging \
    docker/ws-proxy.js \
    "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/" 2>&1 | tail -5 | tee -a "$LOG_FILE"

  # Rename files on remote
  $SSH_CMD "cd $DEPLOY_PATH && mv -f compose.staging.yml compose.yml && mv -f .env.staging .env"

  # 6. Transfer image
  log "Transferring Docker image ($IMAGE_SIZE)..."
  rsync -avz --progress \
    -e "ssh -i $DEPLOY_KEY -p $DEPLOY_PORT" \
    "$IMAGE_TAR" \
    "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/.deploy/images/" 2>&1 | tail -3 | tee -a "$LOG_FILE"
  log "Transfer complete"
fi

# 7. Deploy on remote
log "Deploying on remote server..."
$SSH_CMD << REMOTE_SCRIPT
  set -e
  cd $DEPLOY_PATH

  # Load image
  echo "[remote] Loading Docker image..."
  gunzip -c .deploy/images/gsd-portal-staging.tar.gz | docker load

  # Create storage dirs
  mkdir -p .storage/portal_sqlite_data .storage/portal_workspaces .storage/portal_dev_env .storage/portal_logs

  # Stop existing containers
  docker compose down 2>/dev/null || true

  # Start containers
  echo "[remote] Starting containers..."
  docker compose up -d

  # Wait for health
  echo "[remote] Waiting for health check..."
  for i in \$(seq 1 $HEALTH_CHECK_RETRIES); do
    sleep $HEALTH_CHECK_INTERVAL
    CONTAINER=\$(docker compose ps -q portal 2>/dev/null | head -1)
    STATUS=\$(docker inspect --format='{{.State.Health.Status}}' "\$CONTAINER" 2>/dev/null || echo "starting")
    echo "[remote] Health check \$i/$HEALTH_CHECK_RETRIES: \$STATUS"
    if [ "\$STATUS" = "healthy" ]; then
      echo "[remote] Container is healthy!"
      break
    fi
    if [ \$i -eq $HEALTH_CHECK_RETRIES ]; then
      echo "[remote] ERROR: Health check failed after $HEALTH_CHECK_RETRIES attempts"
      docker compose logs --tail=20
      exit 1
    fi
  done

  echo "[remote] Deployment successful!"
  docker compose ps
REMOTE_SCRIPT

log "=== Staging deployment complete ==="
log "URL: http://$DEPLOY_HOST:29000"

# Clean up local image tar
rm -f "$IMAGE_TAR"
log "Cleaned up local image tar"
