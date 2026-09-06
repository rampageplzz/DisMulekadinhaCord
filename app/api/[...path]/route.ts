import { database, bucket, iceServers } from '@/db/raw';
export const dynamic = 'force-dynamic';
type User = {
  id: string;
  username: string;
  name: string;
  color: string;
  seen: number;
  password?: string;
  salt?: string;
};
const id = () => crypto.randomUUID();
const now = () => Date.now();
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const str = (value: unknown, max = 100, min = 1) => {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max
  )
    fail(400, 'Verifique os campos e tente novamente.');
  return (value as string).trim();
};
async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
async function password(value: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
const safe = (u: User) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  color: u.color,
  seen: u.seen,
});
async function session(req: Request) {
  const token = req.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)dm_session=([^;]+)/)?.[1];
  if (!token) return null;
  return database()
    .prepare(
      'SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.id=? AND s.expires>?',
    )
    .bind(await hash(token), now())
    .first<User>();
}
async function rate(key: string, max: number, seconds = 60) {
  const db = database();
  const t = now();
  const row = await db
    .prepare(
      'INSERT INTO limits (key,hits,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN expires<? THEN 1 ELSE hits+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING hits',
    )
    .bind(key, t + seconds * 1000, t, t, t + seconds * 1000)
    .first<{ hits: number }>();
  if ((row?.hits || 0) > max) fail(429, 'Muitas tentativas. Aguarde um pouco.');
}
async function access(server: string, u: User) {
  if (
    !(await database()
      .prepare('SELECT 1 FROM members WHERE server_id=? AND user_id=?')
      .bind(server, u.id)
      .first())
  )
    fail(403, 'Você não participa deste servidor.');
}
async function channel(cid: string, u: User) {
  const c = await database()
    .prepare('SELECT * FROM channels WHERE id=?')
    .bind(cid)
    .first<{ id: string; server_id: string; kind: string; name: string }>();
  if (!c) fail(404, 'Canal não encontrado.');
  await access(c!.server_id, u);
  return c!;
}
async function owner(sid: string, u: User) {
  await access(sid, u);
  const s = await database()
    .prepare('SELECT * FROM servers WHERE id=?')
    .bind(sid)
    .first();
  if (s?.owner !== u.id)
    fail(403, 'Apenas o dono do servidor pode fazer isso.');
}
async function seed() {
  const db = database();
  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO servers (id,name,owner,invite,kind) VALUES ('home','Mulekadinha','system','mulekadinha','server')",
    ),
    ...(
      [
        ['welcome', 'boas-vindas', 'info'],
        ['announcements', 'avisos', 'info'],
        ['general', 'geral', 'text'],
        ['games', 'games', 'text'],
        ['memes', 'memes', 'text'],
        ['lounge', 'Resenha', 'voice'],
        ['gaming', 'Jogatina', 'voice'],
      ] as string[][]
    ).map(([cid, name, kind]) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO channels (id,server_id,name,kind,topic) VALUES (?,'home',?,?,?)",
        )
        .bind(
          cid,
          name,
          kind,
          cid === 'general' ? 'O ponto de encontro da mulekadinha' : '',
        ),
    ),
  ]);
}
async function handle(req: Request) {
  const url = new URL(req.url),
    path = url.pathname.replace(/^\/api\//, ''),
    method = req.method,
    db = database();
  if (method !== 'GET') {
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) fail(403, 'Origem não permitida.');
    if (Number(req.headers.get('content-length') || 0) > 9 * 1024 * 1024)
      fail(413, 'Arquivo muito grande.');
  }
  const body = async () => {
    const raw = await req.text();
    if (raw.length > 100000) fail(413, 'Requisição muito grande.');
    try {
      return JSON.parse(raw);
    } catch {
      fail(400, 'Dados inválidos.');
    }
  };
  if (path === 'guest' && method === 'POST') {
    const b = await body(),
      name = str(b.name, 40, 2);
    await rate(
      'guest:' + (await hash(req.headers.get('cf-connecting-ip') || 'local')),
      20,
      600,
    );
    await seed();
    const uid = id(),
      slug =
        name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 14) || 'visitante',
      username = `${slug}_${uid.replaceAll('-', '').slice(0, 8)}`,
      salt = id(),
      color = ['#5865f2', '#438879', '#a85888', '#bd7848', '#8261b9'][
        Math.floor(Math.random() * 5)
      ];
    await db.batch([
      db
        .prepare(
          'INSERT INTO users (id,username,name,password,salt,color,seen) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(
          uid,
          username,
          name,
          await password(id() + id(), salt),
          salt,
          color,
          now(),
        ),
      db
        .prepare("INSERT INTO members (server_id,user_id) VALUES ('home',?)")
        .bind(uid),
    ]);
    const token = id() + id();
    await db
      .prepare('INSERT INTO sessions (id,user_id,expires) VALUES (?,?,?)')
      .bind(await hash(token), uid, now() + 30 * 86400000)
      .run();
    return json(
      { user: { id: uid, username, name, color, seen: now() } },
      200,
      {
        'Set-Cookie':
          'dm_session=' +
          token +
          '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' +
          (url.protocol === 'https:' ? '; Secure' : ''),
      },
    );
  }
  if (path === 'auth' && method === 'POST') {
    const b = await body();
    const username = str(b.username, 24, 3).toLowerCase();
    if (!/^[a-z0-9_.]+$/.test(username))
      fail(400, 'Use letras, números, ponto ou sublinhado no usuário.');
    await rate(
      'auth:' + (await hash(req.headers.get('cf-connecting-ip') || 'local')),
      30,
      600,
    );
    await rate('login:' + username, 15, 600);
    if (
      typeof b.password !== 'string' ||
      b.password.length < 8 ||
      b.password.length > 128
    )
      fail(400, 'A senha deve ter entre 8 e 128 caracteres.');
    let u: User | null;
    if (b.action === 'register') {
      await seed();
      if (
        await db
          .prepare('SELECT 1 FROM users WHERE username=?')
          .bind(username)
          .first()
      )
        fail(409, 'Este nome de usuário já está em uso.');
      const salt = id(),
        uid = id(),
        color = ['#5865f2', '#438879', '#a85888', '#bd7848', '#8261b9'][
          Math.floor(Math.random() * 5)
        ];
      await db.batch([
        db
          .prepare(
            'INSERT INTO users (id,username,name,password,salt,color,seen) VALUES (?,?,?,?,?,?,?)',
          )
          .bind(
            uid,
            username,
            str(b.name, 40),
            await password(b.password, salt),
            salt,
            color,
            now(),
          ),
        db
          .prepare("INSERT INTO members (server_id,user_id) VALUES ('home',?)")
          .bind(uid),
      ]);
      u = await db
        .prepare('SELECT * FROM users WHERE id=?')
        .bind(uid)
        .first<User>();
    } else {
      u = await db
        .prepare('SELECT * FROM users WHERE username=?')
        .bind(username)
        .first<User>();
      const computed = await password(
        b.password,
        u?.salt || 'invalid-account-padding',
      );
      if (!u || computed !== u.password)
        fail(401, 'Usuário ou senha incorretos.');
    }
    const token = id() + id();
    await db
      .prepare('INSERT INTO sessions (id,user_id,expires) VALUES (?,?,?)')
      .bind(await hash(token), u!.id, now() + 30 * 86400000)
      .run();
    return json({ user: safe(u!) }, 200, {
      'Set-Cookie':
        'dm_session=' +
        token +
        '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' +
        (url.protocol === 'https:' ? '; Secure' : ''),
    });
  }
  if (path === 'logout' && method === 'POST') {
    const token = req.headers
      .get('cookie')
      ?.match(/(?:^|;\s*)dm_session=([^;]+)/)?.[1];
    if (token)
      await db
        .prepare('DELETE FROM sessions WHERE id=?')
        .bind(await hash(token))
        .run();
    return json({ ok: true }, 200, {
      'Set-Cookie': 'dm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    });
  }
  const u = await session(req);
  if (path === 'bootstrap') {
    await seed();
    if (!u)
      return json({
        user: null,
        servers: [
          { id: 'home', name: 'Mulekadinha', kind: 'server', owner: 'system' },
        ],
      });
    await db
      .prepare('UPDATE users SET seen=? WHERE id=?')
      .bind(now(), u.id)
      .run();
    const servers = await db
      .prepare(
        "SELECT s.*, CASE WHEN s.kind='dm' THEN (SELECT name FROM users JOIN members ON users.id=members.user_id WHERE members.server_id=s.id AND users.id<>? LIMIT 1) ELSE s.name END AS name FROM servers s JOIN members m ON m.server_id=s.id WHERE m.user_id=?",
      )
      .bind(u.id, u.id)
      .all();
    return json({
      user: safe(u),
      servers: servers.results,
      iceServers: iceServers(),
    });
  }
  if (!u) fail(401, 'Entre na sua conta para continuar.');
  const user = u!;
  if (method !== 'GET') await rate('write:' + user.id, 180);
  if (path === 'profile' && method === 'POST') {
    const b = await body();
    await db
      .prepare('UPDATE users SET name=? WHERE id=?')
      .bind(str(b.name, 40), user.id)
      .run();
    return json({ ok: true });
  }
  if (path === 'servers' && method === 'POST') {
    const b = await body(),
      sid = id(),
      cid = id(),
      invite = id().replaceAll('-', '');
    await db.batch([
      db
        .prepare(
          "INSERT INTO servers (id,name,owner,invite,kind) VALUES (?,?,?,?,'server')",
        )
        .bind(sid, str(b.name, 60), user.id, invite),
      db.prepare('INSERT INTO members VALUES (?,?)').bind(sid, user.id),
      db
        .prepare(
          "INSERT INTO channels (id,server_id,name,kind,topic) VALUES (?,?,'geral','text','')",
        )
        .bind(cid, sid),
      db
        .prepare(
          "INSERT INTO channels (id,server_id,name,kind,topic) VALUES (?,?,'Resenha','voice','')",
        )
        .bind(id(), sid),
    ]);
    return json({ id: sid, channel: cid });
  }
  if (path === 'join' && method === 'POST') {
    const b = await body(),
      code = str(b.code, 200);
    const s = await db
      .prepare("SELECT * FROM servers WHERE invite=? AND kind='server'")
      .bind(code)
      .first<{ id: string }>();
    if (!s) fail(404, 'Convite inválido.');
    await db
      .prepare('INSERT OR IGNORE INTO members VALUES (?,?)')
      .bind(s!.id, user.id)
      .run();
    return json({ id: s!.id });
  }
  if (path === 'dm' && method === 'POST') {
    const b = await body();
    const other = await db
      .prepare('SELECT id FROM users WHERE username=?')
      .bind(str(b.username, 24).toLowerCase())
      .first<{ id: string }>();
    if (!other || other.id === user.id) fail(404, 'Pessoa não encontrada.');
    const pair = [user.id, other!.id].sort().join(':'),
      sid = 'dm:' + pair,
      cid = 'channel:' + sid;
    await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO servers VALUES (?, 'Conversa', ?, ?, 'dm')",
        )
        .bind(sid, user.id, id()),
      db
        .prepare('INSERT OR IGNORE INTO members VALUES (?,?)')
        .bind(sid, user.id),
      db
        .prepare('INSERT OR IGNORE INTO members VALUES (?,?)')
        .bind(sid, other!.id),
      db
        .prepare(
          "INSERT OR IGNORE INTO channels VALUES (?,?,'conversa','text','Mensagem direta')",
        )
        .bind(cid, sid),
    ]);
    return json({ id: sid, channel: cid });
  }
  if (path === 'server' && method === 'GET') {
    const sid = str(url.searchParams.get('id'));
    await access(sid, user);
    const channels = await db
      .prepare('SELECT * FROM channels WHERE server_id=? ORDER BY rowid')
      .bind(sid)
      .all();
    const members = await db
      .prepare(
        'SELECT u.id,u.username,u.name,u.color,u.seen FROM users u JOIN members m ON m.user_id=u.id WHERE m.server_id=? ORDER BY u.name',
      )
      .bind(sid)
      .all();
    const peers = await db
      .prepare(
        'SELECT p.id,p.user_id,p.channel_id,u.name,u.color FROM peers p JOIN channels c ON c.id=p.channel_id JOIN users u ON u.id=p.user_id WHERE c.server_id=? AND p.seen>?',
      )
      .bind(sid, now() - 20000)
      .all();
    return json({
      channels: channels.results,
      members: members.results,
      peers: peers.results,
    });
  }
  if (path === 'channels' && method === 'POST') {
    const b = await body();
    await owner(str(b.server), user);
    const cid = id();
    await db
      .prepare(
        'INSERT INTO channels (id,server_id,name,kind,topic) VALUES (?,?,?,?,?)',
      )
      .bind(
        cid,
        b.server,
        str(b.name, 40),
        b.kind === 'voice' ? 'voice' : 'text',
        typeof b.topic === 'string' ? b.topic.slice(0, 120) : '',
      )
      .run();
    return json({ id: cid });
  }
  if (path === 'messages' && method === 'GET') {
    const cid = str(url.searchParams.get('channel'));
    await channel(cid, user);
    let where = 'm.channel_id=?';
    const args: unknown[] = [cid];
    const search = url.searchParams.get('search');
    if (search) {
      where += ' AND m.body LIKE ?';
      args.push('%' + search.slice(0, 100) + '%');
    }
    if (url.searchParams.get('pinned') === 'true') where += ' AND m.pinned=1';
    const before = url.searchParams.get('before');
    if (before && Number.isFinite(Number(before))) {
      where += ' AND m.created<?';
      args.push(Number(before));
    }
    const rows = await db
      .prepare(
        'SELECT m.*,u.name,u.color,u.username,f.name AS file_name,f.mime AS file_mime,f.size AS file_size,r.body AS reply_body,ru.name AS reply_name FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN files f ON f.id=m.file_id LEFT JOIN messages r ON r.id=m.reply_to LEFT JOIN users ru ON ru.id=r.user_id WHERE ' +
          where +
          ' ORDER BY m.created DESC LIMIT 60',
      )
      .bind(...args)
      .all();
    const reacts = await db
      .prepare(
        'SELECT r.message_id,r.emoji,COUNT(*) AS count,MAX(CASE WHEN r.user_id=? THEN 1 ELSE 0 END) AS mine FROM reactions r JOIN messages m ON m.id=r.message_id WHERE m.channel_id=? GROUP BY r.message_id,r.emoji',
      )
      .bind(user.id, cid)
      .all();
    return json({
      messages: rows.results.reverse(),
      reactions: reacts.results,
      hasMore: rows.results.length === 60,
    });
  }
  if (path === 'messages' && method === 'POST') {
    await rate('message:' + user.id, 40);
    const b = await body(),
      c = await channel(str(b.channel), user);
    if (c.kind === 'voice') fail(400, 'Escolha um canal de texto.');
    const content = str(b.body || '', 2000, 0);
    if (!content && !b.file) fail(400, 'Escreva uma mensagem.');
    if (
      b.file &&
      !(await db
        .prepare(
          'SELECT 1 FROM files WHERE id=? AND channel_id=? AND user_id=?',
        )
        .bind(str(b.file), c.id, user.id)
        .first())
    )
      fail(400, 'Arquivo inválido.');
    if (
      b.reply &&
      !(await db
        .prepare('SELECT 1 FROM messages WHERE id=? AND channel_id=?')
        .bind(str(b.reply), c.id)
        .first())
    )
      fail(400, 'Resposta inválida.');
    const mid = id();
    await db
      .prepare(
        'INSERT INTO messages (id,channel_id,user_id,body,created,reply_to,file_id) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(mid, c.id, user.id, content, now(), b.reply || null, b.file || null)
      .run();
    return json({ id: mid });
  }
  if (path === 'message' && method === 'POST') {
    const b = await body();
    const m = await db
      .prepare('SELECT * FROM messages WHERE id=?')
      .bind(str(b.id))
      .first<{ id: string; user_id: string; channel_id: string }>();
    if (!m) fail(404, 'Mensagem não encontrada.');
    const c = await channel(m!.channel_id, user);
    if (b.action === 'react') {
      const emoji = str(b.emoji, 10);
      if (!['👍', '❤️', '😂', '🔥', '🎮', '👀', '🎉'].includes(emoji))
        fail(400, 'Emoji inválido.');
      const existing = await db
        .prepare(
          'SELECT 1 FROM reactions WHERE message_id=? AND user_id=? AND emoji=?',
        )
        .bind(m!.id, user.id, emoji)
        .first();
      await db
        .prepare(
          existing
            ? 'DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?'
            : 'INSERT INTO reactions (message_id,user_id,emoji) VALUES (?,?,?)',
        )
        .bind(m!.id, user.id, emoji)
        .run();
    } else if (b.action === 'pin') {
      await owner(c.server_id, user);
      await db
        .prepare('UPDATE messages SET pinned=1-pinned WHERE id=?')
        .bind(m!.id)
        .run();
    } else {
      if (m!.user_id !== user.id) {
        if (b.action === 'delete') await owner(c.server_id, user);
        else fail(403, 'Esta mensagem não é sua.');
      }
      if (b.action === 'delete')
        await db.prepare('DELETE FROM messages WHERE id=?').bind(m!.id).run();
      else if (b.action === 'edit')
        await db
          .prepare('UPDATE messages SET body=?,edited=? WHERE id=?')
          .bind(str(b.body, 2000), now(), m!.id)
          .run();
      else fail(400, 'Ação inválida.');
    }
    return json({ ok: true });
  }
  if (path === 'upload' && method === 'POST') {
    const cid = str(url.searchParams.get('channel'));
    await channel(cid, user);
    await rate('upload:' + user.id, 10);
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') fail(400, 'Selecione um arquivo.');
    const f = file as File;
    if (f.size > 8 * 1024 * 1024) fail(413, 'O limite é 8 MB por arquivo.');
    const fid = id();
    await bucket().put(fid, await f.arrayBuffer(), {
      httpMetadata: { contentType: f.type || 'application/octet-stream' },
    });
    await db
      .prepare('INSERT INTO files VALUES (?,?,?,?,?,?)')
      .bind(
        fid,
        cid,
        user.id,
        f.name.slice(0, 150),
        f.type || 'application/octet-stream',
        f.size,
      )
      .run();
    return json({ id: fid, name: f.name });
  }
  if (path.startsWith('file/') && method === 'GET') {
    const fid = path.slice(5),
      f = await db
        .prepare('SELECT * FROM files WHERE id=?')
        .bind(fid)
        .first<{ channel_id: string; name: string; mime: string }>();
    if (!f) fail(404, 'Arquivo não encontrado.');
    await channel(f!.channel_id, user);
    const object = await bucket().get(fid);
    if (!object) fail(404, 'Arquivo não encontrado.');
    const inline = /^image\/(png|jpeg|gif|webp)$/.test(f!.mime);
    return new Response(object!.body, {
      headers: {
        'Content-Type': f!.mime,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition':
          (inline ? 'inline' : 'attachment') +
          "; filename*=UTF-8''" +
          encodeURIComponent(f!.name),
        'Cache-Control': 'private, no-store',
      },
    });
  }
  if (path === 'voice/join' && method === 'POST') {
    const b = await body(),
      c = await channel(str(b.channel), user);
    if (c.kind !== 'voice') fail(400, 'Escolha um canal de voz.');
    await db
      .prepare('DELETE FROM peers WHERE seen<?')
      .bind(now() - 20000)
      .run();
    const pid = id();
    const inserted = await db
      .prepare(
        'INSERT INTO peers (id,user_id,channel_id,seen) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM peers WHERE channel_id=?)<8 RETURNING id',
      )
      .bind(pid, user.id, c.id, now(), c.id)
      .first();
    if (!inserted) fail(409, 'Este canal comporta até 8 pessoas por chamada.');
    return json({ id: pid, iceServers: iceServers() });
  }
  if (path.startsWith('voice/')) {
    const b =
      method === 'GET' ? Object.fromEntries(url.searchParams) : await body();
    const peer = await db
      .prepare('SELECT * FROM peers WHERE id=? AND user_id=? AND seen>?')
      .bind(str(b.peer), user.id, now() - 20000)
      .first<{ id: string; channel_id: string }>();
    if (!peer) fail(404, 'Sua chamada terminou. Entre novamente.');
    await channel(peer!.channel_id, user);
    if (path === 'voice/leave') {
      await db.prepare('DELETE FROM peers WHERE id=?').bind(peer!.id).run();
      return json({ ok: true });
    }
    if (path === 'voice/poll') {
      await db
        .prepare('UPDATE peers SET seen=? WHERE id=?')
        .bind(now(), peer!.id)
        .run();
      const peers = await db
        .prepare(
          'SELECT p.id,p.user_id,u.name,u.color FROM peers p JOIN users u ON u.id=p.user_id WHERE p.channel_id=? AND p.seen>? AND p.id<>?',
        )
        .bind(peer!.channel_id, now() - 20000, peer!.id)
        .all();
      const signals = await db
        .prepare(
          'SELECT * FROM signals WHERE target=? AND id>? AND created>? ORDER BY id LIMIT 100',
        )
        .bind(peer!.id, Number(b.after) || 0, now() - 120000)
        .all();
      return json({ peers: peers.results, signals: signals.results });
    }
    if (path === 'voice/signal') {
      const target = str(b.target);
      if (
        !(await db
          .prepare('SELECT 1 FROM peers WHERE id=? AND channel_id=? AND seen>?')
          .bind(target, peer!.channel_id, now() - 20000)
          .first())
      )
        fail(404, 'Participante desconectado.');
      const payload = JSON.stringify(b.payload);
      if (payload.length > 70000) fail(413, 'Sinal inválido.');
      await db.batch([
        db
          .prepare(
            'INSERT INTO signals (sender,target,payload,created) VALUES (?,?,?,?)',
          )
          .bind(peer!.id, target, payload, now()),
        db.prepare('DELETE FROM signals WHERE created<?').bind(now() - 120000),
      ]);
      return json({ ok: true });
    }
  }
  fail(404, 'Não encontrado.');
}
async function route(req: Request) {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error('API error', error);
    return json({ error: 'Não foi possível concluir. Tente novamente.' }, 500);
  }
}
export const GET = route;
export const POST = route;
