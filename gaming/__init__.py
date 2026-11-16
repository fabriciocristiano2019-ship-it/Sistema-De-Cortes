"""OpenShorts Gaming Edition: local, game-agnostic highlight detection.

Modules:
- profiles: genre categories, signal weights and PT-BR/EN keyword lexicons.
- signals:  audio/visual feature extraction with ffmpeg + numpy (no GPU, no API).
- moments:  turns features + transcript into scored, evidence-backed clips.
- library:  the game library (JSON store under OUTPUT_DIR/gaming).
"""
