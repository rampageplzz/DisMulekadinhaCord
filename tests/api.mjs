import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_URL || 'http://localhost:3000';
assert.ok(
  new URL(base).hostname === 'localhost' ||
    new URL(base).hostname === '127.0.0.1',
  'Run integration tests only against a local test database.',
);
let checks = 0;
function client() {
  let cookie = '';
  return async (path, body, status = 200, extra = {}) => {
    const res = await fetch(base + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw };
    }
    assert.equal(res.status, status, JSON.stringify({ path, data }));
    checks++;
    if (res.headers.get('set-cookie'))
      cookie = res.headers.get('set-cookie').split(';')[0];
    return data;
  };
}
const a = client(),
  b = client(),
  outsider = client(),
  guest = client(),
  tag = randomUUID().slice(0, 8),
  password = randomUUID();
const usernameA = 'test_a_' + tag,
  usernameB = 'test_b_' + tag;
const alice = await a('auth', {
  action: 'register',
  name: 'Teste Alice',
  username: usernameA,
  password,
});
await b('auth', {
  action: 'register',
  name: 'Teste Bruno',
  username: usernameB,
  password,
});
await outsider('auth', {
  action: 'register',
  name: 'Teste externo',
  username: 'test_c_' + tag,
  password,
});
assert.equal((await a('bootstrap')).user.id, alice.user.id);
const server = await a('servers', { name: 'Servidor teste ' + tag });
const mine = (await a('bootstrap')).servers.find((s) => s.id === server.id);
await guest('messages?channel=' + server.channel, undefined, 401);
await b('server?id=' + server.id, undefined, 403);
await b('messages?channel=' + server.channel, undefined, 403);
await b('messages', { channel: server.channel, body: 'Forbidden' }, 403);
await b('join', { code: mine.invite });
assert.equal((await b('server?id=' + server.id)).members.length, 2);
await b('channels', { server: server.id, name: 'Forbidden' }, 403);
const channel = await a('channels', {
  server: server.id,
  name: 'teste',
  kind: 'text',
  topic: 'Integração',
});
const message = await a('messages', {
  channel: channel.id,
  body: 'Mensagem persistente',
});
let rows = await b('messages?channel=' + channel.id);
assert.equal(rows.messages[0].id, message.id);
await b('message', { id: message.id, action: 'edit', body: 'Forbidden' }, 403);
await b('message', { id: message.id, action: 'pin' }, 403);
await a('message', {
  id: message.id,
  action: 'edit',
  body: 'Mensagem editada',
});
await a('message', { id: message.id, action: 'pin' });
await b('message', { id: message.id, action: 'react', emoji: '🔥' });
rows = await b('messages?channel=' + channel.id + '&pinned=true');
assert.equal(rows.messages[0].body, 'Mensagem editada');
assert.equal(rows.reactions[0].count, 1);
await b('message', { id: message.id, action: 'react', emoji: '🔥' });
assert.equal((await b('messages?channel=' + channel.id)).reactions.length, 0);
await b('messages', {
  channel: channel.id,
  body: 'Resposta',
  reply: message.id,
});
rows = await a('messages?channel=' + channel.id + '&search=Resposta');
assert.equal(rows.messages[0].reply_body, 'Mensagem editada');
await a('messages', { channel: channel.id, body: '<script>alert(1)</script>' });
assert.equal(
  (await a('messages?channel=' + channel.id + '&search=script')).messages[0]
    .body,
  '<script>alert(1)</script>',
);
await a('messages', { channel: channel.id, body: 'Cross origin' }, 403, {
  Origin: 'https://evil.example',
});
await a('messages', { channel: channel.id, body: 'x'.repeat(2001) }, 400);
const dm = await a('dm', { username: usernameB });
const same = await b('dm', { username: usernameA });
assert.equal(same.id, dm.id);
await outsider(
  'messages?channel=' + encodeURIComponent(dm.channel),
  undefined,
  403,
);
await b('messages', { channel: dm.channel, body: 'Privada' });
assert.equal(
  (await a('messages?channel=' + encodeURIComponent(dm.channel))).messages[0]
    .body,
  'Privada',
);
const voice = (await a('server?id=' + server.id)).channels.find(
  (c) => c.kind === 'voice',
);
await outsider('voice/join', { channel: voice.id }, 403);
const pa = await a('voice/join', { channel: voice.id });
const pb = await b('voice/join', { channel: voice.id });
assert.equal((await a('voice/poll?peer=' + pa.id)).peers[0].id, pb.id);
await b(
  'voice/signal',
  { peer: pa.id, target: pb.id, payload: { test: true } },
  404,
);
await a('voice/signal', {
  peer: pa.id,
  target: pb.id,
  payload: { description: { type: 'offer', sdp: 'integration-test' } },
});
const signals = (await b('voice/poll?peer=' + pb.id)).signals;
assert.equal(JSON.parse(signals[0].payload).description.type, 'offer');
assert.equal(
  (await b('voice/poll?peer=' + pb.id + '&after=' + signals[0].id)).signals
    .length,
  0,
);
await a('voice/leave', { peer: pa.id });
assert.equal((await b('voice/poll?peer=' + pb.id)).peers.length, 0);
await b('voice/leave', { peer: pb.id });
await a('message', { id: message.id, action: 'delete' });
assert.equal(
  (await a('messages?channel=' + channel.id + '&pinned=true')).messages.length,
  0,
);
await a('logout', {});
await a('server?id=' + server.id, undefined, 401);
await a('auth', { username: usernameA, password: 'incorrect-password' }, 401);
await a('auth', { username: usernameA, password });
assert.ok((await a('messages?channel=' + channel.id)).messages.length > 0);
console.log(
  'PASS: ' +
    checks +
    ' HTTP checks; accounts, sessions, invitations, persistence, membership isolation, owner permissions, DMs, replies, reactions, pins, deletion, validation, CSRF and WebRTC signaling.',
);
