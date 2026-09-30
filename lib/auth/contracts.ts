import type { CustomerDto } from "@/lib/customer/contracts";

export type AuthenticationCustomerResponse = {
  customer: CustomerDto;
  authenticated: true;
};

export type AuthenticationAnonymousResponse = {
  customer: null;
  authenticated: false;
};

export type AuthenticationSessionResponse =
  | AuthenticationCustomerResponse
  | AuthenticationAnonymousResponse;

export type RegistrationInput = { email: string; password: string };
export type LoginInput = { email: string; password: string };
