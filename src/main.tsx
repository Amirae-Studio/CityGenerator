import "./theme-init";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
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
