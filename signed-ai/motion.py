import cv2
import mediapipe as mp
import numpy as np

# Pose upper body, both hands, and facial expression landmarks. Keep image
# coordinates for playback. Zero denotes missing landmarks.
BODY = [0, 11, 12, 13, 14, 15, 16]
FACE = [33, 133, 159, 145, 362, 263, 386, 374, 70, 105, 334, 300, 61, 291, 13, 14]
POINTS = 65
def extract(path):
    video = cv2.VideoCapture(str(path))
    fps = video.get(cv2.CAP_PROP_FPS)
    if not np.isfinite(fps) or fps <= 0:
        video.release()
        raise ValueError("Unreadable video")
    frames, seen = [], 0
    try:
        with mp.solutions.holistic.Holistic(model_complexity=1) as tracker:
            index = 0
            while True:
                ok, frame = video.read()
                if not ok:
                    break
                index += 1
                if (index - 1) / fps + 1e-6 < len(frames) / 12:
                    continue
                result = tracker.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                seen += bool(result.left_hand_landmarks or result.right_hand_landmarks)
                points = []
                for group, ids in [(result.pose_landmarks, BODY), (result.left_hand_landmarks, range(21)), (result.right_hand_landmarks, range(21)), (result.face_landmarks, FACE)]:
                    for i in ids:
                        p = group.landmark[i] if group else None
                        points.extend([p.x, p.y, p.z] if p else [0., 0., 0.])
                frames.append(points)
                if len(frames) > 720:
                    raise ValueError("Split clips into utterances under 60 seconds")
    finally:
        video.release()
    if len(frames) < 3 or seen < max(2, len(frames) // 5):
        raise ValueError("Too few tracked hand frames")
    return np.asarray(frames, dtype=np.float32)
