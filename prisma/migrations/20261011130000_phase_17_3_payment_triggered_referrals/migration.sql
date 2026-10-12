-- Forward-only enum additions for payment-triggered referral rewards and review state.
ALTER TYPE "ReferralRewardType" ADD VALUE IF NOT EXISTS 'PAID_ORDER_25';
ALTER TYPE "ReferralStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT_REVIEW';
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'REFERRAL_PAYMENT_REWARD';
