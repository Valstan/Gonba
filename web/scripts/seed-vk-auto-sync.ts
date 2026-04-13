/**
 * Скрипт для создания начальной конфигурации авто-импорта VK
 * Запуск: npx tsx scripts/seed-vk-auto-sync.ts
 */
import configPromise from '@payload-config'
import { getPayload } from 'payload'

async function main() {
  const payload = await getPayload({ config: configPromise })

  console.log('🔄 Инициализация авто-импорта VK...')

  // Проверяем, есть ли уже источники
  const existing = await payload.find({
    collection: 'vkAutoSync',
    overrideAccess: true,
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log('✅ Источники авто-импорта уже настроены. Пропускаю.')
    return
  }

  // Берём токен из env для группы 229392127
  const token = process.env.VK_TOKEN_229392127 || process.env.VK_TOKEN

  if (!token) {
    console.error('❌ VK токен не найден. Установите VK_TOKEN_229392127 или VK_TOKEN в .env')
    process.exit(1)
  }

  // Создаём источник для Вятской лепоты
  const source = await payload.create({
    collection: 'vkAutoSync',
    overrideAccess: true,
    data: {
      communityUrl: 'https://vk.com/club229392127',
      groupId: 229392127,
      accessToken: token,
      sectionSlug: 'vyatskaya-lepota-malmyzh',
      projectSlug: 'vyatskaya-lepota',
      syncIntervalHours: 3,
      isEnabled: true,
      postType: 'news',
      lastSyncStatus: 'pending',
    },
  })

  console.log(`✅ Создан источник авто-импорта:`)
  console.log(`   Сообщество: https://vk.com/club229392127`)
  console.log(`   Секция: vyatskaya-lepota-malmyzh`)
  console.log(`   Проект: vyatskaya-lepota`)
  console.log(`   Интервал: 3 часа`)
  console.log(`   ID: ${source.id}`)

  // Создаём настройки по умолчанию
  try {
    await payload.updateGlobal({
      slug: 'vkAutoSyncSettings',
      overrideAccess: true,
      data: {
        defaultSyncIntervalHours: 3,
        enabled: true,
        maxPostsPerSync: 1,
        downloadImages: true,
        autoPublish: true,
      },
    })
    console.log('✅ Созданы глобальные настройки авто-импорта')
  } catch {
    console.log('⚠️ Глобальные настройки уже существуют или не удалось создать')
  }

  console.log('\n🎉 Авто-импорт VK настроен!')
  console.log('   Ручной запуск: POST /api/vk-auto-sync/trigger')
  console.log('   Cron job: vkAutoSync (каждые 3 часа)')
}

main().catch((error) => {
  console.error('❌ Ошибка:', error)
  process.exit(1)
})
