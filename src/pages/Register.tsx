import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "../lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTitle } from "../hooks/useTitle";
import { register } from "../services";
import { invalidateAfterUserRegistration } from "../utils/queryInvalidation";
import { GoogleSignInButton } from "../components";
import {
  StaggerContainer,
  StaggerItem,
  RippleButton,
  AuthSplitLayout,
  FormInput,
  FormLabel,
} from "../components/ui";

interface RegisterFormElements extends HTMLFormControlsCollection {
  name: HTMLInputElement;
  email: HTMLInputElement;
  password: HTMLInputElement;
}

interface RegisterFormElement extends HTMLFormElement {
  readonly elements: RegisterFormElements;
}

const REGISTER_BULLETS = [
  "Curated catalog across every CS discipline",
  "Secure checkout with full order history & invoices",
  "Priority support whenever you need help",
];

export const Register = () => {
  useTitle("Register");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React's onSubmit is typed generically over HTMLFormElement; cast to the
    // narrower shape to get typed access to the named form fields below.
    const form = event.currentTarget as RegisterFormElement;
    setIsSubmitting(true);
    try {
      const authDetail = {
        name: form.elements.name.value,
        email: form.elements.email.value,
        password: form.elements.password.value,
      };
      const data = await register(authDetail);
      if (data.accessToken) {
        // Clear React Query cache to prevent showing previous user's data
        queryClient.clear();

        // Invalidate admin queries so admin dashboard updates immediately
        // (new user registration affects "Total Users" metric)
        invalidateAfterUserRegistration(queryClient);

        navigate("/products");
      } else {
        toast.error(data as unknown as string);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error), {
        closeButton: true,
        position: "bottom-right",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      imageSrc="/images/10003.avif"
      imageAlt="Stack of computer science ebooks and a laptop"
      eyebrow="Join CodeBook"
      title="Start building your developer library"
      subtitle="Create a free account to browse, purchase, and manage computer science ebooks — from algorithms to full-stack engineering."
      bullets={REGISTER_BULLETS}
    >
      <StaggerContainer className="w-full">
        <StaggerItem className="mb-6">
          <h1 className="text-2xl font-medium text-gray-700 dark:text-slate-100">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 font-medium"
            >
              Sign in
            </Link>
          </p>
        </StaggerItem>

        <form onSubmit={handleRegister}>
          <StaggerItem className="mb-6">
            <FormLabel htmlFor="name">Your name</FormLabel>
            <FormInput
              type="text"
              id="name"
              name="name"
              placeholder="John Doe"
              required
              autoComplete="off"
            />
          </StaggerItem>
          <StaggerItem className="mb-6">
            <FormLabel htmlFor="email">Your email</FormLabel>
            <FormInput
              type="email"
              id="email"
              name="email"
              placeholder="john.doe@example.com"
              required
              autoComplete="off"
            />
          </StaggerItem>
          <StaggerItem className="mb-6">
            <FormLabel htmlFor="password">Your password</FormLabel>
            <FormInput
              type="password"
              id="password"
              name="password"
              required
              minLength={7}
            />
          </StaggerItem>

          <StaggerItem>
            <div className="cta-shine-wrap rounded-lg w-full">
              <RippleButton
                type="submit"
                disabled={isSubmitting}
                className="cta-shine-button text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-60"
              >
                {isSubmitting ? "Creating account…" : "Sign up"}
              </RippleButton>
            </div>
          </StaggerItem>

          {/* Continue with Google (REQ-1501) */}
          <StaggerItem>
            <GoogleSignInButton />
          </StaggerItem>
        </form>
      </StaggerContainer>
    </AuthSplitLayout>
  );
};
