"use client";

import * as React from "react";
import { useIsMobile } from "./use-mobile";
import { useReducedMotion } from "./use-reduced-motion";

/**
 * Detects a low-powered device via CPU cores / RAM. Returns false during SSR
 * and the first client render (so it never introduces a hydration mismatch),
 * then resolves after mount.
 *
 * This is the main reason the page can feel laggy on "some devices" even on
 * desktop: a weak laptop/Chromebook at >=768px width is NOT "mobile" and has no
 * reduced-motion preference, so without this it would run the full animation
 * load (dozens of whileInView + scroll-linked motion components + WebGL).
 */
export function useIsLowEndDevice(): boolean {
    const [isLowEnd, setIsLowEnd] = React.useState(false);

    React.useEffect(() => {
        const nav = navigator as Navigator & {
            deviceMemory?: number;
            hardwareConcurrency?: number;
        };
        const cores = nav.hardwareConcurrency;
        const memory = nav.deviceMemory; // GB, Chrome-only

        const lowCores = typeof cores === "number" && cores > 0 && cores <= 4;
        const lowMemory = typeof memory === "number" && memory <= 4;

        if (lowCores || lowMemory) setIsLowEnd(true);
    }, []);

    return isLowEnd;
}

/**
 * A unified hook for performance optimization.
 * Combines mobile detection, reduced-motion preference, and low-end hardware
 * detection to provide consistent animation settings across the app.
 *
 * Note: Returns desktop-like values during SSR/hydration to prevent flicker.
 */
export function useMobileOptimization() {
    const isMobileRaw = useIsMobile();
    const prefersReducedMotion = useReducedMotion();
    const isLowEndDevice = useIsLowEndDevice();

    // During SSR/hydration (isMobileRaw === undefined), use desktop defaults
    // This prevents hydration mismatch and flicker
    const isMobile = isMobileRaw ?? false;
    const isHydrating = isMobileRaw === undefined;

    // Reduce animations on mobile, when the user prefers reduced motion, OR on
    // low-powered hardware (the common "laggy on some devices" case on desktop).
    const shouldReduceAnimations =
        (isMobile && !isHydrating) || prefersReducedMotion || isLowEndDevice;

    return React.useMemo(
        () => ({
            // Device detection
            isMobile,
            prefersReducedMotion,
            isLowEndDevice,

            // Computed optimization flags
            shouldReduceAnimations,

            // Animation durations (in seconds) - BALANCED for mobile (visible but quick)
            animationDuration: shouldReduceAnimations ? 0.15 : 0.3,
            fastDuration: shouldReduceAnimations ? 0.1 : 0.15,
            slowDuration: shouldReduceAnimations ? 0.2 : 0.5,

            // Framer Motion spring config - Quick tween on mobile
            springConfig: shouldReduceAnimations
                ? { type: "tween" as const, duration: 0.15, ease: "easeOut" as const }
                : { type: "spring" as const, stiffness: 260, damping: 20 },

            // Lighter spring for subtle animations
            lightSpringConfig: shouldReduceAnimations
                ? { type: "tween" as const, duration: 0.1, ease: "easeOut" as const }
                : { type: "spring" as const, stiffness: 400, damping: 25 },

            // Disable expensive effects on weak / mobile devices
            enableBlur: !isMobile && !isLowEndDevice,
            enableParallax: !shouldReduceAnimations,
            enable3D: !isMobile && !isLowEndDevice,

            // Touch optimization
            touchTargetSize: 44, // Apple HIG minimum

            // Skip whileInView on mobile / low-end to avoid IntersectionObserver overhead
            skipWhileInView: isMobile || isLowEndDevice,

            // Viewport settings for instant trigger on mobile (if whileInView is used)
            mobileViewport: { once: true, amount: 0 },

            // Utility function to get conditional animation props
            getAnimationProps: (desktopProps: Record<string, unknown>) =>
                shouldReduceAnimations
                    ? {
                        initial: false,
                        animate: desktopProps.animate || false,
                        transition: { duration: 0.15 }
                    }
                    : desktopProps,

            // Utility for whileInView - returns empty object on mobile / low-end
            getWhileInViewProps: (props: Record<string, unknown>) =>
                isMobile || isLowEndDevice ? {} : props,
        }),
        [isMobile, prefersReducedMotion, isLowEndDevice, shouldReduceAnimations]
    );
}

// Type export for consumers
export type MobileOptimization = ReturnType<typeof useMobileOptimization>;
