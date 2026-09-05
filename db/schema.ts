import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  salt: text('salt').notNull(),
  color: text('color').notNull(),
  seen: integer('seen').notNull(),
});
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires').notNull(),
});
export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  owner: text('owner').notNull(),
  invite: text('invite').notNull().unique(),
  kind: text('kind').notNull().default('server'),
});
export const members = sqliteTable(
  'members',
  {
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.userId] })],
);
export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    serverId: text('server_id')
      .notNull()
      .references(() => servers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    topic: text('topic').notNull().default(''),
  },
  (t) => [index('channels_server').on(t.serverId)],
);
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    created: integer('created').notNull(),
    edited: integer('edited'),
    pinned: integer('pinned').notNull().default(0),
    replyTo: text('reply_to'),
    fileId: text('file_id'),
  },
  (t) => [index('messages_channel_created').on(t.channelId, t.created)],
);
export const reactions = sqliteTable(
  'reactions',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    emoji: text('emoji').notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })],
);
export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
});
export const peers = sqliteTable(
  'peers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    seen: integer('seen').notNull(),
  },
  (t) => [index('peers_channel').on(t.channelId, t.seen)],
);
export const signals = sqliteTable(
  'signals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sender: text('sender').notNull(),
    target: text('target').notNull(),
    payload: text('payload').notNull(),
    created: integer('created').notNull(),
  },
  (t) => [index('signals_target').on(t.target, t.id)],
);
export const limits = sqliteTable('limits', {
  key: text('key').primaryKey(),
  hits: integer('hits').notNull(),
  expires: integer('expires').notNull(),
});
