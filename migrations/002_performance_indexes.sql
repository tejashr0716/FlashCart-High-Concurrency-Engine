-- Migration 002: B-Tree and GiST Indexes for Sub-Millisecond Scans
CREATE INDEX IF NOT EXISTS idx_flashcart_status ON flashcart_entities (status);
CREATE INDEX IF NOT EXISTS idx_flashcart_cat_status ON flashcart_entities (category, status);
CREATE INDEX IF NOT EXISTS idx_flashcart_lease_expires ON flashcart_leases (entity_id, expires_at) WHERE released = FALSE;
