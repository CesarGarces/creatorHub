"use client";

import { useRouter } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import api from "@/lib/api";

export default function NewUserPage() {
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    await api.post("/admin/users", data);
    router.push("/users");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">New User</h1>
        <p className="text-text-muted">Create a new user account</p>
      </div>

      <UserForm onSubmit={handleSubmit} />
    </div>
  );
}
