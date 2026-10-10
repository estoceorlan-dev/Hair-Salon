CREATE TABLE salon.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES salon.customers(id),
  employee_id uuid NOT NULL,
  service_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','no_show')),
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','customer','walk_in','demo')),
  service_name_snapshot text NOT NULL,
  price_cents_snapshot bigint CHECK (price_cents_snapshot >= 0),
  duration_minutes_snapshot integer CHECK (duration_minutes_snapshot > 0),
  created_by uuid REFERENCES salon.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,customer_id),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (employee_id,service_id) REFERENCES salon.employee_services(employee_id,service_id),
  CONSTRAINT appointments_no_staff_overlap EXCLUDE USING gist
    (employee_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
    WHERE (status IN ('pending','confirmed','in_progress','completed'))
);
CREATE INDEX appointments_customer_date_idx ON salon.appointments(customer_id,starts_at);
CREATE INDEX appointments_date_status_idx ON salon.appointments(starts_at,status);

CREATE TABLE salon.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  stock_unit text NOT NULL,
  retail_price_cents bigint CHECK (retail_price_cents >= 0),
  minimum_stock numeric(14,3) CHECK (minimum_stock >= 0),
  is_retail boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE salon.service_products (
  service_id uuid NOT NULL REFERENCES salon.services(id),
  product_id uuid NOT NULL REFERENCES salon.products(id),
  quantity numeric(14,3) CHECK (quantity > 0),
  definition_state text NOT NULL DEFAULT 'placeholder' CHECK (definition_state IN ('placeholder','demo','confirmed')),
  PRIMARY KEY (service_id,product_id),
  CHECK (definition_state <> 'placeholder' OR quantity IS NULL)
);
CREATE TABLE salon.stock_balances (
  product_id uuid PRIMARY KEY REFERENCES salon.products(id),
  quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE salon.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  receipt_number text UNIQUE,
  customer_id uuid REFERENCES salon.customers(id),
  appointment_id uuid REFERENCES salon.appointments(id),
  cashier_id uuid NOT NULL REFERENCES salon.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','paid','partially_refunded','refunded','voided')),
  subtotal_cents bigint NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  discount_cents bigint CHECK (discount_cents >= 0 AND discount_cents <= subtotal_cents),
  tax_cents bigint CHECK (tax_cents >= 0),
  total_cents bigint CHECK (total_cents >= 0),
  tax_policy_snapshot jsonb,
  discount_policy_snapshot jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  sold_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(appointment_id,customer_id) REFERENCES salon.appointments(id,customer_id),
  CHECK(appointment_id IS NULL OR customer_id IS NOT NULL),
  CHECK (total_cents IS NULL OR total_cents = subtotal_cents - discount_cents + tax_cents),
  CHECK (status IN ('draft','voided') OR (receipt_number IS NOT NULL AND discount_cents IS NOT NULL AND tax_cents IS NOT NULL AND total_cents IS NOT NULL))
);
CREATE UNIQUE INDEX sales_one_active_appointment_idx ON salon.sales(appointment_id) WHERE status <> 'voided';
CREATE INDEX sales_sold_at_status_idx ON salon.sales(sold_at,status);
CREATE INDEX sales_customer_date_idx ON salon.sales(customer_id,sold_at);
CREATE TABLE salon.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES salon.sales(id),
  service_id uuid REFERENCES salon.services(id),
  product_id uuid REFERENCES salon.products(id),
  description_snapshot text NOT NULL,
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  line_total_cents bigint NOT NULL CHECK (line_total_cents >= 0),
  consumption_snapshot jsonb,
  CHECK ((service_id IS NOT NULL) <> (product_id IS NOT NULL)),
  CHECK (line_total_cents = round(unit_price_cents * quantity))
);
CREATE INDEX sale_items_sale_idx ON salon.sale_items(sale_id);
CREATE TABLE salon.sale_item_staff (
  sale_item_id uuid NOT NULL REFERENCES salon.sale_items(id),
  employee_id uuid NOT NULL REFERENCES salon.employees(id),
  commission_policy_snapshot jsonb,
  PRIMARY KEY (sale_item_id,employee_id)
);

