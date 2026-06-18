import React from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input2";
import { cn } from "@/lib/utils";

interface SignupFormDemoProps {
  formData: {
    name: string;
    mobile: string;
    email: string;
  };
  isSubmitting: boolean;
  mobileError: string;
  emailError?: string;
  submitStatus: {
    type: "success" | "error" | null;
    message: string;
  };
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function SignupFormDemo({
  formData,
  isSubmitting,
  mobileError,
  emailError,
  submitStatus,
  handleChange,
  handleSubmit,
}: SignupFormDemoProps) {
  /**
   * 🔹 Centralized message priority
   * 1. Email error
   * 2. Mobile error
   * 3. Submit status (success / error)
   */
  const displayMessage =
    emailError
      ? { type: "error", message: emailError }
      : mobileError
      ? { type: "error", message: mobileError }
      : submitStatus.type
      ? submitStatus
      : null;

  return (
    <div className="md:pt-10 pt-1">
      <h2 className="text-xl font-bold text-white">
        Request A Callback!
      </h2>
      <p className="mt-2 max-w-sm text-sm text-white">
        One of our expert counselors will be in touch with you shortly.
      </p>

      <form className="my-6" onSubmit={handleSubmit}>
        <div className="mb-4 flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
          
          {/* Full Name */}
          <LabelInputContainer>
            <Label htmlFor="name" className="text-white">
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              name="name"
              placeholder="Your Name"
              required
              value={formData.name}
              onChange={handleChange}
              className="form-control bg-[#94b3e17d] text-white placeholder:text-white/80"
            />
          </LabelInputContainer>

          {/* Email */}
          <LabelInputContainer>
            <Label htmlFor="email" className="text-white">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              name="email"
              placeholder="Your Email"
              required
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              inputMode="email"
              pattern="^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
              title="Please enter a valid email address"
              className="form-control bg-[#94b3e17d] text-white placeholder:text-white/80"
            />
          </LabelInputContainer>

          {/* Mobile */}
          <LabelInputContainer>
            <Label htmlFor="mobile" className="text-white">
              Mobile Number
            </Label>
            <Input
              id="mobile"
              type="tel"
              name="mobile"
              placeholder="Mobile Number (10 digits)"
              required
              value={formData.mobile}
              onChange={handleChange}
              maxLength={10}
              className="form-control bg-[#94b3e17d] text-white placeholder:text-white/80"
            />
          </LabelInputContainer>
        </div>

        {/* 🔥 SINGLE MESSAGE AREA */}
        {displayMessage && (
          <div
            className={cn(
              "mt-3 text-sm font-medium",
              displayMessage.type === "success"
                ? "text-green-400"
                : "text-red-500"
            )}
          >
            {displayMessage.message}
          </div>
        )}
      </form>
    </div>
  );
}

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};
