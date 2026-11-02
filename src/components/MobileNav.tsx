import React from "react";
import { Music, ListMusic, Upload } from "lucide-react";
import { NavigationTab } from "../types/music";

interface MobileNavProps {
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, setCurrentTab }) => {
  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 transition-all w-full max-w-full box-border"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="grid grid-cols-3 w-full h-[58px] items-center">
        {/* Tab 1: Library */}
        <button
          id="mobile-nav-library"
          onClick={() => setCurrentTab("library")}
          className={`flex flex-col items-center justify-center h-full w-full py-1.5 transition-colors cursor-pointer touch-manipulation ${
            currentTab === "library"
              ? "text-blue-600 font-bold"
              : "text-slate-500 hover:text-slate-900 active:text-blue-600 font-medium"
          }`}
          aria-label="Menu Library Musik"
        >
          <div className={`p-1 rounded-xl transition-all ${currentTab === "library" ? "bg-blue-50" : ""}`}>
            <Music className="w-5 h-5" />
          </div>
          <span className="text-[10px] leading-tight mt-0.5">Library</span>
        </button>

        {/* Tab 2: Playlist */}
        <button
          id="mobile-nav-playlist"
          onClick={() => setCurrentTab("playlist")}
          className={`flex flex-col items-center justify-center h-full w-full py-1.5 transition-colors cursor-pointer touch-manipulation ${
            currentTab === "playlist"
              ? "text-blue-600 font-bold"
              : "text-slate-500 hover:text-slate-900 active:text-blue-600 font-medium"
          }`}
          aria-label="Menu Playlist"
        >
          <div className={`p-1 rounded-xl transition-all ${currentTab === "playlist" ? "bg-blue-50" : ""}`}>
            <ListMusic className="w-5 h-5" />
          </div>
          <span className="text-[10px] leading-tight mt-0.5">Playlist</span>
        </button>

        {/* Tab 3: Upload */}
        <button
          id="mobile-nav-upload"
          onClick={() => setCurrentTab("upload")}
          className={`flex flex-col items-center justify-center h-full w-full py-1.5 transition-colors cursor-pointer touch-manipulation ${
            currentTab === "upload"
              ? "text-blue-600 font-bold"
              : "text-slate-500 hover:text-slate-900 active:text-blue-600 font-medium"
          }`}
          aria-label="Menu Upload Musik"
        >
          <div className={`p-1 rounded-xl transition-all ${currentTab === "upload" ? "bg-blue-50" : ""}`}>
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-[10px] leading-tight mt-0.5">Upload</span>
        </button>
      </div>
    </nav>
  );
};

