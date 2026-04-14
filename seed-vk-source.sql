INSERT INTO vk_auto_sync (
  community_url,
  group_id,
  access_token,
  section_slug,
  project_slug,
  sync_interval_hours,
  is_enabled,
  post_type,
  last_sync_status,
  total_imported,
  updated_at,
  created_at
) VALUES (
  'https://vk.com/club229392127',
  229392127,
  'vk1.a.nv5IKyDlt15vjgcELAdi5c9mduzY9Wob160azxF_AOblv45fu-sgeDxgwsdM0BKWlemtdHaIj27ap6e2Nt-bQ5JVQAkdUplOV9uRi9Kqa3nZRCH-lkmpKrLt6o_garU9CPbZu9KZVD-iU2mQuknY68bZasL74X8TZ_R2zcLl_2Y3XmU1TFR3wsP4M6Xju9IN2Ygo3V_05Spe1_4mVN2roA',
  'vyatskaya-lepota-malmyzh',
  'vyatskaya-lepota',
  3,
  true,
  'news',
  'pending',
  0,
  NOW(),
  NOW()
);
