import React from "react";
import Footer from "./Footer";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const FooterFixed: React.FC = () => {
  const isDesktop: boolean = useMediaQuery("(min-width: 1024px)");
  if (!isDesktop) {
    return (
      <>
        <Footer />
      </>
    );
  }
  return (
    <>
      <div
        className="relative h-[1050px] lg:h-[747px] xl:h-[733px] 2xl:h-[695px]"
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        <div className="relative h-[calc(100vh+1050px)] lg:h-[calc(100vh+747px)] xl:h-[calc(100vh+733px)] 2xl:h-[calc(100vh+695px)] -top-[100vh]">
          <div className="h-[1050px] lg:h-[747px] xl:h-[733px] 2xl:h-[695px] sticky top-[calc(100vh-1050px)] lg:top-[calc(100vh-747px)] xl:top-[calc(100vh-733px)] 2xl:top-[calc(100vh-695px)]">
            <Footer className="h-full" />
          </div>
        </div>
      </div>
    </>
  );
};

export default FooterFixed;
