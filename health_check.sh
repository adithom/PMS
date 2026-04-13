#!/usr/bin/env bash
# HMS VPS Health Check
# Usage: bash health_check.sh

set -uo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
CONTAINER_NAME="hms"
APP_PORT=8080
MGMT_PORT=8081
APP_HEALTH_URL="http://localhost:${MGMT_PORT}/actuator/health"
APP_PING_URL="http://localhost:${APP_PORT}/api/auth/me"
LOG_TAIL=30
LOAD_WARN_MULTIPLIER=1  # warn if 1-min load > (CPUs * this)

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*"; }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; }
info() { echo -e "  ${DIM}$*${RESET}"; }
section() { echo -e "\n${CYAN}${BOLD}── $* $(printf '%.0s─' {1..40} | head -c $((44 - ${#1})))${RESET}"; }

# ── Header ───────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  HMS Health Check  —  $(date '+%Y-%m-%d %H:%M:%S %Z')${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"

# ── SYSTEM ───────────────────────────────────────────────────────────────────
section "SYSTEM"

HOSTNAME=$(hostname)
KERNEL=$(uname -r)
# OS detection — /etc/os-release on Linux, sw_vers on macOS
if [ -f /etc/os-release ]; then
  DISTRO=$(awk -F'"' '/^PRETTY_NAME=/{print $2}' /etc/os-release)
elif command -v sw_vers &>/dev/null; then
  DISTRO="$(sw_vers -productName) $(sw_vers -productVersion)"
else
  DISTRO="Unknown"
fi
echo -e "  Host       : ${BOLD}${HOSTNAME}${RESET}  (${KERNEL})"
echo -e "  OS         : ${DISTRO}"

UPTIME_STR=$(uptime -p 2>/dev/null || uptime)
echo -e "  Uptime     : ${UPTIME_STR}"

# CPU count — nproc on Linux, sysctl on macOS
CPU_COUNT=$(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 1)

# Load averages — /proc/loadavg on Linux, sysctl on macOS
if [ -f /proc/loadavg ]; then
  read -r LOAD1 LOAD5 LOAD15 _ < /proc/loadavg
else
  LOAD_RAW=$(sysctl -n vm.loadavg 2>/dev/null | tr -d '{}')
  LOAD1=$(echo "${LOAD_RAW}" | awk '{print $1}')
  LOAD5=$(echo "${LOAD_RAW}" | awk '{print $2}')
  LOAD15=$(echo "${LOAD_RAW}" | awk '{print $3}')
fi
LOAD_THRESHOLD=$(awk "BEGIN {printf \"%.1f\", ${CPU_COUNT} * ${LOAD_WARN_MULTIPLIER}}")
echo -ne "  Load 1/5/15: ${BOLD}${LOAD1} / ${LOAD5} / ${LOAD15}${RESET}  (${CPU_COUNT} CPUs)  "
if awk "BEGIN {exit !($LOAD1 > $LOAD_THRESHOLD)}"; then
  warn "high load (>${LOAD_THRESHOLD})"
else
  ok ""
fi

# Memory — free on Linux, vm_stat on macOS
if command -v free &>/dev/null; then
  MEM_LINE=$(free -m | awk '/^Mem:/ {printf "%dMiB used / %dMiB total (%d%%)", $3, $2, int($3/$2*100)}')
  MEM_PCT=$(free | awk '/^Mem:/ {printf "%d", $3/$2*100}')
