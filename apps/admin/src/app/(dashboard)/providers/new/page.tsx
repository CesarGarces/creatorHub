"use client";

import { useRouter } from "next/navigation";
import { ProviderForm } from "@/components/providers/provider-form";
import api from "@/lib/api";

export default function NewProviderPage() {
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    await api.post("/admin/providers", data);
    router.push("/providers");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">New Provider</h1>
        <p className="text-text-muted">Create a new AI provider</p>
      </div>

      <ProviderForm onSubmit={handleSubmit} />
    </div>
  );
}
