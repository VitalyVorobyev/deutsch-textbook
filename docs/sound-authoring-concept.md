Да. Концепция выглядит очень сильной именно как **отдельный authoring product**, а не просто часть учебника.

Я бы определил продукт так:

> **Synthetic Audio Studio for language-learning scenes** — редактор, в котором диалог, персонажи, голоса, окружение, акустика и звуковые события являются независимыми объектами, а итоговый WAV/MP3 — только результат рендера.

И я **не стал бы сейчас ставить целью “убрать Python и всё экспортировать в ONNX”**. Это хорошая возможная конечная оптимизация, но плохая архитектурная отправная точка.

## 1. Как я вижу сам продукт

Не так:

```text
Text
  ↓
TTS
  ↓
add Stable Audio background
  ↓
WAV
```

а так:

```text
                    SCENE
                      │
      ┌───────────────┼─────────────────┐
      │               │                 │
 Dialogue         Environment         Events
      │               │                 │
      ▼               ▼                 ▼
 Characters      Generated ambience    SFX
 + voices        Stable Audio 3       library /
 + emotion                            generated
      │               │                 │
      └───────────────┼─────────────────┘
                      ▼
                 AUDIO STAGE
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   positioning     acoustics       device FX
   L/R/distance    room/reverb     phone/radio
       │              │              │
       └──────────────┼──────────────┘
                      ▼
                    MIXER
                      │
               loudness / SNR
                      │
                      ▼
                   EXPORT
```

Это принципиально более интересный продукт.

## 2. Generative AI и DSP надо строго разделить

Например, если персонаж говорит по телефону, **не надо просить TTS-модель сгенерировать “telephone voice”**.

Лучше:

```text
Qwen voice
   ↓
clean speech.wav
   ↓
TelephoneEffect
   ├── bandwidth limitation
   ├── EQ
   ├── distortion
   ├── compression
   └── optional line noise
```

То же самое с комнатой:

```text
clean speech
    ↓
position = 3 m away
    ↓
room impulse response
    ↓
reverb
    ↓
background ambience
```

Преимущество огромное: один и тот же speech asset можно использовать как:

```text
normal conversation
telephone conversation
announcement
next room
large hall
car interior
poor Zoom call
```

без повторной генерации голоса.

А самое главное для учебника — это **контролируемо**.

---

# 3. В вашем случае появляется очень хорошая предметная модель

Например:

```yaml
scene:
  id: cafe-order-001
  title: Im Café

environment:
  prompt: >
    Quiet German café, cups and saucers,
    distant espresso machine,
    indistinct customers
  seed: 174829
  level_db: -26

room:
  type: small_cafe
  reverb: 0.35

characters:
  anna:
    voice: anna-v2
    position: [-0.4, 1.2]

  waiter:
    voice: thomas-v1
    position: [0.6, 1.8]

timeline:

  - at: 0.0
    character: anna
    text: "Entschuldigung, können wir bestellen?"

  - at: 2.3
    sfx: cup_on_table
    position: [0.7, 1.0]

  - at: 3.1
    character: waiter
    text: "Natürlich. Was möchten Sie?"

  - at: 6.0
    sfx: espresso_machine
    gain_db: -12
```

Это уже не просто audio file.

Это **сцена, которую можно перерендерить**.

Меняете:

```yaml
difficulty: B1
```

и система может сделать:

```text
background: -28 dB → -20 dB
room reverb: 0.15 → 0.35
speaker overlap: 0 → 150 ms
device: none → telephone
speech rate: 0.95 → 1.05
```

С педагогической точки зрения это особенно интересно: можно независимо контролировать **языковую сложность** и **акустическую сложность**.

---

# 4. UI я бы делал именно как mini-DAW

Tauri + React здесь очень подходит. Tauri 2 рассчитан на desktop/mobile приложения с web frontend и Rust backend, а также умеет bundle'ить sidecar binaries. ([Tauri][1])

Я представляю основной экран примерно так:

```text
┌─────────────────────────────────────────────────────────────┐
│ Scene: Im Café                            ▶ Render   Export │
├─────────────────────────────────────────────────────────────┤
│ CHARACTERS      │ SCRIPT                                      │
│                 │                                             │
│ Anna            │ Anna: Entschuldigung, können wir bestellen?│
│ Thomas          │ Thomas: Natürlich. Was möchten Sie?         │
│                 │                                             │
├─────────────────┴─────────────────────────────────────────────┤
│ TIMELINE                                                      │
│                                                              │
│ Anna      ━━━━━speech━━━━                                     │
│ Thomas               ━━━━━speech━━━━                          │
│ Ambience  ═══════════════════════════════════════════════     │
│ SFX              ● cup              ● espresso               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Scene controls                                               │
│ Room: Café ▾   Noise: -24 dB   Reverb: 0.28   Width: 80%    │
└──────────────────────────────────────────────────────────────┘
```

