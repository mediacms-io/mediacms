import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize MEDIA_DATA to ensure it's available before components render
if (typeof window !== 'undefined') {
  window.MEDIA_DATA = {
    videoUrl: "",
    chapters: []
  };
}

// Type declaration for the global window object
declare global {
  interface Window {
    MEDIA_DATA: {
      videoUrl: string;
      chapters: Array<{
        id: string;
        title: string;
        timestamp: number;
      }>;
    };
    seekToFunction?: (time: number) => void;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
