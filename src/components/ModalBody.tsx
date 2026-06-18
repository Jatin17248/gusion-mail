"use client";
import React from "react";
import {
  ModalBody,
  ModalContent,
  ModalFooter,
  useModal,
} from "./ui/animated-modal";
import { motion } from "framer-motion";
import SignupFormDemo from "./signup-form-demo";

import Image from "next/image";

export default function ModalBody1() {
  const [formData, setFormData] = React.useState({
    name: "",
    mobile: "",
    email: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [mobileError, setMobileError] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [submitStatus, setSubmitStatus] = React.useState<{
    type: "success" | "error" | null;
    message: string;
  }>({
    type: null,
    message: "",
  });
  const { setOpen } = useModal();
  // Deterministic pseudo-random rotation to avoid SSR/CSR mismatch
  const seededRotation = React.useCallback((seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const normalized = (Math.sin(hash) + 1) / 2; // 0..1
    return normalized * 20 - 10; // -10..10
  }, []);
  const validateMobileNumber = (number: string): boolean => {
    // Check if number is valid 10 digit Indian number
    const regex = /^[6-9]\d{9}$/;
    if (!regex.test(number)) {
      setMobileError(
        "Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9"
      );
      return false;
    }
    setMobileError("");
    return true;
  };

  const validateEmailAddress = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "mobile") {
      // Only allow numbers
      if (value && !/^\d*$/.test(value)) {
        return;
      }
      // Clear error when user starts typing
      if (mobileError) {
        setMobileError("");
      }
    }

    if (name === "email") {
      if (emailError) {
        setEmailError("");
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) {
      e.preventDefault();
    }

    // Validate email and mobile before submission
    const isEmailValid = validateEmailAddress(formData.email);
    const isMobileValid = validateMobileNumber(formData.mobile);
    if (!isEmailValid || !isMobileValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Replace with actual API endpoint
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          type: "callback_request",
        }),
      });

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: "Callback request submitted successfully!",
        });
        setFormData({ name: "", mobile: "", email: "" });
      } else {
        setSubmitStatus({
          type: "error",
          message: "Failed to submit callback request.",
        });
      }
    } catch (error) {
      setSubmitStatus({ type: "error", message: "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookNowClick = () => {
    // Call handleSubmit directly
    handleSubmit();
  };


  const images = ["https://cdn.gusion.omsoftwares.in/images/onboarding/step1.webp", "https://cdn.gusion.omsoftwares.in/images/onboarding/step2.webp", "https://cdn.gusion.omsoftwares.in/images/onboarding/step4.webp", "https://cdn.gusion.omsoftwares.in/images/onboarding/step6.webp"];
  return (
    <ModalBody>
      <ModalContent>
        <h4 className="text-lg md:text-2xl  text-white font-bold text-center mb-4">
          Reviews that create{" "}
          <span className="px-1 py-0.5 rounded-md bg-white text-[#004ab9] border border-gray-200">
            Growth!
          </span>
          {" "} in your Business
        </h4>
        <div className="flex justify-center items-center max-[400px]:hidden">
          {images.map((image, idx) => (
            <motion.div
              key={"images" + idx}
              style={{
                rotate: seededRotation(String(idx)),
              }}
              whileHover={{
                scale: 1.1,
                rotate: 0,
                zIndex: 100,
              }}
              whileTap={{
                scale: 1.1,
                rotate: 0,
                zIndex: 100,
              }}

              // background: rgb(54, 106, 205);
              // border-color: blue;
              className="rounded-xl -mr-4 mt-4 p-1 bg-[#366acd] border border-[#366acd] shrink-0 overflow-hidden"
            >
              <Image
                src={image}
                alt="Gusion  "
                width={160}
                height={160}
                className="rounded-lg h-32 w-32 md:h-52 md:w-52 object-cover shrink-0"
                priority={idx < 2}
              />
            </motion.div>
          ))}
        </div>

        <SignupFormDemo
          formData={formData}
          isSubmitting={isSubmitting}
          mobileError={mobileError}
          emailError={emailError}
          submitStatus={submitStatus}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
        />
      </ModalContent>
      <ModalFooter className="gap-4">
        <button
          onClick={() => setOpen(false)}
          className="px-2 py-1 bg-[#ffffffcc] text-blue-700 hover:cursor-pointer  border border-gray-300 rounded-md text-sm w-28"
        >
          Cancel
        </button>
        <button
          onClick={handleBookNowClick}
          disabled={isSubmitting}
          className="bg-[#ffffff] text-blue-700 hover:cursor-pointer  text-sm px-2 py-1 rounded-md border border-[#fffff] w-28 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting..." : "Book Now"}
        </button>
      </ModalFooter>
    </ModalBody>
  );
}
