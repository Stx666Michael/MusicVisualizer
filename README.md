# Resonance Field

Resonance Field is a single-page, audio-reactive 3D particle visualizer built with raw HTML, vanilla JavaScript, Three.js, custom GLSL shaders, and the HTML5 Web Audio API.

The visualizer captures live browser tab or system audio, analyzes bass, mid, and treble energy, and uses those bands to drive a glowing 32,000-particle field.

## Features

- Live tab or system audio capture through `navigator.mediaDevices.getDisplayMedia`
- Bass, mid, and treble frequency analysis with frame-by-frame smoothing
- Bass-driven cloud expansion, pulse movement, and impulse bursts
- Mid-driven simplex-noise turbulence and structural displacement
- Treble-driven particle jitter, brightness, and color response
- Custom vertex and fragment shaders for soft circular particles
- Three.js `OrbitControls` for rotation, pan, and zoom
- `EffectComposer` with `UnrealBloomPass` for neon glow
- Cyberpunk, Deep Space, and Solar Flare themes
- Per-band sensitivity controls
- Optional audio monitoring with an echo-prevention toggle
- Live capture status and FPS indicators
- Responsive full-window rendering

## Running locally

Browser screen and tab capture requires a secure context. Use `localhost` or HTTPS rather than opening the file directly with `file://`.

### Python

From the project directory, run:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

### Node.js

If `npx` is available, run:

```bash
npx serve .
```

Open the local URL printed by the server.

The page loads Three.js and its post-processing modules from jsDelivr, so an internet connection is required unless those CDN imports are replaced with local copies.

## Using the visualizer

1. Click **Capture Browser/System Audio**.
2. Choose a browser tab or screen in the sharing dialog.
3. Enable **Share tab audio** or the equivalent system-audio option.
4. Use the **Bass**, **Mids**, and **Treble** sliders to adjust the response.
5. Select a theme and drag the particle field to orbit it.

The **Monitor captured audio** option routes the captured stream back to the speakers. Disable it if the browser is already playing the source locally and you hear an echo. Disabling monitoring does not stop analysis.

## Project structure

```text
.
├── index.html   # Complete application: markup, styles, JavaScript, and GLSL
└── README.md    # Setup and usage documentation
```

## Browser notes

- Use a current desktop browser with `getDisplayMedia` and Web Audio API support.
- Permission prompts and available audio options vary by browser and operating system.
- Selecting a source without enabling its audio-sharing option produces a friendly no-audio notice.
- Canceling the permission dialog leaves the visualizer idle and ready for another attempt.
- The screen-sharing video track is requested to satisfy the capture API, but it is not displayed; only its audio track is analyzed.
