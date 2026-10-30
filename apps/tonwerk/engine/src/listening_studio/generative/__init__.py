"""Generative models, and nothing else.

Everything in this subpackage asks a model for audio, or says which model a stored name selects
(`registry`). Everything that *processes* audio — pace, resampling, placement, mixing, loudness —
lives in `dsp` and `graph`, because the moment a "telephone voice" is asked of a TTS model instead
of applied as a filter, the same speech has to be regenerated for every acoustic variant it
appears in.

Import from the submodule, never from here: `qwen.py` reaches for torch and `locks.py` reaches
for the filesystem, and a test suite that only needs `FakeSpeech` must pay for neither.
"""
