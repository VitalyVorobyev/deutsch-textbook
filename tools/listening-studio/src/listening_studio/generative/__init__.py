"""Generative models, and nothing else.

Everything in this subpackage asks a model for audio. Everything that *processes* audio —
pace, resampling, concatenation, mixing, loudness — stays in `adapters.py`, because the moment
a "telephone voice" is asked of a TTS model instead of applied as a filter, the same speech has
to be regenerated for every acoustic variant it appears in.

Import from the submodule, never from here: `qwen.py` reaches for torch and `locks.py` reaches
for the filesystem, and a test suite that only needs `FakeSpeech` must pay for neither.
"""
