/** Keeps a stable recorded canvas/audio stream while camera hardware is reconnected. */
export class SessionMedia {
  private stream: MediaStream | null = null;
  private canvas = document.createElement('canvas');
  private video = document.createElement('video');
  private audio = new AudioContext();
  private destination = this.audio.createMediaStreamDestination();
  private source: MediaStreamAudioSourceNode | null = null;
  private frame = 0;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private recorded: Blob | null = null;
  onDisconnect?: () => void;

  constructor() {
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.video.muted = true;
    this.video.playsInline = true;
  }

  get preview() { return this.video; }
  get speechAudio() { return { context: this.audio, destination: this.destination }; }
  get healthy() { return !!this.stream && this.stream.getVideoTracks().some(t => t.readyState === 'live' && !t.muted && t.enabled) && this.stream.getAudioTracks().some(t => t.readyState === 'live' && !t.muted && t.enabled); }
  get active() { return this.recorder?.state === 'recording'; }

  async connect() {
    const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } });
    if (!next.getVideoTracks().length || !next.getAudioTracks().length) { next.getTracks().forEach(t => t.stop()); throw new Error('A camera and microphone are both required.'); }
    this.source?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = next;
    for (const track of next.getTracks()) {
      track.addEventListener('ended', () => { if (this.stream === next) this.onDisconnect?.(); });
      track.addEventListener('mute', () => { if (this.stream === next) this.onDisconnect?.(); });
      track.addEventListener('unmute', () => { if (this.stream === next) this.onDisconnect?.(); });
    }
    this.video.srcObject = next;
    await this.video.play();
    await this.audio.resume();
    this.source = this.audio.createMediaStreamSource(next);
    this.source.connect(this.destination);
    const draw = () => {
      if (this.video.readyState >= 2) this.canvas.getContext('2d')?.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      this.frame = requestAnimationFrame(draw);
    };
    if (!this.frame) draw();
  }

  start() {
    const canvasStream = this.canvas.captureStream(24);
    const stream = new MediaStream([...canvasStream.getVideoTracks(), ...this.destination.stream.getAudioTracks()]);
    const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw new Error('This browser cannot record the session. Try Chrome or Edge.');
    this.recorder = new MediaRecorder(stream, { mimeType });
    this.chunks = [];
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start(1000);
  }
  pause() { if (this.recorder?.state === 'recording') this.recorder.pause(); }
  resume() { if (this.recorder?.state === 'paused') this.recorder.resume(); }
  async stop() {
    if (!this.recorder) return this.recorded;
    const recorder = this.recorder;
    if (recorder.state !== 'inactive') await new Promise<void>(resolve => { recorder.addEventListener('stop', () => resolve(), { once: true }); recorder.stop(); });
    this.recorded = new Blob(this.chunks, { type: recorder.mimeType });
    this.recorder = null;
    return this.recorded;
  }
  async dispose() {
    await this.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(this.frame);
    this.video.srcObject = null;
    this.source?.disconnect();
    await this.audio.close();
  }
}
