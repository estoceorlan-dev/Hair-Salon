CREATE FUNCTION salon.reject_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical records are append-only; post a new reversal or adjustment' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER immutable_inventory_movements BEFORE UPDATE OR DELETE ON salon.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION salon.reject_record_mutation();
CREATE TRIGGER immutable_activity_logs BEFORE UPDATE OR DELETE ON salon.activity_logs
  FOR EACH ROW EXECUTE FUNCTION salon.reject_record_mutation();

CREATE FUNCTION salon.protect_stock_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    IF TG_OP <> 'INSERT' OR NEW.quantity <> 0 THEN
      RAISE EXCEPTION 'Post an inventory movement to change stock' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER stock_changes_require_movement BEFORE INSERT OR UPDATE OR DELETE ON salon.stock_balances
  FOR EACH ROW EXECUTE FUNCTION salon.protect_stock_balance();
CREATE FUNCTION salon.apply_inventory_movement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO salon.stock_balances(product_id,quantity) VALUES (NEW.product_id,0) ON CONFLICT DO NOTHING;
  UPDATE salon.stock_balances SET quantity = quantity + NEW.quantity_delta, updated_at = now()
    WHERE product_id = NEW.product_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER post_inventory_movement AFTER INSERT ON salon.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION salon.apply_inventory_movement();

CREATE FUNCTION salon.protect_sale_item_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_status text;
  new_status text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO old_status FROM salon.sales WHERE id = OLD.sale_id;
    IF old_status <> 'draft' THEN
      RAISE EXCEPTION 'Finalized sale items are immutable' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT status INTO new_status FROM salon.sales WHERE id = NEW.sale_id;
    IF new_status <> 'draft' THEN
      RAISE EXCEPTION 'Add items before finalizing the sale' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER sale_item_snapshots_immutable BEFORE INSERT OR UPDATE OR DELETE ON salon.sale_items
  FOR EACH ROW EXECUTE FUNCTION salon.protect_sale_item_history();

CREATE FUNCTION salon.validate_payroll_commission_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM salon.commission_entries WHERE id = NEW.commission_id AND employee_id = NEW.employee_id) THEN
    RAISE EXCEPTION 'Commission belongs to another employee' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_commission_owner BEFORE INSERT OR UPDATE ON salon.payroll_commissions
  FOR EACH ROW EXECUTE FUNCTION salon.validate_payroll_commission_owner();
