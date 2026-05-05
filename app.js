/* ──────────────────────────────────────────────────────────────
   APP.JS — shared runtime for all pages
   Handles: theme, i18n, splash, orb, reveal, magnetic micro-FX,
            lazy video, smooth scroll polish.
   No external dependencies. IIFE-scoped, exposes `window.App`.
   ──────────────────────────────────────────────────────────── */
(() => {
  'use strict';

  /* ───────────── helpers ───────────── */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ls = {
    get(k, fb) { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } },
    set(k, v)  { try { localStorage.setItem(k, v); } catch {} }
  };
  const resolve = (obj, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
  const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ════════════════════════════════════════════════
     1. THEME — light is the default
     ════════════════════════════════════════════════ */
  const Theme = {
    KEY: 'tko-theme',
    DEFAULT: 'light',
    init() {
      const saved = ls.get(this.KEY, this.DEFAULT);
      this.apply(saved, false);
    },
    apply(theme, animate = true) {
      const root = document.documentElement;
      // Use the View Transitions API when available for a circular reveal.
      if (animate && document.startViewTransition && !prefersReducedMotion()) {
        document.startViewTransition(() => {
          root.setAttribute('data-theme', theme);
          this.syncToggle(theme);
        });
      } else {
        root.setAttribute('data-theme', theme);
        this.syncToggle(theme);
      }
      ls.set(this.KEY, theme);
    },
    syncToggle(theme) {
      const slider = $('#toggle-slider');
      if (slider) slider.textContent = theme === 'dark' ? '🌙' : '☀️';
      const btn = $('.theme-toggle');
      if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
    },
    toggle() {
      const cur = document.documentElement.getAttribute('data-theme') || this.DEFAULT;
      this.apply(cur === 'dark' ? 'light' : 'dark');
    },
    bind() {
      const btn = $('.theme-toggle');
      if (btn) btn.addEventListener('click', () => this.toggle());
    }
  };

  /* ════════════════════════════════════════════════
     2. i18n — TR default, EN secondary
     ════════════════════════════════════════════════ */
  const I18n = {
    KEY: 'tko-lang',
    DEFAULT: 'tr',
    current: 'tr',
    init() {
      this.current = ls.get(this.KEY, this.DEFAULT);
      if (!window.TRANSLATIONS || !window.TRANSLATIONS[this.current]) this.current = this.DEFAULT;
      this.apply(this.current);
      this.buildDropdown();
    },
    apply(lang) {
      this.current = lang;
      const dict = window.TRANSLATIONS[lang];
      if (!dict) return;
      ls.set(this.KEY, lang);
      document.documentElement.setAttribute('lang', lang);

      // Page <title>
      const titleKey = document.body.dataset.titleKey;
      if (titleKey) {
        const t = resolve(dict, titleKey);
        if (t) document.title = t;
      }

      // textContent translations
      $$('[data-i18n]').forEach(el => {
        const t = resolve(dict, el.dataset.i18n);
        if (t != null) el.textContent = t;
      });

      // innerHTML translations (use sparingly — only with trusted dictionary content)
      $$('[data-i18n-html]').forEach(el => {
        const t = resolve(dict, el.dataset.i18nHtml);
        if (t != null) el.innerHTML = t;
      });

      // attribute translations: data-i18n-attr="placeholder:contact.fNamePh|aria-label:nav.main"
      $$('[data-i18n-attr]').forEach(el => {
        el.dataset.i18nAttr.split('|').forEach(pair => {
          const [attr, key] = pair.split(':').map(s => s.trim());
          const v = resolve(dict, key);
          if (v != null) el.setAttribute(attr, v);
        });
      });

      // mark active flag
      $$('.lang-option').forEach(o => o.classList.toggle('active', o.dataset.lang === lang));
      const cur = $('.lang-current');
      if (cur) cur.textContent = lang.toUpperCase();
      const flag = $('.lang-current-flag');
      if (flag) flag.textContent = lang === 'tr' ? '🇹🇷' : '🇬🇧';

      // notify other modules
      document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
    },
    buildDropdown() {
      const wrap = $('.lang-switcher');
      if (!wrap) return;
      const button = $('.lang-trigger', wrap);
      const menu   = $('.lang-menu', wrap);
      if (!button || !menu) return;

      button.addEventListener('click', e => {
        e.stopPropagation();
        wrap.classList.toggle('open');
      });
      document.addEventListener('click', () => wrap.classList.remove('open'));

      $$('.lang-option', menu).forEach(opt => {
        opt.addEventListener('click', e => {
          e.stopPropagation();
          this.apply(opt.dataset.lang);
          wrap.classList.remove('open');
        });
      });
    }
  };

  /* ════════════════════════════════════════════════
     3. SPLASH (only present on main.html)
     ════════════════════════════════════════════════ */
  const Splash = {
    init() {
      const splash = $('#splash');
      if (!splash) return;
      const dismiss = () => {
        splash.classList.add('hidden');
        sessionStorage.setItem('splashSeen', '1');
      };
      if (sessionStorage.getItem('splashSeen')) {
        splash.classList.add('hidden');
      } else {
        splash.addEventListener('click', dismiss);
        setTimeout(dismiss, 4200);
      }
    }
  };

  /* ════════════════════════════════════════════════
     4. ORB — organic, multi-layer ambient field
     ════════════════════════════════════════════════ */
  const Orb = {
    init() {
      const orb = $('#orb');
      if (!orb) return;
      // Inject blob layers if author included only the wrapper.
      if (!orb.firstElementChild) {
        orb.innerHTML = `
          <span class="orb-blob orb-blob--a"></span>
          <span class="orb-blob orb-blob--b"></span>
          <span class="orb-blob orb-blob--c"></span>`;
      }
      if (prefersReducedMotion()) return;

      let tx = innerWidth / 2, ty = innerHeight / 2;
      let cx = tx, cy = ty;
      addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });

      const tick = () => {
        cx += (tx - cx) * 0.06;
        cy += (ty - cy) * 0.06;
        orb.style.transform = `translate3d(${cx - 300}px, ${cy - 300}px, 0)`;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };

  /* ════════════════════════════════════════════════
     5. REVEAL — staggered scroll-triggered entrance
     ════════════════════════════════════════════════ */
  const Reveal = {
    init() {
      // Elements with data-stagger are handled by page-specific stagger observers.
      const targets = $$('.reveal:not([data-stagger])');
      if (!targets.length) return;
      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      targets.forEach(t => io.observe(t));
    }
  };

  /* ════════════════════════════════════════════════
     6. MAGNETIC — subtle micro-interaction on CTAs
     ════════════════════════════════════════════════ */
  const Magnetic = {
    init() {
      if (prefersReducedMotion()) return;
      $$('[data-magnetic], .btn-primary, .submit-btn, .cv-download-btn, .lang-trigger, .theme-toggle')
        .forEach(el => {
          el.addEventListener('mousemove', e => {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left  - r.width  / 2) * 0.18;
            const y = (e.clientY - r.top   - r.height / 2) * 0.18;
            el.style.setProperty('--mx', `${x}px`);
            el.style.setProperty('--my', `${y}px`);
          });
          el.addEventListener('mouseleave', () => {
            el.style.setProperty('--mx', '0px');
            el.style.setProperty('--my', '0px');
          });
        });
    }
  };

  /* ════════════════════════════════════════════════
     7. LAZY VIDEO — IntersectionObserver-driven
     Replace src→data-src, only load when in view,
     and pause off-screen to spare CPU.
     ════════════════════════════════════════════════ */
  const LazyVideo = {
    init() {
      const vids = $$('video[data-src], video[data-lazy]');
      if (!vids.length) return;

      const load = (v) => {
        const src = v.dataset.src || v.getAttribute('src');
        if (!src) return;
        if (!v.querySelector('source')) {
          v.setAttribute('src', src);
          v.setAttribute('preload', 'metadata');
          v.load();
        }
        v.dataset.loaded = '1';
      };

      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          const v = e.target;
          if (e.isIntersecting) {
            if (!v.dataset.loaded) load(v);
          } else {
            // pause when fully off screen — no idle decoding
            if (!v.paused) v.pause();
          }
        });
      }, { rootMargin: '200px 0px', threshold: 0.05 });

      vids.forEach(v => io.observe(v));
    }
  };

  /* ════════════════════════════════════════════════
     BOOTSTRAP
     ════════════════════════════════════════════════ */
  const boot = () => {
    Theme.init();
    Theme.bind();
    I18n.init();
    Splash.init();
    Orb.init();
    Reveal.init();
    Magnetic.init();
    LazyVideo.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.App = { Theme, I18n, Reveal, LazyVideo };
})();
