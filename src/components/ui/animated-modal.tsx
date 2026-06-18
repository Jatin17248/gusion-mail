"use client";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
// import { useLenis } from "lenis/react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMobileOptimization } from "@/hooks/useMobileOptimization";


interface ModalContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <ModalContext.Provider value={{ open, setOpen }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

export function Modal({ children }: { children: ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}

export const ModalTrigger = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { setOpen } = useModal();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (

    <button
      id="modal-btn"
      className={cn(
        "px-4 py-2 rounded-md text-black dark:text-white text-center relative overflow-hidden",
        className
      )}
      onClick={() => setOpen(true)}
    >
      {children}


    </button>

  );
};

export const ModalBody = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { open } = useModal();
  const { isMobile, shouldReduceAnimations, springConfig, enableBlur } = useMobileOptimization();

  const isDesktop: boolean = useMediaQuery("(min-width: 1024px)");
  const isHeight: boolean = useMediaQuery("(min-height: 930px)");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [open]);

  // Use ref only on client to avoid SSR mismatch
  const modalRef = useRef<HTMLDivElement>(null);

  const { setOpen } = useModal();
  useOutsideClick(modalRef as React.RefObject<HTMLDivElement>, () => setOpen(false));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{
            opacity: 0,
            padding: "40px"
          }}
          animate={{
            opacity: 1,
            padding: "40px",
            backdropFilter: enableBlur ? "blur(10px)" : "none",
          }}
          exit={{
            opacity: 0,
            backdropFilter: "blur(0px)",
          }}
          className={`fixed [perspective:800px] [transform-style:preserve-3d] inset-0 h-full w-full  flex items-center justify-center z-[101] !pt-10 ${isHeight && isDesktop ? 'flex-col' : ''} `}
        >
          <Overlay enableBlur={enableBlur} />

          <motion.div
            ref={modalRef}
            className={cn(
              "min-h-[50%] max-h-[100%] 2xl:max-w-[40%] md:max-w-[75%] lg:max-w-[65%]  border border-transparent dark:border-neutral-800 md:rounded-2xl relative z-50 flex flex-col flex-1 overflow-hidden bg-transparent",
              className
            )}
            initial={shouldReduceAnimations ? {
              opacity: 0,
              scale: 0.95,
              y: 20,
            } : {
              opacity: 0,
              scale: 0.5,
              rotateX: 40,
              y: 40,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotateX: 0,
              y: 0,
            }}
            exit={shouldReduceAnimations ? {
              opacity: 0,
              scale: 0.95,
            } : {
              opacity: 0,
              scale: 0.8,
              rotateX: 10,
            }}
            transition={springConfig}
          >
            <CloseIcon />
            {children}
          </motion.div>

          {isDesktop && isHeight && (
            <section className="relative px-4 max-w-270 text-center text-gray-100 flex items-center justify-center gap-2 mx-auto pb-2 text-[9rem] sm:text-[14rem] md:text-[16rem] lg:text-[18rem] leading-[1] pointer-events-none font-bold -mb-[11%] sm:-mb-[7%] duration-200 ease-in-out l-10">
              <div className="text-[#fae4c5] animate-[pulse_4s_infinite] drop-shadow-xl select-none opacity-40 z-100">
                Gusion
              </div>
              <div className="bg-linear-to-b from-transparent via-white to-white h-[20%] w-full absolute bottom-0 left-0 z-20"></div>
            </section>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ModalContent = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-col flex-1 p-8 md:p-10 bg-[#004ab9b3] justify-between backdrop-blur-lg", className)}>
      {children}
    </div>
  );
};

export const ModalFooter = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex justify-end p-4 bg-[#004ab9b3] backdrop-blur-lg border-t border-white px-8",
        className
      )}
    >
      {children}
    </div>
  );
};

const Overlay = ({ className, enableBlur = true }: { className?: string; enableBlur?: boolean }) => {
  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
        backdropFilter: enableBlur ? "blur(10px)" : "none",
      }}
      exit={{
        opacity: 0,
        backdropFilter: "blur(0px)",
      }}
      className={`fixed inset-0 h-full w-full bg-[#c8ccff33] bg-opacity-50 z-50  ${className}`}
    ></motion.div>
  );
};

const CloseIcon = () => {
  const { setOpen } = useModal();
  return (
    <button
      onClick={() => setOpen(false)}
      className="absolute top-4 right-4 group hover:cursor-pointer text-white z-1 scale-125"

    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className=" h-4 w-4 group-hover:scale-125 group-hover:rotate-3 transition duration-200"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M18 6l-12 12" />
        <path d="M6 6l12 12" />
      </svg>
    </button>
  );
};

export const useOutsideClick = (
  ref: React.RefObject<HTMLDivElement | null>,
  callback: (event: MouseEvent | TouchEvent) => void
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // DO NOTHING if the element being clicked is the target element or their children
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      callback(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, callback]);
};
