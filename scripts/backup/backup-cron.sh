#!/bin/bash

# Backup Cron Script
# This script sets up automated backups using cron

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🕒 Setting up automated backups..."

# Create cron job file
cat > /tmp/hastecrm-backup-cron <<EOF
# hasteCRM Automated Backups
# Daily backup at 2:00 AM
0 2 * * * cd ${PROJECT_ROOT} && ./scripts/run-backup.sh >> ${PROJECT_ROOT}/logs/backup.log 2>&1

# Weekly full backup with verification on Sunday at 3:00 AM
0 3 * * 0 cd ${PROJECT_ROOT} && VERIFY_BACKUP=true ./scripts/run-backup.sh >> ${PROJECT_ROOT}/logs/backup.log 2>&1

# Clean up old local backups (keep 30 days) daily at 4:00 AM
0 4 * * * find ${PROJECT_ROOT}/backups -name "*.gz" -mtime +30 -delete >> ${PROJECT_ROOT}/logs/backup.log 2>&1
EOF

echo "📋 Cron configuration:"
cat /tmp/hastecrm-backup-cron

echo ""
echo "To install the cron jobs, run:"
echo "  crontab /tmp/hastecrm-backup-cron"
echo ""
echo "To view current cron jobs:"
echo "  crontab -l"
echo ""
echo "To edit cron jobs:"
echo "  crontab -e"
echo ""
echo "To remove all cron jobs:"
echo "  crontab -r"

# Create systemd timer as alternative (for systems using systemd)
cat > /tmp/hastecrm-backup.service <<EOF
[Unit]
Description=hasteCRM Backup Service
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${PROJECT_ROOT}/scripts/run-backup.sh
StandardOutput=append:${PROJECT_ROOT}/logs/backup.log
StandardError=append:${PROJECT_ROOT}/logs/backup.log
EOF

cat > /tmp/hastecrm-backup.timer <<EOF
[Unit]
Description=Daily hasteCRM Backup
Requires=hastecrm-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo ""
echo "🔧 Systemd timer configuration also created."
echo ""
echo "To install systemd timer (requires sudo):"
echo "  sudo cp /tmp/hastecrm-backup.{service,timer} /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable hastecrm-backup.timer"
echo "  sudo systemctl start hastecrm-backup.timer"
echo ""
echo "To check timer status:"
echo "  sudo systemctl status hastecrm-backup.timer"
echo "  sudo systemctl list-timers"