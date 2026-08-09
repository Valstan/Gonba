export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { bootstrapSecretsFromVault } = await import('./server/secrets/bootstrap')
  await bootstrapSecretsFromVault()
}
