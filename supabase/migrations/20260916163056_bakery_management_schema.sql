/*
# Bakery Management, Production & Packaging Dashboard Schema

1. New Tables
- `bakery_raw_materials`: Tracks raw materials (Flour, Sugar, Margarine, Biscuit Curb, etc.)
  - id (uuid, PK)
  - name (text, not null) — material name
  - unit (text, not null) — unit of measurement (kg, g, L)
  - current_stock (numeric, default 0) — current stock level
  - buffer_stock (numeric, default 0) — minimum threshold for low-stock alerts
  - unit_cost (numeric, default 0) — cost per unit in LKR
  - category (text) — grouping (Flour Base, Biscuit Curb Base, General)
  - created_at, updated_at (timestamptz)

- `bakery_goods`: Master products based on Flour Base and Biscuit Curb Base (LS, SS, S200, CB, etc.)
  - id (uuid, PK)
  - code (text, unique, not null) — short product code
  - name (text, not null) — full product name
  - base_type (text, not null) — 'Flour Base' or 'Biscuit Curb Base'
  - packets_per_batch (int, not null) — standard batch output in packets
  - created_at (timestamptz)

- `bakery_recipes` (BOM): Maps raw materials to products
  - id (uuid, PK)
  - good_id (uuid, FK -> bakery_goods.id ON DELETE CASCADE)
  - raw_material_id (uuid, FK -> bakery_raw_materials.id ON DELETE CASCADE)
  - quantity_per_batch (numeric, not null) — amount of this material per batch
  - created_at (timestamptz)

- `bakery_batch_cards`: Manages individual batch cards with status flow and time tracking
  - id (uuid, PK)
  - batch_number (text, unique, not null) — unique batch identifier
  - good_id (uuid, FK -> bakery_goods.id)
  - status (text, not null, default 'PLANNED') — PLANNED, IN_PRODUCTION, PACKAGING, COMPLETED
  - planned_quantity (int, not null) — planned packet count
  - actual_output_quantity (int) — actual good packets from production
  - damaged_quantity (int, default 0) — damaged/burnt during production
  - packaging_wastage (int, default 0) — wastage during packaging
  - production_start_time (timestamptz) — when production floor work began
  - production_end_time (timestamptz) — when production floor work ended
  - packaging_start_time (timestamptz) — when packaging line work began
  - packaging_end_time (timestamptz) — when packaging line work ended
  - notes (text)
  - created_at, updated_at (timestamptz)

2. Security
- RLS enabled on all tables.
- This is a single-tenant app with no sign-in screen, so all policies use TO anon, authenticated
  with USING (true) / WITH CHECK (true) — the data is intentionally shared.
- Four separate policies per table (SELECT, INSERT, UPDATE, DELETE).

3. Seed Data
- Raw materials: Flour, Sugar, Margarine, Biscuit Curb, Baking Powder, Salt, Eggs, Vanilla
- Goods: LS, SS, S200 (Flour Base), CB, CB200 (Biscuit Curb Base)
- Recipes: sample BOM entries linking goods to raw materials
- Batch cards: sample cards in various statuses
*/

-- ============================================================
-- bakery_raw_materials
-- ============================================================
CREATE TABLE IF NOT EXISTS bakery_raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  current_stock numeric NOT NULL DEFAULT 0,
  buffer_stock numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  category text DEFAULT 'General',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bakery_raw_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_raw_materials" ON bakery_raw_materials;
CREATE POLICY "anon_select_raw_materials" ON bakery_raw_materials FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_raw_materials" ON bakery_raw_materials;
CREATE POLICY "anon_insert_raw_materials" ON bakery_raw_materials FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_raw_materials" ON bakery_raw_materials;
CREATE POLICY "anon_update_raw_materials" ON bakery_raw_materials FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_raw_materials" ON bakery_raw_materials;
CREATE POLICY "anon_delete_raw_materials" ON bakery_raw_materials FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- bakery_goods
-- ============================================================
CREATE TABLE IF NOT EXISTS bakery_goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  base_type text NOT NULL CHECK (base_type IN ('Flour Base', 'Biscuit Curb Base')),
  packets_per_batch int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bakery_goods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_goods" ON bakery_goods;
