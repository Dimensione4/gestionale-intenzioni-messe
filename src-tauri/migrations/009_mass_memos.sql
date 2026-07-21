CREATE TABLE IF NOT EXISTS mass_memos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offerer_first_name TEXT NOT NULL DEFAULT '',
  offerer_last_name TEXT NOT NULL DEFAULT '',
  offerer_phone TEXT NOT NULL DEFAULT '',
  offering_cents INTEGER NOT NULL DEFAULT 0 CHECK(offering_cents>=0),
  payment_method TEXT NOT NULL DEFAULT 'Contanti',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mass_memo_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id INTEGER NOT NULL REFERENCES mass_memos(id) ON DELETE CASCADE,
  intention_id INTEGER NOT NULL REFERENCES mass_intentions(id),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mass_memo_items_memo ON mass_memo_items(memo_id,position,id);
CREATE INDEX IF NOT EXISTS idx_mass_memo_items_intention ON mass_memo_items(intention_id);
