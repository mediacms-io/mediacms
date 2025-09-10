// components/controls/CustomSettingsMenu.js
import videojs from "video.js";
import "./CustomSettingsMenu.css";
import UserPreferences from "../../utils/UserPreferences";

// Get the Component base class from Video.js
const Component = videojs.getComponent("Component");

class CustomSettingsMenu extends Component {
  constructor(player, options) {
    super(player, options);

    this.settingsButton = null;
    this.settingsOverlay = null;
    this.speedSubmenu = null;
    this.qualitySubmenu = null;
    this.userPreferences = options?.userPreferences || new UserPreferences();
    this.providedQualities = options?.qualities || null;

    // Bind methods
    this.createSettingsButton = this.createSettingsButton.bind(this);
    this.createSettingsOverlay = this.createSettingsOverlay.bind(this);
    this.positionButton = this.positionButton.bind(this);
    this.toggleSettings = this.toggleSettings.bind(this);
    this.handleSpeedChange = this.handleSpeedChange.bind(this);
    this.handleQualityChange = this.handleQualityChange.bind(this);
    this.getAvailableQualities = this.getAvailableQualities.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);

    // Initialize after player is ready
    this.player().ready(() => {
      this.createSettingsButton();
      this.createSettingsOverlay();
      this.setupEventListeners();
    });
  }

  createSettingsButton() {
    const controlBar = this.player().getChild("controlBar");

    // Do NOT hide default playback rate button to avoid control bar layout shifts

    // Create settings button
    this.settingsButton = controlBar.addChild("button", {
      controlText: "Settings",
      className: "vjs-settings-button",
    });

    // Style the settings button (gear icon)
    const settingsButtonEl = this.settingsButton.el();
    settingsButtonEl.innerHTML = `
            <span class="vjs-icon-cog"></span>
        `;

    // Position the settings button at the end of the control bar
    this.positionButton();

    // Add click handler
    this.settingsButton.on("click", this.toggleSettings);
  }

  createSettingsOverlay() {
    const controlBar = this.player().getChild("controlBar");

    // Create settings overlay
    this.settingsOverlay = document.createElement("div");
    this.settingsOverlay.className = "custom-settings-overlay";

    // Get current preferences for display
    const currentPlaybackRate =
      this.userPreferences.getPreference("playbackRate");
    const currentQuality = this.userPreferences.getPreference("quality");

    // Format playback rate for display
    const playbackRateLabel =
      currentPlaybackRate === 1 ? "Normal" : `${currentPlaybackRate}`;
    const qualities = this.getAvailableQualities();
    const activeQuality =
      qualities.find((q) => q.value === currentQuality) || qualities[0];
    const qualityLabelHTML =
      activeQuality?.displayLabel ||
      activeQuality?.label ||
      (currentQuality ? String(currentQuality) : "Auto");

    // Settings menu content
    this.settingsOverlay.innerHTML = `
    <div class="settings-header">Settings</div>
    
    <div class="settings-item" data-setting="playback-speed">
        <span class="settings-left">
            <span class="vjs-icon-placeholder settings-item-svg">
                <svg height="24" viewBox="0 0 24 24" width="24"><path d="M10,8v8l6-4L10,8L10,8z M6.3,5L5.7,4.2C7.2,3,9,2.2,11,2l0.1,1C9.3,3.2,7.7,3.9,6.3,5z            M5,6.3L4.2,5.7C3,7.2,2.2,9,2,11 l1,.1C3.2,9.3,3.9,7.7,5,6.3z            M5,17.7c-1.1-1.4-1.8-3.1-2-4.8L2,13c0.2,2,1,3.8,2.2,5.4L5,17.7z            M11.1,21c-1.8-0.2-3.4-0.9-4.8-2 l-0.6,.8C7.2,21,9,21.8,11,22L11.1,21z            M22,12c0-5.2-3.9-9.4-9-10l-0.1,1c4.6,.5,8.1,4.3,8.1,9s-3.5,8.5-8.1,9l0.1,1 C18.2,21.5,22,17.2,22,12z" fill="white"></path></svg>
            </span>
        <span>Playback speed</span></span>
        <span class="settings-right">
            <span class="current-speed">${playbackRateLabel}</span>
            <span class="vjs-icon-placeholder vjs-icon-navigate-next"></span>
        </span>
    </div>
    
    <div class="settings-item" data-setting="quality">
        <span class="settings-left">
           <span class="vjs-icon-placeholder settings-item-svg">
              <svg height="24" viewBox="0 0 24 24" width="24"><path d="M15,17h6v1h-6V17z M11,17H3v1h8v2h1v-2v-1v-2h-1V17z M14,8h1V6V5V3h-1v2H3v1h11V8z            M18,5v1h3V5H18z M6,14h1v-2v-1V9H6v2H3v1 h3V14z M10,12h11v-1H10V12z" fill="white"></path></svg>
           </span>
        <span>Quality</span></span>
        <span class="settings-right">
            <span class="current-quality">${qualityLabelHTML}</span>
            <span class="vjs-icon-placeholder vjs-icon-navigate-next"></span>
        </span>
    </div>
`;

    // Create speed submenu
    this.createSpeedSubmenu();

    // Create quality submenu
    this.createQualitySubmenu(qualities, activeQuality?.value);

    // Add to control bar
    controlBar.el().appendChild(this.settingsOverlay);
  }

  createSpeedSubmenu() {
    const speedOptions = [
      { label: "0.25", value: 0.25 },
      { label: "0.5", value: 0.5 },
      { label: "0.75", value: 0.75 },
      { label: "Normal", value: 1 },
      { label: "1.25", value: 1.25 },
      { label: "1.5", value: 1.5 },
      { label: "1.75", value: 1.75 },
      { label: "2", value: 2 },
    ];

    this.speedSubmenu = document.createElement("div");
    this.speedSubmenu.className = "speed-submenu";

    // Get current playback rate for highlighting
    const currentRate = this.userPreferences.getPreference("playbackRate");

    this.speedSubmenu.innerHTML = `
            <div class="submenu-header">
                <span style="margin-right: 8px;">←</span>
                <span>Playback speed</span>
            </div>
            ${speedOptions
              .map(
                (option) => `
                <div class="speed-option ${option.value === currentRate ? "active" : ""}" data-speed="${option.value}">
                    <span>${option.label}</span>
                    ${option.value === currentRate ? '<span class="checkmark">✓</span>' : ""}
                </div>
            `
              )
              .join("")}
        `;

    this.settingsOverlay.appendChild(this.speedSubmenu);
  }

  createQualitySubmenu(qualities, currentValue) {
    this.qualitySubmenu = document.createElement("div");
    this.qualitySubmenu.className = "quality-submenu";

    const header = `
            <div class="submenu-header">
                <span style="margin-right: 8px;">←</span>
                <span>Quality</span>
            </div>
        `;

    const optionsHtml = qualities
      .map(
        (q) => `
                <div class="quality-option ${q.value === currentValue ? "active" : ""}" data-quality="${q.value}">
                    <span class="quality-label">${q.displayLabel || q.label}</span>
                    ${q.value === currentValue ? '<span class="checkmark">✓</span>' : ""}
                </div>
            `
      )
      .join("");

    this.qualitySubmenu.innerHTML = header + optionsHtml;
    this.settingsOverlay.appendChild(this.qualitySubmenu);
  }

  getAvailableQualities() {
    // Priority: provided options -> MEDIA_DATA JSON -> player sources -> default
    const desiredOrder = [
      "auto",
      "144p",
      "240p",
      "360p",
      "480p",
      "720p",
      "1080p",
    ];

    if (
      Array.isArray(this.providedQualities) &&
      this.providedQualities.length
    ) {
      return this.sortAndDecorateQualities(
        this.providedQualities,
        desiredOrder
      );
    }

    try {
      const md = typeof window !== "undefined" ? window.MEDIA_DATA : null;
      const jsonQualities = md?.data?.qualities;
      if (Array.isArray(jsonQualities) && jsonQualities.length) {
        // Expected format: [{label: '1080p', value: '1080p', src: '...'}]
        const normalized = jsonQualities.map((q) => ({
          label: q.label || q.value || "Auto",
          value: (q.value || q.label || "auto").toString().toLowerCase(),
          src: q.src || q.url || q.href,
          type: q.type || "video/mp4",
        }));
        return this.sortAndDecorateQualities(normalized, desiredOrder);
      }
    } catch (e) {
      // ignore
    }

    // Derive from player's current sources
    const sources = this.player().currentSources
      ? this.player().currentSources()
      : this.player().currentSrc();
    if (Array.isArray(sources) && sources.length > 0) {
      const mapped = sources.map((s, idx) => {
        const label =
          s.label ||
          s.res ||
          this.inferLabelFromSrc(s.src) ||
          (idx === 0 ? "Auto" : `Source ${idx + 1}`);
        const value = String(label).toLowerCase();
        return { label, value, src: s.src, type: s.type || "video/mp4" };
      });
      return this.sortAndDecorateQualities(mapped, desiredOrder);
    }

    // Default fallback
    // Build full ordered list without src so UI is consistent; switching will require src in JSON
    const fallback = desiredOrder.map((v) => ({
      label: v === "auto" ? "Auto" : v,
      value: v,
    }));
    return this.sortAndDecorateQualities(fallback, desiredOrder);
  }

  sortAndDecorateQualities(list, desiredOrder) {
    const orderIndex = (val) => {
      const i = desiredOrder.indexOf(String(val).toLowerCase());
      return i === -1 ? 999 : i;
    };
    const decorated = list
      .map((q) => {
        const val = (q.value || q.label || "").toString().toLowerCase();
        const baseLabel = q.label || q.value || "";
        const is1080 = val === "1080p";
        const displayLabel = is1080
          ? `${baseLabel} <sup class="hd-badge">HD</sup>`
          : baseLabel;
        return { ...q, value: val, label: baseLabel, displayLabel };
      })
      .sort((a, b) => orderIndex(a.value) - orderIndex(b.value));

    // Ensure all desired labels appear at least once (even if not provided), for consistent menu
    const have = new Set(decorated.map((q) => q.value));
    desiredOrder.forEach((val) => {
      if (!have.has(val)) {
        const baseLabel = val === "auto" ? "Auto" : val;
        const displayLabel =
          val === "1080p"
            ? `${baseLabel} <sup class="hd-badge">HD</sup>`
            : baseLabel;
        decorated.push({ label: baseLabel, value: val, displayLabel });
      }
    });
    // Re-sort after pushing missing
    decorated.sort((a, b) => orderIndex(a.value) - orderIndex(b.value));
    return decorated;
  }

  inferLabelFromSrc(src) {
    if (!src) return null;
    // Try to detect typical resolution markers in file name or query string
    const match = /(?:_|\.|\/)\D*(1440p|1080p|720p|480p|360p|240p|144p)/i.exec(
      src
    );
    if (match && match[1]) return match[1].toUpperCase();
    const m2 = /(\b\d{3,4})p\b/i.exec(src);
    if (m2 && m2[1]) return `${m2[1]}p`;
    return null;
  }

  positionButton() {
    const controlBar = this.player().getChild("controlBar");
    const fullscreenToggle = controlBar.getChild("fullscreenToggle");

    if (this.settingsButton && fullscreenToggle) {
      // Small delay to ensure all buttons are created
      setTimeout(() => {
        const fullscreenIndex = controlBar.children().indexOf(fullscreenToggle);
        controlBar.removeChild(this.settingsButton);
        controlBar.addChild(this.settingsButton, {}, fullscreenIndex + 1);
        console.log("✓ Settings button positioned after fullscreen toggle");
      }, 50);
    }
  }

  setupEventListeners() {
    // Settings item clicks
    this.settingsOverlay.addEventListener("click", (e) => {
      e.stopPropagation();

      if (e.target.closest('[data-setting="playback-speed"]')) {
        this.speedSubmenu.style.display = "flex";
        this.qualitySubmenu.style.display = "none";
      }

      if (e.target.closest('[data-setting="quality"]')) {
        this.qualitySubmenu.style.display = "flex";
        this.speedSubmenu.style.display = "none";
      }
    });

    // Speed submenu header (back button)
    this.speedSubmenu
      .querySelector(".submenu-header")
      .addEventListener("click", () => {
        this.speedSubmenu.style.display = "none";
      });

    // Quality submenu header (back button)
    this.qualitySubmenu
      .querySelector(".submenu-header")
      .addEventListener("click", () => {
        this.qualitySubmenu.style.display = "none";
      });

    // Speed option clicks
    this.speedSubmenu.addEventListener("click", (e) => {
      const speedOption = e.target.closest(".speed-option");
      if (speedOption) {
        const speed = parseFloat(speedOption.dataset.speed);
        this.handleSpeedChange(speed, speedOption);
      }
    });

    // Quality option clicks
    this.qualitySubmenu.addEventListener("click", (e) => {
      const qualityOption = e.target.closest(".quality-option");
      if (qualityOption) {
        const value = qualityOption.dataset.quality;
        this.handleQualityChange(value, qualityOption);
      }
    });

    // Close menu when clicking outside
    document.addEventListener("click", this.handleClickOutside);

    // Add hover effects
    this.settingsOverlay.addEventListener("mouseover", (e) => {
      const item = e.target.closest(".settings-item, .speed-option");
      if (item && !item.style.background.includes("0.1")) {
        item.style.background = "rgba(255, 255, 255, 0.05)";
      }
    });

    this.settingsOverlay.addEventListener("mouseout", (e) => {
      const item = e.target.closest(".settings-item, .speed-option");
      if (item && !item.style.background.includes("0.1")) {
        item.style.background = "transparent";
      }
    });
  }

  toggleSettings(e) {
    e.stopPropagation();
    const isVisible = this.settingsOverlay.style.display === "block";
    this.settingsOverlay.style.display = isVisible ? "none" : "block";
    this.speedSubmenu.style.display = "none"; // Hide submenu when main menu toggles
    if (this.qualitySubmenu) this.qualitySubmenu.style.display = "none";
  }

  handleSpeedChange(speed, speedOption) {
    // Update player speed
    this.player().playbackRate(speed);

    // Save preference
    this.userPreferences.setPreference("playbackRate", speed);

    // Update UI
    this.speedSubmenu.querySelectorAll(".speed-option").forEach((opt) => {
      opt.classList.remove("active");
      opt.style.background = "transparent";
      const check = opt.querySelector(".checkmark");
      if (check) check.remove();
    });

    speedOption.classList.add("active");
    speedOption.style.background = "rgba(255, 255, 255, 0.1)";
    speedOption.insertAdjacentHTML(
      "beforeend",
      '<span class="checkmark">✓</span>'
    );

    // Update main menu display
    const currentSpeedDisplay =
      this.settingsOverlay.querySelector(".current-speed");
    const speedLabel = speed === 1 ? "Normal" : `${speed}`;
    currentSpeedDisplay.textContent = speedLabel;

    // Close only the speed submenu (keep overlay open)
    this.speedSubmenu.style.display = "none";

    console.log("Playback speed preference saved:", speed);
  }

  handleQualityChange(value, qualityOption) {
    const qualities = this.getAvailableQualities();
    const selected = qualities.find((q) => String(q.value) === String(value));

    // Save preference
    this.userPreferences.setQualityPreference(value);

    // Update UI
    this.qualitySubmenu.querySelectorAll(".quality-option").forEach((opt) => {
      opt.classList.remove("active");
      opt.style.background = "transparent";
      const check = opt.querySelector(".checkmark");
      if (check) check.remove();
    });

    qualityOption.classList.add("active");
    qualityOption.style.background = "rgba(255, 255, 255, 0.1)";
    qualityOption.insertAdjacentHTML(
      "beforeend",
      '<span class="checkmark">✓</span>'
    );

    // Update main menu display
    const currentQualityDisplay =
      this.settingsOverlay.querySelector(".current-quality");
    currentQualityDisplay.innerHTML =
      selected?.displayLabel || selected?.label || String(value);

    // Perform source switch if we have src defined
    if (selected?.src) {
      const player = this.player();
      const wasPaused = player.paused();
      const currentTime = player.currentTime();
      const rate = player.playbackRate();

      // Try to preserve active subtitle track
      const textTracks = player.textTracks();
      let activeSubtitleLang = null;
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        if (track.kind === "subtitles" && track.mode === "showing") {
          activeSubtitleLang = track.language;
          break;
        }
      }

      console.log("Switching quality to", selected.label, selected.src);

      player.addClass("vjs-changing-resolution");
      player.src({ src: selected.src, type: selected.type || "video/mp4" });

      const onLoaded = () => {
        // Restore time, rate, subtitles
        try {
          player.playbackRate(rate);
        } catch (e) {}
        try {
          if (!isNaN(currentTime)) player.currentTime(currentTime);
        } catch (e) {}
        if (!wasPaused) {
          player.play().catch(() => {});
        }

        // Restore subtitles
        if (activeSubtitleLang) {
          const tt = player.textTracks();
          for (let i = 0; i < tt.length; i++) {
            const t = tt[i];
            if (t.kind === "subtitles") {
              t.mode =
                t.language === activeSubtitleLang ? "showing" : "disabled";
            }
          }
        }

        // Ensure Subtitles (CC) button remains visible after source switch
        try {
          const controlBar = player.getChild("controlBar");
          const names = [
            "subtitlesButton",
            "textTrackButton",
            "subsCapsButton",
          ];
          for (const n of names) {
            const btn = controlBar && controlBar.getChild(n);
            if (btn) {
              if (typeof btn.show === "function") btn.show();
              const el = btn.el && btn.el();
              if (el) {
                el.style.display = "";
                el.style.visibility = "";
              }
            }
          }
        } catch (e) {
          // noop
        }

        player.removeClass("vjs-changing-resolution");
        player.off("loadedmetadata", onLoaded);
      };

      player.on("loadedmetadata", onLoaded);
    }

    // Close overlay to avoid covering the CC button
    if (this.qualitySubmenu) this.qualitySubmenu.style.display = "none";
    this.settingsOverlay.style.display = "none";

    console.log("Quality preference saved:", value);
  }

  handleClickOutside(e) {
    if (
      this.settingsOverlay &&
      this.settingsButton &&
      !this.settingsOverlay.contains(e.target) &&
      !this.settingsButton.el().contains(e.target)
    ) {
      this.settingsOverlay.style.display = "none";
      this.speedSubmenu.style.display = "none";
      if (this.qualitySubmenu) this.qualitySubmenu.style.display = "none";
    }
  }

  dispose() {
    // Remove event listeners
    document.removeEventListener("click", this.handleClickOutside);

    // Remove DOM elements
    if (this.settingsOverlay) {
      this.settingsOverlay.remove();
    }

    super.dispose();
  }
}

// Set component name for Video.js
CustomSettingsMenu.prototype.controlText_ = "Settings Menu";

// Register the component with Video.js
videojs.registerComponent("CustomSettingsMenu", CustomSettingsMenu);

export default CustomSettingsMenu;
