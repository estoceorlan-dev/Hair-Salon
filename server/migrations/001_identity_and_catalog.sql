CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA salon;

CREATE TABLE salon.database_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  application text NOT NULL DEFAULT 'romel-hair-salon' CHECK (application = 'romel-hair-salon'),
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('development','demo','test','production')),
  database_name text NOT NULL DEFAULT current_database(),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO salon.database_identity(singleton) VALUES (true);

CREATE TABLE salon.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  CHECK (code IN ('manager','cashier','stylist','beautician','customer'))
);
CREATE TABLE salon.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL
);
CREATE TABLE salon.role_permissions (
  role_id uuid NOT NULL REFERENCES salon.roles(id),
  permission_id uuid NOT NULL REFERENCES salon.permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE salon.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES salon.roles(id),
  email text NOT NULL CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  password_hash text NOT NULL CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$'),
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  token_version integer NOT NULL DEFAULT 0 CHECK (token_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);
CREATE INDEX users_role_idx ON salon.users(role_id);

CREATE TABLE salon.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES salon.users(id),
  employee_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  job_kind text NOT NULL CHECK (job_kind IN ('manager','cashier','stylist','beautician')),
  base_pay_cents bigint CHECK (base_pay_cents >= 0),
  commission_policy jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE salon.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES salon.users(id),
  display_name text NOT NULL,
  email text,
  phone text,
  preferred_employee_id uuid REFERENCES salon.employees(id),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NULL OR email = lower(btrim(email)))
);
CREATE INDEX customers_name_idx ON salon.customers(lower(display_name));
CREATE INDEX customers_phone_idx ON salon.customers(phone);

CREATE TABLE salon.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  price_cents bigint CHECK (price_cents >= 0),
  duration_minutes integer CHECK (duration_minutes > 0),
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE salon.employee_services (
  employee_id uuid NOT NULL REFERENCES salon.employees(id),
  service_id uuid NOT NULL REFERENCES salon.services(id),
  PRIMARY KEY (employee_id, service_id)
);
CREATE TABLE salon.business_hours (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean,
  definition_state text NOT NULL DEFAULT 'placeholder' CHECK (definition_state IN ('placeholder','demo','confirmed')),
  CHECK ((opens_at IS NULL AND closes_at IS NULL) OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at > opens_at)),
  CHECK (is_closed IS DISTINCT FROM true OR (opens_at IS NULL AND closes_at IS NULL))
);
CREATE TABLE salon.closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closed_on date NOT NULL UNIQUE,
  reason text NOT NULL,
  created_by uuid REFERENCES salon.users(id)
);
CREATE TABLE salon.employee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES salon.employees(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  available boolean NOT NULL,
  reason text,
  CHECK (ends_at > starts_at)
);
CREATE INDEX employee_availability_staff_date_idx ON salon.employee_availability(employee_id, starts_at);
CREATE TABLE salon.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  definition_state text NOT NULL DEFAULT 'placeholder' CHECK (definition_state IN ('placeholder','demo','confirmed')),
  updated_by uuid REFERENCES salon.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (definition_state <> 'placeholder' OR value = 'null'::jsonb)
);

INSERT INTO salon.roles(id,code,name) VALUES
 ('10000000-0000-4000-8000-000000000001','manager','Manager'),
 ('10000000-0000-4000-8000-000000000002','cashier','Receptionist / Cashier'),
 ('10000000-0000-4000-8000-000000000003','stylist','Stylist'),
 ('10000000-0000-4000-8000-000000000004','beautician','Beautician'),
 ('10000000-0000-4000-8000-000000000005','customer','Customer');
INSERT INTO salon.permissions(code,description) VALUES
 ('customers.manage','Manage customer records'), ('appointments.manage','Manage salon appointments'),
 ('appointments.own','Manage own bookings'), ('appointments.assigned','View assigned appointments'),
 ('sales.manage','Manage checkout'), ('inventory.manage','Manage inventory'),
 ('employees.manage','Manage employees'), ('payroll.manage','Manage payroll'),
 ('reports.view','View financial reports'), ('settings.manage','Manage settings'), ('logs.view','View activity logs');
-- No permission grants until the proposed role policy is confirmed in Phase 3.
INSERT INTO salon.settings(key,value,definition_state) VALUES
 ('currency','"PHP"','confirmed'), ('timezone','"Asia/Manila"','confirmed'),
 ('tax_policy','null','placeholder'), ('discount_policy','null','placeholder'),
 ('commission_policy','null','placeholder'), ('payroll_policy','null','placeholder'),
 ('booking_policy','null','placeholder'), ('consumption_posting_policy','null','placeholder');
INSERT INTO salon.business_hours(weekday) SELECT generate_series(0,6);
