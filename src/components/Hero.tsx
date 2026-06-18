import React from "react";
import FeatureSlider from "./FeatureSlider";
import HeroForm from "./HeroForm";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Hero = () => {
  return (
    <>
      <section
        className="relative w-full flex justify-center items-start pt-28 overflow-x-visible sm:rounded-b-[140px] rounded-b-[70px] bg-[url('/images/login-banner-bg.jpg')] bg-[linear-gradient(275deg,_rgb(205,214,229)_0%,_rgb(211,246,242)_100%)] bg-no-repeat bg-cover bg-center sm:h-[118vh] h-[105vh] max-h-[1100px] min-h-[900px] lg:min-h-[1100px]"
      >
        <div
          className="absolute z-10 w-full max-w-[1100px] text-center px-4 md:bottom-[-70px] sm:bottom-[-24px] bottom-0 [@media_(min-width:2030px)_and_(max-width:3000px)]:scale-[1.25]"
        >
          <h1
            className="animate-fade-up [@media_(min-width:550px)_and_(max-width:640px)]:text-[64px] [@media_(min-width:480px)_and_(max-width:550px)]:text-[56px] [@media_(min-width:400px)_and_(max-width:480px)]:text-[48px] [@media_(min-width:0px)_and_(max-width:400px)]:text-[40px] sm:text-[72px] md:text-[84px] lg:text-[100px] font-bold lg:font-semibold tracking-normal lg:tracking-[-1px] leading-tight font-sans text-[#0067ff]"
          >
            The AI-first email <br /> client for teams.
          </h1>

          <p
            className="text-center animate-fade-up mt-4 text-[#343434] mx-auto relative left-1/2 -translate-x-1/2 sm:min-w-[80vw] [@media_(min-width:550px)_and_(max-width:640px)]:text-[19px] [@media_(min-width:480px)_and_(max-width:550px)]:text-[16px] [@media_(min-width:400px)_and_(max-width:480px)]:text-[14px] [@media_(min-width:0px)_and_(max-width:400px)]:text-[13px] sm:text-[22px] md:text-[29px] lg:text-[35px]"
          >
            Gusion Mail syncs with Gmail to deliver speed. Draft complete replies in seconds, summarize long threads automatically, and manage contacts in a beautiful interface.
          </p>

          <p
            className="text-center animate-fade-up mt-3 text-[#0067ff] font-medium italic [@media_(min-width:0px)_and_(max-width:480px)]:text-[11px] [@media_(min-width:480px)_and_(max-width:640px)]:text-[12px] sm:text-[14px] md:text-[16px] lg:text-[18px]"
          >
            Keyboard-first navigation meets generative AI speed.
          </p>

          <div className="relative">
            <div className="mx-auto mt-10 bg-[#fff2e0]  rounded-[70px] p-8 pb-10 w-full max-w-[380px] flex items-center flex-col">
              <h3 className="text-center text-[16px] font-medium mb-4 text-zinc-800 leading-tight">
                Get started with your <br />
                <span className="font-bold text-[22px] text-zinc-900 mt-1 block">14-day Pro trial</span>
              </h3>

              <HeroForm />
            </div>
            
            <div
              className="w-[100px] h-[100px] absolute top-[343px] left-[245px] max-[1100px]:left-[calc(245px+0.5*(100vw-1100px))] overflow-hidden z-[-1] before:content-[''] before:block before:w-[200%] before:h-[200%] before:absolute before:bottom-0 before:right-0 before:rounded-full before:shadow-[50px_50px_0_0_rgb(255,242,224)] hidden lg:block"
            ></div>

            <div
              className="w-[100px] h-[100px] absolute top-[343px] right-[245px] max-[1100px]:right-[calc(245px+0.5*(100vw-1100px))] overflow-hidden z-[-1] hidden lg:block before:content-[''] before:block before:w-[200%] before:h-[200%] before:absolute before:bottom-0 before:left-0 before:rounded-full before:shadow-[-50px_50px_0_0_rgb(255,242,224)]"
            ></div>
          </div>
        </div>

        <ErrorBoundary name="hero-feature-slider">
          <FeatureSlider />
        </ErrorBoundary>
      </section>
    </>
  );
};

export default Hero;