else
  PAGE=$(pagesize 2>/dev/null || echo 4096)
  MEM_LINE=$(vm_stat | awk -v page="${PAGE}" '
    /Pages free/      {free=$3+0}
    /Pages active/    {active=$3+0}
    /Pages inactive/  {inactive=$3+0}
    /Pages wired/     {wired=$4+0}
    /Pages occupied by compressor/ {comp=$5+0}
    END {
      total=(free+active+inactive+wired+comp)*page/1048576
      used=(active+inactive+wired+comp)*page/1048576
      printf "%dMiB used / %dMiB total (%d%%)", used, total, int(used/total*100)
    }')
  MEM_PCT=$(echo "${MEM_LINE}" | grep -o '[0-9]*%' | tr -d '%')
fi
echo -ne "  Memory     : ${MEM_LINE}  "
if [ "${MEM_PCT}" -ge 90 ]; then
  fail "critical (${MEM_PCT}% used)"
elif [ "${MEM_PCT}" -ge 75 ]; then
  warn "high (${MEM_PCT}% used)"
else
  ok ""
fi

DISK_LINE=$(df -h / | awk 'NR==2 {print $3 " used / " $2 " total (" $5 ")"}')
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
echo -ne "  Disk (/)   : ${DISK_LINE}  "
if [ "${DISK_PCT}" -ge 90 ]; then
  fail "critical (${DISK_PCT}% used)"
elif [ "${DISK_PCT}" -ge 75 ]; then
  warn "high (${DISK_PCT}% used)"
else
  ok ""
fi

# ── CONTAINER ────────────────────────────────────────────────────────────────
section "CONTAINER  [${CONTAINER_NAME}]"

if ! command -v docker &>/dev/null; then
  fail "docker not found on PATH"
else
  CONTAINER_EXISTS=$(docker inspect "${CONTAINER_NAME}" &>/dev/null && echo yes || echo no)

  if [ "${CONTAINER_EXISTS}" = "no" ]; then
    fail "container '${CONTAINER_NAME}' does not exist"
  else
    CONTAINER_STATUS=$(docker inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")
    STARTED_AT=$(docker inspect --format '{{.State.StartedAt}}' "${CONTAINER_NAME}")
    RESTART_COUNT=$(docker inspect --format '{{.RestartCount}}' "${CONTAINER_NAME}")
    IMAGE=$(docker inspect --format '{{.Config.Image}}' "${CONTAINER_NAME}")

    echo -ne "  Status     : ${BOLD}${CONTAINER_STATUS}${RESET}  "
    if [ "${CONTAINER_STATUS}" = "running" ]; then ok ""; else fail "not running"; fi

    echo -e "  Image      : ${IMAGE}"
    echo -e "  Started    : ${STARTED_AT}"

    echo -ne "  Restarts   : ${RESTART_COUNT}  "
    if [ "${RESTART_COUNT}" -eq 0 ]; then ok ""; elif [ "${RESTART_COUNT}" -lt 5 ]; then warn ""; else fail "excessive restarts"; fi

    if [ "${CONTAINER_STATUS}" = "running" ]; then
      STATS=$(docker stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}} {{.MemPerc}}" "${CONTAINER_NAME}" 2>/dev/null || echo "unavailable")
      CPU_USAGE=$(echo "${STATS}" | awk '{print $1}')
      MEM_USAGE=$(echo "${STATS}" | awk '{print $2, $3, $4}')
      MEM_PCT_DOCKER=$(echo "${STATS}" | awk '{gsub(/%/,""); print $NF}')
      echo -e "  CPU        : ${CPU_USAGE}"
      echo -e "  Memory     : ${MEM_USAGE}"
    fi

    echo ""
    echo -e "  ${DIM}Recent logs (last ${LOG_TAIL} lines):${RESET}"
    echo -e "  ${DIM}$(printf '%.0s─' {1..44})${RESET}"
    docker logs --tail "${LOG_TAIL}" "${CONTAINER_NAME}" 2>&1 | sed 's/^/  /'
  fi
fi

# ── SPRING APP ───────────────────────────────────────────────────────────────
section "SPRING APP"

# Reachability check on app port
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "${APP_PING_URL}" 2>/dev/null || echo "000")
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 "${APP_PING_URL}" 2>/dev/null || echo "N/A")

echo -ne "  Port ${APP_PORT}   : "
if [ "${HTTP_CODE}" = "000" ]; then
  fail "connection refused — app not responding"
elif [ "${HTTP_CODE}" = "401" ] || [ "${HTTP_CODE}" = "403" ]; then
  ok "reachable (HTTP ${HTTP_CODE} — expected for auth endpoint)"
else
  warn "unexpected HTTP ${HTTP_CODE}"
fi
echo -e "  Response   : ${RESPONSE_TIME}s"

# Actuator health
echo ""
HEALTH_JSON=$(curl -s --connect-timeout 3 "${APP_HEALTH_URL}" 2>/dev/null || echo "")

if [ -z "${HEALTH_JSON}" ]; then
  fail "actuator not reachable at port ${MGMT_PORT} — is the app running with actuator configured?"
