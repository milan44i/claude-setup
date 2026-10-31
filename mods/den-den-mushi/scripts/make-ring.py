#!/usr/bin/env python3
import math
import struct
import wave
from pathlib import Path

RATE = 22050
PEAK = 0.7
LOW_HZ = 760.0
HIGH_HZ = 1010.0
WARBLE_HZ = 18.0
BURST_SECONDS = 0.34
GAP_SECONDS = 0.1
EDGE_SECONDS = 0.015
BURSTS = 2
OUTPUT = Path(__file__).resolve().parent.parent / "sounds" / "ring.wav"


def burst():
    phase = 0.0
    samples = []
    for index in range(int(RATE * BURST_SECONDS)):
        time = index / RATE
        is_high = math.sin(2 * math.pi * WARBLE_HZ * time) >= 0
        phase += 2 * math.pi * (HIGH_HZ if is_high else LOW_HZ) / RATE
        edge = min(time, BURST_SECONDS - time, EDGE_SECONDS) / EDGE_SECONDS
        samples.append(edge * math.sin(phase))
    return samples


silence = [0.0] * int(RATE * GAP_SECONDS)
samples = (burst() + silence) * BURSTS

OUTPUT.parent.mkdir(exist_ok=True)
with wave.open(str(OUTPUT), "wb") as ring:
    ring.setnchannels(1)
    ring.setsampwidth(2)
    ring.setframerate(RATE)
    ring.writeframes(b"".join(struct.pack("<h", round(value * PEAK * 32767)) for value in samples))
