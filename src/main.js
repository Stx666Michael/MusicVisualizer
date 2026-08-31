    import * as THREE from "three";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";
    import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
    import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
    import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

    const MAX_PARTICLE_COUNT = 50000;
    const MAX_PIXEL_RATIO = 2;
    const BASE_POINT_SIZE = 0.055;
    const DEFAULT_SENSITIVITY = Object.freeze({
      bass: 1.55,
      mid: 1.2,
      treble: 1.4
    });
    const DEFAULT_VISUALS = Object.freeze({
      particleCount: 32000,
      particleSize: 1,
      motion: 1,
      glow: 1
    });
    const SHAPE_VISUAL_DEFAULTS = Object.freeze({
      sphere: Object.freeze({ ...DEFAULT_VISUALS }),
      plane: Object.freeze({
        particleCount: 16000,
        particleSize: 0.5,
        motion: 1,
        glow: 0.4
      }),
      torus: Object.freeze({ ...DEFAULT_VISUALS })
    });
    const DEFAULT_SHAPE = "sphere";
    const SHAPE_VALUES = Object.freeze({
      sphere: 0,
      plane: 1,
      torus: 2
    });
    const THEME_ORDER = ["cyberpunk", "deep-space", "solar-flare"];

    const ui = {
      startCapture: document.getElementById("startCapture"),
      stopCapture: document.getElementById("stopCapture"),
      controlsPanel: document.getElementById("controlsPanel"),
      panelToggle: document.getElementById("panelToggle"),
      resetSliders: document.getElementById("resetSliders"),
      resetVisuals: document.getElementById("resetVisuals"),
      shapeSelect: document.getElementById("shapeSelect"),
      autoAtmosphere: document.getElementById("autoAtmosphere"),
      audioDot: document.getElementById("audioDot"),
      statusLabel: document.getElementById("statusLabel"),
      sourceLabel: document.getElementById("sourceLabel"),
      notice: document.getElementById("notice"),
      monitorAudio: document.getElementById("monitorAudio"),
      fpsValue: document.getElementById("fpsValue"),
      particleCountValue: document.getElementById("particleCountValue"),
      sliders: {
        bass: document.getElementById("bassSensitivity"),
        mid: document.getElementById("midSensitivity"),
        treble: document.getElementById("trebleSensitivity")
      },
      sliderValues: {
        bass: document.getElementById("bassValue"),
        mid: document.getElementById("midValue"),
        treble: document.getElementById("trebleValue")
      },
      visualSliders: {
        particleCount: document.getElementById("particleCount"),
        particleSize: document.getElementById("particleSize"),
        motion: document.getElementById("motionSpeed"),
        glow: document.getElementById("glowStrength")
      },
      visualSliderValues: {
        particleCount: document.getElementById("particleCountDisplay"),
        particleSize: document.getElementById("particleSizeDisplay"),
        motion: document.getElementById("motionSpeedDisplay"),
        glow: document.getElementById("glowStrengthDisplay")
      },
      themeButtons: [...document.querySelectorAll(".theme-button")]
    };

    async function loadShader(shaderPath) {
      const response = await fetch(new URL(shaderPath, import.meta.url));
      if (!response.ok) {
        throw new Error(`Unable to load shader ${shaderPath}: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }

    let vertexShader;
    let fragmentShader;
    try {
      [vertexShader, fragmentShader] = await Promise.all([
        loadShader("./shaders/particle.vert.glsl"),
        loadShader("./shaders/particle.frag.glsl")
      ]);
    } catch (error) {
      ui.notice.className = "notice error";
      ui.notice.textContent = "Shader files could not be loaded. Run the project from localhost or HTTPS.";
      console.error("Shader loading failed:", error);
      throw error;
    }
    const settings = {
      sensitivity: { ...DEFAULT_SENSITIVITY },
      visuals: { ...DEFAULT_VISUALS, autoAtmosphere: false },
      audio: {
        bass: 0,
        mid: 0,
        treble: 0,
        previousBass: 0,
        impulse: 0
      }
    };

    let captureStream = null;
    let audioContext = null;
    let mediaSource = null;
    let analyser = null;
    let monitorGain = null;
    let frequencyData = null;
    let captureBusy = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.05, 4.7);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-label", "Interactive audio-reactive particle visualizer");
    document.getElementById("app").appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = true;
    controls.minDistance = 2.25;
    controls.maxDistance = 11;
    controls.target.set(0, 0, 0);

    const renderPass = new RenderPass(scene, camera);
    renderPass.clearAlpha = 0;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.05,
      0.72,
      0.06
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    function createParticleGeometry(count) {
      const positions = createShapePositions(DEFAULT_SHAPE, count);
      const randoms = new Float32Array(count * 3);
      const sizes = new Float32Array(count);

      for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        randoms[offset] = Math.random();
        randoms[offset + 1] = Math.random();
        randoms[offset + 2] = Math.random();
        sizes[index] = 0.62 + Math.random() * 1.18;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      return geometry;
    }

    function createShapePositions(shapeName, count) {
      const positions = new Float32Array(count * 3);

      for (let index = 0; index < count; index += 1) {
        const offset = index * 3;
        if (shapeName === "plane") {
          const planeAngle = Math.random() * Math.PI * 2;
          const planeRadius = Math.sqrt(Math.random()) * 1.48;
          const x = Math.cos(planeAngle) * planeRadius;
          const y = Math.sin(planeAngle) * planeRadius;
          const z = (Math.random() - 0.5) * 0.4 + Math.sin(x * 3.2 + y * 1.4) * 0.045;
          positions[offset] = x;
          positions[offset + 1] = y;
          positions[offset + 2] = z;
        } else if (shapeName === "torus") {
          const ringAngle = Math.random() * Math.PI * 2;
          const tubeAngle = Math.random() * Math.PI * 2;
          const tubeRadius = 0.14 + Math.random() * 0.26;
          const ringRadius = 0.88 + tubeRadius * Math.cos(tubeAngle);
          positions[offset] = ringRadius * Math.cos(ringAngle);
          positions[offset + 1] = tubeRadius * Math.sin(tubeAngle);
          positions[offset + 2] = ringRadius * Math.sin(ringAngle);
        } else {
          const directionY = 1 - Math.random() * 2;
          const directionRadius = Math.sqrt(1 - directionY * directionY);
          const angle = Math.random() * Math.PI * 2;
          const shellBias = Math.pow(Math.random(), 0.42);
          const radius = 0.12 + shellBias * 1.22;

          positions[offset] = Math.cos(angle) * directionRadius * radius;
          positions[offset + 1] = directionY * radius;
          positions[offset + 2] = Math.sin(angle) * directionRadius * radius;
        }
      }
      return positions;
    }

    // Ashima-style 3D simplex noise keeps the organic motion entirely on the GPU.
    

    

    const uniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uImpulse: { value: 0 },
      uScale: { value: 1 },
      uShape: { value: SHAPE_VALUES[DEFAULT_SHAPE] },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO) },
      uPointSize: { value: BASE_POINT_SIZE * DEFAULT_VISUALS.particleSize },
      uColorA: { value: new THREE.Color(0x121d91) },
      uColorB: { value: new THREE.Color(0x943cff) },
      uColorC: { value: new THREE.Color(0xffd7ff) }
    };

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const particleGeometry = createParticleGeometry(MAX_PARTICLE_COUNT);
    particleGeometry.setDrawRange(0, DEFAULT_VISUALS.particleCount);
    const particleField = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleField);

    const themes = {
      cyberpunk: {
        colorA: 0x101a91,
        colorB: 0x9d34ff,
        colorC: 0xffd7ff,
        accent: "#ff38d1",
        accentSoft: "rgba(255, 56, 209, 0.3)",
        accentStrong: "#a7f5ff",
        bloom: 1.08,
        threshold: 0.06
      },
      "deep-space": {
        colorA: 0x050a3b,
        colorB: 0x2859d7,
        colorC: 0xa8ddff,
        accent: "#5d8dff",
        accentSoft: "rgba(93, 141, 255, 0.28)",
        accentStrong: "#b8dbff",
        bloom: 0.9,
        threshold: 0.09
      },
      "solar-flare": {
        colorA: 0x57140a,
        colorB: 0xff4d0a,
        colorC: 0xfff0a6,
        accent: "#ff6c2d",
        accentSoft: "rgba(255, 108, 45, 0.3)",
        accentStrong: "#ffe1a8",
        bloom: 1.2,
        threshold: 0.04
      }
    };

    const themeColors = THEME_ORDER.reduce((colors, themeName) => {
      const theme = themes[themeName];
      colors[themeName] = {
        colorA: new THREE.Color(theme.colorA),
        colorB: new THREE.Color(theme.colorB),
        colorC: new THREE.Color(theme.colorC)
      };
      return colors;
    }, {});
    let activeThemeName = "cyberpunk";
    let atmospherePhase = 0;

    function updateBloomStrength() {
      const theme = themes[activeThemeName];
      if (theme) {
        bloomPass.strength = theme.bloom * settings.visuals.glow;
      }
    }

    function updateThemeChrome(themeName) {
      const theme = themes[themeName];
      document.documentElement.style.setProperty("--accent", theme.accent);
      document.documentElement.style.setProperty("--accent-soft", theme.accentSoft);
      document.documentElement.style.setProperty("--accent-strong", theme.accentStrong);

      ui.themeButtons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.theme === themeName));
      });
    }

    function setThemePalette(fromThemeName, toThemeName, amount) {
      const fromColors = themeColors[fromThemeName];
      const toColors = themeColors[toThemeName];
      uniforms.uColorA.value.copy(fromColors.colorA).lerp(toColors.colorA, amount);
      uniforms.uColorB.value.copy(fromColors.colorB).lerp(toColors.colorB, amount);
      uniforms.uColorC.value.copy(fromColors.colorC).lerp(toColors.colorC, amount);
    }

    function applyTheme(themeName) {
      const theme = themes[themeName];
      if (!theme) {
        return;
      }

      activeThemeName = themeName;
      atmospherePhase = THEME_ORDER.indexOf(themeName);
      setThemePalette(themeName, themeName, 0);
      updateBloomStrength();
      bloomPass.threshold = theme.threshold;
      updateThemeChrome(themeName);
    }

    function updateAtmosphere(delta) {
      if (!settings.visuals.autoAtmosphere) {
        return;
      }

      atmospherePhase = (atmospherePhase + delta * THEME_ORDER.length / 8) % THEME_ORDER.length;
      const fromIndex = Math.floor(atmospherePhase);
      const amount = atmospherePhase - fromIndex;
      const fromThemeName = THEME_ORDER[fromIndex];
      const toThemeName = THEME_ORDER[(fromIndex + 1) % THEME_ORDER.length];
      const smoothAmount = amount * amount * (3 - 2 * amount);
      const fromTheme = themes[fromThemeName];
      const toTheme = themes[toThemeName];

      if (activeThemeName !== fromThemeName) {
        activeThemeName = fromThemeName;
        updateThemeChrome(fromThemeName);
      }
      setThemePalette(fromThemeName, toThemeName, smoothAmount);
      bloomPass.strength = THREE.MathUtils.lerp(fromTheme.bloom, toTheme.bloom, smoothAmount) * settings.visuals.glow;
      bloomPass.threshold = THREE.MathUtils.lerp(fromTheme.threshold, toTheme.threshold, smoothAmount);
    }

    function setAudioStatus(state, label, source = "No audio source") {
      ui.audioDot.dataset.state = state;
      ui.statusLabel.textContent = label;
      ui.sourceLabel.textContent = source;
    }

    function setNotice(message, tone = "info") {
      ui.notice.className = `notice${tone === "info" ? "" : ` ${tone}`}`;
      ui.notice.textContent = message;
    }

    function updateCaptureButtons() {
      ui.startCapture.disabled = captureBusy || Boolean(captureStream);
      ui.stopCapture.disabled = captureBusy || !captureStream;
    }

    function setPanelVisibility(isVisible) {
      ui.controlsPanel.classList.toggle("is-hidden", !isVisible);
      ui.controlsPanel.setAttribute("aria-hidden", String(!isVisible));
      ui.panelToggle.setAttribute("aria-expanded", String(isVisible));
      ui.panelToggle.textContent = isVisible ? "Hide panel" : "Show panel";
    }

    function requestDisplayAudio() {
      const mediaDevices = navigator.mediaDevices;
      const supportedConstraints = typeof mediaDevices.getSupportedConstraints === "function"
        ? mediaDevices.getSupportedConstraints()
        : {};

      // Newer browsers can keep the original tab audio playing. The fallback
      // deliberately uses the broadly supported getDisplayMedia({ video: true, audio: true }).
      if (supportedConstraints.suppressLocalAudioPlayback) {
        return mediaDevices.getDisplayMedia({
          video: true,
          audio: { suppressLocalAudioPlayback: false }
        });
      }

      return mediaDevices.getDisplayMedia({ video: true, audio: true });
    }

    function classifyCaptureError(error) {
      const errorName = error && typeof error === "object" && "name" in error
        ? error.name
        : "";

      if (errorName === "NotAllowedError" || errorName === "AbortError") {
        return {
          label: "Capture canceled",
          message: "The sharing dialog was canceled. Choose a source and enable its tab or system audio option.",
          tone: "warning"
        };
      }

      if (errorName === "NotFoundError") {
        return {
          label: "No source selected",
          message: "No shareable source was available. Try selecting a browser tab or a screen again.",
          tone: "warning"
        };
      }

      const detail = error && typeof error.message === "string" && error.message
        ? ` ${error.message}`
        : "";
      return {
        label: "Capture error",
        message: `The audio stream could not be started.${detail}`,
        tone: "error"
      };
    }

    async function startCapture() {
      if (captureBusy || captureStream) {
        return;
      }

      if (!window.isSecureContext) {
        setAudioStatus("error", "Secure context required");
        setNotice("Screen and tab capture requires HTTPS or localhost. Serve this file from a local web server and try again.", "error");
        return;
      }

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
        setAudioStatus("error", "Capture unavailable");
        setNotice("This browser does not expose getDisplayMedia. Use a current desktop browser with screen-capture support.", "error");
        return;
      }

      const AudioContextClass = window.AudioContext || Reflect.get(window, "webkitAudioContext");
      if (!AudioContextClass) {
        setAudioStatus("error", "Web Audio unavailable");
        setNotice("This browser does not expose the Web Audio API required for live analysis.", "error");
        return;
      }

      captureBusy = true;
      updateCaptureButtons();
      setAudioStatus("busy", "Waiting for source selection");
      setNotice("Select a tab or screen, then enable Share tab audio or system audio in the browser dialog.");

      let pendingStream = null;
      let pendingContext = null;
      let pendingSource = null;
      let pendingAnalyser = null;
      let pendingMonitor = null;

      try {
        pendingStream = await requestDisplayAudio();
        const audioTracks = pendingStream.getAudioTracks();

        if (audioTracks.length === 0) {
          pendingStream.getTracks().forEach((track) => track.stop());
          pendingStream = null;
          setAudioStatus("error", "No audio track");
          setNotice("The source was shared without audio. Start again and enable Share tab audio (or system audio) before confirming.", "warning");
          return;
        }

        pendingContext = new AudioContextClass();
        await pendingContext.resume();
        pendingAnalyser = pendingContext.createAnalyser();
        pendingAnalyser.fftSize = 1024;
        pendingAnalyser.minDecibels = -90;
        pendingAnalyser.maxDecibels = -10;
        pendingAnalyser.smoothingTimeConstant = 0.08;
        pendingSource = pendingContext.createMediaStreamSource(pendingStream);
        pendingMonitor = pendingContext.createGain();
        pendingMonitor.gain.value = ui.monitorAudio.checked ? 1 : 0;

        // Routing: source -> analyser -> monitor gain -> speakers. This keeps
        // the captured audio audible while allowing the checkbox to mute the
        // pass-through if the browser is already playing the tab locally.
        pendingSource.connect(pendingAnalyser);
        pendingAnalyser.connect(pendingMonitor);
        pendingMonitor.connect(pendingContext.destination);

        captureStream = pendingStream;
        audioContext = pendingContext;
        mediaSource = pendingSource;
        analyser = pendingAnalyser;
        monitorGain = pendingMonitor;
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        pendingStream = null;
        pendingContext = null;
        pendingSource = null;
        pendingAnalyser = null;
        pendingMonitor = null;

        captureStream.getTracks().forEach((track) => {
          track.addEventListener("ended", handleCaptureEnded, { once: true });
        });

        const sourceDescription = audioTracks[0].label || "Captured audio track";
        setAudioStatus("ready", "Live audio reactive", sourceDescription);
        setNotice("Audio is live. Bass expands the field, mids bend its structure, and treble adds jitter and light.");
      } catch (error) {
        if (pendingStream) {
          pendingStream.getTracks().forEach((track) => track.stop());
        }
        if (pendingSource) {
          pendingSource.disconnect();
        }
        if (pendingAnalyser) {
          pendingAnalyser.disconnect();
        }
        if (pendingMonitor) {
          pendingMonitor.disconnect();
        }
        if (pendingContext && pendingContext.state !== "closed") {
          await pendingContext.close();
        }

        const failure = classifyCaptureError(error);
        setAudioStatus("error", failure.label);
        setNotice(failure.message, failure.tone);
        if (failure.tone === "error") {
          console.error("Audio capture failed:", error);
        }
      } finally {
        captureBusy = false;
        updateCaptureButtons();
      }
    }

    async function stopCapture(message = "Audio capture stopped.") {
      const streamToStop = captureStream;
      const contextToClose = audioContext;
      const sourceToDisconnect = mediaSource;
      const analyserToDisconnect = analyser;
      const monitorToDisconnect = monitorGain;

      captureStream = null;
      audioContext = null;
      mediaSource = null;
      analyser = null;
      monitorGain = null;
      frequencyData = null;

      if (sourceToDisconnect) {
        sourceToDisconnect.disconnect();
      }
      if (analyserToDisconnect) {
        analyserToDisconnect.disconnect();
      }
      if (monitorToDisconnect) {
        monitorToDisconnect.disconnect();
      }
      if (streamToStop) {
        streamToStop.getTracks().forEach((track) => track.stop());
      }
      if (contextToClose && contextToClose.state !== "closed") {
        await contextToClose.close();
      }

      settings.audio.bass = 0;
      settings.audio.mid = 0;
      settings.audio.treble = 0;
      settings.audio.previousBass = 0;
      settings.audio.impulse = 0;
      setAudioStatus("idle", "Idle - waiting for capture");
      setNotice(message);
      updateCaptureButtons();
    }

    function handleCaptureEnded() {
      if (!captureStream) {
        return;
      }

      const ended = captureStream.getTracks().some((track) => track.readyState === "ended");
      if (ended) {
        void stopCapture("Browser/system audio sharing ended. Start a new capture whenever you are ready.");
      }
    }

    function averageBand(lowFrequency, highFrequency) {
      if (!audioContext || !analyser || !frequencyData) {
        return 0;
      }

      const frequencyPerBin = audioContext.sampleRate / analyser.fftSize;
      const firstBin = Math.max(0, Math.floor(lowFrequency / frequencyPerBin));
      const lastBin = Math.min(
        frequencyData.length - 1,
        Math.ceil(highFrequency / frequencyPerBin)
      );

      if (lastBin < firstBin) {
        return 0;
      }

      let sum = 0;
      for (let bin = firstBin; bin <= lastBin; bin += 1) {
        sum += frequencyData[bin];
      }
      return sum / ((lastBin - firstBin + 1) * 255);
    }

    function smoothAudioValue(current, target, delta) {
      const smoothingRate = target > current ? 15 : 6;
      const amount = 1 - Math.exp(-smoothingRate * delta);
      return THREE.MathUtils.lerp(current, target, amount);
    }

    function updateAudioAnalysis(delta) {
      if (analyser && frequencyData) {
        analyser.getByteFrequencyData(frequencyData);

        const bassTarget = THREE.MathUtils.clamp(
          averageBand(0, 150) * settings.sensitivity.bass,
          0,
          1
        );
        const midTarget = THREE.MathUtils.clamp(
          averageBand(150, 2000) * settings.sensitivity.mid,
          0,
          1
        );
        const trebleTarget = THREE.MathUtils.clamp(
          averageBand(2000, audioContext.sampleRate / 2) * settings.sensitivity.treble,
          0,
          1
        );

        settings.audio.bass = smoothAudioValue(settings.audio.bass, bassTarget, delta);
        settings.audio.mid = smoothAudioValue(settings.audio.mid, midTarget, delta);
        settings.audio.treble = smoothAudioValue(settings.audio.treble, trebleTarget, delta);
      } else {
        settings.audio.bass = smoothAudioValue(settings.audio.bass, 0, delta);
        settings.audio.mid = smoothAudioValue(settings.audio.mid, 0, delta);
        settings.audio.treble = smoothAudioValue(settings.audio.treble, 0, delta);
      }

      const bassRise = Math.max(0, settings.audio.bass - settings.audio.previousBass);
      settings.audio.impulse = Math.max(
        settings.audio.impulse * Math.exp(-7 * delta),
        bassRise * 5.5
      );
      settings.audio.previousBass = settings.audio.bass;

      uniforms.uBass.value = settings.audio.bass;
      uniforms.uMid.value = settings.audio.mid;
      uniforms.uTreble.value = settings.audio.treble;
      uniforms.uImpulse.value = settings.audio.impulse;
    }

    function applyShape(shapeName) {
      if (!Object.prototype.hasOwnProperty.call(SHAPE_VALUES, shapeName)) {
        return;
      }

      const positionAttribute = particleField.geometry.getAttribute("position");
      positionAttribute.array.set(createShapePositions(shapeName, MAX_PARTICLE_COUNT));
      positionAttribute.needsUpdate = true;
      particleField.geometry.computeBoundingSphere();
      uniforms.uShape.value = SHAPE_VALUES[shapeName];
      ui.shapeSelect.value = shapeName;
    }

    function updateSlider(name) {
      const value = Number(ui.sliders[name].value);
      settings.sensitivity[name] = value;
      ui.sliderValues[name].textContent = `${value.toFixed(2)}x`;
    }

    function formatParticleCount(value) {
      return Math.round(value).toLocaleString("en-US");
    }

    function updateVisualSlider(name) {
      const value = Number(ui.visualSliders[name].value);
      settings.visuals[name] = value;

      if (name === "particleCount") {
        particleField.geometry.setDrawRange(0, Math.round(value));
        ui.visualSliderValues[name].textContent = formatParticleCount(value);
        ui.particleCountValue.textContent = formatParticleCount(value);
      } else if (name === "particleSize") {
        uniforms.uPointSize.value = BASE_POINT_SIZE * value;
        ui.visualSliderValues[name].textContent = `${value.toFixed(2)}x`;
      } else if (name === "motion" || name === "glow") {
        ui.visualSliderValues[name].textContent = `${value.toFixed(2)}x`;
        if (name === "glow") {
          updateBloomStrength();
        }
      }
    }

    function applyVisualDefaults(shapeName) {
      const defaults = SHAPE_VISUAL_DEFAULTS[shapeName];
      if (!defaults) {
        return;
      }

      Object.entries(defaults).forEach(([name, value]) => {
        ui.visualSliders[name].value = String(value);
        updateVisualSlider(name);
      });
    }

    function resetSliders() {
      Object.entries(DEFAULT_SENSITIVITY).forEach(([name, value]) => {
        ui.sliders[name].value = String(value);
        updateSlider(name);
      });
      setNotice("Band sensitivity sliders reset to their defaults.");
    }

    function resetVisuals() {
      applyVisualDefaults(ui.shapeSelect.value);
      setNotice("Visual controls reset to the defaults for the current shape.");
    }

    Object.keys(ui.sliders).forEach((name) => {
      ui.sliders[name].addEventListener("input", () => updateSlider(name));
      updateSlider(name);
    });

    Object.keys(ui.visualSliders).forEach((name) => {
      ui.visualSliders[name].addEventListener("input", () => updateVisualSlider(name));
      updateVisualSlider(name);
    });

    ui.resetSliders.addEventListener("click", resetSliders);
    ui.resetVisuals.addEventListener("click", resetVisuals);
    ui.shapeSelect.addEventListener("change", () => {
      const shapeName = ui.shapeSelect.value;
      applyShape(shapeName);
      applyVisualDefaults(shapeName);
      const shapeLabel = ui.shapeSelect.options[ui.shapeSelect.selectedIndex].textContent;
      setNotice(`Field shape changed to ${shapeLabel}; its visual defaults were applied.`);
    });

    ui.panelToggle.addEventListener("click", () => {
      const isVisible = !ui.controlsPanel.classList.contains("is-hidden");
      setPanelVisibility(!isVisible);
    });

    ui.themeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (settings.visuals.autoAtmosphere) {
          settings.visuals.autoAtmosphere = false;
          ui.autoAtmosphere.checked = false;
        }
        applyTheme(button.dataset.theme);
      });
    });

    ui.autoAtmosphere.addEventListener("change", () => {
      settings.visuals.autoAtmosphere = ui.autoAtmosphere.checked;
      if (settings.visuals.autoAtmosphere) {
        atmospherePhase = THEME_ORDER.indexOf(activeThemeName);
        setNotice("Auto atmosphere enabled. Theme colors will transition continuously.");
      } else {
        applyTheme(activeThemeName);
        setNotice("Auto atmosphere disabled. The selected theme is fixed.");
      }
    });

    ui.monitorAudio.addEventListener("change", () => {
      if (monitorGain && audioContext) {
        monitorGain.gain.setTargetAtTime(
          ui.monitorAudio.checked ? 1 : 0,
          audioContext.currentTime,
          0.015
        );
      }
      setNotice(
        ui.monitorAudio.checked
          ? "Captured audio monitoring is enabled."
          : "Monitoring is muted; analysis continues without routing the captured stream to your speakers."
      );
    });

    ui.startCapture.addEventListener("click", () => {
      void startCapture();
    });

    ui.stopCapture.addEventListener("click", () => {
      void stopCapture();
    });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      uniforms.uPixelRatio.value = pixelRatio;
    }

    window.addEventListener("resize", resize, { passive: true });

    let elapsed = 0;
    let visualTime = 0;
    let pulseTime = 0;
    let fpsFrames = 0;
    let fpsElapsed = 0;
    let previousFrameTime = performance.now();

    function animate(now) {
      requestAnimationFrame(animate);
      const delta = Math.min(0.05, Math.max(0.001, (now - previousFrameTime) / 1000));
      previousFrameTime = now;
      elapsed += delta;
      const visualDelta = delta * settings.visuals.motion;
      visualTime += visualDelta;
      pulseTime += visualDelta * (0.8 + settings.audio.bass * 4.5);

      updateAudioAnalysis(delta);
      updateAtmosphere(delta);
      uniforms.uTime.value = visualTime;
      uniforms.uScale.value =
        1 +
        settings.audio.bass * 0.16 +
        Math.sin(pulseTime) * (0.006 + settings.audio.bass * 0.018) +
        settings.audio.impulse * 0.075;

      particleField.rotation.y += visualDelta * (0.045 + settings.audio.mid * 0.18);
      particleField.rotation.x = Math.sin(visualTime * 0.13) * 0.09 + settings.audio.mid * 0.035;
      particleField.rotation.z += visualDelta * (0.018 + settings.audio.treble * 0.09);
      controls.update();
      composer.render();

      fpsFrames += 1;
      fpsElapsed += delta;
      if (fpsElapsed >= 0.5) {
        ui.fpsValue.textContent = `${Math.round(fpsFrames / fpsElapsed)} FPS`;
        fpsFrames = 0;
        fpsElapsed = 0;
      }
    }

    applyTheme("cyberpunk");
    setPanelVisibility(true);
    resize();
    updateCaptureButtons();
    requestAnimationFrame(animate);

    window.addEventListener("pagehide", () => {
      if (captureStream) {
        captureStream.getTracks().forEach((track) => track.stop());
      }
    });
