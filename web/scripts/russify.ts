import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { contactForm as contactFormSeed } from '@/endpoints/seed/contact-form'
import { contact as contactPageSeed } from '@/endpoints/seed/contact-page'
import { home as homeSeed } from '@/endpoints/seed/home'
import { post1 } from '@/endpoints/seed/post-1'
import { post2 } from '@/endpoints/seed/post-2'
import { post3 } from '@/endpoints/seed/post-3'

const footerNav = [
  {
    link: {
      type: 'custom',
      label: 'Админка',
      url: '/admin',
    },
  },
  {
    link: {
      type: 'custom',
      label: 'Исходный код',
      newTab: true,
      url: 'https://github.com/payloadcms/payload/tree/main/templates/website',
    },
  },
  {
    link: {
      type: 'custom',
      label: 'Payload CMS',
      newTab: true,
      url: 'https://payloadcms.com/',
    },
  },
] satisfies Array<{ link: { type: 'custom'; label: string; url: string; newTab?: boolean } }>

const run = async () => {
  const payload = await getPayload({ config: configPromise })

  const media = await payload.find({ collection: 'media', limit: 3 })
  const heroImage = media.docs[0]
  const galleryImages = media.docs.slice(0, 3)
  if (!heroImage) {
    payload.logger.error('Нет медиа для домашней страницы. Загрузите изображение в Media.')
    return
  }

  const users = await payload.find({ collection: 'users', limit: 1 })
  const author = users.docs[0]
  if (!author) {
    payload.logger.error('Нет пользователя для авторов постов.')
    return
  }

  const { createdAt: _createdAt, updatedAt: _updatedAt, ...formData } = contactFormSeed
  const existingForm = await payload.find({
    collection: 'forms',
    limit: 1,
    where: { title: { in: ['Contact Form', 'Форма контактов'] } },
  })

  const formDoc = existingForm.docs[0]
    ? await payload.update({
        collection: 'forms',
        id: existingForm.docs[0].id,
        data: formData,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
    : await payload.create({
        collection: 'forms',
        data: formData,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })

  const homeData = homeSeed({ heroImage, metaImage: heroImage, galleryImages })
  const existingHome = await payload.find({
    collection: 'pages',
    limit: 1,
    where: { slug: { equals: 'home' } },
  })

  if (existingHome.docs[0]) {
    await payload.update({
      collection: 'pages',
      id: existingHome.docs[0].id,
      data: homeData,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  } else {
    await payload.create({
      collection: 'pages',
      data: homeData,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }

  const contactData = contactPageSeed({ contactForm: formDoc })
  const existingContact = await payload.find({
    collection: 'pages',
    limit: 1,
    where: { slug: { equals: 'contact' } },
  })

  if (existingContact.docs[0]) {
    await payload.update({
      collection: 'pages',
      id: existingContact.docs[0].id,
      data: contactData,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  } else {
    await payload.create({
      collection: 'pages',
      data: contactData,
      overrideAccess: true,
      context: { disableRevalidate: true },
    })
  }

  await payload.updateGlobal({
    slug: 'footer',
    data: { navItems: footerNav },
    overrideAccess: true,
    context: { disableRevalidate: true },
  })

  const replacements = [
    {
      oldSlug: 'digital-horizons',
      data: post1({ heroImage, blockImage: heroImage, author }),
    },
    {
      oldSlug: 'global-gaze',
      data: post2({ heroImage, blockImage: heroImage, author }),
    },
    {
      oldSlug: 'dollar-and-sense-the-financial-forecast',
      data: post3({ heroImage, blockImage: heroImage, author }),
    },
  ]

  for (const replacement of replacements) {
    const existing = await payload.find({
      collection: 'posts',
      limit: 1,
      where: { slug: { equals: replacement.oldSlug } },
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'posts',
        id: existing.docs[0].id,
        data: replacement.data,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      continue
    }

    const alreadyByNewSlug = await payload.find({
      collection: 'posts',
      limit: 1,
      where: { slug: { equals: replacement.data.slug } },
    })

    if (!alreadyByNewSlug.docs[0]) {
      await payload.create({
        collection: 'posts',
        data: replacement.data,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
    }
  }

  payload.logger.info('Русификация контента завершена.')
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exit(1)
})
