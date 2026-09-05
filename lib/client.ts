export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
// Routes have different response shapes; server validation and integration tests
// own this JSON boundary until endpoint-specific generated types are introduced.
// oxlint-disable-next-line typescript/no-explicit-any
export async function api(path: string, body?: unknown): Promise<any> {
  const res = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // oxlint-disable-next-line typescript/no-explicit-any
  const data: any = await res.json();
  if (!res.ok)
    throw new ApiError(data.error || 'Falha na conexão.', res.status);
  return data;
}
export type User = {
  id: string;
  username: string;
  name: string;
  color: string;
  seen: number;
};
export type Server = {
  id: string;
  name: string;
  owner: string;
  invite: string;
  kind: string;
};
export type Channel = {
  id: string;
  server_id: string;
  name: string;
  kind: string;
  topic: string;
};
export type Message = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  body: string;
  created: number;
  edited: number | null;
  pinned: number;
  reply_to: string | null;
  reply_body: string | null;
  reply_name: string | null;
  file_id: string | null;
  file_name: string | null;
  file_mime: string | null;
};
export type Reaction = {
  message_id: string;
  emoji: string;
  count: number;
  mine: number;
};
