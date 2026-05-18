import sounddevice as sd
from scipy.io.wavfile import write
import numpy as np
import sys
import queue

fs = 16000
q = queue.Queue()

def callback(indata, frames, time, status):
    if status:
        pass # ignore status for now
    q.put(indata.copy())

def main():
    print("READY", flush=True)
    try:
        with sd.InputStream(samplerate=fs, channels=1, dtype='int16', callback=callback):
            # Wait until we receive a newline from Node.js
            sys.stdin.readline()
    except Exception as e:
        print(f"Error: {e}")

    frames = []
    while not q.empty():
        frames.append(q.get())

    if len(frames) > 0:
        recording = np.concatenate(frames, axis=0)
        write('user_input.wav', fs, recording)
        print("SAVED", flush=True)
    else:
        print("NO_FRAMES", flush=True)

if __name__ == "__main__":
    main()
