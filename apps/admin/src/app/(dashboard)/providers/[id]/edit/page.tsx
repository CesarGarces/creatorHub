"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ProviderForm } from "@/components/providers/provider-form";
import api from "@/lib/api";
import { Skeleton } from "@creator-hub/ui";
import type { Provider } from "@/types";

export default function EditProviderPage() {
  const router = useRouter();
  const params = useParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const res = await api.get(`/admin/providers/${params.id}`);
        setProvider(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [params.id]);

  const handleSubmit = async (data: any) => {
    await api.put(`/admin/providers/${params.id}`, data);
    router.push("/providers");
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!provider) {
    return <div className="text-error">Provider not found</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Edit Provider</h1>
        <p className="text-text-muted">Update provider details</p>
      </div>

      <ProviderForm provider={provider} onSubmit={handleSubmit} />
    </div>
  );
}
