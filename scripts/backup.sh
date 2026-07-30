#!/usr/bin/env bash
# Nightly backup: database, uploaded media, and the env file needed to
# restore them. Everything else on this server is reproducible from git.
#
# The neighbours on this box had daily backups from day one; dafter-news
# had none until launch prep. Runs at 04:17 — deliberately off the :00
# spike the other apps' jobs share.
#
#   restore db:    pg_restore -d aldaftar --clean --if-exists db-DATE.dump
#   restore media: tar -xzf media-DATE.tar.gz -C /srv/dafter-news/backend
set -euo pipefail

DEST=/var/backups/dafter
KEEP_DAYS=7
STAMP=$(date +%F)
ENV_FILE=/srv/dafter-news/backend/.env

mkdir -p "$DEST"
chmod 700 "$DEST"

# Pull the DB credentials out of .env without sourcing arbitrary lines.
get() { grep "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
export PGPASSWORD="$(get POSTGRES_PASSWORD)"
DB="$(get POSTGRES_DB)"; DBUSER="$(get POSTGRES_USER)"
HOST="$(get POSTGRES_HOST)"; PORT="$(get POSTGRES_PORT)"

echo "[$(date '+%F %T')] backup starting"

# Custom format: compressed, and restorable table-by-table.
pg_dump -Fc -h "$HOST" -p "$PORT" -U "$DBUSER" "$DB" > "$DEST/db-$STAMP.dump"
# A dump that pg_restore can't list is a dump that won't restore at 3am.
pg_restore --list "$DEST/db-$STAMP.dump" > /dev/null

tar -czf "$DEST/media-$STAMP.tar.gz" -C /srv/dafter-news/backend media
gzip -t "$DEST/media-$STAMP.tar.gz"

# The secrets needed to stand the site back up; useless without them.
install -m 600 "$ENV_FILE" "$DEST/env-$STAMP"

find "$DEST" -type f -mtime +"$KEEP_DAYS" -delete

echo "[$(date '+%F %T')] done: $(du -sh "$DEST/db-$STAMP.dump" | cut -f1) db, $(du -sh "$DEST/media-$STAMP.tar.gz" | cut -f1) media, keeping $(ls "$DEST" | wc -l) files"
