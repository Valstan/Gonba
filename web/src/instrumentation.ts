export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { bootstrapSecretsFromVault } = await import('./server/secrets/bootstrap')
  await bootstrapSecretsFromVault()

  // Таймауты keep-alive + graceful drain на SIGTERM (G234). Не блокирует старт:
  // если http.Server ещё не поднялся, модуль сам повторит попытку.
  const { installHttpLifecycle } = await import('./server/runtime/http-lifecycle')
  installHttpLifecycle()
}
