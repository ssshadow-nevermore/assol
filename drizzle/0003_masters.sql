CREATE TABLE IF NOT EXISTS `masters` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `specialization` text DEFAULT '' NOT NULL,
  `services_text` text DEFAULT '' NOT NULL,
  `image_storage_key` text,
  `image_url` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `masters_is_active_check` CHECK (`is_active` IN (0, 1))
);
CREATE INDEX IF NOT EXISTS `masters_active_sort_idx` ON `masters` (`is_active`, `sort_order`);

INSERT INTO `masters` (`id`, `name`, `specialization`, `services_text`, `is_active`, `sort_order`)
VALUES
  ('dzhulia', 'Джулия', 'Парикмахер-универсал', 'Стрижки · окрашивание любой сложности · брови', 1, 0),
  ('marina', 'Марина', 'Мастер депиляции', 'Депиляция лица и тела', 1, 1),
  ('snezhana', 'Снежана', 'Парикмахер-универсал', 'Стрижки · окрашивание · химия', 1, 2),
  ('yulia', 'Юлия', 'Парикмахер-универсал, колорист', 'Стрижки · окрашивание любой сложности', 1, 3),
  ('elena', 'Елена', 'Мастер ногтевого сервиса', 'Маникюр · педикюр · покрытие', 1, 4)
ON CONFLICT (`id`) DO UPDATE SET
  `name` = excluded.`name`,
  `specialization` = excluded.`specialization`,
  `services_text` = excluded.`services_text`,
  `is_active` = excluded.`is_active`,
  `sort_order` = excluded.`sort_order`,
  `updated_at` = CURRENT_TIMESTAMP;
