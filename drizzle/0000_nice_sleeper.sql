CREATE TABLE `external_links` (
	`id` text PRIMARY KEY NOT NULL,
	`link_key` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`phone_to_copy` text,
	`open_in_new_tab` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "external_links_kind_check" CHECK("external_links"."kind" IN ('vk', 'max', 'email', 'dikidi_widget', 'dikidi_script', 'yandex_maps', 'yandex_reviews', 'other')),
	CONSTRAINT "external_links_open_in_new_tab_check" CHECK("external_links"."open_in_new_tab" IN (0, 1)),
	CONSTRAINT "external_links_is_active_check" CHECK("external_links"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_links_link_key_unique` ON `external_links` (`link_key`);--> statement-breakpoint
CREATE INDEX `external_links_active_sort_idx` ON `external_links` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `offer_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`condition_type` text NOT NULL,
	`operator` text DEFAULT 'custom' NOT NULL,
	`amount_value` integer,
	`text_value` text,
	`service_id` text,
	`service_category_id` text,
	`title` text,
	`description` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`service_category_id`) REFERENCES `service_categories`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "offer_conditions_type_check" CHECK("offer_conditions"."condition_type" IN ('minimum_single_service_price', 'minimum_order_total', 'service_purchase', 'category_purchase', 'new_customer', 'nth_visit', 'custom')),
	CONSTRAINT "offer_conditions_operator_check" CHECK("offer_conditions"."operator" IN ('gt', 'gte', 'eq', 'lte', 'lt', 'custom')),
	CONSTRAINT "offer_conditions_value_check" CHECK((
        ("offer_conditions"."condition_type" IN ('minimum_single_service_price', 'minimum_order_total') AND "offer_conditions"."operator" IN ('gt', 'gte', 'eq', 'lte', 'lt') AND "offer_conditions"."amount_value" IS NOT NULL AND "offer_conditions"."amount_value" >= 0)
        OR ("offer_conditions"."condition_type" = 'service_purchase' AND "offer_conditions"."service_id" IS NOT NULL)
        OR ("offer_conditions"."condition_type" = 'category_purchase' AND "offer_conditions"."service_category_id" IS NOT NULL)
        OR ("offer_conditions"."condition_type" = 'nth_visit' AND "offer_conditions"."amount_value" IS NOT NULL AND "offer_conditions"."amount_value" >= 2)
        OR "offer_conditions"."condition_type" IN ('new_customer', 'custom')
      )),
	CONSTRAINT "offer_conditions_is_active_check" CHECK("offer_conditions"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `offer_conditions_offer_active_sort_idx` ON `offer_conditions` (`offer_id`,`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `offer_conditions_service_idx` ON `offer_conditions` (`service_id`);--> statement-breakpoint
CREATE INDEX `offer_conditions_category_idx` ON `offer_conditions` (`service_category_id`);--> statement-breakpoint
CREATE TABLE `offer_service_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`service_id` text NOT NULL,
	`rule_type` text NOT NULL,
	`discount_amount` integer,
	`discount_percent` integer,
	`free_visit_number` integer,
	`usage_limit` integer,
	`shared_usage_group` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "offer_service_rules_rule_type_check" CHECK("offer_service_rules"."rule_type" IN ('fixed_discount', 'percent_discount', 'free', 'free_nth_visit')),
	CONSTRAINT "offer_service_rules_values_check" CHECK((
        ("offer_service_rules"."rule_type" = 'fixed_discount' AND "offer_service_rules"."discount_amount" IS NOT NULL AND "offer_service_rules"."discount_amount" > 0 AND "offer_service_rules"."discount_percent" IS NULL AND "offer_service_rules"."free_visit_number" IS NULL)
        OR ("offer_service_rules"."rule_type" = 'percent_discount' AND "offer_service_rules"."discount_percent" BETWEEN 1 AND 100 AND "offer_service_rules"."discount_amount" IS NULL AND "offer_service_rules"."free_visit_number" IS NULL)
        OR ("offer_service_rules"."rule_type" = 'free' AND "offer_service_rules"."discount_amount" IS NULL AND "offer_service_rules"."discount_percent" IS NULL AND "offer_service_rules"."free_visit_number" IS NULL)
        OR ("offer_service_rules"."rule_type" = 'free_nth_visit' AND "offer_service_rules"."free_visit_number" IS NOT NULL AND "offer_service_rules"."free_visit_number" >= 2 AND "offer_service_rules"."discount_amount" IS NULL AND "offer_service_rules"."discount_percent" IS NULL)
      )),
	CONSTRAINT "offer_service_rules_usage_limit_check" CHECK("offer_service_rules"."usage_limit" IS NULL OR "offer_service_rules"."usage_limit" > 0),
	CONSTRAINT "offer_service_rules_is_active_check" CHECK("offer_service_rules"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offer_service_rules_offer_service_unique` ON `offer_service_rules` (`offer_id`,`service_id`);--> statement-breakpoint
CREATE INDEX `offer_service_rules_offer_active_idx` ON `offer_service_rules` (`offer_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `offer_service_rules_service_active_idx` ON `offer_service_rules` (`service_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`linked_service_id` text,
	`type` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`short_title` text,
	`eyebrow` text,
	`description` text NOT NULL,
	`legal_note` text,
	`benefit_type` text NOT NULL,
	`benefit_value` integer,
	`nominal_value` integer,
	`currency` text DEFAULT 'RUB' NOT NULL,
	`free_visit_number` integer,
	`front_storage_key` text,
	`front_url` text,
	`back_storage_key` text,
	`back_url` text,
	`valid_from` text,
	`valid_until` text,
	`is_transferable` integer DEFAULT 0 NOT NULL,
	`can_combine_with_other_offers` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`linked_service_id`) REFERENCES `services`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "offers_type_check" CHECK("offers"."type" IN ('promotion', 'loyalty', 'certificate', 'gift_card')),
	CONSTRAINT "offers_benefit_type_check" CHECK("offers"."benefit_type" IN ('fixed_discount', 'percent_discount', 'nominal', 'free_nth_visit', 'free_service', 'custom')),
	CONSTRAINT "offers_nominal_value_check" CHECK("offers"."benefit_type" <> 'nominal' OR ("offers"."nominal_value" IS NOT NULL AND "offers"."nominal_value" >= 0 AND "offers"."benefit_value" IS NULL)),
	CONSTRAINT "offers_free_nth_visit_check" CHECK("offers"."benefit_type" <> 'free_nth_visit' OR ("offers"."free_visit_number" IS NOT NULL AND "offers"."free_visit_number" >= 2)),
	CONSTRAINT "offers_validity_range_check" CHECK("offers"."valid_from" IS NULL OR "offers"."valid_until" IS NULL OR "offers"."valid_until" >= "offers"."valid_from"),
	CONSTRAINT "offers_is_transferable_check" CHECK("offers"."is_transferable" IN (0, 1)),
	CONSTRAINT "offers_can_combine_check" CHECK("offers"."can_combine_with_other_offers" IN (0, 1)),
	CONSTRAINT "offers_status_check" CHECK("offers"."status" IN ('draft', 'active', 'hidden', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_slug_unique` ON `offers` (`slug`);--> statement-breakpoint
CREATE INDEX `offers_status_sort_idx` ON `offers` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `offers_linked_service_idx` ON `offers` (`linked_service_id`);--> statement-breakpoint
CREATE TABLE `portfolio_items` (
	`id` text PRIMARY KEY NOT NULL,
	`service_category_id` text,
	`title` text NOT NULL,
	`description` text,
	`alt_text` text NOT NULL,
	`image_storage_key` text,
	`image_url` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`service_category_id`) REFERENCES `service_categories`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "portfolio_items_is_active_check" CHECK("portfolio_items"."is_active" IN (0, 1)),
	CONSTRAINT "portfolio_items_image_reference_check" CHECK("portfolio_items"."image_storage_key" IS NOT NULL OR "portfolio_items"."image_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `portfolio_items_active_sort_idx` ON `portfolio_items` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `portfolio_items_category_idx` ON `portfolio_items` (`service_category_id`);--> statement-breakpoint
CREATE TABLE `salon_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`salon_name` text NOT NULL,
	`phone` text NOT NULL,
	`display_phone` text NOT NULL,
	`email` text,
	`region` text,
	`city` text,
	`street_address` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`yandex_organization_id` text,
	`logo_storage_key` text,
	`logo_url` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "salon_settings_singleton_check" CHECK("salon_settings"."id" = 1),
	CONSTRAINT "salon_settings_is_active_check" CHECK("salon_settings"."is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_id` text NOT NULL,
	`number` text NOT NULL,
	`title` text NOT NULL,
	`short_title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_from_type` text DEFAULT 'from' NOT NULL,
	`price_from_amount` integer,
	`price_from_min` integer,
	`price_from_max` integer,
	`price_from_display_text` text,
	`price_note` text,
	`master_ids_json` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "service_categories_price_from_type_check" CHECK("service_categories"."price_from_type" IN ('fixed', 'from', 'range', 'free', 'custom')),
	CONSTRAINT "service_categories_master_ids_json_check" CHECK(json_valid("service_categories"."master_ids_json")),
	CONSTRAINT "service_categories_is_active_check" CHECK("service_categories"."is_active" IN (0, 1)),
	CONSTRAINT "service_categories_price_range_check" CHECK("service_categories"."price_from_min" IS NULL OR "service_categories"."price_from_max" IS NULL OR "service_categories"."price_from_max" >= "service_categories"."price_from_min")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_categories_legacy_id_unique` ON `service_categories` (`legacy_id`);--> statement-breakpoint
CREATE INDEX `service_categories_active_sort_idx` ON `service_categories` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`legacy_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`pricing_type` text NOT NULL,
	`price_amount` integer,
	`price_min` integer,
	`price_max` integer,
	`price_tiers_json` text DEFAULT '[]' NOT NULL,
	`price_display_text` text,
	`duration_text` text,
	`duration_min_minutes` integer,
	`duration_max_minutes` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON UPDATE cascade ON DELETE restrict,
	CONSTRAINT "services_pricing_type_check" CHECK("services"."pricing_type" IN ('fixed', 'from', 'range', 'tiers', 'free', 'custom')),
	CONSTRAINT "services_price_tiers_json_check" CHECK(json_valid("services"."price_tiers_json")),
	CONSTRAINT "services_is_active_check" CHECK("services"."is_active" IN (0, 1)),
	CONSTRAINT "services_price_values_check" CHECK((
        ("services"."pricing_type" IN ('fixed', 'from') AND "services"."price_amount" IS NOT NULL AND "services"."price_amount" >= 0)
        OR ("services"."pricing_type" = 'range' AND "services"."price_min" IS NOT NULL AND "services"."price_max" IS NOT NULL AND "services"."price_min" >= 0 AND "services"."price_max" >= "services"."price_min")
        OR ("services"."pricing_type" = 'tiers' AND json_array_length("services"."price_tiers_json") > 0)
        OR ("services"."pricing_type" = 'free' AND COALESCE("services"."price_amount", 0) = 0)
        OR "services"."pricing_type" = 'custom'
      )),
	CONSTRAINT "services_duration_range_check" CHECK("services"."duration_min_minutes" IS NULL OR "services"."duration_max_minutes" IS NULL OR "services"."duration_max_minutes" >= "services"."duration_min_minutes")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_category_legacy_id_unique` ON `services` (`category_id`,`legacy_id`);--> statement-breakpoint
CREATE INDEX `services_category_active_sort_idx` ON `services` (`category_id`,`is_active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `working_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`weekday` integer,
	`specific_date` text,
	`is_closed` integer DEFAULT 0 NOT NULL,
	`opens_at` text,
	`closes_at` text,
	`note` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "working_hours_schedule_kind_check" CHECK((
        ("working_hours"."weekday" BETWEEN 1 AND 7 AND "working_hours"."specific_date" IS NULL)
        OR ("working_hours"."weekday" IS NULL AND "working_hours"."specific_date" IS NOT NULL)
      )),
	CONSTRAINT "working_hours_is_closed_check" CHECK("working_hours"."is_closed" IN (0, 1)),
	CONSTRAINT "working_hours_is_active_check" CHECK("working_hours"."is_active" IN (0, 1)),
	CONSTRAINT "working_hours_time_required_check" CHECK("working_hours"."is_closed" = 1 OR ("working_hours"."opens_at" IS NOT NULL AND "working_hours"."closes_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `working_hours_recurring_weekday_unique` ON `working_hours` (`weekday`) WHERE "working_hours"."specific_date" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `working_hours_specific_date_unique` ON `working_hours` (`specific_date`) WHERE "working_hours"."specific_date" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `working_hours_weekday_date_active_idx` ON `working_hours` (`weekday`,`specific_date`,`is_active`);