CREATE TABLE salon.payroll_commission_adjustments (
  adjustment_id uuid PRIMARY KEY REFERENCES salon.commission_adjustments(id),
  payroll_item_id uuid NOT NULL REFERENCES salon.payroll_items(id)
);

