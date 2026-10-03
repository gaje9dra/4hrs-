-- Phase 15.14: customer account security notification events.
ALTER TYPE "NotificationEventType" ADD VALUE 'SECURITY_PASSWORD_CHANGED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SECURITY_SESSIONS_REVOKED';
