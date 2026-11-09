import { defineConfig } from "vitepress";
import lightbox from "vitepress-plugin-lightbox";

export default defineConfig({
  lang: "en-US",
  title: "OpenHVX Docs",
  description:
    "Open-source IaaS for Hyper-V - multi-tenant, API-first, agent-based automation.",

  base: "/docs/",
  outDir: "../dist/docs",
  themeConfig: {
    logo: "/assets/logo.png",
    siteTitle: "OpenHVX",
    outline: [2, 3],
    lastUpdated: true,
    search: { provider: "local" },

    nav: [
      { text: "Home", link: "/" },
      { text: "Quick Start", link: "/getting-started" },
      { text: "API", link: "/api" },
      { text: "Agents", link: "/agents" },
      { text: "GitHub", link: "https://github.com/openhvx" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Overview", link: "/" },
          { text: "Quick Start", link: "/getting-started" },
          { text: "Configuration", link: "/configuration" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "Control plane", link: "/architecture" },
          { text: "Task protocol", link: "/task-protocol" },
          { text: "Task flow", link: "/task-flow" },
          { text: "Agents", link: "/agents" },
          { text: "CLI", link: "/cli" },
        ],
      },
      {
        text: "API Reference",
        items: [{ text: "Endpoints", link: "/api" }],
      },
      {
        text: "Contributing",
        items: [{ text: "How to Contribute", link: "/contributing" }],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/openhvx" },
      { icon: "twitter", link: "https://x.com/OpenHVX" },
    ],

    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "© 2025 OpenHVX. Built with ❤️ by the community.",
    },
  },

  head: [
    ["meta", { name: "theme-color", content: "#10B981" }],
    ["link", { rel: "icon", href: "/assets/logo.png", type: "image/png" }],
    ["meta", { property: "og:title", content: "OpenHVX Docs" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Open-source IaaS for Hyper-V - multi-tenant, API-first, agent-based automation.",
      },
    ],
    ["meta", { property: "og:image", content: "/assets/logo.png" }],
  ],
  markdown: {
    config: (md) => {
      md.use(lightbox, {
        selector: "img[data-zoomable]",
        delay: 300,
        scrollOffset: 50,
      });
    },
  },
});
