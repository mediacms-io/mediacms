import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (typeof window !== 'undefined') {
  window.MEDIA_DATA = {
    videoUrl: "",
    mediaId: ""
  };
}

declare global {
  interface Window {
    MEDIA_DATA: {
      videoUrl: string;
      mediaId: string;
    };
    seekToFunction?: (time: number) => void;
  }
}

// Mount the components when the DOM is ready
const mountComponents = () => {
  const trimContainer = document.getElementById("video-editor-trim-root");
  if (trimContainer) {
    const trimRoot = createRoot(trimContainer);
    trimRoot.render(<App />);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountComponents);
} else {
  mountComponents();
}