#!/bin/bash
# deploy.sh - Kubernetes deployment for backups-microservice
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="backups-microservice"
NAMESPACE="${NAMESPACE:-statex-apps}"
REGISTRY="localhost:5000"
HEALTH_PORT="${PORT:-3398}"
HEALTH_PATH="/health"
HEALTH_MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-30}"
HEALTH_INTERVAL_SEC="${HEALTH_INTERVAL_SEC:-2}"

DEFAULT_COMMIT="$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || true)"
if [ -n "$DEFAULT_COMMIT" ] && (cd "$PROJECT_ROOT" && git diff --quiet && git diff --cached --quiet); then
  DEFAULT_TAG="$DEFAULT_COMMIT"
elif [ -n "$DEFAULT_COMMIT" ]; then
  DEFAULT_TAG="${DEFAULT_COMMIT}-dirty-$(date -u +%Y%m%d%H%M%S)"
else
  DEFAULT_TAG="build-$(date -u +%Y%m%d%H%M%S)"
fi
IMAGE_TAG="${1:-$DEFAULT_TAG}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"

# shellcheck disable=SC1091
source "$(dirname "$PROJECT_ROOT")/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" 2>/dev/null \
  || source "$HOME/Documents/Github/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" \
  || { echo -e "${RED}Error: deploy timing library not found${NC}" >&2; exit 1; }
deploy_timing_init "$SERVICE_NAME"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║       Backups Microservice - Kubernetes Deployment     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "${NODE_ENV:-}" = "production" ]; then
  deploy_timing_phase_start "Git sync"
  cd "$PROJECT_ROOT"
  git fetch origin
  git stash || true
  git pull origin main
  git stash pop || true
  deploy_timing_phase_end "Git sync"
fi

deploy_timing_phase_start "Build image"
docker build -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT"
deploy_timing_phase_end "Build image"

deploy_timing_phase_start "Push image"
docker push "$IMAGE"
docker push "$IMAGE_LATEST"
deploy_timing_phase_end "Push image"

deploy_timing_phase_start "Apply K8s manifests"
kubectl apply -f "$PROJECT_ROOT/k8s/external-secret.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/rbac.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/configmap.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/deployment.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/service.yaml" -n "$NAMESPACE"
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml" -n "$NAMESPACE"
deploy_timing_phase_end "Apply K8s manifests"

deploy_timing_phase_start "Update deployment image"
kubectl set image "deployment/${SERVICE_NAME}" app="$IMAGE" -n "$NAMESPACE"
deploy_timing_phase_end "Update deployment image"

deploy_timing_phase_start "Wait for rollout"
deploy_timing_k8s_rollout_wait kubectl "$SERVICE_NAME" "$NAMESPACE"
deploy_timing_phase_end "Wait for rollout"

deploy_timing_phase_start "Smoke check"
attempt=1
while [ "${attempt}" -le "${HEALTH_MAX_ATTEMPTS}" ]; do
  POD=$(kubectl get pod -n "${NAMESPACE}" -l "app=${SERVICE_NAME}" -o jsonpath={.items[0].metadata.name} 2>/dev/null || true)
  if [ -z "${POD}" ]; then
    echo -e "${RED}No pod found for ${SERVICE_NAME}${NC}"
    exit 1
  fi
  if kubectl exec -n "${NAMESPACE}" "${POD}" -- sh -c "BACKUPS_BASE_URL=http://127.0.0.1:${HEALTH_PORT} BACKUPS_AUTH_TOKEN=\"\${SERVICE_TOKEN:-}\" BACKUPS_REQUIRE_AUTH_SMOKE=true node scripts/smoke-check.js"; then
    echo -e "${GREEN}Smoke check OK${NC}"
    break
  fi
  if [ "${attempt}" -eq "${HEALTH_MAX_ATTEMPTS}" ]; then
    echo -e "${RED}Smoke check failed after ${HEALTH_MAX_ATTEMPTS} attempts${NC}"
    exit 1
  fi
  echo -e "${YELLOW}   attempt ${attempt}/${HEALTH_MAX_ATTEMPTS}, retry in ${HEALTH_INTERVAL_SEC}s...${NC}"
  sleep "${HEALTH_INTERVAL_SEC}"
  attempt=$((attempt + 1))
done
deploy_timing_phase_end "Smoke check"

deploy_timing_finish_success "$SERVICE_NAME"
echo "Image:     ${IMAGE}"
echo "Namespace: ${NAMESPACE}"
echo "Service:   https://backups.alfares.cz"
DEPLOY_TIMING_FINISHED=1
exit 0
