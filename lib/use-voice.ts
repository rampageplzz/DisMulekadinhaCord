'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './client';
export type VoicePeer = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  stream?: MediaStream;
  video?: boolean;
  state?: string;
  quality?: StreamQuality;
  width?: number;
  height?: number;
  frameRate?: number;
};
export type StreamQuality = '1080p60' | '1440p60';
export type StreamInfo = {
  quality: StreamQuality;
  width: number;
  height: number;
  frameRate: number;
};
export const STREAM_QUALITY_OPTIONS: {
  value: StreamQuality;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}[] = [
  {
    value: '1080p60',
    label: '1080p · 60 FPS',
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrate: 6_000_000,
  },
  {
    value: '1440p60',
    label: '1440p · 60 FPS',
    width: 2560,
    height: 1440,
    frameRate: 60,
    bitrate: 10_000_000,
  },
];
const tuneVideoSender = async (
  sender: RTCRtpSender,
  bitrate: number,
  frameRate: number,
) => {
  const parameters = sender.getParameters();
  if (!parameters.encodings.length) return;
  parameters.degradationPreference = 'balanced';
  parameters.encodings[0].maxBitrate = bitrate;
  parameters.encodings[0].maxFramerate = frameRate;
  parameters.encodings[0].scaleResolutionDownBy = 1;
  await sender.setParameters(parameters).catch(() => {});
};
const preferCompatibleVideoCodec = (transceiver: RTCRtpTransceiver) => {
  const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs;
  if (!codecs?.some((codec) => codec.mimeType.toLowerCase() === 'video/vp8'))
    return;
  transceiver.setCodecPreferences([
    ...codecs.filter((codec) => codec.mimeType.toLowerCase() === 'video/vp8'),
    ...codecs.filter((codec) => codec.mimeType.toLowerCase() !== 'video/vp8'),
  ]);
};
type Connection = {
  pc: RTCPeerConnection;
  senders: RTCRtpSender[];
  candidates: RTCIceCandidateInit[];
  stream: MediaStream;
};
export function useVoice(onError: (text: string) => void) {
  const [room, setRoom] = useState<{ id: string; name: string } | null>(null),
    [peers, setPeers] = useState<VoicePeer[]>([]),
    [muted, setMuted] = useState(false),
    [deaf, setDeaf] = useState(false),
    [visual, setVisual] = useState<MediaStream | null>(null),
    [mode, setMode] = useState<'screen' | 'camera' | null>(null),
    [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null),
    [joining, setJoining] = useState(false);
  const current = useRef<{
    id: string;
    channel: string;
    mic: MediaStream;
    visual: MediaStream | null;
    mode: string | null;
    streamInfo: StreamInfo | null;
    videoBitrate: number;
    videoFrameRate: number;
    connections: Map<string, Connection>;
    ice: RTCIceServer[];
    stopped: boolean;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  const generation = useRef(0);
  const joiningRef = useRef(false);
  const leave = useCallback(() => {
    generation.current++;
    const s = current.current;
    if (!s) return;
    current.current = null;
    s.stopped = true;
    clearTimeout(s.timer);
    s.mic.getTracks().forEach((t) => t.stop());
    s.visual?.getTracks().forEach((t) => t.stop());
    s.connections.forEach((c) => c.pc.close());
    void fetch('/api/voice/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peer: s.id }),
      keepalive: true,
    }).catch(() => {});
    setRoom(null);
    setPeers([]);
    setVisual(null);
    setMode(null);
    setStreamInfo(null);
    setMuted(false);
    setDeaf(false);
  }, []);
  useEffect(() => {
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [leave]);
  const join = async (channel: { id: string; name: string }) => {
    if (joiningRef.current || current.current?.channel === channel.id) return;
    leave();
    const attempt = generation.current;
    joiningRef.current = true;
    setJoining(true);
    let mic: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Seu navegador não permite áudio aqui. Abra o site por HTTPS no Chrome, Edge ou Firefox.',
        );
      mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (attempt !== generation.current) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      const res = await api('voice/join', { channel: channel.id });
      if (attempt !== generation.current) {
        mic.getTracks().forEach((t) => t.stop());
        void api('voice/leave', { peer: res.id }).catch(() => {});
        return;
      }
      const s = {
        id: res.id,
        channel: channel.id,
        mic,
        visual: null as MediaStream | null,
        mode: null as string | null,
        streamInfo: null as StreamInfo | null,
        videoBitrate: 2_500_000,
        videoFrameRate: 30,
        connections: new Map<string, Connection>(),
        ice: res.iceServers as RTCIceServer[],
        stopped: false,
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
      };
      current.current = s;
      setRoom(channel);
      const signal = async (target: string, payload: unknown) => {
        if (!s.stopped)
          await api('voice/signal', { peer: s.id, target, payload });
      };
      const make = (p: VoicePeer) => {
        if (s.connections.has(p.id)) return s.connections.get(p.id)!;
        const pc = new RTCPeerConnection({ iceServers: s.ice }),
          stream = new MediaStream(),
          microphone = pc.addTransceiver(s.mic.getAudioTracks()[0], {
            direction: 'sendrecv',
          }),
          video = pc.addTransceiver('video', { direction: 'sendrecv' }),
          screenAudio = pc.addTransceiver('audio', {
            direction: 'sendrecv',
          });
        preferCompatibleVideoCodec(video);
        const senders = [
          microphone.sender,
          video.sender,
          screenAudio.sender,
        ];
        const c = {
          pc,
          senders,
          candidates: [] as RTCIceCandidateInit[],
          stream,
        };
        s.connections.set(p.id, c);
        if (s.visual) {
          senders[1].setStreams(s.visual);
          void senders[1]
            .replaceTrack(s.visual.getVideoTracks()[0] || null)
            .then(() =>
              tuneVideoSender(senders[1], s.videoBitrate, s.videoFrameRate),
            );
          void senders[2].replaceTrack(s.visual.getAudioTracks()[0] || null);
        }
        pc.onicecandidate = (e) => {
          if (e.candidate)
            void signal(p.id, { candidate: e.candidate.toJSON() }).catch(
              () => {},
            );
        };
        pc.ontrack = (e) => {
          stream.addTrack(e.track);
          setPeers((old) =>
            old.map((x) => (x.id === p.id ? { ...x, stream } : x)),
          );
        };
        pc.onconnectionstatechange = () => {
          setPeers((old) =>
            old.map((x) =>
              x.id === p.id ? { ...x, state: pc.connectionState } : x,
            ),
          );
          if (pc.connectionState === 'failed')
            errorRef.current(
              'A conexão com ' +
                p.name +
                ' falhou. Esta rede pode precisar de um servidor TURN.',
            );
        };
        return c;
      };
      let after = 0,
        failures = 0;
      const poll = async () => {
        if (s.stopped) return;
        try {
          const result = await api(
            'voice/poll?peer=' + s.id + '&after=' + after,
          );
          if (s.stopped) return;
          failures = 0;
          const incoming: VoicePeer[] = result.peers;
          const valid = new Set(incoming.map((p) => p.id));
          s.connections.forEach((c, key) => {
            if (!valid.has(key)) {
              c.pc.close();
              s.connections.delete(key);
            }
          });
          setPeers((old) =>
            incoming.map((p) => ({ ...old.find((x) => x.id === p.id), ...p })),
          );
          for (const p of incoming) {
            if (!s.connections.has(p.id)) {
              const c = make(p);
              if (s.id < p.id) {
                await c.pc.setLocalDescription(await c.pc.createOffer());
                await signal(p.id, {
                  description: c.pc.localDescription,
                  video: !!s.visual,
                  ...s.streamInfo,
                });
              }
            }
          }
          for (const message of result.signals) {
            after = Math.max(after, message.id);
            const p = incoming.find((x) => x.id === message.sender);
            if (!p) continue;
            const c = make(p),
              payload = JSON.parse(message.payload);
            if (payload.video !== undefined)
              setPeers((old) =>
                old.map((x) =>
                  x.id === p.id
                    ? {
                        ...x,
                        video: payload.video,
                        quality: payload.video ? payload.quality : undefined,
                        width: payload.video ? payload.width : undefined,
                        height: payload.video ? payload.height : undefined,
                        frameRate: payload.video
                          ? payload.frameRate
                          : undefined,
                      }
                    : x,
                ),
              );
            if (
              payload.refreshVideo &&
              s.id < p.id &&
              c.pc.signalingState === 'stable'
            ) {
              await c.pc.setLocalDescription(await c.pc.createOffer());
              await signal(p.id, {
                description: c.pc.localDescription,
                video: !!s.visual,
                ...s.streamInfo,
              });
            }
            if (payload.description) {
              await c.pc.setRemoteDescription(payload.description);
              for (const candidate of c.candidates)
                await c.pc.addIceCandidate(candidate);
              c.candidates = [];
              if (payload.description.type === 'offer') {
                await c.pc.setLocalDescription(await c.pc.createAnswer());
                await signal(p.id, {
                  description: c.pc.localDescription,
                  video: !!s.visual,
                  ...s.streamInfo,
                });
              }
            } else if (payload.candidate) {
              if (c.pc.remoteDescription)
                await c.pc.addIceCandidate(payload.candidate);
              else c.candidates.push(payload.candidate);
            }
          }
        } catch (e) {
          if (s.stopped) return;
          failures++;
          if ((e instanceof ApiError && e.status === 404) || failures >= 10) {
            leave();
            errorRef.current('A chamada foi desconectada. Entre novamente.');
            return;
          }
        }
        if (!s.stopped) s.timer = setTimeout(poll, 1000);
      };
      void poll();
    } catch (e) {
      mic?.getTracks().forEach((t) => t.stop());
      errorRef.current(
        e instanceof DOMException
          ? 'Permita o acesso ao microfone para entrar na chamada.'
          : (e as Error).message,
      );
    } finally {
      joiningRef.current = false;
      setJoining(false);
    }
  };
  const toggleMute = () => {
    const next = !muted;
    current.current?.mic.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleDeaf = () => {
    const next = !deaf;
    setDeaf(next);
    if (next) {
      current.current?.mic.getAudioTracks().forEach((t) => (t.enabled = false));
      setMuted(true);
    }
  };
  const stopVisual = async () => {
    const s = current.current;
    if (!s) return;
    const previous = s.visual;
    s.visual = null;
    s.mode = null;
    s.streamInfo = null;
    previous?.getTracks().forEach((t) => t.stop());
    await Promise.all(
      [...s.connections].map(async ([target, c]) => {
        await c.senders[1].replaceTrack(null);
        await c.senders[2].replaceTrack(null);
        await api('voice/signal', {
          peer: s.id,
          target,
          payload: { video: false },
        }).catch(() => {});
      }),
    );
    setVisual(null);
    setMode(null);
    setStreamInfo(null);
  };
  const startVisual = async (
    kind: 'screen' | 'camera',
    quality: StreamQuality = '1080p60',
  ) => {
    const s = current.current;
    if (!s) return;
    if (s.mode === kind) {
      await stopVisual();
      return;
    }
    let stream: MediaStream | undefined;
    try {
      const profile =
        STREAM_QUALITY_OPTIONS.find((option) => option.value === quality) ||
        STREAM_QUALITY_OPTIONS[0];
      stream =
        kind === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({
              video: {
                width: { ideal: profile.width },
                height: { ideal: profile.height },
                frameRate: { ideal: profile.frameRate, max: profile.frameRate },
              },
              audio: true,
            })
          : await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
      if (s.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('A fonte escolhida não tem vídeo.');
      videoTrack.contentHint = kind === 'screen' ? 'detail' : 'motion';
      if (kind === 'screen') {
        await videoTrack
          .applyConstraints({
            width: { ideal: profile.width },
            height: { ideal: profile.height },
            frameRate: { ideal: profile.frameRate, max: profile.frameRate },
          })
          .catch(() => {});
      }
      await stopVisual();
      const settings = videoTrack.getSettings();
      const info: StreamInfo | null =
        kind === 'screen'
          ? {
              quality,
              width: settings.width || profile.width,
              height: settings.height || profile.height,
              frameRate: Math.round(settings.frameRate || profile.frameRate),
            }
          : null;
      s.visual = stream;
      s.mode = kind;
      s.streamInfo = info;
      s.videoBitrate = kind === 'screen' ? profile.bitrate : 2_500_000;
      s.videoFrameRate = kind === 'screen' ? profile.frameRate : 30;
      await Promise.all(
        [...s.connections].map(async ([target, c]) => {
          await c.senders[1].replaceTrack(videoTrack);
          c.senders[1].setStreams(stream!);
          await tuneVideoSender(c.senders[1], s.videoBitrate, s.videoFrameRate);
          await c.senders[2].replaceTrack(stream!.getAudioTracks()[0] || null);
          await api('voice/signal', {
            peer: s.id,
            target,
            payload: { video: true, refreshVideo: true, ...info },
          });
          if (s.id < target && c.pc.signalingState === 'stable') {
            await c.pc.setLocalDescription(await c.pc.createOffer());
            await api('voice/signal', {
              peer: s.id,
              target,
              payload: {
                description: c.pc.localDescription,
                video: true,
                ...info,
              },
            });
          }
          window.setTimeout(async () => {
            if (s.stopped || s.visual !== stream) return;
            const stats = await c.senders[1].getStats().catch(() => null);
            let framesEncoded = 0;
            stats?.forEach((report) => {
              if (
                report.type === 'outbound-rtp' &&
                !report.isRemote &&
                (report.kind === 'video' || report.mediaType === 'video')
              )
                framesEncoded += Number(report.framesEncoded || 0);
            });
            if (framesEncoded > 0) return;
            await c.senders[1].replaceTrack(null).catch(() => {});
            await c.senders[1].replaceTrack(videoTrack).catch(() => {});
            c.senders[1].setStreams(stream!);
            await tuneVideoSender(
              c.senders[1],
              s.videoBitrate,
              s.videoFrameRate,
            );
            await api('voice/signal', {
              peer: s.id,
              target,
              payload: { video: true, refreshVideo: true, ...info },
            }).catch(() => {});
            if (s.id < target && c.pc.signalingState === 'stable') {
              await c.pc.setLocalDescription(await c.pc.createOffer());
              await api('voice/signal', {
                peer: s.id,
                target,
                payload: {
                  description: c.pc.localDescription,
                  video: true,
                  ...info,
                },
              }).catch(() => {});
            }
          }, 5000);
        }),
      );
      stream.getVideoTracks()[0].onended = () => {
        if (s.visual === stream) void stopVisual();
      };
      setVisual(stream);
      setMode(kind);
      setStreamInfo(info);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if ((e as Error).name !== 'NotAllowedError')
        errorRef.current(
          'Não foi possível iniciar o vídeo. Tente outra janela ou câmera.',
        );
    }
  };
  return {
    room,
    peers,
    muted,
    deaf,
    visual,
    mode,
    streamInfo,
    joining,
    join,
    leave,
    toggleMute,
    toggleDeaf,
    startVisual,
    stopVisual,
  };
}
