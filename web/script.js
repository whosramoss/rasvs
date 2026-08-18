"use strict";

const { gsap, CustomEase, ScrollTrigger, SplitText } = window;
const THREE = window.THREE;

gsap.registerPlugin(CustomEase, SplitText, ScrollTrigger);

class RasvsAnimation {
  constructor() {
    this.customEaseIn2 = CustomEase.create(
      "custom-ease-in-2",
      "0.17, 0.17, 0.34, 1.00",
    );

    this.mobileNoTextAnimMq = window.matchMedia("(max-width: 639px)");

    this.heroScrollAnimationsDone = false;
    this.timberScrollAnimationsDone = false;

    this._onHeroCmsReady = this.onHeroCmsReady.bind(this);
  }

  isMobileNoTextAnimations() {
    return this.mobileNoTextAnimMq.matches;
  }

  createScrollTrigger(el, activate) {
    ScrollTrigger.create({
      trigger: el,
      start: "top bottom-=10%",
      end: "bottom top-=10%",
      scrub: true,
      onEnter: () => activate(),
      onEnterBack: () => activate(),
      onUpdate: () => activate(),
    });
  }

  activateTimeline(tl) {
    tl.play();
  }

  initHeroScrollAnimations() {
    if (this.heroScrollAnimationsDone) return;
    this.heroScrollAnimationsDone = true;

    const skipTextMotion = this.isMobileNoTextAnimations();

    const heroAboutParas = document.querySelectorAll(
      ".hero .text-block .right-container > div:not(.links) .desc-2",
    );
    const heroDescSubtitles = document.querySelectorAll(
      ".hero .text-block .right-container > div:not(.links) .sub-desc",
    );
    const heroItemsText = document.querySelectorAll(".hero .js-anim-item-text");
    const heroPhotoBlock = document.querySelector(".hero .js-anim-hero-photo");

    const linksLeadTitle = document.querySelector(".hero .links .links__title");
    const linksLeadIntro = document.querySelector(".hero .links .links__intro");

    if (skipTextMotion) {
      gsap.set(heroItemsText, { autoAlpha: 1, y: 0 });
      gsap.set(heroDescSubtitles, { autoAlpha: 1, y: 0 });
      gsap.set(heroAboutParas, { autoAlpha: 1, y: 0 });
      if (linksLeadTitle) {
        gsap.set(linksLeadTitle, { autoAlpha: 1, y: 0 });
      }
      if (linksLeadIntro) {
        gsap.set(linksLeadIntro, { autoAlpha: 1, y: 0 });
      }
    }

    let heroDescLines = [];
    if (!skipTextMotion) {
      heroAboutParas.forEach((p) => {
        const lines = new SplitText(p, { type: "lines" }).lines;
        heroDescLines = heroDescLines.concat(lines);
      });
    }

    let linksContextLines = [];
    if (!skipTextMotion && linksLeadIntro) {
      linksContextLines = new SplitText(linksLeadIntro, { type: "lines" })
        .lines;
    }

    const heroSectionSecondTimeline = gsap.timeline({ paused: true });

    if (heroPhotoBlock) {
      heroSectionSecondTimeline.fromTo(
        heroPhotoBlock,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
        },
        0,
      );
    }
    if (!skipTextMotion && heroItemsText.length) {
      heroSectionSecondTimeline.fromTo(
        heroItemsText,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
          stagger: 0.0666,
        },
        0,
      );
    }
    if (!skipTextMotion && heroDescSubtitles.length) {
      heroSectionSecondTimeline.fromTo(
        heroDescSubtitles,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
          stagger: 0.0666,
        },
        0.0666,
      );
    }
    if (!skipTextMotion && heroDescLines.length) {
      heroSectionSecondTimeline.fromTo(
        heroDescLines,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
          stagger: 0.0666,
        },
        0.0666,
      );
    }
    if (!skipTextMotion && linksLeadTitle) {
      heroSectionSecondTimeline.fromTo(
        linksLeadTitle,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
        },
        0.0666,
      );
    }
    if (!skipTextMotion && linksContextLines.length) {
      heroSectionSecondTimeline.fromTo(
        linksContextLines,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
          stagger: 0.0666,
        },
        0.0666,
      );
    }

    if (heroSectionSecondTimeline.duration() > 0) {
      this.createScrollTrigger(".hero .text-block", () =>
        this.activateTimeline(heroSectionSecondTimeline),
      );
      this.activateTimeline(heroSectionSecondTimeline);
    }
  }

  initTimberScrollAnimations() {
    if (this.timberScrollAnimationsDone) return;
    this.timberScrollAnimationsDone = true;

    const timberP = document.querySelector(".timber .text-block p");

    if (this.isMobileNoTextAnimations()) {
      if (timberP) {
        gsap.set(timberP, { autoAlpha: 1, y: 0 });
      }
      return;
    }

    let timberSectionTextLines = [];
    if (timberP) {
      timberSectionTextLines = new SplitText(timberP, { type: "lines" }).lines;
    }

    const timberSectionTimeline = gsap.timeline({ paused: true });

    if (timberSectionTextLines.length) {
      timberSectionTimeline.fromTo(
        timberSectionTextLines,
        { autoAlpha: 0, y: 50 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.833,
          ease: this.customEaseIn2,
          stagger: 0.066666,
        },
        0,
      );
    }

    if (timberSectionTimeline.duration() > 0) {
      this.createScrollTrigger(".timber", () =>
        this.activateTimeline(timberSectionTimeline),
      );
    }
  }

  onHeroCmsReady() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initHeroScrollAnimations();
        ScrollTrigger.refresh();
      });
    });
  }

  startScrollAnimations() {
    this.initTimberScrollAnimations();
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  }

  start() {
    window.addEventListener("heroCmsReady", this._onHeroCmsReady);
    if (window.rasvsHeroCmsReady) {
      this.onHeroCmsReady();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.startScrollAnimations(),
      );
    } else {
      this.startScrollAnimations();
    }
  }
}

