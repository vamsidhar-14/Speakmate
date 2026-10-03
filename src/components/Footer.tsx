import React from 'react';
import { SpeakMateLogo } from './SpeakMateLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="relative z-10 text-center py-10 px-6 border-t border-[rgba(0,200,255,0.12)] bg-[#010812]">
      <div className="flex justify-center mb-3">
        <SpeakMateLogo size={32} showText={true} textClassName="text-xl" />
      </div>
      <p className="text-xs text-[#8299aa] max-w-md mx-auto mb-2">
        Practice speaking. Build confidence. Prepare for your professional career.
      </p>
      <div className="flex flex-wrap justify-center gap-5 text-xs text-[#5f788b] my-3">
        <span>Engineering Placements</span>
        <span>•</span>
        <span>Group Discussions</span>
        <span>•</span>
        <span>Mock HR & Technical Interviews</span>
        <span>•</span>
        <span>Peer Collaboration</span>
      </div>
      <div className="text-[11px] text-[#475d6e]">
        © 2026 SpeakMate. All rights reserved.
      </div>
    </footer>
  );
};