else
  OVERALL=$(echo "${HEALTH_JSON}" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"//;s/"//')
  DB_STATUS=$(echo "${HEALTH_JSON}" | grep -A2 '"db"' | grep '"status"' | head -1 | sed 's/.*"status":"//;s/".*//')
  DISK_STATUS=$(echo "${HEALTH_JSON}" | grep -A2 '"diskSpace"' | grep '"status"' | head -1 | sed 's/.*"status":"//;s/".*//')
  PING_STATUS=$(echo "${HEALTH_JSON}" | grep -A2 '"ping"' | grep '"status"' | head -1 | sed 's/.*"status":"//;s/".*//')

  echo -ne "  Overall    : ${BOLD}${OVERALL:-UNKNOWN}${RESET}  "
  [ "${OVERALL}" = "UP" ] && ok "" || fail ""

  if [ -n "${DB_STATUS}" ]; then
    echo -ne "  Database   : ${DB_STATUS}  "
    [ "${DB_STATUS}" = "UP" ] && ok "" || fail "database is not UP"
  fi

  if [ -n "${DISK_STATUS}" ]; then
    echo -ne "  Disk Space : ${DISK_STATUS}  "
    [ "${DISK_STATUS}" = "UP" ] && ok "" || warn "disk space check failed"
  fi

  if [ -n "${PING_STATUS}" ]; then
    echo -ne "  Ping       : ${PING_STATUS}  "
    [ "${PING_STATUS}" = "UP" ] && ok "" || fail ""
  fi
fi

# ── JVM ──────────────────────────────────────────────────────────────────────
section "JVM"

METRICS_BASE="http://localhost:${MGMT_PORT}/actuator/metrics"

# Helper: fetch a single metric value (first measurement) in bytes, return as-is
metric_value() {
  curl -s --connect-timeout 3 "${METRICS_BASE}/$1" 2>/dev/null \
    | grep -o '"value":[0-9.]*' | head -1 | sed 's/"value"://'
}

# Helper: bytes → human readable (MiB)
to_mib() { awk "BEGIN {printf \"%.0f MiB\", $1 / 1048576}"; }

# Test if metrics endpoint is reachable
METRICS_TEST=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "${METRICS_BASE}" 2>/dev/null || echo "000")

if [ "${METRICS_TEST}" != "200" ]; then
  fail "metrics endpoint not reachable (HTTP ${METRICS_TEST}) — redeploy may be needed"
else
  # Uptime
  UPTIME_S=$(metric_value "process.uptime")
  if [ -n "${UPTIME_S}" ]; then
    UPTIME_H=$(awk "BEGIN {printf \"%dh %dm\", int($UPTIME_S/3600), int(($UPTIME_S%3600)/60)}")
    echo -e "  Uptime     : ${UPTIME_H}"
  fi

  # CPU
  CPU_USAGE=$(metric_value "process.cpu.usage")
  if [ -n "${CPU_USAGE}" ]; then
    CPU_PCT=$(awk "BEGIN {printf \"%.1f%%\", $CPU_USAGE * 100}")
    echo -e "  CPU usage  : ${CPU_PCT}"
  fi

  # Heap memory
  HEAP_USED=$(metric_value "jvm.memory.used?tag=area:heap")
  HEAP_MAX=$(metric_value "jvm.memory.max?tag=area:heap")
  HEAP_COMMITTED=$(metric_value "jvm.memory.committed?tag=area:heap")
  if [ -n "${HEAP_USED}" ] && [ -n "${HEAP_MAX}" ]; then
    HEAP_PCT=$(awk "BEGIN {printf \"%.0f\", ($HEAP_USED / $HEAP_MAX) * 100}")
    echo -ne "  Heap       : $(to_mib ${HEAP_USED}) used / $(to_mib ${HEAP_MAX}) max  (${HEAP_PCT}%)  "
    if [ "${HEAP_PCT}" -ge 90 ]; then
      fail "critical heap pressure"
    elif [ "${HEAP_PCT}" -ge 75 ]; then
      warn "high heap usage"
    else
      ok ""
    fi
  fi

  # Non-heap (metaspace, code cache, etc.)
  NONHEAP_USED=$(metric_value "jvm.memory.used?tag=area:nonheap")
  NONHEAP_COMMITTED=$(metric_value "jvm.memory.committed?tag=area:nonheap")
  if [ -n "${NONHEAP_USED}" ]; then
    echo -e "  Non-heap   : $(to_mib ${NONHEAP_USED}) used / $(to_mib ${NONHEAP_COMMITTED}) committed"
  fi

  # Threads
  THREADS_LIVE=$(metric_value "jvm.threads.live")
  THREADS_DAEMON=$(metric_value "jvm.threads.daemon")
  THREADS_PEAK=$(metric_value "jvm.threads.peak")
  if [ -n "${THREADS_LIVE}" ]; then
    echo -e "  Threads    : ${THREADS_LIVE%.0} live  /  ${THREADS_DAEMON%.0} daemon  /  ${THREADS_PEAK%.0} peak"
  fi

  # GC pause (total cumulative time in seconds)
  GC_PAUSE=$(metric_value "jvm.gc.pause")
  if [ -n "${GC_PAUSE}" ]; then
    GC_MS=$(awk "BEGIN {printf \"%.0f ms total\", $GC_PAUSE * 1000}")
    echo -e "  GC pauses  : ${GC_MS}"
  fi

  # Classes loaded
  CLASSES=$(metric_value "jvm.classes.loaded")
  if [ -n "${CLASSES}" ]; then
    echo -e "  Classes    : ${CLASSES%.0} loaded"
  fi
fi

echo -e "\n${BOLD}══════════════════════════════════════════════════${RESET}\n"
