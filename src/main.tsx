import "./theme-init";
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-500.css";
import "@fontsource/instrument-sans/latin-600.css";
import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-700.css";
// Frame text fonts (self-hosted for MakerLab's CSP; Latin only, to keep the build small). Each file downloads only
// when a frame label actually uses that font.
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/oswald/latin-700.css";
import "@fontsource/dancing-script/latin-700.css";
import "@fontsource/pacifico/latin-400.css";
import "@fontsource/lobster/latin-400.css";
import "@fontsource/permanent-marker/latin-400.css";
import "@fontsource/orbitron/latin-700.css";
import "./globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/lib/theme";
import { MakerLabProvider } from "@/lib/makerlab/MakerLabProvider";
import { ExploreWorld } from "@/components/explore/ExploreWorld";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <MakerLabProvider>
        <ExploreWorld />
      </MakerLabProvider>
    </ThemeProvider>
  </StrictMode>
);
