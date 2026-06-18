"use client";

import { useEffect, useState } from "react";
import { Keyboard, Bot, Sparkles, Calendar, Layers, ShieldCheck } from "lucide-react";

const PILLARS = [
  {
    icon: Keyboard,
    title: "Superhuman Navigation",
    desc: "Archive, reply, snooze, or search with zero mouse clicks.",
  },
  {
    icon: Bot,
    title: "AI Draft Agent",
    desc: "Describe your reply in plain text and watch a professional response write itself.",
  },
  {
    icon: Sparkles,
    title: "Daily Morning Brief",
    desc: "Wake up to a 3-sentence summary of yesterday's most critical email threads.",
  },
  {
    icon: Calendar,
    title: "Integrated Scheduling",
    desc: "Insert calendar slots directly into your draft with a keyboard shortcut.",
  },
  {
    icon: Layers,
    title: "Unified Accounts",
    desc: "Connect multiple Google, Workspace, or custom accounts under one unified priority view.",
  },
  {
    icon: ShieldCheck,
    title: "DPDP & GST Compliant",
    desc: "100% of data is stored in secure Indian datacenters with full local encryption.",
  },
];

export default function FeatureSlider({ need = 2 }) {
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => (prev + 1) % PILLARS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const visibleCards = [
    PILLARS[startIndex]!,
    PILLARS[(startIndex + 1) % PILLARS.length]!,
  ];

  const iconColors = ["#e61f2a", "#0067ff"];

  if (need === 1) {
    return (
      <div className="w-full leading-normal font-sans p-0">
        {visibleCards.map((item, i: number) => {
          if (i > 0) return null;
          const Icon = item.icon;

          return (
            <div
              key={i}
              className={`w-full leading-normal transition-all duration-500 font-sans border-2 p-2.5 rounded-2xl ${
                startIndex % 2 === 0 ? "bg-[#dbeaff]" : "bg-[#ff00002e]"
              } backdrop-blur-md`}
            >
              <div className="flex items-center justify-center md:max-w-50 lg:max-w-[305px] xl:max-w-[375px] 2xl:max-w-100 leading-normal flex-col">
                <span className="flex justify-center items-center h-12.5 w-15 rounded-[28px] aspect-square">
                  <Icon
                    className="h-20 w-20 transition-all duration-500"
                    style={{ color: iconColors[startIndex % 2 ? 0 : 1] }}
                  />
                </span>

                <div className="flex flex-col justify-center items-center mt-2">
                  <p className="text-justify font-semibold text-black text-[19px] leading-snug">
                    {item.title}
                  </p>
                  <p className="text-center font-normal text-black text-[14px] mt-1">
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative justify-between lg:min-w-[98vw] xl:min-w-[92vw] 2xl:min-w-[90vw] lg:flex hidden top-[700px] leading-normal font-sans">
      {visibleCards.map((item, i) => {
        const Icon = item.icon;

        return (
          <div
            key={i}
            className="flex align-center justify-center md:max-w-50 lg:max-w-[305px] xl:max-w-[375px] 2xl:max-w-100 leading-normal"
          >
            <span className="flex justify-center items-center lg:w-[75px] lg:h-[75px] xl:w-25 xl:h-25 rounded-[28px] aspect-square mr-4">
              <Icon
                className="h-20 w-20"
                style={{ color: iconColors[i] }}
              />
            </span>

            <div className="flex flex-col justify-center">
              <p className="text-justify font-semibold text-black text-[22px] leading-snug">
                {item.title}
              </p>
              <p className="text-justify font-normal text-black text-[16px]">
                {item.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
