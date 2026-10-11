CREATE TABLE salon.auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES salon.users(id),
  token_version integer NOT NULL CHECK (token_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX auth_sessions_user_idx ON salon.auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry_idx ON salon.auth_sessions(expires_at);

INSERT INTO salon.permissions(code,description) VALUES
 ('dashboard.view','View the operational dashboard'),
 ('services.manage','Manage the service catalog'),
 ('earnings.own','Read personal earnings without calculation'),
 ('history.own','Read personal customer service history');

-- Conservative Phase 3 access. These grants do not enable future business writes.
-- Undefined inventory/report/override access for non-managers remains denied.
INSERT INTO salon.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM salon.roles r JOIN salon.permissions p ON
 (r.code='manager' AND p.code IN
  ('dashboard.view','customers.manage','appointments.manage','sales.manage',
   'inventory.manage','employees.manage','payroll.manage','reports.view',
   'settings.manage','logs.view','services.manage','earnings.own')) OR
 (r.code='cashier' AND p.code IN
  ('dashboard.view','customers.manage','appointments.manage','sales.manage')) OR
 (r.code IN ('stylist','beautician') AND p.code IN
  ('appointments.assigned','earnings.own')) OR
 (r.code='customer' AND p.code IN ('appointments.own','history.own'));
