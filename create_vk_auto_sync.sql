CREATE TABLE IF NOT EXISTS vk_auto_sync (
  id SERIAL PRIMARY KEY,
  community_url VARCHAR(255),
  group_id NUMERIC,
  access_token VARCHAR(255),
  section_slug VARCHAR(255),
  project_slug VARCHAR(255),
  sync_interval_hours NUMERIC DEFAULT 3,
  is_enabled BOOLEAN DEFAULT true,
  post_type VARCHAR(50) DEFAULT 'news',
  last_synced_post_id NUMERIC,
  last_sync_status VARCHAR(50) DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  total_imported NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS _vk_auto_sync_v_sync_log (
  _order NUMERIC,
  _parent_id INTEGER REFERENCES vk_auto_sync(id) ON DELETE CASCADE,
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  status VARCHAR(50),
  message TEXT,
  post_id NUMERIC
);

CREATE TABLE IF NOT EXISTS vk_auto_sync_rels (
  id SERIAL PRIMARY KEY,
  order NUMERIC,
  parent_id INTEGER REFERENCES vk_auto_sync(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  vk_auto_sync_id INTEGER
);
