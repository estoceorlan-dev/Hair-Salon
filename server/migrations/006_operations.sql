ALTER TABLE salon.services ADD COLUMN image_key text;
ALTER TABLE salon.payment_methods DROP CONSTRAINT payment_methods_enabled_check;
ALTER TABLE salon.payment_methods ADD CHECK (NOT enabled OR code='cash');
UPDATE salon.payment_methods SET enabled=true WHERE code='cash';
UPDATE salon.business_hours SET opens_at=CASE WHEN weekday<>0 THEN '09:00'::time END,
  closes_at=CASE WHEN weekday<>0 THEN '19:00'::time END,is_closed=(weekday=0),definition_state='confirmed'
  WHERE definition_state='placeholder';