class RasvsBackground {
  constructor() {
    this.WIREFRAME_COLOR = 0x6b3a40;
    this.BASE_ROTATION_SPEED = 0.02;
    this.SCROLL_IMPULSE_PER_PX = 0.014;
    this.SCROLL_IMPULSE_MAX = 2.2;
    this.SCROLL_IMPULSE_DECAY = 3.2;

    this.mqDesktop = window.matchMedia("(min-width: 640px)");
    this.wrap = document.getElementById("bg-webgl");

    this.renderer = null;
    this.camera = null;
    this.mesh = null;
    this.scene = null;
    this.geometries = null;
    this.geoIndex = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.lastTime = performance.now();
    this.reduceMotion = false;
    this.raf = 0;
    this.lastScrollTop = 0;
    this.scrollImpulse = 0;

    this._onPointerDown = this.onPointerDown.bind(this);
    this._onResize = this.onResize.bind(this);
    this._onScroll = this.onScroll.bind(this);
    this._animate = this.animate.bind(this);
    this._onMqChange = this.onMqChange.bind(this);
  }

  shouldRun() {
    return this.mqDesktop.matches;
  }

  onPointerDown(event) {
    if (!this.renderer || !this.mesh || !this.camera) return;
    var rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    var hits = this.raycaster.intersectObject(this.mesh);
    if (hits.length > 0) {
      this.geoIndex = (this.geoIndex + 1) % this.geometries.length;
      this.mesh.geometry = this.geometries[this.geoIndex];
    }
  }

  onResize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onScroll() {
    if (!this.mesh || this.reduceMotion) return;
    var top =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    var d = Math.abs(top - this.lastScrollTop);
    this.lastScrollTop = top;
    this.scrollImpulse += d * this.SCROLL_IMPULSE_PER_PX;
    if (this.scrollImpulse > this.SCROLL_IMPULSE_MAX) {
      this.scrollImpulse = this.SCROLL_IMPULSE_MAX;
    }
  }

  animate(now) {
    this.raf = requestAnimationFrame(this._animate);
    if (!this.mesh || !this.renderer || !this.scene || !this.camera) return;
    var delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    if (!this.reduceMotion) {
      this.mesh.rotation.x = 0.8;
      this.scrollImpulse *= Math.exp(-this.SCROLL_IMPULSE_DECAY * delta);
      var turnSpeed = this.BASE_ROTATION_SPEED + this.scrollImpulse;
      this.mesh.rotation.y += turnSpeed * delta;
    }
    this.renderer.render(this.scene, this.camera);
  }

  teardown() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("scroll", this._onScroll);
    if (this.renderer) {
      this.renderer.domElement.removeEventListener(
        "pointerdown",
        this._onPointerDown,
      );
      if (this.renderer.domElement.parentNode === this.wrap) {
        this.wrap.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
    if (this.geometries) {
      this.geometries.forEach(function (g) {
        g.dispose();
      });
    }
    if (this.mesh && this.mesh.material) this.mesh.material.dispose();
    this.renderer = null;
    this.camera = null;
    this.mesh = null;
    this.scene = null;
    this.geometries = null;
    this.scrollImpulse = 0;
    document.body.classList.remove("has-bg-outer");
  }

  build() {
    if (!this.shouldRun()) return;

    document.body.classList.add("has-bg-outer");

    var radius = 0.5;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 0, 3);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.wrap.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener("pointerdown", this._onPointerDown);

    this.geometries = [
      new THREE.SphereGeometry(radius),
      new THREE.SphereGeometry(radius),
      new THREE.SphereGeometry(radius),
    ];
    var material = new THREE.MeshBasicMaterial({
      wireframe: true,
      color: this.WIREFRAME_COLOR,
    });
    this.mesh = new THREE.Mesh(this.geometries[0], material);
    this.mesh.position.set(0.2, 0, 2.8);
    this.scene.add(this.mesh);

    this.lastTime = performance.now();
    this.lastScrollTop =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    this.scrollImpulse = 0;
    window.addEventListener("resize", this._onResize);
    window.addEventListener("scroll", this._onScroll, { passive: true });
    this.raf = requestAnimationFrame(this._animate);
  }

  onMqChange() {
    if (this.shouldRun() && !this.renderer) this.build();
    else if (!this.shouldRun() && this.renderer) this.teardown();
  }

  init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.classList.add("reduce-motion");
    }

    if (!this.wrap) return;

    this.reduceMotion =
      document.documentElement.classList.contains("reduce-motion");

    if (this.shouldRun()) this.build();

    if (typeof this.mqDesktop.addEventListener === "function") {
      this.mqDesktop.addEventListener("change", this._onMqChange);
    } else {
      this.mqDesktop.addListener(this._onMqChange);
    }
  }
}

new RasvsAnimation().start();
new RasvsBackground().init();
