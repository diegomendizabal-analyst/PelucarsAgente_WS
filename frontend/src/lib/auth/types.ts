export type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "seller";
  contact_phone: string | null;
  contact_email: string | null;
  is_enabled: boolean;
  accepts_assignments: boolean;
};
export type CurrentAccount = Profile & { email: string };
export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string> };