Но это должна быть **DAW для автора учебника**, а не конкурент Ableton.

То есть никаких сотен knobs.

---

# 5. Три основных режима UI

Я бы сделал их такими.

### Script

Автор работает прежде всего с текстом:

```text
Anna
Guten Morgen. Ich hätte gern einen Kaffee.

Kellner
Gerne. Mit Milch?
```

и назначает персонажей.

### Scene

Окружение:

```text
Location       Café
Ambience       generated
Acoustics      small room
Activity       low
Background     -24 dB
```

и события:

```text
00:04.2  cup placed on table
00:08.4  door opens
00:12.1  espresso machine
```

### Mix

Timeline для ручной доводки.

То есть authoring workflow:

```text
Script → Generate → Listen → Adjust → Export
```

а не:

```text
open DAW → manually build everything
```

---

# 6. Архитектура backend: я бы сделал гибрид

Вот здесь я бы немного изменил ваше направление.

**Не:**

```text
React
   ↓
Rust
   ↓
ONNX everything
```

А:

```text
                React
                  │
               Tauri
                  │
            Rust Core
                  │
       ┌──────────┼──────────┐
       │          │          │
     Audio      Assets     Render
     engine     database    graph
       │
       │          Model API
       │             │
       │      ┌──────┴──────┐
       │      │             │
       ▼      ▼             ▼
      DSP   Qwen TTS    Stable Audio
            worker        worker
              │             │
            Python        Python/
                           native
```

Rust должен владеть **продуктом**, Python — **моделями**.

---

# 7. Что я бы сразу написал на Rust

Очень многое:

```text
Scene model
Timeline
Project serialization
Asset management
Caching
Dependency graph
Audio mixing
Resampling
Gain
Pan
EQ
Filters
Compression
Convolution reverb
Telephone/radio effects
Fade/crossfade
Normalization
Export
Render scheduling
```

То есть:

```text
Rust = audio workstation
```

Python:

```text
Python = model host
```

---

# 8. Python не обязательно означает HTTP backend

Это важный момент.

Tauri умеет запускать внешние binaries как **sidecars**, поэтому Python model host можно упаковать вместе с desktop application. ([Tauri][1])

Например:

```text
Tauri application
│
├── studio-ui
├── studio-core        Rust
│
└── model-worker
     ├── Python runtime
     ├── Qwen
     └── Stable Audio
```

Communication:

```text
Rust
 ↓
JSON RPC / stdin-stdout / localhost IPC
 ↓
Python worker
```

API:

```text
generate_speech(...)
generate_ambience(...)
generate_sfx(...)
```

Rust вообще не должен знать, что внутри PyTorch.

Это даёт критически важную свободу:

сегодня:

```text
Qwen → PyTorch
```

через год:

```text
Qwen → ONNX
```

а UI и project format не меняются.

---

# 9. Почему я пока не стал бы делать ONNX migration

ONNX Runtime сам по себе вполне подходит для Rust/cross-platform inference: он поддерживает Windows, Linux, macOS и execution providers, включая CoreML на Apple. Rust API у ONNX Runtime существует, хотя официальная документация называет его community API. ([ONNX Runtime][2])

Но проблема не ONNX Runtime.

Проблема:

> **насколько конкретная generative model хорошо превращается в стабильный ONNX inference graph.**

Qwen3-TTS сейчас официально распространяется как Python/PyTorch package и использует Transformers; официальный проект поддерживает voice cloning, voice design и streaming. ([GitHub][3])

Я сейчас **не вижу официального ONNX deployment pipeline для Qwen3-TTS** в документации проекта. Поэтому я бы не делал ONNX обязательной архитектурной зависимостью.

---

# 10. Со Stable Audio ситуация даже интереснее

Stable Audio 3 Small-SFX уже имеет официальные optimized backends.

В частности, Stability предоставляет:

```text
PyTorch
MLX → Apple Silicon
LiteRT/TFLite → portable CPU
```

Small-SFX — 433M parameters, рассчитан на lightweight SFX inference и поддерживает до 120 секунд. ([GitHub][4])

Для вашего Mac есть официальная MLX implementation. ([GitHub][5])

А portable LiteRT/TFLite версия вообще не требует PyTorch/Transformers runtime и предназначена для macOS/Linux/Windows CPU inference. ([GitHub][6])

Поэтому я бы даже **не стал обязательно конвертировать Stable Audio в ONNX**.

Можно иметь:

```text
trait SoundGenerator {
    generate(request) -> AudioAsset;
}
```

и implementations:

```text
StableAudioPython
StableAudioMLX
StableAudioLiteRT
StableAudioRemote
```

---

# 11. Самое важное архитектурное понятие — Render Graph

Я бы построил продукт вокруг этого.

Например:

