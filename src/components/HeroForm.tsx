"use client";
import React, { useState } from "react";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema } from "@/schemas/registerForm.schema";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type FormValues = z.infer<typeof formSchema>;

const HeroForm = () => {
  const router = useRouter();
  const [show, setShow] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      setServerError("");

      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        setServerError("User already exists with this email or phone number");
        alert(
          "An account already exists with this email or phone number. Please log in to continue."
        );
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json();
        setServerError(errorData?.message || "OOPS! Something Went Wrong");
        return;
      }

      alert("Registration successful! Please check your email to verify your account before logging in.");
      router.push("/login");
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        className="flex flex-col gap-3.5 w-full"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div>
          <input
            className="w-full text-zinc-800 block text-[15px] appearance-none relative z-[1] h-[50px] leading-none bg-white border border-[#ebd5bc] rounded-full px-6 focus:outline-none focus:border-[#d9b58f] transition-all placeholder-zinc-400"
            placeholder="Full Name"
            style={{ borderColor: errors.name ? "#ff0000" : "" }}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-red-500 text-[12px] mt-1 pl-4">{errors.name.message}</p>
          )}
        </div>

        <div>
          <input
            className="w-full text-zinc-800 block text-[15px] appearance-none relative z-[1] h-[50px] leading-none bg-white border border-[#ebd5bc] rounded-full px-6 focus:outline-none focus:border-[#d9b58f] transition-all placeholder-zinc-400"
            placeholder="Email"
            {...register("email")}
            style={{ borderColor: errors.email ? "#ff0000" : "" }}
          />
          {errors.email && (
            <p className="text-red-500 text-[12px] mt-1 pl-4">{errors.email.message}</p>
          )}
        </div>

        <div className="relative">
          <input
            type={show ? "text" : "password"}
            className="w-full text-zinc-800 block text-[15px] appearance-none relative z-[1] h-[50px] leading-none bg-white border border-[#ebd5bc] rounded-full pl-6 pr-12 focus:outline-none focus:border-[#d9b58f] transition-all placeholder-zinc-400"
            style={{ borderColor: errors.password ? "#ff0000" : "" }}
            placeholder="Password"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute z-10 right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
          >
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          {errors.password && (
            <p className="text-red-500 text-[12px] mt-1 pl-4">{errors.password.message}</p>
          )}
        </div>

        <div>
          <input
            className="w-full text-zinc-800 block text-[15px] appearance-none relative z-[1] h-[50px] leading-none bg-white border border-[#ebd5bc] rounded-full px-6 focus:outline-none focus:border-[#d9b58f] transition-all placeholder-zinc-400"
            style={{ borderColor: errors.phone ? "#ff0000" : "" }}
            placeholder="Phone"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-red-500 text-[12px] mt-1 pl-4">{errors.phone.message}</p>
          )}
        </div>

        <div className="text-center text-[12px] mt-1 px-2 text-zinc-500 leading-relaxed font-normal">
          By continuing, I agree to the{" "}
          <Link className="text-[#e31b23] hover:underline whitespace-nowrap" href="/terms">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link className="text-[#e31b23] hover:underline whitespace-nowrap" href="/privacy">
            Privacy Policy.
          </Link>
        </div>

        <button
          disabled={loading}
          className="mt-2 w-full h-[50px] bg-[#e31b23] hover:bg-[#c81822] text-white rounded-full font-bold text-[15px] tracking-wider uppercase transition cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed border-none"
        >
          {loading ? "Submitting..." : "GET STARTED"}
        </button>

        {serverError && (
          <p className="text-red-600 text-sm font-medium text-center mt-2">{serverError}</p>
        )}
      </form>
    </>
  );
};

export default HeroForm;
