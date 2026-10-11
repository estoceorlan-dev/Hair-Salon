ALTER TABLE salon.employees ADD COLUMN phone text, ADD COLUMN notes text;
INSERT INTO salon.settings(key) VALUES ('receipt_details'), ('payroll_periods') ON CONFLICT DO NOTHING;
CREATE INDEX services_category_name_idx ON salon.services(category,lower(name));
CREATE INDEX customers_email_idx ON salon.customers(lower(email));
