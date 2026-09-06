'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  Hash,
  Volume2,
  Plus,
  ChevronDown,
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Settings,
  Users,
  Search,
  Pin,
  Bell,
  BellOff,
  CircleHelp,
  Gamepad2,
  Compass,
  MessageCircle,
  MonitorUp,
  X,
  Send,
  Smile,
  Reply,
  Pencil,
  Trash2,
  Check,
  Copy,
  PhoneOff,
  Video,
  VideoOff,
  LogOut,
  Crown,
  Menu,
  Paperclip,
  Download,
  LoaderCircle,
  AtSign,
} from 'lucide-react';
import {
  api,
  type User,
  type Server,
  type Channel,
  type Message,
  type Reaction,
} from '@/lib/client';
import {
  STREAM_QUALITY_OPTIONS,
  useVoice,
  type StreamQuality,
} from '@/lib/use-voice';
import {
  Avatar,
  IconButton,
  Media,
  Modal,
  FormError,
  FullscreenButton,
} from '@/components/discord';
const guestChannels: Channel[] = [
  ['welcome', 'boas-vindas', 'info'],
  ['announcements', 'avisos', 'info'],
  ['general', 'geral', 'text'],
  ['games', 'games', 'text'],
  ['memes', 'memes', 'text'],
  ['lounge', 'Resenha', 'voice'],
  ['gaming', 'Jogatina', 'voice'],
].map(([id, name, kind]) => ({
  id,
  name,
  kind,
  server_id: 'home',
  topic: id === 'general' ? 'O ponto de encontro da mulekadinha' : '',
}));
const emojis = ['👍', '❤️', '😂', '🔥', '🎮', '👀', '🎉'];
export default function Home() {
  const [user, setUser] = useState<User | null>(null),
    [servers, setServers] = useState<Server[]>([
      {
        id: 'home',
        name: 'Mulekadinha',
        kind: 'server',
        owner: 'system',
        invite: 'mulekadinha',
      },
    ]),
    [sid, setSid] = useState('home'),
    [channels, setChannels] = useState<Channel[]>(guestChannels),
    [cid, setCid] = useState('general'),
    [members, setMembers] = useState<User[]>([]),
    [roomMembers, setRoomMembers] = useState<
      {
        id: string;
        user_id: string;
        channel_id: string;
        name: string;
        color: string;
      }[]
    >([]),
    [messages, setMessages] = useState<Message[]>([]),
    [reactions, setReactions] = useState<Reaction[]>([]),
    [hasMore, setHasMore] = useState(false);
  const [modal, setModal] = useState(''),
    [authMode, setAuthMode] = useState<'nickname' | 'login' | 'register'>(
      'nickname',
    ),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(''),
    [modalError, setModalError] = useState(''),
    [connected, setConnected] = useState(false),
    [loaded, setLoaded] = useState(false),
    [showMembers, setShowMembers] = useState(true),
    [showSidebar, setShowSidebar] = useState(false),
    [home, setHome] = useState(false),
    [voiceView, setVoiceView] = useState(false),
    [notifications, setNotifications] = useState(false),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [pins, setPins] = useState(false),
    [draft, setDraft] = useState(''),
    [reply, setReply] = useState<Message | null>(null),
    [editing, setEditing] = useState<Message | null>(null),
    [emojiOpen, setEmojiOpen] = useState(false),
    [attachment, setAttachment] = useState<{ id: string; name: string } | null>(
      null,
    ),
    [sending, setSending] = useState(false),
    [channelKind, setChannelKind] = useState('text'),
    [copied, setCopied] = useState(false),
    [pendingInvite, setPendingInvite] = useState(''),
    [deleting, setDeleting] = useState<Message | null>(null),
    [screenQuality, setScreenQuality] = useState<StreamQuality>('1080p60');
  const composer = useRef<HTMLTextAreaElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    upload = useRef<HTMLInputElement>(null),
    lastMessage = useRef(''),
    nearBottom = useRef(true),
    notificationRef = useRef(false),
    cidRef = useRef(cid);
  cidRef.current = cid;
  notificationRef.current = notifications;
  const userId = user?.id;
  const notify = useCallback((text: string) => setToast(text), []),
    voice = useVoice(notify),
    server = servers.find((s) => s.id === sid) || servers[0],
    channel =
      channels.find((c) => c.id === cid) || channels[0] || guestChannels[2],
    isOwner = server?.owner === user?.id;
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  const open = useCallback((name: string) => {
    setModalError('');
    setCopied(false);
    setModal(name);
  }, []);
  const requireUser = (action: () => void) => {
    if (user) action();
    else open('auth');
  };
  const bootstrap = useCallback(async () => {
    try {
      const data = await api('bootstrap');
      setUser(data.user);
      setServers(data.servers);
      setConnected(true);
      setLoaded(true);
      return data;
    } catch (e) {
      setConnected(false);
      setLoaded(true);
      throw e;
    }
  }, []);
  useEffect(() => {
    void bootstrap().catch((e) => notify(e.message));
    const t = setInterval(
      () => void bootstrap().catch(() => setConnected(false)),
      12000,
    );
    const invitation = new URLSearchParams(location.search).get('invite');
    if (invitation) {
      setPendingInvite(invitation);
      open('join');
    }
    return () => clearInterval(t);
  }, [bootstrap, notify, open]);
  useEffect(() => {
    if (!userId) {
      setChannels(guestChannels);
      setMembers([]);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await api('server?id=' + encodeURIComponent(sid));
        if (cancelled) return;
        setChannels(data.channels);
        setMembers(data.members);
        setRoomMembers(data.peers);
        setCid((old) =>
          data.channels.some((c: Channel) => c.id === old)
            ? old
            : data.channels.find((c: Channel) => c.kind !== 'voice')?.id ||
              data.channels[0]?.id ||
              '',
        );
        setConnected(true);
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    void refresh();
    const t = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sid, userId]);
  const refreshMessages = useCallback(async () => {
    if (!userId || !cid) return;
    const selected = cid;
    const data = await api(
      'messages?channel=' +
        encodeURIComponent(selected) +
        (search ? '&search=' + encodeURIComponent(search) : '') +
        (pins ? '&pinned=true' : ''),
    );
    if (cidRef.current !== selected) return;
    setMessages(data.messages);
    setReactions(data.reactions);
    setHasMore(data.hasMore);
    setConnected(true);
    const newest = data.messages.at(-1);
    if (
      newest &&
      lastMessage.current &&
      newest.id !== lastMessage.current &&
      newest.user_id !== userId &&
      document.hidden &&
      notificationRef.current &&
      Notification.permission === 'granted'
    )
      new Notification('DisMulekadinhaCord', {
        body: newest.name + ': ' + newest.body.slice(0, 150),
      });
    lastMessage.current = newest?.id || '';
    if (nearBottom.current)
      requestAnimationFrame(() =>
        scroll.current?.scrollTo({ top: scroll.current.scrollHeight }),
      );
  }, [userId, cid, search, pins]);
  useEffect(() => {
    setMessages([]);
    setReply(null);
    setEditing(null);
    setAttachment(null);
    setDraft('');
    lastMessage.current = '';
    nearBottom.current = true;
    if (!userId || channel?.kind === 'voice') return;
    void refreshMessages().catch(() => setConnected(false));
    const t = setInterval(() => {
      if (nearBottom.current)
        void refreshMessages().catch(() => setConnected(false));
    }, 2000);
    return () => clearInterval(t);
  }, [refreshMessages, channel?.kind, userId]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'list_channels',
        title: 'Listar canais',
        description: 'Lista os canais do servidor selecionado.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => ({
          server: server?.name,
          channels: channels.map((c) => ({
            id: c.id,
            name: c.name,
            kind: c.kind,
          })),
        }),
      },
      {
        name: 'navigate_text_channel',
        title: 'Abrir canal de texto',
        description:
          'Abre um canal de texto visível neste servidor. Não envia mensagens.',
        inputSchema: {
          type: 'object',
          properties: { channelId: { type: 'string' } },
          required: ['channelId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const value = input as { channelId?: unknown };
          if (typeof value?.channelId !== 'string')
            throw new Error('channelId deve ser texto.');
          const selected = channels.find(
            (c) => c.id === value.channelId && c.kind !== 'voice',
          );
          if (!selected) throw new Error('Canal de texto não encontrado.');
          setCid(selected.id);
          setVoiceView(false);
          setHome(false);
          await new Promise(requestAnimationFrame);
          return { channelId: selected.id, name: selected.name };
        },
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, [channels, server?.name]);
  const selectServer = (s: Server) => {
    setSid(s.id);
    setCid('');
    setChannels([]);
    setHome(false);
    setVoiceView(false);
    setSearch('');
    setQuery('');
    setPins(false);
    setShowSidebar(false);
    setMessages([]);
  };
  const selectChannel = (c: Channel) => {
    setShowSidebar(false);
    setHome(false);
    if (c.kind === 'voice') {
      requireUser(() => {
        setVoiceView(true);
        void voice.join(c);
      });
      return;
    }
    setCid(c.id);
    setVoiceView(false);
    setSearch('');
    setQuery('');
    setPins(false);
  };
  const startDM = async (username: string) => {
    const result = await api('dm', { username });
    await bootstrap();
    setSid(result.id);
    setCid(result.channel);
    setHome(false);
    setVoiceView(false);
    setModal('');
  };
  const submitModal = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setModalError('');
    const b = Object.fromEntries(
      Array.from(new FormData(event.currentTarget), ([key, value]) => [
        key,
        typeof value === 'string' ? value : value.name,
      ]),
    );
    try {
      if (modal === 'auth') {
        if (authMode === 'nickname') await api('guest', { name: b.name });
        else
          await api('auth', {
            ...b,
            action: authMode === 'register' ? 'register' : 'login',
          });
        await bootstrap();
        setModal(pendingInvite ? 'join' : '');
      } else if (modal === 'server') {
        const data = await api('servers', { name: b.name });
        await bootstrap();
        setSid(data.id);
        setCid(data.channel);
        setHome(false);
        setVoiceView(false);
        setModal('');
      } else if (modal === 'join') {
        if (!user) {
          setPendingInvite(String(b.code));
          open('auth');
          return;
        }
        let code = String(b.code).trim();
        if (code.includes('?'))
          code = new URL(code).searchParams.get('invite') || code;
        const data = await api('join', { code });
        await bootstrap();
        setSid(data.id);
        setHome(false);
        setVoiceView(false);
        setPendingInvite('');
        history.replaceState({}, '', location.pathname);
        setModal('');
      } else if (modal === 'channel') {
        const data = await api('channels', {
          server: sid,
          name: b.name,
          kind: channelKind,
          topic: b.topic,
        });
        const state = await api('server?id=' + encodeURIComponent(sid));
        setChannels(state.channels);
        if (channelKind !== 'voice') {
          setCid(data.id);
          setVoiceView(false);
        }
        setModal('');
      } else if (modal === 'profile') {
        await api('profile', { name: b.name });
        await bootstrap();
        setModal('');
        notify('Perfil atualizado.');
      } else if (modal === 'dm') await startDM(String(b.username));
      else if (modal === 'delete' && deleting) {
        await api('message', { id: deleting.id, action: 'delete' });
        await refreshMessages();
        setDeleting(null);
        setModal('');
      }
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!user) {
      open('auth');
      return;
    }
    if (sending || (!draft.trim() && !attachment)) return;
    setSending(true);
    try {
      if (editing)
        await api('message', { id: editing.id, action: 'edit', body: draft });
      else
        await api('messages', {
          channel: cid,
          body: draft,
          file: attachment?.id,
          reply: reply?.id,
        });
      setDraft('');
      setReply(null);
      setEditing(null);
      setAttachment(null);
      nearBottom.current = true;
      await refreshMessages();
      composer.current?.focus();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  const react = async (m: Message, emoji: string) => {
    try {
      await api('message', { id: m.id, action: 'react', emoji });
      await refreshMessages();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const uploadFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      notify('O limite é 8 MB por arquivo.');
      return;
    }
    setSending(true);
    const selected = cid;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        '/api/upload?channel=' + encodeURIComponent(selected),
        { method: 'POST', body: form },
      );
      const data = (await res.json()) as {
        id: string;
        name: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error);
      if (cidRef.current === selected) setAttachment(data);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSending(false);
      if (upload.current) upload.current.value = '';
    }
  };
  const inviteURL =
    typeof location === 'undefined'
      ? ''
      : location.origin + '/?invite=' + (server?.invite || 'mulekadinha');
  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      notify('Este navegador não oferece notificações.');
      return;
    }
    if (notifications) {
      setNotifications(false);
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotifications(true);
      notify('Notificações ativadas para o canal aberto.');
    } else notify('Notificações bloqueadas nas configurações do navegador.');
  };
  const loadEarlier = async () => {
    try {
      const data = await api(
        'messages?channel=' +
          encodeURIComponent(cid) +
          '&before=' +
          messages[0].created +
          (search ? '&search=' + encodeURIComponent(search) : '') +
          (pins ? '&pinned=true' : ''),
      );
      setMessages((old) => [...data.messages, ...old]);
      setHasMore(data.hasMore);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <main className="app">
      <div className="titlebar">
        <Gamepad2 size={17} /> DisMulekadinhaCord{' '}
        <span className={'connection-dot ' + (connected ? 'online' : '')} />
        <span>
          {connected ? 'Conectado' : loaded ? 'Reconectando…' : 'Conectando…'}
        </span>
      </div>
      <div className="workspace">
        <nav className="servers" aria-label="Servidores">
          <button
            className={'server home ' + (home ? 'selected' : '')}
            title="Mensagens diretas"
            aria-label="Mensagens diretas"
            onClick={() =>
              requireUser(() => {
                setHome(true);
                setVoiceView(false);
              })
            }
          >
            <Gamepad2 size={27} />
          </button>
          <hr />
          {servers
            .filter((s) => s.kind !== 'dm')
            .map((s) => (
              <button
                key={s.id}
                className={
                  'server ' + (!home && s.id === sid ? 'selected' : '')
                }
                title={s.name}
                aria-label={'Servidor ' + s.name}
                onClick={() => selectServer(s)}
              >
                {s.id === 'home' ? 'MK' : s.name.slice(0, 2).toUpperCase()}
              </button>
            ))}
          <button
            className="server add"
            title="Adicionar um servidor"
            aria-label="Adicionar um servidor"
            onClick={() => requireUser(() => open('server'))}
          >
            <Plus size={25} />
          </button>
          <button
            className="server add"
            title="Entrar com convite"
            aria-label="Entrar com convite"
            onClick={() => open('join')}
          >
            <Compass size={25} />
          </button>
          <div className="server-spacer" />
          <button
            className="server help-server"
            title="Ajuda"
            onClick={() => open('help')}
          >
            <CircleHelp size={22} />
          </button>
        </nav>
        <aside className={'sidebar ' + (showSidebar ? 'mobile-open' : '')}>
          <button
            className="server-heading"
            onClick={() => requireUser(() => open(home ? 'dm' : 'server-menu'))}
          >
            {home ? 'Mensagens diretas' : server?.name}
            <ChevronDown size={18} />
          </button>
          <div className="channel-list">
            {home ? (
              <>
                <button
                  className="channel active"
                  onClick={() => setHome(true)}
                >
                  <Users /> Amigos
                </button>
                <div className="category">
                  MENSAGENS DIRETAS{' '}
                  <IconButton
                    label="Nova mensagem direta"
                    onClick={() => open('dm')}
                  >
                    <Plus size={15} />
                  </IconButton>
                </div>
                {servers
                  .filter((s) => s.kind === 'dm')
                  .map((s) => (
                    <button
                      className="channel dm-channel"
                      key={s.id}
                      onClick={() => selectServer(s)}
                    >
                      <Avatar user={{ name: s.name }} size={30} />
                      {s.name}
                    </button>
                  ))}
                {!servers.some((s) => s.kind === 'dm') && (
                  <p className="sidebar-note">
                    Comece uma conversa pelo nome de usuário.
                  </p>
                )}
              </>
            ) : (
              <>
                {server?.kind !== 'dm' && (
                  <>
                    <div className="server-banner">
                      <Gamepad2 size={35} />
                      <strong>Boas-vindas à Mulekadinha!</strong>
                      <small>Aqui a gente assiste à tela do Jarbas.</small>
                    </div>
                    <button
                      className="invite"
                      onClick={() => requireUser(() => open('invite'))}
                    >
                      <Users size={17} /> Convidar amigos
                    </button>
                  </>
                )}
                {['info', 'text', 'voice'].map((kind) => {
                  const group = channels.filter((c) => c.kind === kind);
                  if (!group.length && kind === 'info') return null;
                  return (
                    <div key={kind}>
                      <div className="category">
                        <span>
                          ⌄{' '}
                          {kind === 'info'
                            ? 'INFORMAÇÕES'
                            : kind === 'text'
                              ? 'CANAIS DE TEXTO'
                              : 'CANAIS DE VOZ'}
                        </span>
                        {isOwner && (
                          <IconButton
                            label={
                              'Criar canal de ' +
                              (kind === 'voice' ? 'voz' : 'texto')
                            }
                            onClick={() => {
                              setChannelKind(
                                kind === 'voice' ? 'voice' : 'text',
                              );
                              open('channel');
                            }}
                          >
                            <Plus size={14} />
                          </IconButton>
                        )}
                      </div>
                      {group.map((c) => (
                        <div key={c.id}>
                          <button
                            className={
                              'channel ' +
                              ((voiceView && voice.room?.id === c.id) ||
                              (!voiceView && cid === c.id)
                                ? 'active'
                                : '')
                            }
                            onClick={() => selectChannel(c)}
                          >
                            {kind === 'voice' ? <Volume2 /> : <Hash />}
                            <span>{c.name}</span>
                            {voice.room?.id === c.id && (
                              <span className="small-dot" />
                            )}
                          </button>
                          {c.kind === 'voice' &&
                            roomMembers
                              .filter((p) => p.channel_id === c.id)
                              .map((p) => (
                                <div className="voice-person" key={p.id}>
                                  <Avatar user={p} size={22} />
                                  <span>{p.name}</span>
                                  {p.user_id === user?.id && voice.muted && (
                                    <MicOff size={13} />
                                  )}
                                </div>
                              ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
          {voice.room && (
            <div className="voice-status">
              <div>
                <Volume2 size={17} />
                <strong>Voz conectada</strong>
                <IconButton label="Desconectar" onClick={voice.leave}>
                  <PhoneOff size={19} />
                </IconButton>
              </div>
              <button
                onClick={() => {
                  setVoiceView(true);
                  setHome(false);
                }}
              >
                {voice.room.name}
              </button>
              <div className="voice-status-actions">
                <button onClick={() => void voice.startVisual('camera')}>
                  <Video size={17} /> Vídeo
                </button>
                <button
                  className={voice.mode === 'screen' ? 'is-active' : ''}
                  onClick={() =>
                    void voice.startVisual('screen', screenQuality)
                  }
                >
                  <MonitorUp size={17} /> Tela
                </button>
              </div>
            </div>
          )}
          <div className="user-panel">
            <button
              className="profile-button"
              onClick={() => open(user ? 'profile' : 'auth')}
            >
              <Avatar user={user || { name: 'G' }} size={32} />
              <div>
                <strong>{user?.name || 'Visitante'}</strong>
                <small>{user ? '@' + user.username : 'Entrar na conta'}</small>
              </div>
            </button>
            <IconButton
              label={voice.muted ? 'Ativar microfone' : 'Silenciar microfone'}
              active={voice.muted}
              onClick={() =>
                voice.room
                  ? voice.toggleMute()
                  : notify('Entre em um canal de voz primeiro.')
              }
            >
              {voice.muted ? <MicOff size={18} /> : <Mic size={18} />}
            </IconButton>
            <IconButton
              label={voice.deaf ? 'Ativar áudio' : 'Desativar áudio'}
              active={voice.deaf}
              onClick={() =>
                voice.room
                  ? voice.toggleDeaf()
                  : notify('Entre em um canal de voz primeiro.')
              }
            >
              {voice.deaf ? (
                <HeadphoneOff size={18} />
              ) : (
                <Headphones size={18} />
              )}
            </IconButton>
            <IconButton
              label="Configurações"
              onClick={() => open(user ? 'profile' : 'auth')}
            >
              <Settings size={18} />
            </IconButton>
          </div>
        </aside>
        <section className="main-panel">
          <header className="channel-heading">
            <IconButton
              className="mobile-menu"
              label="Mostrar canais"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <Menu size={20} />
            </IconButton>
            {home ? (
              <Users />
            ) : voiceView ? (
              <Volume2 />
            ) : server?.kind === 'dm' ? (
              <AtSign />
            ) : (
              <Hash />
            )}
            <strong>
              {home
                ? 'Amigos'
                : voiceView
                  ? voice.room?.name || 'Canal de voz'
                  : channel?.name}
            </strong>
            {!home && !voiceView && (
              <span className="topic">
                {channel?.topic || 'Converse com a galera'}
              </span>
            )}
            <div className="header-actions">
              <IconButton
                label={
                  notifications
                    ? 'Desativar notificações'
                    : 'Ativar notificações'
                }
                active={notifications}
                onClick={() => void toggleNotifications()}
              >
                {notifications ? <Bell size={20} /> : <BellOff size={20} />}
              </IconButton>
              {!home && !voiceView && (
                <IconButton
                  label="Mensagens fixadas"
                  active={pins}
                  onClick={() => {
                    setPins(!pins);
                    nearBottom.current = true;
                  }}
                >
                  <Pin size={20} />
                </IconButton>
              )}
              <IconButton
                label="Mostrar membros"
                active={showMembers}
                onClick={() => setShowMembers(!showMembers)}
              >
                <Users size={20} />
              </IconButton>
              {!home && !voiceView && (
                <form
                  className="search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearch(query);
                    nearBottom.current = true;
                  }}
                >
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (!e.target.value) setSearch('');
                    }}
                    placeholder="Buscar"
                    aria-label="Buscar mensagens"
                  />
                  <button title="Buscar" aria-label="Buscar">
                    <Search size={15} />
                  </button>
                </form>
              )}
              <IconButton label="Ajuda" onClick={() => open('help')}>
                <CircleHelp size={20} />
              </IconButton>
            </div>
          </header>
          <div className="chat-layout">
            {home ? (
              <section className="friends-view">
                <div className="friends-toolbar">
                  <h1>Amigos da comunidade</h1>
                  <button className="primary" onClick={() => open('dm')}>
                    Nova conversa
                  </button>
                </div>
                <p>Converse em particular com alguém pelo nome de usuário.</p>
                {members
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      className="friend-row"
                      onClick={() =>
                        void startDM(m.username).catch((e) => notify(e.message))
                      }
                    >
                      <Avatar user={m} />
                      <div>
                        <strong>{m.name}</strong>
                        <small>@{m.username}</small>
                      </div>
                      <span
                        className={
                          'small-dot ' +
                          (Date.now() - m.seen < 40000 ? '' : 'offline')
                        }
                      />
                      <MessageCircle size={22} />
                    </button>
                  ))}
                {members.filter((m) => m.id !== user?.id).length === 0 && (
                  <div className="friends-empty">
                    <Users size={58} />
                    <h2>A galera ainda está chegando.</h2>
                    <p>Compartilhe o convite do servidor para começar.</p>
                    <button className="primary" onClick={() => open('invite')}>
                      Convidar amigos
                    </button>
                  </div>
                )}
              </section>
            ) : voiceView ? (
              <section className="voice-view">
                <div className="voice-title">
                  <div>
                    <span className="eyebrow">CANAL DE VOZ</span>
                    <h1>{voice.room?.name || 'Entrando na chamada…'}</h1>
                  </div>
                  <span className="voice-count">
                    {voice.room ? voice.peers.length + 1 : 0} participante
                    {voice.peers.length !== 0 ? 's' : ''}
                  </span>
                </div>
                <div className="voice-grid">
                  <div
                    className={
                      'voice-tile self ' + (voice.visual ? 'has-video' : '')
                    }
                  >
                    {voice.visual ? (
                      <Media stream={voice.visual} muted video />
                    ) : (
                      <Avatar user={user || { name: 'Você' }} size={88} />
                    )}
                    <span className="tile-label">
                      {voice.muted && <MicOff size={14} />} {user?.name} (você)
                    </span>
                    {voice.mode === 'screen' && (
                      <span className="live-label">AO VIVO</span>
                    )}
                    {voice.visual && voice.mode !== 'screen' && (
                      <FullscreenButton />
                    )}
                    {voice.mode === 'screen' && voice.streamInfo && (
                      <span className="stream-spec">
                        {voice.streamInfo.width}×{voice.streamInfo.height} ·{' '}
                        {voice.streamInfo.frameRate} FPS
                      </span>
                    )}
                  </div>
                  {voice.peers.map((p) => (
                    <div
                      className={'voice-tile ' + (p.video ? 'has-video' : '')}
                      key={p.id}
                    >
                      <Media
                        stream={p.stream}
                        muted={voice.deaf}
                        video={p.video}
                      />
                      {!p.video && <Avatar user={p} size={88} />}
                      <span className="tile-label">{p.name}</span>
                      <span className="tile-state">
                        {p.state === 'connected'
                          ? 'Conectado'
                          : p.state === 'failed'
                            ? 'Falha na conexão'
                            : 'Conectando…'}
                      </span>
                      {p.video && <FullscreenButton />}
                      {p.video && p.width && p.height && (
                        <span className="stream-spec">
                          {p.width}×{p.height}
                          {p.frameRate ? ` · ${p.frameRate} FPS` : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {voice.mode === 'screen' && (
                  <p className="screen-share-tip">
                    Para evitar o efeito espelho, compartilhe outra janela ou
                    aba. Quem assiste pode abrir a transmissão em tela cheia.
                  </p>
                )}
                {voice.peers.length === 0 && (
                  <p className="voice-hint">
                    {voice.joining
                      ? 'Permita o acesso ao microfone no navegador.'
                      : 'Você está por aqui. Agora só falta a galera.'}
                  </p>
                )}
                <div className="call-controls">
                  <IconButton
                    label={voice.muted ? 'Ativar microfone' : 'Silenciar'}
                    active={voice.muted}
                    onClick={voice.toggleMute}
                  >
                    {voice.muted ? <MicOff /> : <Mic />}
                  </IconButton>
                  <IconButton
                    label={
                      voice.mode === 'camera'
                        ? 'Desligar câmera'
                        : 'Ligar câmera'
                    }
                    active={voice.mode === 'camera'}
                    onClick={() => void voice.startVisual('camera')}
                  >
                    {voice.mode === 'camera' ? <Video /> : <VideoOff />}
                  </IconButton>
                  <div className="stream-controls">
                    <label>
                      <span>Qualidade da transmissão</span>
                      <select
                        aria-label="Qualidade da transmissão"
                        value={screenQuality}
                        disabled={voice.mode === 'screen'}
                        onChange={(event) =>
                          setScreenQuality(event.target.value as StreamQuality)
                        }
                      >
                        {STREAM_QUALITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className={
                        'share-screen ' +
                        (voice.mode === 'screen' ? 'sharing' : '')
                      }
                      disabled={!voice.room}
                      onClick={() =>
                        void voice.startVisual('screen', screenQuality)
                      }
                    >
                      <MonitorUp size={22} />
                      {voice.mode === 'screen'
                        ? 'Parar transmissão'
                        : 'Compartilhar tela'}
                    </button>
                  </div>
                  <IconButton
                    label="Sair da chamada"
                    className="hangup"
                    onClick={() => {
                      voice.leave();
                      setVoiceView(false);
                    }}
                  >
                    <PhoneOff />
                  </IconButton>
                </div>
                <p className="voice-footnote">
                  Até 8 pessoas • Tela em até 1440p e 60 FPS • A qualidade final
                  depende da fonte e da conexão
                </p>
              </section>
            ) : (
              <section className="conversation">
                {(search || pins) && (
                  <div className="filter-bar">
                    {pins
                      ? 'Mensagens fixadas'
                      : 'Resultados para “' + search + '”'}
                    <IconButton
                      label="Limpar filtro"
                      onClick={() => {
                        setSearch('');
                        setQuery('');
                        setPins(false);
                      }}
                    >
                      <X size={16} />
                    </IconButton>
                  </div>
                )}
                <div
                  className="message-scroll"
                  ref={scroll}
                  onScroll={() => {
                    const el = scroll.current;
                    if (el)
                      nearBottom.current =
                        el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                  }}
                >
                  <div className="welcome">
                    <span className="welcome-icon">
                      {server?.kind === 'dm' ? (
                        <AtSign size={42} />
                      ) : (
                        <Hash size={42} />
                      )}
                    </span>
                    <h1>
                      {server?.kind === 'dm'
                        ? 'Conversa com ' + server.name
                        : channel?.name === 'boas-vindas'
                          ? 'Boas-vindas à Mulekadinha!'
                          : 'Boas-vindas a #' + channel?.name + '!'}
                    </h1>
                    <p>
                      {server?.kind === 'dm' ? (
                        'Este é o começo da conversa de vocês.'
                      ) : channel?.name === 'boas-vindas' ? (
                        'Aqui a gente assiste à tela do Jarbas.'
                      ) : (
                        <>
                          Este é o começo do canal{' '}
                          <strong>#{channel?.name}</strong>.
                        </>
                      )}
                    </p>
                    {server?.kind !== 'dm' && (
                      <div className="welcome-actions">
                        <button
                          className="primary"
                          onClick={() => requireUser(() => open('invite'))}
                        >
                          <Users size={17} /> Convidar amigos
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            const c = channels.find((c) => c.kind === 'voice');
                            if (c) selectChannel(c);
                          }}
                        >
                          <MonitorUp size={17} /> Entrar na resenha
                        </button>
                      </div>
                    )}
                  </div>
                  {hasMore && (
                    <button
                      className="load-earlier"
                      onClick={() => void loadEarlier()}
                    >
                      Carregar mensagens anteriores
                    </button>
                  )}
                  <div className="date-divider">
                    <span>
                      {messages.length
                        ? new Date(messages[0].created).toLocaleDateString(
                            'pt-BR',
                            { day: 'numeric', month: 'long', year: 'numeric' },
                          )
                        : 'Hoje'}
                    </span>
                  </div>
                  {!messages.length && !search && !pins && (
                    <div className="system-message">
                      <span className="avatar purple">
                        <Gamepad2 size={24} />
                      </span>
                      <div>
                        <strong>
                          DisMulekadinhaCord{' '}
                          <span className="app-tag">APP</span>
                        </strong>
                        <p>
                          A casa é sua. Chame a galera, entre em um canal de voz
                          e bora conversar. 👋
                        </p>
                      </div>
                    </div>
                  )}
                  {!messages.length && (search || pins) && (
                    <div className="no-messages">
                      <Search size={32} />
                      <p>
                        {pins
                          ? 'Ainda não há mensagens fixadas.'
                          : 'Nenhuma mensagem encontrada.'}
                      </p>
                    </div>
                  )}
                  {messages.map((m) => (
                    <article
                      className={
                        'message ' + (m.pinned ? 'pinned-message' : '')
                      }
                      key={m.id}
                    >
                      <Avatar user={m} size={40} />
                      <div className="message-content">
                        {m.reply_to && (
                          <div className="reply-preview">
                            <Reply size={13} />
                            <strong>
                              {m.reply_name || 'Mensagem excluída'}
                            </strong>
                            <span>{m.reply_body?.slice(0, 110)}</span>
                          </div>
                        )}
                        <div className="message-meta">
                          <strong style={{ color: m.color }}>{m.name}</strong>
                          <time
                            dateTime={new Date(m.created).toISOString()}
                            title={new Date(m.created).toLocaleString('pt-BR')}
                          >
                            {new Date(m.created).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                          {m.pinned && <Pin size={12} />}
                        </div>
                        <p>
                          {m.body}
                          {m.edited && (
                            <small className="edited"> (editada)</small>
                          )}
                        </p>
                        {m.file_id && (
                          <a
                            className="file-attachment"
                            href={'/api/file/' + m.file_id}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {/^image\/(png|jpeg|gif|webp)$/.test(
                              m.file_mime || '',
                            ) ? (
                              // Authenticated uploads need the user's cookie; a server image optimizer cannot fetch them.
                              // oxlint-disable-next-line next/no-img-element
                              <img
                                src={'/api/file/' + m.file_id}
                                alt={m.file_name || 'Imagem enviada'}
                                loading="lazy"
                              />
                            ) : (
                              <>
                                <Paperclip size={23} />
                                <span>{m.file_name}</span>
                                <Download size={18} />
                              </>
                            )}
                          </a>
                        )}
                        <div className="reactions">
                          {reactions
                            .filter((r) => r.message_id === m.id)
                            .map((r) => (
                              <button
                                key={r.emoji}
                                className={r.mine ? 'mine' : ''}
                                aria-label={'Reagir ' + r.emoji}
                                onClick={() => void react(m, r.emoji)}
                              >
                                {r.emoji} <span>{r.count}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                      <div className="message-actions">
                        <IconButton
                          label="Curtir mensagem"
                          onClick={() => void react(m, '👍')}
                        >
                          <Smile size={17} />
                        </IconButton>
                        <IconButton
                          label="Responder"
                          onClick={() => {
                            setReply(m);
                            setEditing(null);
                            composer.current?.focus();
                          }}
                        >
                          <Reply size={17} />
                        </IconButton>
                        {isOwner && (
                          <IconButton
                            label={m.pinned ? 'Desafixar' : 'Fixar'}
                            onClick={() =>
                              void api('message', { id: m.id, action: 'pin' })
                                .then(refreshMessages)
                                .catch((e) => notify(e.message))
                            }
                          >
                            <Pin size={17} />
                          </IconButton>
                        )}
                        {m.user_id === user?.id && (
                          <IconButton
                            label="Editar mensagem"
                            onClick={() => {
                              setEditing(m);
                              setReply(null);
                              setDraft(m.body);
                              composer.current?.focus();
                            }}
                          >
                            <Pencil size={17} />
                          </IconButton>
                        )}
                        {(m.user_id === user?.id || isOwner) && (
                          <IconButton
                            label="Excluir mensagem"
                            onClick={() => {
                              setDeleting(m);
                              open('delete');
                            }}
                          >
                            <Trash2 size={17} />
                          </IconButton>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="chat-bottom">
                  {(reply || editing) && (
                    <div className="replying">
                      {editing
                        ? 'Editando sua mensagem'
                        : 'Respondendo a ' + reply?.name}
                      <IconButton
                        label="Cancelar"
                        onClick={() => {
                          setReply(null);
                          setEditing(null);
                          setDraft('');
                        }}
                      >
                        <X size={15} />
                      </IconButton>
                    </div>
                  )}
                  {attachment && (
                    <div className="replying">
                      <Paperclip size={15} />
                      {attachment.name}
                      <IconButton
                        label="Remover anexo"
                        onClick={() => setAttachment(null)}
                      >
                        <X size={15} />
                      </IconButton>
                    </div>
                  )}
                  {emojiOpen && (
                    <div className="emoji-picker">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setDraft((d) => d + emoji);
                            setEmojiOpen(false);
                            composer.current?.focus();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="composer">
                    <IconButton
                      label="Anexar arquivo"
                      onClick={() => requireUser(() => upload.current?.click())}
                    >
                      <Plus size={23} />
                    </IconButton>
                    <input
                      type="file"
                      ref={upload}
                      hidden
                      onChange={(e) => void uploadFile(e.target.files?.[0])}
                    />
                    <textarea
                      ref={composer}
                      value={draft}
                      rows={1}
                      maxLength={2000}
                      aria-label={'Mensagem em ' + channel?.name}
                      placeholder={
                        user
                          ? 'Conversar em ' +
                            (server?.kind === 'dm' ? '@' : '#') +
                            channel?.name
                          : 'Entre para conversar em #' + channel?.name
                      }
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                        if (e.key === 'Escape') {
                          setEditing(null);
                          setReply(null);
                          setDraft('');
                        }
                      }}
                    />
                    <IconButton
                      label="Inserir emoji"
                      active={emojiOpen}
                      onClick={() => setEmojiOpen(!emojiOpen)}
                    >
                      <Smile size={23} />
                    </IconButton>
                    <button
                      className="send-button"
                      title={editing ? 'Salvar edição' : 'Enviar mensagem'}
                      aria-label="Enviar mensagem"
                      disabled={sending || !cid}
                      onClick={() => void send()}
                    >
                      {sending ? (
                        <LoaderCircle className="spin" size={20} />
                      ) : editing ? (
                        <Check size={21} />
                      ) : (
                        <Send size={21} />
                      )}
                    </button>
                  </div>
                  <small>
                    {user ? (
                      'Enter para enviar • Shift + Enter para nova linha'
                    ) : (
                      <button onClick={() => open('auth')}>
                        Entre na sua conta para enviar uma mensagem.
                      </button>
                    )}
                    {draft.length > 1800 && (
                      <span className="character-count">
                        {draft.length}/2000
                      </span>
                    )}
                  </small>
                </div>
              </section>
            )}
            {showMembers && !voiceView && (
              <aside className="members">
                <div className="category">
                  {user
                    ? 'ONLINE — ' +
                      members.filter((m) => Date.now() - m.seen < 40000).length
                    : 'SEU SERVIDOR'}
                </div>
                {members
                  .filter((m) => Date.now() - m.seen < 40000)
                  .map((m) => (
                    <button
                      className="member"
                      key={m.id}
                      onClick={() =>
                        m.id === user?.id
                          ? open('profile')
                          : void startDM(m.username).catch((e) =>
                              notify(e.message),
                            )
                      }
                    >
                      <span className="member-avatar">
                        <Avatar user={m} size={32} />
                        <i />
                      </span>
                      <div>
                        <strong style={{ color: m.color }}>
                          {m.name}{' '}
                          {m.id === server?.owner && <Crown size={12} />}
                        </strong>
                        <small>{m.id === user?.id ? 'Você' : 'Online'}</small>
                      </div>
                    </button>
                  ))}
                {members.some((m) => Date.now() - m.seen >= 40000) && (
                  <div className="category">
                    OFFLINE —{' '}
                    {members.filter((m) => Date.now() - m.seen >= 40000).length}
                  </div>
                )}
                {members
                  .filter((m) => Date.now() - m.seen >= 40000)
                  .map((m) => (
                    <button
                      className="member offline-member"
                      key={m.id}
                      onClick={() =>
                        void startDM(m.username).catch((e) => notify(e.message))
                      }
                    >
                      <Avatar user={m} size={32} />
                      <strong>{m.name}</strong>
                    </button>
                  ))}
                {members.length < 2 && (
                  <div className="community-card">
                    <span className="community-icon">
                      <Users size={28} />
                    </span>
                    <strong>Melhor com a galera</strong>
                    <p>
                      Convide seus amigos e faça deste servidor o seu ponto de
                      encontro.
                    </p>
                    <button onClick={() => requireUser(() => open('invite'))}>
                      Convidar amigos →
                    </button>
                  </div>
                )}
              </aside>
            )}
          </div>
        </section>
      </div>
      {!voiceView &&
        voice.peers.map((p) => (
          <Media key={p.id} stream={p.stream} muted={voice.deaf} />
        ))}
      {toast && (
        <output className="toast">
          {toast}
          <IconButton label="Fechar aviso" onClick={() => setToast('')}>
            <X size={16} />
          </IconButton>
        </output>
      )}
      {modal && (
        <Modal key={modal} onClose={() => setModal('')}>
          {modal === 'auth' ? (
            <>
              <div className="modal-symbol">
                <Gamepad2 size={34} />
              </div>
              <h2>
                {authMode === 'nickname'
                  ? 'Qual é o seu apelido?'
                  : authMode === 'register'
                    ? 'Crie sua conta'
                    : 'Olha quem voltou!'}
              </h2>
              <p>
                {authMode === 'nickname'
                  ? 'Digite um nick e entre direto na resenha.'
                  : authMode === 'register'
                  ? 'A mulekadinha está esperando por você.'
                  : 'Entre para continuar a resenha.'}
              </p>
              <form onSubmit={submitModal}>
                {(authMode === 'nickname' || authMode === 'register') && (
                  <label>
                    SEU APELIDO
                    <input
                      name="name"
                      placeholder="Como a galera te chama?"
                      required
                      minLength={2}
                      maxLength={40}
                      autoComplete="name"
                    />
                  </label>
                )}
                {authMode !== 'nickname' && (
                  <>
                    <label>
                      NOME DE USUÁRIO
                      <input
                        name="username"
                        placeholder="seu_usuario"
                        required
                        minLength={3}
                        maxLength={24}
                        pattern="[a-zA-Z0-9_.]+"
                        autoComplete="username"
                      />
                    </label>
                    <label>
                      SENHA
                      <input
                        type="password"
                        name="password"
                        placeholder="Pelo menos 8 caracteres"
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete={
                          authMode === 'register'
                            ? 'new-password'
                            : 'current-password'
                        }
                      />
                    </label>
                  </>
                )}
                <FormError error={modalError} />
                <button className="primary full" disabled={busy}>
                  {busy
                    ? 'Aguarde…'
                    : authMode === 'nickname'
                      ? 'Entrar na Mulekadinha'
                      : authMode === 'register'
                        ? 'Criar conta'
                        : 'Entrar'}
                </button>
              </form>
              <button
                className="text-link"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'nickname' : 'login');
                  setModalError('');
                }}
              >
                {authMode === 'login'
                  ? 'Entrar apenas com apelido'
                  : 'Já tenho uma conta antiga'}
              </button>
              {authMode === 'login' && (
                <button
                  className="text-link"
                  onClick={() => {
                    setAuthMode('register');
                    setModalError('');
                  }}
                >
                  Criar uma conta com senha
                </button>
              )}
              <small className="auth-note">
                DisMulekadinhaCord é um projeto independente.
              </small>
            </>
          ) : modal === 'server' ? (
            <>
              <div className="modal-symbol">
                <Users size={32} />
              </div>
              <h2>Crie seu servidor</h2>
              <p>
                Um lugar para seus amigos conversarem e passarem tempo juntos.
              </p>
              <form onSubmit={submitModal}>
                <label>
                  NOME DO SERVIDOR
                  <input
                    name="name"
                    placeholder="Servidor da galera"
                    maxLength={60}
                    required
                  />
                </label>
                <FormError error={modalError} />
                <button className="primary full" disabled={busy}>
                  {busy ? 'Criando…' : 'Criar servidor'}
                </button>
              </form>
              <div className="modal-footer">
                <strong>Já tem um convite?</strong>
                <button className="secondary full" onClick={() => open('join')}>
                  Entrar em um servidor
                </button>
              </div>
            </>
          ) : modal === 'join' ? (
            <>
              <h2>Entrar em um servidor</h2>
              <p>Cole o link ou o código de convite que seu amigo enviou.</p>
              <form onSubmit={submitModal}>
                <label>
                  CONVITE
                  <input
                    name="code"
                    placeholder="Link ou código de convite"
                    defaultValue={pendingInvite}
                    required
                  />
                </label>
                <FormError error={modalError} />
                <button className="primary full" disabled={busy}>
                  {!user
                    ? 'Entrar na conta e continuar'
                    : busy
                      ? 'Entrando…'
                      : 'Entrar no servidor'}
                </button>
              </form>
            </>
          ) : modal === 'invite' ? (
            <>
              <h2>Convide seus amigos</h2>
              <p>
                Compartilhe este link para entrar no servidor {server?.name}.
              </p>
              <label>
                LINK DE CONVITE
                <input readOnly value={inviteURL} />
              </label>
              <button
                className="primary full"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(inviteURL)
                    .then(() => setCopied(true))
                    .catch(() => notify('Selecione e copie o link acima.'))
                }
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}{' '}
                {copied ? 'Link copiado!' : 'Copiar convite'}
              </button>
            </>
          ) : modal === 'channel' ? (
            <>
              <h2>Criar canal</h2>
              <p>Em {server?.name}</p>
              <form onSubmit={submitModal}>
                <div className="channel-type">
                  <button
                    type="button"
                    className={channelKind === 'text' ? 'chosen' : ''}
                    onClick={() => setChannelKind('text')}
                  >
                    <Hash /> Texto
                  </button>
                  <button
                    type="button"
                    className={channelKind === 'voice' ? 'chosen' : ''}
                    onClick={() => setChannelKind('voice')}
                  >
                    <Volume2 /> Voz
                  </button>
                </div>
                <label>
                  NOME DO CANAL
                  <input
                    name="name"
                    placeholder={
                      channelKind === 'voice' ? 'Resenha' : 'novo-canal'
                    }
                    maxLength={40}
                    required
                  />
                </label>
                <label>
                  ASSUNTO (OPCIONAL)
                  <input
                    name="topic"
                    maxLength={120}
                    placeholder="Sobre o que vocês vão conversar?"
                  />
                </label>
                <FormError error={modalError} />
                <button className="primary full" disabled={busy}>
                  {busy ? 'Criando…' : 'Criar canal'}
                </button>
              </form>
            </>
          ) : modal === 'dm' ? (
            <>
              <h2>Nova conversa</h2>
              <p>Digite o nome de usuário de quem você quer chamar.</p>
              <form onSubmit={submitModal}>
                <label>
                  NOME DE USUÁRIO
                  <input
                    name="username"
                    placeholder="usuario_do_amigo"
                    required
                    maxLength={24}
                  />
                </label>
                <FormError error={modalError} />
                <button className="primary full" disabled={busy}>
                  Abrir conversa
                </button>
              </form>
            </>
          ) : modal === 'profile' ? (
            <>
              <div className="profile-preview">
                <Avatar user={user!} size={70} />
                <div>
                  <h2>{user?.name}</h2>
                  <p>@{user?.username}</p>
                </div>
              </div>
              <form onSubmit={submitModal}>
                <label>
                  NOME DE EXIBIÇÃO
                  <input
                    name="name"
                    defaultValue={user?.name}
                    maxLength={40}
                    required
                  />
                </label>
                <FormError error={modalError} />
                <button className="primary full" disabled={busy}>
                  Salvar alterações
                </button>
              </form>
              <button
                className="logout"
                onClick={() =>
                  void api('logout', {})
                    .then(() => {
                      voice.leave();
                      setModal('');
                      setHome(false);
                      setVoiceView(false);
                      setSid('home');
                      setCid('general');
                      return bootstrap();
                    })
                    .catch((e) => notify(e.message))
                }
              >
                <LogOut size={18} /> Sair da conta
              </button>
            </>
          ) : modal === 'server-menu' ? (
            <>
              <h2>{server?.name}</h2>
              <button className="menu-item" onClick={() => open('invite')}>
                <Users /> Convidar amigos
              </button>
              {isOwner && (
                <button className="menu-item" onClick={() => open('channel')}>
                  <Plus /> Criar canal
                </button>
              )}
              <button className="menu-item" onClick={() => open('server')}>
                <Plus /> Criar outro servidor
              </button>
              <button className="menu-item" onClick={() => open('join')}>
                <Compass /> Entrar com convite
              </button>
            </>
          ) : modal === 'delete' ? (
            <>
              <h2>Excluir mensagem?</h2>
              <p>Esta ação não pode ser desfeita.</p>
              <blockquote>{deleting?.body || deleting?.file_name}</blockquote>
              <form onSubmit={submitModal}>
                <FormError error={modalError} />
                <button className="danger full" disabled={busy}>
                  Excluir mensagem
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Seu lugar para a resenha</h2>
              <div className="help-content">
                <p>
                  <strong>Servidores e canais</strong>Crie sua conta, adicione
                  um servidor no botão + e compartilhe o convite com os amigos.
                </p>
                <p>
                  <strong>Voz e tela</strong>Escolha um canal de voz e permita o
                  microfone. Use “Compartilhar tela” para transmitir uma aba,
                  janela ou monitor. Até 8 participantes por chamada.
                </p>
                <p>
                  <strong>Mensagens</strong>Envie texto, emojis e arquivos de
                  até 8 MB. Passe o mouse sobre uma mensagem para responder ou
                  editar. O dono do servidor também pode fixar e excluir
                  mensagens.
                </p>
                <p>
                  <strong>Conexão</strong>Mensagens são atualizadas a cada 2
                  segundos. Chamadas usam conexão direta; algumas redes exigem
                  um serviço TURN configurado pelo administrador.
                </p>
                <p>
                  <strong>Sobre o projeto</strong>Aplicação independente
                  inspirada no Discord. Ainda não oferece todos os recursos
                  dele, como bots, Nitro, moderação avançada e recuperação de
                  senha.
                </p>
              </div>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
