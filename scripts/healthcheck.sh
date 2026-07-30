#!/usr/bin/env bash
# Is the site actually answering? Runs on a short cron.
#
# The box had no monitoring at all: when the frontend was serving 500s for
# every asset earlier today, nothing noticed — it was found by hand. A news
# site that goes quiet at 3am stays quiet until someone opens it.
#
# Deliberately conservative. It restarts the unit only when systemd still
# believes it is running while HTTP says otherwise (the failure mode that
# actually happened: process alive, build directory pulled out from under it),
# only after two consecutive bad checks, and never more than once per
# COOLDOWN. A crash-looping service is left down and shouting in the log
# rather than being restarted every minute forever.
#
# Log: /var/log/aldaftar-health.log
set -uo pipefail

URL="${HEALTH_URL:-https://dafter.educore.software/}"
# Overridable so the failure path can be exercised against a dummy unit
# without restarting the live one.
UNIT="${HEALTH_UNIT:-dafter-frontend}"
STATE_DIR=/var/lib/aldaftar
FAIL_FILE="$STATE_DIR/health-fails"
LAST_RESTART="$STATE_DIR/health-last-restart"
COOLDOWN=600      # seconds between permitted restarts
THRESHOLD=2       # consecutive failures before acting

mkdir -p "$STATE_DIR"
now=$(date +%s)
stamp=$(date '+%Y-%m-%d %H:%M:%S')

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" || echo 000)

if [ "$code" = "200" ]; then
  [ -s "$FAIL_FILE" ] && echo "$stamp  RECOVERED — $URL is 200 again" >> /var/log/aldaftar-health.log
  : > "$FAIL_FILE"
  exit 0
fi

fails=$(( $(cat "$FAIL_FILE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$FAIL_FILE"
echo "$stamp  DOWN — HTTP $code from $URL (consecutive: $fails)" >> /var/log/aldaftar-health.log

[ "$fails" -lt "$THRESHOLD" ] && exit 1

# Only intervene when systemd thinks it is fine — otherwise it is already
# crash-looping and restarting it again just hides that.
if ! systemctl is-active --quiet "$UNIT"; then
  echo "$stamp  $UNIT is not active — leaving it down, this needs a human" >> /var/log/aldaftar-health.log
  exit 1
fi

last=$(cat "$LAST_RESTART" 2>/dev/null || echo 0)
if [ $(( now - last )) -lt "$COOLDOWN" ]; then
  echo "$stamp  restart suppressed — last was $(( (now - last) / 60 ))m ago (cooldown ${COOLDOWN}s)" >> /var/log/aldaftar-health.log
  exit 1
fi

echo "$now" > "$LAST_RESTART"
echo "$stamp  restarting $UNIT after $fails failed checks" >> /var/log/aldaftar-health.log
systemctl restart "$UNIT"
sleep 8
after=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" || echo 000)
echo "$stamp  after restart: HTTP $after" >> /var/log/aldaftar-health.log
[ "$after" = "200" ] && : > "$FAIL_FILE"
