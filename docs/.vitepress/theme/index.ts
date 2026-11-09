import DefaultTheme from "vitepress/theme";
import "./custom.css";

let mermaidReady = false;

async function renderMermaid() {
  if (typeof window === "undefined") return;

  const mermaid = (await import("mermaid")).default;

  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: document.documentElement.classList.contains("dark")
        ? "dark"
        : "neutral",
      flowchart: { curve: "basis" },
      sequence: {
        actorMargin: 28,
        messageMargin: 36,
        mirrorActors: false,
        useMaxWidth: true,
      },
    });
    mermaidReady = true;
  }

  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid:not([data-processed])"),
  );
  if (!nodes.length) return;

  await mermaid.run({ nodes });
}

export default {
  ...DefaultTheme,
  enhanceApp({ router }) {
    if (typeof window === "undefined") return;

    const schedule = () => {
      window.setTimeout(() => {
        void renderMermaid();
      }, 50);
    };

    schedule();
    router.onAfterRouteChanged = schedule;
  },
};
