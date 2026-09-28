// Browser-only face counter using MediaPipe (loaded on demand).
type Detector = { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: unknown[] } };

let detectorPromise: Promise<Detector> | null = null;

export function loadFaceDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const files = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );
    return (await vision.FaceDetector.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    })) as unknown as Detector;
  })();
  return detectorPromise;
}

export async function countFaces(video: HTMLVideoElement): Promise<number | null> {
  if (video.readyState < 2) return null;
  try {
    const detector = await loadFaceDetector();
    return detector.detectForVideo(video, performance.now()).detections.length;
  } catch {
    return null;
  }
}
