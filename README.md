# Resonance Field

Resonance Field is a single-page, audio-reactive 3D particle visualizer built with raw HTML, vanilla JavaScript, Three.js, custom GLSL shaders, and the HTML5 Web Audio API.

The visualizer captures live browser tab or system audio, analyzes bass, mid, and treble energy, and uses those bands to drive a glowing 32,000-particle field.

## Features

- Live tab or system audio capture through `navigator.mediaDevices.getDisplayMedia`
- Live microphone input through `navigator.mediaDevices.getUserMedia`
- Bass, mid, and treble frequency analysis with frame-by-frame smoothing
- Bass-driven cloud expansion, pulse movement, and impulse bursts
- Mid-driven simplex-noise turbulence and structural displacement
- Treble-driven particle jitter, brightness, and color response
- Custom vertex and fragment shaders for soft circular particles
- Three.js `OrbitControls` for rotation, pan, and zoom
- `EffectComposer` with `UnrealBloomPass` for neon glow
- Cyberpunk, Deep Space, and Solar Flare themes
- Per-band sensitivity controls
- Adjustable particle count (8,000-50,000), particle size, motion speed, and bloom glow
- Reset controls for sensitivity and visual settings
- Hideable controls panel with a persistent show button
- Sphere, vertical circular plane, and torus particle field shapes
- The circular plane contracts to a central vertical line in silence and activates from the center as audio rises
- The vertical circular plane uses lighter defaults: 16,000 particles, 0.5x size, 1x motion, and 0.4x glow
- Optional Auto shape mode with random next-form selection and smooth particle/visual transitions
- Auto shape Keep and Transition timing sliders revealed when that mode is enabled
- Optional automatic atmosphere mode with random next-theme selection and configurable color Keep and Transition timing sliders
- Optional audio monitoring with an echo- and microphone-feedback-prevention toggle
- Live capture status and FPS indicators
- Responsive full-window rendering

## Running locally

Browser screen, tab, and microphone capture require a secure context. Use `localhost` or HTTPS rather than opening the file directly with `file://`.

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

1. Click **Capture Browser/System Audio**, choose a browser tab or screen, and enable **Share tab audio** or the equivalent system-audio option.
2. Alternatively, click **Use Microphone** and allow microphone permission when prompted.
3. Use the **Bass**, **Mids**, and **Treble** sliders to adjust the response.
4. Adjust **Particles**, **Size**, **Motion**, and **Glow** to tune the visual output.
5. Choose a **Sphere**, **Vertical circular plane**, or **Torus vortex** field shape.
6. Enable **Auto shape** to randomly move between the three forms using smooth geometry and visual transitions. Use the revealed **Keep** and **Transition** sliders to control its timing.
7. Enable **Auto atmosphere** to randomly move between the theme palettes, then use its revealed **Keep** and **Transition** sliders to control color timing.
8. Use **Reset sliders** or **Reset visuals** to restore their numeric defaults; **Reset visuals** uses the current shape's defaults and preserves shape and atmosphere modes.
9. Drag the particle field to orbit it.

The **Monitor input audio** option routes the selected input back to the speakers. Disable it if the browser is already playing the source locally and you hear an echo; keep it disabled for microphone input unless you intentionally want live monitoring, because speakers can feed back into the microphone. Disabling monitoring does not stop analysis.

Use **Hide panel** to clear the controls from the canvas. The floating **Show panel** button remains available so the controls can be restored.

## Project structure

```text
.
├── index.html                     # Application markup and CDN import map
├── styles.css                     # Glassmorphism UI and responsive layout
├── src/
│   ├── main.js                    # Three.js scene, audio engine, and controls
│   └── shaders/
│       ├── particle.vert.glsl     # Audio-reactive particle vertex shader
│       └── particle.frag.glsl     # Glowing particle fragment shader
└── README.md                      # Setup and usage documentation
```

The project intentionally has no build step. `src/main.js` loads the shader files with `fetch`, so the app must be served over `localhost` or HTTPS.

## Browser notes

- Use a current desktop browser with `getDisplayMedia`, `getUserMedia`, and Web Audio API support.
- Permission prompts and available audio options vary by browser and operating system.
- Selecting a source without enabling its audio-sharing option produces a friendly no-audio notice.
- Microphone input requires granting microphone permission and may be affected by the browser's input processing settings.
- Canceling the permission dialog leaves the visualizer idle and ready for another attempt.
- The screen-sharing video track is requested to satisfy the capture API, but it is not displayed; only its audio track is analyzed.
