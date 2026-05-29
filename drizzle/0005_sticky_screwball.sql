CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`log_type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
