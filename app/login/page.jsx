"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      captchaToken,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-sm rounded-xl border border-foreground/10 bg-white/5 backdrop-blur p-6 shadow-lg">
        <h1 className="text-2xl font-semibold mb-1">Admin Login</h1>
        <p className="text-sm text-foreground/70 mb-6">Use email and password to continue.</p>
        {error ? (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-foreground/40"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="relative space-y-1">
            <label className="text-sm" htmlFor="password">Password</label>
            {/* --- This is the corrected input element --- */}
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-foreground/40"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 top-6 flex items-center pr-3 text-foreground/50 hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
            onChange={(token) => setCaptchaToken(token)}
          />

          <button
            type="submit"
            disabled={loading || !captchaToken}
            className="w-full rounded-md bg-foreground text-background py-2 font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        
      </div>
    </div>
  );
}