"use client";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import LoginForm from "./LoginForm";
import RightFormRotations from "./RightFormRotations";

const LoginMain = () => {
  return (
    <>
      <div className="min-h-screen relative overflow-hidden bg-[#fff2e0]">
        {/* Warm gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#fffaf5] via-[#fff2e0] to-[#ffe0d3]" />

        {/* Color blobs + glass orbit */}
        <div className="pointer-events-none absolute inset-0 hidden sm:block">
          <div className="absolute -top-24 -right-20 h-80 w-80 rounded-full bg-[#e61f2a]/18 blur-3xl" />
          <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-[#0067ff]/16 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-[22rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-[999px] border border-white/50 bg-white/10 backdrop-blur-3xl" />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:py-0">
          <motion.div
            layoutId="auth-container"
            className="w-full max-w-5xl grid items-center lg:grid-cols-[1.15fr_minmax(0,1fr)]
        rounded-[30px] 
        bg-[url('https://cdn.gusion.omsoftwares.in/images/login-banner-bg.jpg')] bg-[linear-gradient(275deg,_rgb(205,214,229)_0%,_rgb(211,246,242)_100%)] bg-no-repeat bg-cover bg-center
        shadow-2xl overflow-hidden
        "
          >
            {/* Left: Rotating Features */}
            <RightFormRotations
              ctaBtnText="Register now"
              ctaQuestion="Don't have an account yet?"
              ctaRoute="/register"
              isRight={false}
            />

            {/* Right: login card */}
            <Card
              className="relative w-full h-full flex flex-col justify-center bg-white/60 backdrop-blur-xl  border-0  shadow-xl rounded-[30px] p-6 sm:p-10
          
          "
            >
              <CardHeader className="space-y-4 pb-6 pt-0 px-0">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff2e0] shadow-sm mb-2">
                  <Lock size={24} className="text-[#e61f2a]" />
                </div>

                <div className="space-y-1 text-center">
                  <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
                    Sign in with email
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Access your Gusion inbox and manage your team workflows.
                  </p>
                </div>
              </CardHeader>

              <CardContent className="px-0 pb-0">
                <LoginForm />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default LoginMain;
