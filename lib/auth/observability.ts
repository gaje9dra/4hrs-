type AuthenticationEvent = {
  event:
    | "registration_success"
    | "registration_failure"
    | "login_success"
    | "login_failure"
    | "logout"
    | "authorization_denied";
  code?: string;
};

export function logAuthenticationEvent(event: AuthenticationEvent): void {
  // Deliberately excludes email, customer IDs, passwords, hashes, tokens, cookies and request bodies.
  if (process.env.NODE_ENV !== "test") {
    console.info("[auth]", event);
  }
}
