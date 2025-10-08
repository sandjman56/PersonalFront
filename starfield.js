(function (global) {
  const BUFFER_WIDTH = 960;
  const BUFFER_HEIGHT = 540;
  const FRAME_INTERVAL = 1000 / 30;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  class Starfield {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.bufferCanvas = document.createElement('canvas');
      this.bufferCanvas.width = BUFFER_WIDTH;
      this.bufferCanvas.height = BUFFER_HEIGHT;
      this.bufferCtx = this.bufferCanvas.getContext('2d');

      this.heroSelector = options.heroSelector || 'header';
      this.staticMode = Boolean(options.staticMode);
      this.scale = 1;
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.stars = [];
      this.lastFrame = 0;
      this.running = false;
      this.pausedForVisibility = false;
      this.pausedForScroll = false;

      this.handleResize = this.handleResize.bind(this);
      this.animate = this.animate.bind(this);
      this.handleVisibility = this.handleVisibility.bind(this);
      this.handleThemeChange = this.handleThemeChange.bind(this);

      this.setTheme(options.theme || this.detectTheme());

      window.addEventListener('resize', this.handleResize);
      document.addEventListener('visibilitychange', this.handleVisibility);
      document.addEventListener('themechange', this.handleThemeChange);
      this.setupHeroObserver();

      this.handleResize();
      this.start();
    }

    detectTheme() {
      return document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    }

    setTheme(theme) {
      const isDark = theme === 'dark';
      this.theme = isDark ? 'dark' : 'light';
      this.starFill = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)';
      this.starGlow = isDark ? 'rgba(160, 255, 241, 0.45)' : 'rgba(0,0,0,0.3)';
    }

    handleThemeChange(event) {
      const theme = event?.detail?.theme || this.detectTheme();
      this.setTheme(theme);
    }

    handleVisibility() {
      this.pausedForVisibility = document.hidden;
      if (this.pausedForVisibility) {
        this.stop();
      } else {
        this.start();
      }
    }

    setupHeroObserver() {
      const hero = document.querySelector(this.heroSelector);
      if (!hero || typeof IntersectionObserver === 'undefined') {
        return;
      }

      this.heroObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        const isVisible = entry && entry.isIntersecting && entry.intersectionRatio > 0.05;
        this.pausedForScroll = !isVisible;
        if (this.pausedForScroll) {
          this.stop();
        } else {
          this.start();
        }
      }, { threshold: [0.05, 0.1, 0.25] });

      this.heroObserver.observe(hero);
    }

    handleResize() {
      this.width = Math.max(1, window.innerWidth);
      this.height = Math.max(1, window.innerHeight);
      this.scale = window.devicePixelRatio > 1 ? 0.6 : 1;

      this.canvas.width = Math.floor(this.width * this.scale);
      this.canvas.height = Math.floor(this.height * this.scale);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.scale, this.scale);

      this.populateStars();
    }

    populateStars() {
      const density = this.width > 1200 ? 0.25 : 0.6;
      const target = clamp(Math.floor(this.width * density), 60, 600);
      this.stars = new Array(target).fill(null).map(() => this.createStar());
    }

    createStar() {
      const angle = Math.random() * Math.PI * 2;
      const baseSpeed = 0.02 + Math.random() * 0.04;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: Math.cos(angle) * baseSpeed,
        vy: Math.sin(angle) * baseSpeed * 0.6,
        size: 0.8 + Math.random() * 1.4,
        twinkleSpeed: 0.004 + Math.random() * 0.012,
        twinklePhase: Math.random() * Math.PI * 2
      };
    }

    update(delta) {
      const width = this.width;
      const height = this.height;
      for (let i = 0; i < this.stars.length; i += 1) {
        const star = this.stars[i];
        star.x += star.vx * delta;
        star.y += star.vy * delta;

        if (star.x > width) star.x -= width;
        if (star.x < 0) star.x += width;
        if (star.y > height) star.y -= height;
        if (star.y < 0) star.y += height;

        star.twinklePhase += star.twinkleSpeed * delta;
      }
    }

    draw() {
      const bctx = this.bufferCtx;
      const width = this.bufferCanvas.width;
      const height = this.bufferCanvas.height;
      const scaleX = width / this.width;
      const scaleY = height / this.height;
      const radiusScale = (scaleX + scaleY) / 2;

      bctx.clearRect(0, 0, width, height);

      for (let i = 0; i < this.stars.length; i += 1) {
        const star = this.stars[i];
        const x = star.x * scaleX;
        const y = star.y * scaleY;
        const twinkle = 0.6 + 0.4 * Math.sin(star.twinklePhase);
        const radius = Math.max(0.6, star.size * radiusScale * twinkle);

        const gradient = bctx.createRadialGradient(x, y, 0, x, y, radius * 3);
        gradient.addColorStop(0, this.starFill);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        bctx.fillStyle = gradient;
        bctx.beginPath();
        bctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        bctx.fill();

        bctx.shadowBlur = radius * 4;
        bctx.shadowColor = this.starGlow;
        bctx.fillStyle = this.starFill;
        bctx.beginPath();
        bctx.arc(x, y, radius, 0, Math.PI * 2);
        bctx.fill();
        bctx.shadowBlur = 0;
      }

      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.drawImage(
        this.bufferCanvas,
        0,
        0,
        width,
        height,
        0,
        0,
        this.width,
        this.height
      );
    }

    animate(timestamp) {
      if (!this.running) {
        return;
      }

      if (timestamp - this.lastFrame < FRAME_INTERVAL) {
        requestAnimationFrame(this.animate);
        return;
      }

      const deltaRaw = timestamp - this.lastFrame;
      const delta = Math.min(deltaRaw > 0 ? deltaRaw : FRAME_INTERVAL, 120);
      this.lastFrame = timestamp;

      this.update(delta);
      this.draw();

      requestAnimationFrame(this.animate);
    }

    start() {
      if (this.staticMode || this.running || this.pausedForVisibility || this.pausedForScroll) {
        return;
      }

      this.running = true;
      this.lastFrame = performance.now();
      requestAnimationFrame(this.animate);
    }

    stop() {
      this.running = false;
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this.handleResize);
      document.removeEventListener('visibilitychange', this.handleVisibility);
      document.removeEventListener('themechange', this.handleThemeChange);
      if (this.heroObserver) {
        this.heroObserver.disconnect();
      }
    }
  }

  function init(options = {}) {
    const canvasId = options.canvasId || 'particle-canvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      return null;
    }

    if (options.staticMode) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return null;
    }

    return new Starfield(canvas, options);
  }

  global.StarfieldBackground = {
    init
  };
})(typeof window !== 'undefined' ? window : this);
