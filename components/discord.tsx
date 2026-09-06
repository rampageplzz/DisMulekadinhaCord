'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
export function Avatar({
  user,
  size = 36,
}: {
  user: { name: string; color?: string };
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{
        background: user.color || '#5865f2',
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {user.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      className={'icon-button ' + (active ? 'is-active ' : '') + className}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Media({
  stream,
  muted = false,
  video = false,
}: {
  stream?: MediaStream;
  muted?: boolean;
  video?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null),
    audioRef = useRef<HTMLAudioElement>(null),
    [blocked, setBlocked] = useState(false),
    [waiting, setWaiting] = useState(video);
  useEffect(() => {
    const videoElement = videoRef.current,
      audioElement = audioRef.current;
    setBlocked(false);
    setWaiting(video && !!stream);
    const bind = () => {
      if (!stream) return;
      if (videoElement) {
        videoElement.srcObject = new MediaStream(stream.getVideoTracks());
        videoElement.play().catch(() => {});
      }
      if (audioElement) {
        audioElement.srcObject = new MediaStream(stream.getAudioTracks());
        audioElement.play().catch(() => setBlocked(true));
      }
    };
    bind();
    const retry = () => {
      bind();
      videoElement?.play().catch(() => {});
      audioElement?.play().catch(() => setBlocked(true));
    };
    stream?.addEventListener('addtrack', retry);
    stream
      ?.getTracks()
      .forEach((track) => track.addEventListener('unmute', retry));
    return () => {
      stream?.removeEventListener('addtrack', retry);
      stream
        ?.getTracks()
        .forEach((track) => track.removeEventListener('unmute', retry));
      if (videoElement) videoElement.srcObject = null;
      if (audioElement) audioElement.srcObject = null;
    };
  }, [stream, video]);
  return (
    <>
      {video && (
        <>
          {/* Live peer media has no prerecorded caption track. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="media-video"
            onPlaying={() => setWaiting(false)}
            onWaiting={() => setWaiting(true)}
          />
        </>
      )}
      {/* Live peer audio has no prerecorded caption track. */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} autoPlay muted={muted} className="media-audio" />
      {waiting && (
        <output className="media-waiting">
          Aguardando imagem…
        </output>
      )}
      {blocked && (
        <button
          className="primary media-unlock"
          onClick={() => {
            audioRef.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => {});
          }}
        >
          Ativar áudio
        </button>
      )}
    </>
  );
}
export function FullscreenButton() {
  const ref = useRef<HTMLButtonElement>(null),
    [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => {
      const tile = ref.current?.closest('.voice-tile');
      setFullscreen(!!tile && document.fullscreenElement === tile);
    };
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  return (
    <button
      ref={ref}
      className="fullscreen-button"
      title={fullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
      aria-label={fullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
      onClick={() => {
        const tile = ref.current?.closest('.voice-tile') as HTMLElement | null;
        if (document.fullscreenElement) void document.exitFullscreen();
        else if (tile) void tile.requestFullscreen();
      }}
    >
      {fullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
    </button>
  );
}
export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-inner">
        <IconButton className="modal-close" label="Fechar" onClick={onClose}>
          <X />
        </IconButton>
        {children}
      </div>
    </dialog>
  );
}
export function FormError({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
