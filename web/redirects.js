const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // Мягкие 308-редиректы legacy-маршрутов на новые «Жизнь проекта» и «Лавку».
  // permanent: false → 308, чтобы при необходимости легко откатить.
  const projectSectionRedirects = [
    { source: '/projects/:slug/posts', destination: '/projects/:slug/feed?type=blog', permanent: false },
    { source: '/projects/:slug/events', destination: '/projects/:slug/feed?type=event', permanent: false },
    { source: '/projects/:slug/services', destination: '/projects/:slug/lavka?tab=services', permanent: false },
    { source: '/projects/:slug/shop', destination: '/projects/:slug/lavka?tab=shop', permanent: false },
  ]

  return [internetExplorerRedirect, ...projectSectionRedirects]
}

export default redirects
