#!/usr/bin/env python3
import math
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 1.6
STRIKE_HZ = 880.0
ATTACK_SECONDS = 0.002
PEAK = 0.8
OUTPUT = Path(__file__).resolve().parent.parent / "sounds" / "bell.wav"

# (ratio to the strike note, loudness, seconds to fall to 1/e), a bell's inharmonic partials
PARTIALS = [
    (0.5, 0.35, 0.65),
    (1.0, 1.0, 0.5),
    (1.183, 0.55, 0.4),
    (1.506, 0.3, 0.3),
    (2.0, 0.45, 0.22),
    (2.514, 0.2, 0.15),
    (2.662, 0.15, 0.12),
    (3.011, 0.12, 0.09),
]


def sample(time):
    attack = min(time / ATTACK_SECONDS, 1.0)
    fade = min((SECONDS - time) / 0.1, 1.0)
    ring = sum(
        loudness * math.exp(-time / decay) * math.sin(2 * math.pi * STRIKE_HZ * ratio * time)
        for ratio, loudness, decay in PARTIALS
    )
    return attack * fade * ring


samples = [sample(index / RATE) for index in range(int(RATE * SECONDS))]
scale = PEAK / max(abs(value) for value in samples)

OUTPUT.parent.mkdir(exist_ok=True)
with wave.open(str(OUTPUT), "wb") as bell:
    bell.setnchannels(1)
    bell.setsampwidth(2)
    bell.setframerate(RATE)
    bell.writeframes(b"".join(struct.pack("<h", round(value * scale * 32767)) for value in samples))