CREATE TABLE salon.payment_methods (
  code text PRIMARY KEY CHECK (code IN ('cash','gcash','maya','card')),
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  CHECK (NOT enabled)
);
INSERT INTO salon.payment_methods(code,label) VALUES ('cash','Cash'),('gcash','GCash'),('maya','Maya'),('card','Card');
-- Enabling a provider requires a later explicit migration and business implementation.
CREATE TABLE salon.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES salon.sales(id),
  method_code text NOT NULL REFERENCES salon.payment_methods(code),
  idempotency_key text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  tendered_cents bigint CHECK (tendered_cents >= amount_cents),
  change_cents bigint CHECK (change_cents >= 0),
  reference text,
  status text NOT NULL CHECK (status IN ('pending','recorded','voided')),
  is_demo boolean NOT NULL DEFAULT false,
  recorded_by uuid NOT NULL REFERENCES salon.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,sale_id),
  CHECK ((tendered_cents IS NULL AND change_cents IS NULL) OR (tendered_cents IS NOT NULL AND change_cents IS NOT NULL AND change_cents = tendered_cents - amount_cents))
);
CREATE INDEX payments_sale_idx ON salon.payments(sale_id);
CREATE TABLE salon.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES salon.sales(id),
  payment_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  approved_by uuid NOT NULL REFERENCES salon.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (payment_id,sale_id) REFERENCES salon.payments(id,sale_id)
);
CREATE TABLE salon.sale_voids (
  sale_id uuid PRIMARY KEY REFERENCES salon.sales(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  approved_by uuid NOT NULL REFERENCES salon.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE salon.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES salon.products(id),
  quantity_delta numeric(14,3) NOT NULL CHECK (quantity_delta <> 0),
  source_type text NOT NULL CHECK (source_type IN ('opening','restock','service_consumption','retail_sale','adjustment','reversal')),
  source_reference text NOT NULL,
  sale_item_id uuid REFERENCES salon.sale_items(id),
  reverses_movement_id uuid REFERENCES salon.inventory_movements(id),
  actor_id uuid NOT NULL REFERENCES salon.users(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id,source_type,source_reference)
);
CREATE INDEX inventory_movements_product_date_idx ON salon.inventory_movements(product_id,occurred_at);

CREATE TABLE salon.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  amount_cents bigint CHECK (amount_cents >= 0),
  policy_snapshot jsonb,
  status text NOT NULL DEFAULT 'pending_definition' CHECK (status IN ('pending_definition','earned','reversed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sale_item_id,employee_id),
  FOREIGN KEY(sale_item_id,employee_id) REFERENCES salon.sale_item_staff(sale_item_id,employee_id),
  CHECK (status = 'pending_definition' OR (amount_cents IS NOT NULL AND policy_snapshot IS NOT NULL))
);
CREATE TABLE salon.commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES salon.commission_entries(id),
  amount_delta_cents bigint NOT NULL CHECK (amount_delta_cents <> 0),
  reason text NOT NULL,
  approved_by uuid NOT NULL REFERENCES salon.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE salon.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','voided')),
  policy_snapshot jsonb,
  approved_by uuid REFERENCES salon.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_start,period_end),
  CHECK(period_end > period_start),
  CHECK(status IN ('draft','voided') OR (policy_snapshot IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE TABLE salon.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES salon.payroll_runs(id),
  employee_id uuid NOT NULL REFERENCES salon.employees(id),
  base_pay_cents bigint CHECK (base_pay_cents >= 0),
  commission_cents bigint CHECK (commission_cents >= 0),
  adjustment_cents bigint,
  net_pay_cents bigint CHECK (net_pay_cents >= 0),
  calculation_snapshot jsonb,
  UNIQUE(payroll_run_id,employee_id),
  UNIQUE(id,employee_id),
  CHECK(net_pay_cents IS NULL OR (base_pay_cents IS NOT NULL AND commission_cents IS NOT NULL AND adjustment_cents IS NOT NULL AND net_pay_cents = base_pay_cents + commission_cents + adjustment_cents))
);
CREATE TABLE salon.payroll_commissions (
  payroll_item_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  commission_id uuid NOT NULL UNIQUE REFERENCES salon.commission_entries(id),
  PRIMARY KEY(payroll_item_id,commission_id),
  FOREIGN KEY(payroll_item_id,employee_id) REFERENCES salon.payroll_items(id,employee_id)
);
CREATE TABLE salon.payroll_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid NOT NULL UNIQUE REFERENCES salon.payroll_items(id),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  recorded_by uuid NOT NULL REFERENCES salon.users(id),
  paid_at timestamptz NOT NULL,
  reference text
);
CREATE TABLE salon.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES salon.users(id),
  kind text NOT NULL,
  product_id uuid REFERENCES salon.products(id),
  dedupe_key text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recipient_user_id,dedupe_key)
);
CREATE TABLE salon.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES salon.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_reference text,
  reason text,
  details jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_actor_date_idx ON salon.activity_logs(actor_id,occurred_at);
CREATE INDEX activity_logs_action_date_idx ON salon.activity_logs(action,occurred_at);
CREATE TABLE salon.seed_runs (
  seed_key text PRIMARY KEY,
  reference_date date NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
