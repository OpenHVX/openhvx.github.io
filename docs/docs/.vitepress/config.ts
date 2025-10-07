import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "OpenHVX Docs",
  description:
    "Open-source IaaS for Hyper-V — multi-tenant, API-first, agent-based automation.",

  base: "/docs/", // hébergé sous openhvx.org/docs

  themeConfig: {
    logo: "/assets/logo.svg",
    siteTitle: "OpenHVX",
    outline: [2, 3],
    lastUpdated: true,
    search: {
      provider: "local",
    },

    // --- Navbar ---
    nav: [
      { text: "Home", link: "/" },
      { text: "Architecture", link: "/architecture" },
      { text: "API", link: "/api" },
      { text: "Agents", link: "/agents" },
      { text: "GitHub", link: "https://github.com/openhvx" },
    ],

    // --- Sidebar ---
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Overview", link: "/index" },
          { text: "Quick Start", link: "/getting-started" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "High-level Design", link: "/architecture" },
          { text: "Control Plane", link: "/control-plane" },
          { text: "Agent Lifecycle", link: "/agent-lifecycle" },
          { text: "Inventory Merge Logic", link: "/inventory-merge" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "Endpoints", link: "/api" },
          { text: "Schemas", link: "/schemas" },
          { text: "Errors", link: "/errors" },
        ],
      },
      {
        text: "Agents",
        items: [
          { text: "Overview", link: "/agents" },
          { text: "Hyper-V Agent", link: "/agents/hyperv" },
          { text: "Tasks & Inventory", link: "/agents/tasks" },
        ],
      },
      {
        text: "Contributing",
        items: [
          { text: "How to Contribute", link: "/contributing" },
          { text: "Code Style", link: "/code-style" },
        ],
      },
    ],

    // --- Social Links ---
    socialLinks: [
      { icon: "github", link: "https://github.com/openhvx" },
      { icon: "twitter", link: "https://x.com/OpenHVX" },
    ],

    // --- Footer ---
    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "© 2025 OpenHVX. Built with ❤️ by the community.",
    },
  },

  head: [
    ["meta", { name: "theme-color", content: "#10B981" }],
    ["link", { rel: "icon", href: "/assets/logo.svg", type: "image/svg+xml" }],
    ["meta", { property: "og:title", content: "OpenHVX Docs" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Open-source IaaS for Hyper-V — multi-tenant, API-first, agent-based automation.",
      },
    ],
    ["meta", { property: "og:image", content: "/assets/og-cover.png" }],
  ],
});