```text
                     Scene
                       │
            ┌──────────┴─────────┐
            │                    │
        Speech Anna         Speech Thomas
            │                    │
        Qwen node            Qwen node
            │                    │
      Anna.wav                Thomas.wav
            │                    │
       Room FX                 Phone FX
            │                    │
            └─────────┬──────────┘
                      │
               Dialogue bus
                      │
                      ├──────── Ambience generator
                      │
                      ├──────── Event SFX
                      │
                      ▼
                  Master mix
                      │
                  Normalize
                      │
                     WAV
```

Каждый node имеет hash:

```text
hash(
    model,
    model_version,
    prompt,
    voice,
    seed,
    parameters
)
```

и результат кешируется.

Изменили:

```text
master_gain
```

→ TTS не запускается.

Изменили:

```text
Anna line #3
```

→ перегенерируется только одна реплика.

Изменили:

```text
cafe ambience seed
```

→ только background.

Это будет иметь огромное значение для UX.

---

# 12. Я бы сохранял stems навсегда

Проект:

```text
scene/
├── scene.json
├── assets/
│   ├── speech/
│   │   ├── anna_001.wav
│   │   ├── thomas_001.wav
│   │   └── ...
│   ├── ambience/
│   │   └── cafe_174829.wav
│   └── sfx/
│       ├── cup_001.wav
│       └── door_003.wav
└── renders/
    ├── clean.wav
    ├── exercise-a1.wav
    └── exercise-b1.wav
```

И итоговый файл никогда не становится source of truth.

---

# 13. Seed здесь — часть контента

Я бы обязательно сохранял:

```text
model
model version/hash
seed
prompt
negative prompt
generation parameters
source voice/reference hash
post-processing parameters
```

То есть любое упражнение должно быть **reproducible build artifact**.

Пример:

```json
{
  "generator": "stable-audio-3-small-sfx",
  "model_revision": "...",
  "seed": 2841824,
  "prompt": "...",
  "duration": 32.0
}
```

Это особенно ценно, если через полгода понадобится заменить одну сцену или пересобрать весь textbook.

---

# 14. Я бы ещё ввёл понятие Voice Character

Не просто:

```text
voice.wav
```

а:

```text
Character
├── identity
├── name
├── gender/age metadata
├── language
├── voice model
├── voice seed
├── reference audio
├── default speaking rate
├── default emotion
└── pronunciation overrides
```

Например:

```yaml
id: anna
display_name: Anna
language: de-DE

voice:
  engine: qwen3-tts
  model: 1.7B
  reference: anna-reference.wav
  seed: 49329

defaults:
  speed: 1.0
  style: friendly-neutral
```

Тогда Anna остаётся Anna во всём учебнике.

---

# 15. Следующий уровень — acoustic profiles

Например:

```text
Studio
Small room
Kitchen
Café
Restaurant
Railway station
Car
Street
Telephone
Mobile phone
Public announcement
Next room
```

Но это **не generative presets**.

Это DSP profiles.

Например:

```yaml
telephone:
  highpass: 300 Hz
  lowpass: 3400 Hz
  compression: ...
  distortion: ...
  mono: true
```

А:

```yaml
large_room:
  impulse_response: ...
  wet: 0.25
  predelay: ...
```

---

# 16. И здесь появляется очень хорошая функция именно для учебника

**Acoustic difficulty presets.**

Например:

### Clean

```text
background       -35 dB
reverb           minimal
overlap          none
speech clarity   maximum
```

### Natural

```text
background       -25 dB
normal room
occasional SFX
```

### Challenging

```text
background       -18 dB
moderate reverb
speaker overlap
greater distance
```

Один и тот же диалог:

```text
A1 listening
B1 listening
B2 listening
```

можно постепенно делать акустически сложнее **не меняя текст**.

Для вашего textbook product это, на мой взгляд, одна из наиболее сильных возможностей всей системы.

---

# 17. Что с web version

Я бы проектировал так:

```text
                 React UI
                    │
            shared frontend
              ┌─────┴─────┐
              │           │
           Browser      Tauri
              │           │
              │         Rust core
              │
        Remote engine    Local engine
```

То есть frontend действительно общий.

Но **web version я бы не заставлял запускать Qwen + Stable Audio непосредственно в browser**.

ONNX Runtime действительно имеет Web runtime, так что небольшие ONNX models могут выполняться прямо в браузере. ([ONNX Runtime][7])

Но для вашей студии я бы воспринимал browser inference как future optimization.

Web:

```text
React → API → GPU worker
```

Desktop:

```text
React → Tauri → local inference
```

---

# 18. Как бы я разделил repository

Например:

