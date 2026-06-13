# Coding Prompt: BAK-G12 NotificationsModule Integration

Implement typed success/failure notifications for Backups. Preserve the existing HTTP `/notify` transport. Add event constants, detail sanitization, typed helper methods, and tests. Update backup, restore, and retention services to use the helpers. Do not expose secrets, do not trigger a backup or restore, and do not deploy.
