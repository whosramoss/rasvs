"use strict";

class RasvsCms {
  static LOCALE_STORAGE_KEY = "rasvs-locale";
  static CMS_FALLBACK_PATH = "../data/rasvs-cms-en.json";

  static getCmsRelativePath() {
    try {
      if (localStorage.getItem(RasvsCms.LOCALE_STORAGE_KEY) === "pt") {
        return "../data/rasvs-cms-pt.json";
      }
    } catch (e) {
      /* ignore */
    }
    return "../data/rasvs-cms-en.json";
  }

  static resolveFetchUrl(relativePath) {
    var path = relativePath || RasvsCms.CMS_FALLBACK_PATH;
    try {
      var el = document.currentScript;
      if (el && el.src) return new URL(path, el.src).href;
    } catch (e) {
      /* ignore */
    }
    try {
      var tag = document.querySelector('script[src*="rasvs-cms"]');
      if (tag && tag.src) return new URL(path, tag.src).href;
    } catch (e2) {
      /* ignore */
    }
    return path;
  }

  constructor() {
    this.fetchUrl = RasvsCms.resolveFetchUrl(RasvsCms.getCmsRelativePath());
  }

  static splitRasvContentAndLinksLead(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
      return {
        aboutBlocks: [],
        lead: { title: "", body: "" },
      };
    }
    const normalized = raw
      .filter(function (b) {
        return b && (b.title != null || b.body != null);
      })
      .map(function (b) {
        return {
          title: b.title != null ? String(b.title) : "",
          body: b.body != null ? String(b.body) : "",
        };
      });
    if (normalized.length === 0) {
      return {
        aboutBlocks: [],
        lead: { title: "", body: "" },
      };
    }
    const lead = normalized[normalized.length - 1];
    const aboutBlocks = normalized.length > 1 ? normalized.slice(0, -1) : [];
    return { aboutBlocks: aboutBlocks, lead: lead };
  }

  static LINKS_ARIA_LABEL = "Project links";

  static normalizePayload(data) {
    if (!data || typeof data !== "object") return null;
    const facts = Array.isArray(data.rasvtopics) ? data.rasvtopics : [];
    const links = Array.isArray(data.links) ? data.links : [];
    const aboutSplit = RasvsCms.splitRasvContentAndLinksLead(data.rasvcontent);
    const aboutBlocks = aboutSplit.aboutBlocks;
    const linksLead = aboutSplit.lead;
    return {
      facts: facts
        .filter(function (f) {
          return f && (f.label != null || f.value != null);
        })
        .map(function (f) {
          return {
            label: f.label != null ? String(f.label) : "",
            value: f.value != null ? String(f.value) : "",
          };
        }),
      aboutBlocks: aboutBlocks
        .filter(function (b) {
          return b && (b.title != null || b.body != null);
        })
        .map(function (b) {
          return {
            title: b.title != null ? String(b.title) : "",
            body: b.body != null ? String(b.body) : "",
          };
        }),
      links: links
        .filter(function (l) {
          return l && l.href;
        })
        .map(function (l) {
          return {
            label: l.label != null ? String(l.label) : String(l.href),
            href: String(l.href),
            external: Boolean(l.external),
          };
        }),
      linksContextTitle: linksLead.title,
      linksContext: linksLead.body,
    };
  }

  renderFacts(container, facts) {
    container.replaceChildren();
    facts.forEach(function (item) {
      const row = document.createElement("div");
      row.className = "text-item";
      const sub = document.createElement("span");
      sub.className = "sub-desc js-anim-item-text";
      sub.textContent = item.label;
      const p = document.createElement("p");
      p.className = "desc-2 js-anim-item-text";
      p.textContent = item.value;
      row.appendChild(sub);
      row.appendChild(p);
      container.appendChild(row);
    });
  }

  appendLocaleSwitch(container, locale, options) {
    if (!container || !locale || typeof locale !== "object") return;
    const opts = options || {};
    const label =
      locale.switchToLabel != null ? String(locale.switchToLabel).trim() : "";
    const nextLocale =
      locale.switchToLocale != null ? String(locale.switchToLocale).trim() : "";
    if (!label || !nextLocale) return;
    const wrap = document.createElement("div");
    wrap.className = opts.wrapClass || "text-item rasvs-locale-switch";
    const a = document.createElement("a");
    a.href = "#";
    a.className =
      opts.linkClass || "desc-2 js-anim-item-text rasvs-locale-switch__link";
    a.setAttribute("role", "button");
    a.textContent = label;
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      try {
        localStorage.setItem(RasvsCms.LOCALE_STORAGE_KEY, nextLocale);
      } catch (err) {
        /* ignore */
      }
      window.location.reload();
    });
    wrap.appendChild(a);
    container.appendChild(wrap);
  }

  renderAboutBlocks(rightContainer, blocks) {
    const linksEl = rightContainer.querySelector(".links");
    blocks.forEach(function (block) {
      const wrap = document.createElement("div");
      const titleText = block.title != null ? String(block.title).trim() : "";
      if (titleText) {
        const sub = document.createElement("span");
        sub.className = "sub-desc";
        sub.textContent = titleText;
        wrap.appendChild(sub);
      }
      const p = document.createElement("p");
      p.className = "desc-2";
      p.textContent = block.body != null ? String(block.body) : "";
      wrap.appendChild(p);
      rightContainer.insertBefore(wrap, linksEl);
    });
  }

  renderLinks(linksEl, links, lead) {
    linksEl.replaceChildren();
    if (lead.title) {
      const title = document.createElement("p");
      title.className = "links__title sub-desc";
      title.textContent = lead.title;
      linksEl.appendChild(title);
    }
    if (lead.body) {
      const intro = document.createElement("p");
      intro.className = "links__intro desc-2";
      intro.textContent = lead.body;
      linksEl.appendChild(intro);
    }
    links.forEach(function (link) {
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;
      if (link.external) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      linksEl.appendChild(a);
    });
  }

  async load() {
    const left = document.querySelector(".hero .text-block .left-container");
    const right = document.querySelector(".hero .text-block .right-container");
    const linksEl = right && right.querySelector(".links");
    if (!left || !right || !linksEl) return;

    let payload;
    try {
      const res = await fetch(this.fetchUrl, { credentials: "same-origin" });
      if (!res.ok) throw new Error(res.statusText);
      payload = await res.json();
    } catch (e) {
      console.error("[rasvs-cms] Failed to load CMS JSON", e);
      left.removeAttribute("aria-busy");
      window.dispatchEvent(
        new CustomEvent("heroCmsError", { detail: { error: e } }),
      );
      return;
    }

    const page = RasvsCms.normalizePayload(payload);
    if (!page) {
      console.error("[rasvs-cms] Invalid CMS payload");
      left.removeAttribute("aria-busy");
      window.dispatchEvent(new CustomEvent("heroCmsError"));
      return;
    }

    this.renderFacts(left, page.facts);
    this.appendLocaleSwitch(left, payload.locale);
    const localeMobile = document.getElementById("rasvs-locale-mobile");
    if (localeMobile) {
      this.appendLocaleSwitch(localeMobile, payload.locale, {
        wrapClass: "rasvs-locale-mobile__inner",
        linkClass: "desc-2 rasvs-locale-switch__link rasvs-locale-mobile__link",
      });
    }
    this.renderAboutBlocks(right, page.aboutBlocks);
    this.renderLinks(linksEl, page.links, {
      title: page.linksContextTitle,
      body: page.linksContext,
    });
    linksEl.setAttribute("aria-label", RasvsCms.LINKS_ARIA_LABEL);
    left.removeAttribute("aria-busy");

    window.dispatchEvent(new CustomEvent("heroCmsReady", { detail: page }));
  }

  start() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.load());
    } else {
      this.load();
    }
  }
}

new RasvsCms().start();
