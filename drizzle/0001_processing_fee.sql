ALTER TABLE `jobs` ADD `processing_fee_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `paypal_fee_cents` integer;