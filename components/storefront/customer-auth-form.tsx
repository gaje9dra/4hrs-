"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

type Mode = "login" | "register";

type ApiError = { error?: { code?: string; message?: string } };

const GENERIC_AUTH_ERROR = "Authentication could not be completed. Please check your details and try again.";

function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (email.length > 320 || !email.includes("@") || /[\u0000-\u001F\u007F]/.test(email)) return "Enter a valid email address.";
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Enter your password.";
  if (value.length < 12) return "Password must be at least 12 characters.";
  if (new TextEncoder().encode(value).length > 1024) return "Password is too long.";
  return null;
}

export function CustomerAuthForm({ mode, redirectTo = "/" }: { mode: Mode; redirectTo?: string }) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "submitting" | "success">("idle");

  const isRegister = mode === "register";
  const safeRedirect = getSafeAuthRedirect(redirectTo);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(null);

    if (nextEmailError || nextPasswordError) {
      requestAnimationFrame(() => {
        if (nextEmailError) emailRef.current?.focus();
        else document.getElementById("auth-password")?.focus();
      });
      return;
    }

    setState("submitting");
    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const body = await response.json().catch(() => null) as ApiError | { authenticated?: boolean } | null;
      if (!response.ok) {
        const code = body && "error" in body ? body.error?.code : undefined;
        if (code === "RATE_LIMITED") {
          setFormError("Too many attempts. Please wait and try again.");
        } else if (code === "INVALID_INPUT") {
          setFormError("Please check the information entered and try again.");
        } else if (code === "CSRF_REJECTED") {
          setFormError("This request could not be verified. Refresh the page and try again.");
        } else {
          setFormError(GENERIC_AUTH_ERROR);
        }
        setState("idle");
        requestAnimationFrame(() => {
          if (code === "INVALID_INPUT") emailRef.current?.focus();
          else document.getElementById("auth-form-error")?.focus();
        });
        return;
      }

      setState("success");
      router.replace(safeRedirect);
      router.refresh();
    } catch {
      setState("idle");
      setFormError("Authentication is temporarily unavailable. Please try again.");
      requestAnimationFrame(() => document.getElementById("auth-form-error")?.focus());
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <p className="text-xs font-900 uppercase tracking-[0.25em] text-primary-blue">
          4HRS / Customer
        </p>
        <CardTitle>{isRegister ? "Create account" : "Sign in"}</CardTitle>
        <CardDescription>
          {isRegister
            ? "Create your 4HRS customer account with your email and a secure password."
            : "Sign in to manage your authenticated storefront session."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {formError ? (
          <div id="auth-form-error" tabIndex={-1} className="mb-5">
            <Alert variant="error" title="Authentication error">
              {formError}
            </Alert>
          </div>
        ) : null}

        {state === "success" ? (
          <Alert variant="success" title={isRegister ? "Account created" : "Signed in"}>
            Authentication succeeded. Redirecting…
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} noValidate aria-busy={state === "submitting"} className="grid gap-5">
          <FormField label="Email address" htmlFor="auth-email" error={emailError ?? undefined} required>
            <Input
              ref={emailRef}
              id="auth-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(null);
                if (formError) setFormError(null);
              }}
              required
              disabled={state === "submitting"}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="auth-password"
            description="Use at least 12 characters."
            error={passwordError ?? undefined}
            required
          >
            <Input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError(null);
                if (formError) setFormError(null);
              }}
              required
              disabled={state === "submitting"}
            />
          </FormField>

          <Button type="submit" loading={state === "submitting"} disabled={state === "success"} className="w-full sm:w-auto">
            {isRegister ? "Create account" : "Sign in"}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        {isRegister ? (
          <p className="text-sm">
            Already have an account?{" "}
            <Link className="font-900 underline underline-offset-4" href={`/login?next=${encodeURIComponent(safeRedirect)}`}>
              Sign in
            </Link>
          </p>
        ) : (
          <p className="text-sm">
            New to 4HRS?{" "}
            <Link className="font-900 underline underline-offset-4" href={`/register?next=${encodeURIComponent(safeRedirect)}`}>
              Create an account
            </Link>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