CREATE POLICY "anon_select_goods" ON bakery_goods FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_goods" ON bakery_goods;
CREATE POLICY "anon_insert_goods" ON bakery_goods FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_goods" ON bakery_goods;
CREATE POLICY "anon_update_goods" ON bakery_goods FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_goods" ON bakery_goods;
CREATE POLICY "anon_delete_goods" ON bakery_goods FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- bakery_recipes (BOM)
-- ============================================================
CREATE TABLE IF NOT EXISTS bakery_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  good_id uuid NOT NULL REFERENCES bakery_goods(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES bakery_raw_materials(id) ON DELETE CASCADE,
  quantity_per_batch numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bakery_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_recipes" ON bakery_recipes;
CREATE POLICY "anon_select_recipes" ON bakery_recipes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_recipes" ON bakery_recipes;
CREATE POLICY "anon_insert_recipes" ON bakery_recipes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_recipes" ON bakery_recipes;
CREATE POLICY "anon_update_recipes" ON bakery_recipes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_recipes" ON bakery_recipes;
CREATE POLICY "anon_delete_recipes" ON bakery_recipes FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- bakery_batch_cards
-- ============================================================
CREATE TABLE IF NOT EXISTS bakery_batch_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL UNIQUE,
  good_id uuid NOT NULL REFERENCES bakery_goods(id),
  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PRODUCTION', 'PACKAGING', 'COMPLETED')),
  planned_quantity int NOT NULL DEFAULT 0,
  actual_output_quantity int,
  damaged_quantity int DEFAULT 0,
  packaging_wastage int DEFAULT 0,
  production_start_time timestamptz,
  production_end_time timestamptz,
  packaging_start_time timestamptz,
  packaging_end_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bakery_batch_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_batch_cards" ON bakery_batch_cards;
CREATE POLICY "anon_select_batch_cards" ON bakery_batch_cards FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_batch_cards" ON bakery_batch_cards;
CREATE POLICY "anon_insert_batch_cards" ON bakery_batch_cards FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_batch_cards" ON bakery_batch_cards;
CREATE POLICY "anon_update_batch_cards" ON bakery_batch_cards FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_batch_cards" ON bakery_batch_cards;
CREATE POLICY "anon_delete_batch_cards" ON bakery_batch_cards FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recipes_good_id ON bakery_recipes(good_id);
CREATE INDEX IF NOT EXISTS idx_recipes_raw_material_id ON bakery_recipes(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_batch_cards_good_id ON bakery_batch_cards(good_id);
CREATE INDEX IF NOT EXISTS idx_batch_cards_status ON bakery_batch_cards(status);

-- ============================================================
-- Seed Data: Raw Materials
-- ============================================================
INSERT INTO bakery_raw_materials (name, unit, current_stock, buffer_stock, unit_cost, category) VALUES
  ('Flour', 'kg', 500, 100, 120, 'Flour Base'),
  ('Sugar', 'kg', 300, 80, 180, 'General'),
  ('Margarine', 'kg', 150, 50, 650, 'General'),
  ('Biscuit Curb', 'kg', 200, 60, 300, 'Biscuit Curb Base'),
  ('Baking Powder', 'kg', 50, 10, 500, 'General'),
  ('Salt', 'kg', 40, 5, 50, 'General'),
  ('Eggs', 'pcs', 600, 100, 25, 'General'),
  ('Vanilla Essence', 'L', 20, 5, 1200, 'General')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Goods (Products)
-- ============================================================
INSERT INTO bakery_goods (code, name, base_type, packets_per_batch) VALUES
  ('LS', 'Lemon Slice', 'Flour Base', 100),
  ('SS', 'Sugar Slice', 'Flour Base', 100),
  ('S200', 'Sweet 200', 'Flour Base', 200),
  ('CB', 'Curb Biscuit', 'Biscuit Curb Base', 150),
  ('CB200', 'Curb Biscuit 200', 'Biscuit Curb Base', 200)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Seed Data: Recipes (BOM)
-- ============================================================
INSERT INTO bakery_recipes (good_id, raw_material_id, quantity_per_batch)
SELECT g.id, rm.id, v.qty
FROM (VALUES
  ('LS', 'Flour', 10.0),
  ('LS', 'Sugar', 5.0),
  ('LS', 'Margarine', 3.0),
  ('LS', 'Baking Powder', 0.5),
  ('LS', 'Vanilla Essence', 0.2),
  ('SS', 'Flour', 12.0),
  ('SS', 'Sugar', 6.0),
  ('SS', 'Margarine', 2.0),
  ('SS', 'Salt', 0.3),
  ('S200', 'Flour', 20.0),
  ('S200', 'Sugar', 10.0),
  ('S200', 'Margarine', 5.0),
  ('S200', 'Eggs', 20.0),
  ('S200', 'Baking Powder', 1.0),
  ('CB', 'Biscuit Curb', 15.0),
  ('CB', 'Sugar', 4.0),
  ('CB', 'Margarine', 2.0),
  ('CB', 'Salt', 0.2),
  ('CB200', 'Biscuit Curb', 25.0),
  ('CB200', 'Sugar', 7.0),
  ('CB200', 'Margarine', 4.0),
  ('CB200', 'Salt', 0.3)
) AS v(good_code, rm_name, qty)
JOIN bakery_goods g ON g.code = v.good_code
JOIN bakery_raw_materials rm ON rm.name = v.rm_name
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed Data: Sample Batch Cards
-- ============================================================
INSERT INTO bakery_batch_cards (batch_number, good_id, status, planned_quantity, actual_output_quantity, damaged_quantity, packaging_wastage, production_start_time, production_end_time, packaging_start_time, packaging_end_time)
SELECT 'BATCH-2026-001', g.id, 'COMPLETED', 100, 98, 2, 1,
  now() - interval '2 days', now() - interval '2 days' + interval '45 minutes',
  now() - interval '2 days' + interval '50 minutes', now() - interval '2 days' + interval '80 minutes'
FROM bakery_goods g WHERE g.code = 'LS'
ON CONFLICT DO NOTHING;

INSERT INTO bakery_batch_cards (batch_number, good_id, status, planned_quantity, production_start_time)
SELECT 'BATCH-2026-002', g.id, 'IN_PRODUCTION', 200, now() - interval '20 minutes'
FROM bakery_goods g WHERE g.code = 'S200'
ON CONFLICT DO NOTHING;

INSERT INTO bakery_batch_cards (batch_number, good_id, status, planned_quantity, production_start_time, production_end_time, packaging_start_time)
SELECT 'BATCH-2026-003', g.id, 'PACKAGING', 150, now() - interval '3 hours', now() - interval '2 hours', now() - interval '1 hour'
FROM bakery_goods g WHERE g.code = 'CB'
ON CONFLICT DO NOTHING;

INSERT INTO bakery_batch_cards (batch_number, good_id, status, planned_quantity)
SELECT 'BATCH-2026-004', g.id, 'PLANNED', 200
FROM bakery_goods g WHERE g.code = 'CB200'
ON CONFLICT DO NOTHING;