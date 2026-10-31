#!/usr/bin/env python3
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
PEAK = 0.8
OUTPUT = Path(__file__).resolve().parent.parent / "sounds"


def tone(hz, time):
    return math.sin(2 * math.pi * hz * time)


def cannon():
    noise = random.Random(1)
    rumble = 0.0
    samples = []
    for index in range(int(RATE * 1.1)):
        time = index / RATE
        rumble += 0.15 * (noise.uniform(-1, 1) - rumble)
        # the pitch falls from 280 Hz to 110 Hz, since laptop speakers lose anything much lower
        thump = math.sin(2 * math.pi * (110 * time + 170 * 0.05 * (1 - math.exp(-time / 0.05))))
        crack = noise.uniform(-1, 1) * math.exp(-time / 0.015)
        samples.append(
            1.0 * thump * math.exp(-time / 0.22) + 3.0 * rumble * math.exp(-time / 0.35) + 0.5 * crack
        )
    return samples


def horn():
    seconds = 1.3
    samples = []
    for index in range(int(RATE * seconds)):
        time = index / RATE
        swell = min(time / 0.12, 1.0) * min((seconds - time) / 0.25, 1.0)
        chord = sum(
            loudness * tone(hz * harmonic, time)
            for hz in (146.8, 220.0)
            for harmonic, loudness in ((1, 1.0), (2, 0.55), (3, 0.35), (4, 0.18), (5, 0.08))
        )
        samples.append(swell * chord)
    return samples


def alarm():
    seconds = 1.05
    beat = 0.175
    samples = []
    for index in range(int(RATE * seconds)):
        time = index / RATE
        hz = 880.0 if int(time / beat) % 2 == 0 else 660.0
        edge = min(time % beat, beat - time % beat) / 0.004
        samples.append(min(edge, 1.0) * (tone(hz, time) + 0.4 * tone(hz * 3, time)))
    return samples


def write(name, samples):
    scale = PEAK / max(abs(value) for value in samples)
    with wave.open(str(OUTPUT / name), "wb") as sound:
        sound.setnchannels(1)
        sound.setsampwidth(2)
        sound.setframerate(RATE)
        sound.writeframes(b"".join(struct.pack("<h", round(value * scale * 32767)) for value in samples))


OUTPUT.mkdir(exist_ok=True)
write("cannon.wav", cannon())
write("horn.wav", horn())
write("alarm.wav", alarm())
