import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw new Error('Banco indisponível.');
  return env.DB;
}
export function bucket() {
  if (!env.FILES) throw new Error('Arquivos indisponíveis.');
  return env.FILES;
}
export function iceServers() {
  return [
    { urls: 'stun:stun.cloudflare.com:3478' },
    ...(env.TURN_URL
      ? [
          {
            urls: env.TURN_URL,
            username: env.TURN_USERNAME,
            credential: env.TURN_PASSWORD,
          },
        ]
      : []),
  ];
}
