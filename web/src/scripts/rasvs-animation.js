"use strict";

class RasvsAnimation {
  constructor() {
    gsap.registerPlugin(CustomEase, SplitText, ScrollTrigger);

    this.customEaseIn2 = CustomEase.create(
      "custom-ease-in-2",
      "0.17, 0.17, 0.34, 1.00",
    );

    this.mobileNoTextAnimMq = window.matchMedia("(max-width: 639px)");

    this.heroScrollAnimationsDone = false;
    this.timberScrollAnimationsDone = false;
    this.preloaderFinished = false;
    this.heroCmsReadyFlag = false;

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

  tryInitHeroAfterPreloader() {
    if (!this.preloaderFinished || !this.heroCmsReadyFlag) return;
    this.initHeroScrollAnimations();
  }

  onHeroCmsReady() {
    this.heroCmsReadyFlag = true;
    this.tryInitHeroAfterPreloader();
  }

  runScrollInitsAfterReveal() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initTimberScrollAnimations();
        this.tryInitHeroAfterPreloader();
        requestAnimationFrame(() => {
          if (window.ScrollTrigger) {
            window.ScrollTrigger.refresh();
          }
        });
      });
    });
  }

  revealPreloader() {
    document.documentElement.classList.remove("is-preloader-open");
    const pre = document.getElementById("site-preloader");
    const main = document.querySelector(".site-content");
    if (main) {
      main.classList.remove("site-content--preloading");
    }
    if (pre) {
      pre.classList.add("site-preloader--hide");
      pre.setAttribute("aria-busy", "false");
      window.setTimeout(function () {
        pre.remove();
      }, 420);
    }
    this.preloaderFinished = true;
    this.runScrollInitsAfterReveal();
  }

  schedulePreloaderReveal() {
    const DURATION_MS = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 2000;
    window.setTimeout(() => this.revealPreloader(), DURATION_MS);
  }

  startPreloader() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.schedulePreloaderReveal(),
      );
    } else {
      this.schedulePreloaderReveal();
    }
  }

  start() {
    window.addEventListener("heroCmsReady", this._onHeroCmsReady);
    this.startPreloader();
  }
}

new RasvsAnimation().start();