```text
audio-studio/
│
├── apps/
│   ├── desktop/
│   │   └── Tauri + React
│   │
│   └── web/
│       └── React
│
├── crates/
│   ├── studio-model/
│   ├── studio-audio/
│   ├── studio-render/
│   ├── studio-effects/
│   └── studio-project/
│
├── frontend/
│   └── shared React UI
│
└── model-workers/
    └── python/
        ├── qwen_tts/
        ├── stable_audio/
        └── server/
```

И API boundary:

```rust
trait SpeechGenerator {
    fn generate(&self, request: SpeechRequest)
        -> Result<AudioAsset>;
}

trait SoundGenerator {
    fn generate(&self, request: SoundRequest)
        -> Result<AudioAsset>;
}
```

Backend implementation при этом может быть чем угодно.

---

# 19. Я бы строил продукт в таком порядке

Не пытался бы сразу сделать всё.

### V0 — scene renderer

```text
script
characters
Qwen voices
Stable Audio ambience
simple mixer
export WAV
```

Это уже продукт.

### V1 — authoring studio

Добавить:

```text
timeline
regenerate individual line
waveform
SFX events
gain/pan
project persistence
render cache
```

### V2 — acoustic simulation

```text
room presets
telephone
radio
distance
convolution reverb
EQ/compression
acoustic difficulty
```

### V3 — intelligent authoring

Например:

```text
Scene:
"Anna orders coffee at a busy café."
```

↓

LLM предлагает:

```text
ambience: cafe
SFX:
  00:02 cup
  00:07 espresso machine

room: small cafe
```

Автор нажимает Generate.

### V4 — batch textbook production

```text
Unit 1
 ├── Scene 1
 ├── Scene 2
 └── Scene 3

Generate all
```

и:

```text
A1-clean
A1-natural
B1-natural
B1-difficult
```

---

# 20. И только потом я бы решал проблему Python

После появления benchmarks:

```text
startup time
package size
RAM
generation latency
distribution complexity
GPU compatibility
```

можно принимать решение по каждой модели отдельно.

Например:

| Component            | Сегодня        | Возможное будущее           |
| -------------------- | -------------- | --------------------------- |
| Qwen TTS             | Python/PyTorch | ONNX/native если оправдано  |
| Stable Audio Mac     | MLX/Python     | MLX native wrapper / LiteRT |
| Stable Audio Windows | Python         | LiteRT / ONNX               |
| DSP                  | **Rust**       | Rust                        |
| Mixer                | **Rust**       | Rust                        |
| Project model        | **Rust**       | Rust                        |
| UI                   | React          | React                       |
| Desktop shell        | Tauri          | Tauri                       |

То есть я бы **не ставил “100% Rust backend” как продуктовую цель**.

Я бы поставил:

> **100% Rust orchestration/audio engine, model-runtime agnostic inference layer.**

Тогда Python постепенно может исчезнуть сам, если это действительно окажется выгодно.

---

## Архитектура, которую я бы выбрал сейчас

```text
                         React
                           │
                        Tauri 2
                           │
                   ┌──── Rust Core ────┐
                   │                   │
              Project/Scene       Render Graph
                   │                   │
             Asset Manager          Cache
                   │                   │
                   ├──── Audio Engine ─┤
                   │        │          │
                   │       DSP         │
                   │                   │
                   └── Model Gateway ──┘
                           │
               ┌───────────┴───────────┐
               │                       │
          Speech Engine           Sound Engine
               │                       │
           Qwen worker             Stable Audio
               │                       │
          Python now            MLX/Python now
          native later           native later
```

И для меня здесь самое важное: **проектировать не вокруг Qwen, Stable Audio, ONNX или Python, а вокруг `Scene → Render Graph → Assets → Mix`**. Тогда модели становятся заменяемыми plugins, а сама студия переживёт несколько поколений моделей.

Такой дизайн, на мой взгляд, достаточно устойчив, чтобы начать с него реальную разработку продукта.

[1]: https://v2.tauri.app/develop/sidecar/?utm_source=chatgpt.com "Embedding External Binaries - Tauri"
[2]: https://onnxruntime.ai/?utm_source=chatgpt.com "ONNX Runtime | Home"
[3]: https://github.com/QwenLM/Qwen3-TTS?utm_source=chatgpt.com "Qwen3-TTS is an open-source series ..."
[4]: https://github.com/Stability-AI/stable-audio-3?utm_source=chatgpt.com "Stability-AI/stable-audio-3 - GitHub"
[5]: https://github.com/Stability-AI/stable-audio-3/blob/main/optimized/mlx/README.md?utm_source=chatgpt.com "stable-audio-3/optimized/mlx/README.md at main - GitHub"
[6]: https://github.com/Stability-AI/stable-audio-3/blob/main/optimized/tflite/README.md?utm_source=chatgpt.com "stable-audio-3/optimized/tflite/README.md at main · Stability-AI ..."
[7]: https://onnxruntime.ai/docs/install/?utm_source=chatgpt.com "Install ONNX Runtime | onnxruntime"
