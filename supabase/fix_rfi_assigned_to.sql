
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_rfis_assigned_to_id ON rfis(assigned_to_id);
