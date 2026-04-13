#!/bin/bash
# Seed VK Auto-Sync source для Вятской лепоты
# Запускать на production-сервере: bash /tmp/seed-vk.sh

set -e

TOKEN=$(grep VK_TOKEN_229392127 /home/valstan/GONBA/web/.env | cut -d= -f2- | tr -d '\n')
if [ -z "$TOKEN" ]; then
  TOKEN=$(grep '^VK_TOKEN=' /home/valstan/GONBA/web/.env | cut -d= -f2- | tr -d '\n')
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: VK token not found in .env"
  exit 1
fi

CRON=$(grep CRON_SECRET /home/valstan/GONBA/web/.env | cut -d= -f2 | tr -d '\n')

echo "Creating VK Auto-Sync source for club229392127..."
echo "Token: ${TOKEN:0:20}..."

# Создаём через Payload Local API — нужно зайти в админку и создать запись
# VkAutoSync collection: /admin/collections/vk-auto-sync

echo ""
echo "Для создания источника авто-импорта:"
echo "1. Зайди в админку: https://гоньба.рф/admin"
echo "2. Перейди в 'Источники авто-импорта VK'"
echo "3. Создай новую запись с параметрами:"
echo "   Community URL: https://vk.com/club229392127"
echo "   Group ID: 229392127"
echo "   Access Token: (из .env VK_TOKEN_229392127 или VK_TOKEN)"
echo "   Section Slug: vyatskaya-lepota-malmyzh"
echo "   Project Slug: vyatskaya-lepota"
echo "   Sync Interval: 3 часа"
echo "   Is Enabled: ✓"
echo "   Post Type: news"
echo ""
echo "Или вызови API:"
echo "curl -X POST http://127.0.0.1:3000/api/vk-auto-sync/trigger \\"
echo "  -H 'Authorization: Bearer $CRON' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"seed\":true}'"
