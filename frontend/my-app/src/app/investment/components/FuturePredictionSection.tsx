"use client";

import React, { useState } from "react";
import FuturePredictionModal from "./FuturePredictionModal";

interface Holding {
  ticker: string;
  name: string;
}

export default function FuturePredictionSection({ holdings }: { holdings: Holding[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="relative mb-6 group w-full">
        {/* Glow behind the button */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
        
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#0a0f1d] border border-white/10 rounded-xl hover:bg-white/5 transition-colors overflow-hidden"
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
          
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wide text-base">
            G O &nbsp; T O &nbsp; F U T U R E
          </span>
        </button>
      </div>

      <FuturePredictionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        holdings={holdings}
      />
    </>
  );
}
