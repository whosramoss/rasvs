"use strict";

class RasvsMetadata {
  static TITLE = "RASVS";
  static SITE_URL = "https://rasvs.whosramoss.com";
  static DESCRIPTION =
    "RASVS: RAG focused on OWASP ASVS—cited answers from the standard.";
  static THUMBNAIL_PATH = "/thumbnail.png";
  static BRAND_COLOR = "#5D3136";
  static OG_IMAGE_WIDTH = "526";
  static OG_IMAGE_HEIGHT = "275";

  static thumbnailAbsoluteUrl() {
    return `${RasvsMetadata.SITE_URL}${RasvsMetadata.THUMBNAIL_PATH}`;
  }

  static LINK_TAGS = [
    { rel: "canonical", href: RasvsMetadata.SITE_URL },
    { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: RasvsMetadata.THUMBNAIL_PATH },
  ];

  static META_TAGS = [
    { name: "description", content: RasvsMetadata.DESCRIPTION },
    { name: "robots", content: "index, follow" },
    {
      name: "keywords",
      content: "rag, asvs, owasp, application security verification standard",
    },
    { name: "author", content: "whosramoss" },
    { name: "msapplication-TileColor", content: RasvsMetadata.BRAND_COLOR },
    { name: "theme-color", content: RasvsMetadata.BRAND_COLOR },
    { property: "og:title", content: RasvsMetadata.TITLE },
    { property: "og:description", content: RasvsMetadata.DESCRIPTION },
    { property: "og:site_name", content: "rasvs" },
    { property: "og:locale", content: "en" },
    { property: "og:url", content: RasvsMetadata.SITE_URL },
    { property: "og:type", content: "website" },
    {
      property: "og:image",
      content: RasvsMetadata.thumbnailAbsoluteUrl(),
    },
    {
      property: "og:image:secure_url",
      content: RasvsMetadata.thumbnailAbsoluteUrl(),
    },
    {
      property: "og:image:width",
      content: RasvsMetadata.OG_IMAGE_WIDTH,
    },
    {
      property: "og:image:height",
      content: RasvsMetadata.OG_IMAGE_HEIGHT,
    },
    { property: "og:image:alt", content: RasvsMetadata.TITLE },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: RasvsMetadata.TITLE },
    {
      name: "twitter:description",
      content: RasvsMetadata.DESCRIPTION,
    },
    {
      name: "twitter:image",
      content: RasvsMetadata.thumbnailAbsoluteUrl(),
    },
    {
      name: "twitter:image:secure_url",
      content: RasvsMetadata.thumbnailAbsoluteUrl(),
    },
    {
      property: "twitter:image:width",
      content: RasvsMetadata.OG_IMAGE_WIDTH,
    },
    {
      property: "twitter:image:height",
      content: RasvsMetadata.OG_IMAGE_HEIGHT,
    },
    { name: "twitter:image:alt", content: RasvsMetadata.TITLE },
  ];

  _upsertMetaTag(def) {
    const keyAttr = def.name ? "name" : "property";
    const keyValue = def[keyAttr];
    if (!keyValue) return;
    const selector = `meta[${keyAttr}="${keyValue}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      document.head.appendChild(el);
    }
    el.setAttribute(keyAttr, keyValue);
    el.setAttribute("content", def.content);
  }

  _upsertLinkTag(def) {
    const selector = `link[rel="${def.rel}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      document.head.appendChild(el);
    }
    el.setAttribute("rel", def.rel);
    el.setAttribute("href", def.href);
    if (def.type != null && def.type !== "") {
      el.setAttribute("type", def.type);
    } else {
      el.removeAttribute("type");
    }
  }

  apply() {
    document.title = RasvsMetadata.TITLE;
    RasvsMetadata.LINK_TAGS.forEach((def) => this._upsertLinkTag(def));
    RasvsMetadata.META_TAGS.forEach((def) => this._upsertMetaTag(def));
  }
}

new RasvsMetadata().apply();
