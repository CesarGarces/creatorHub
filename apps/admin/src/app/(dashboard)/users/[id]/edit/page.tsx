"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import api from "@/lib/api";
import { Skeleton } from "@creator-hub/ui";
import type { User } from "@/types";
import { useI18n } from "@/i18n/i18n-provider";

export default function EditUserPage() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get(`/admin/users/${params.id}`);
        setUser(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [params.id]);

  const handleSubmit = async (data: any) => {
    await api.put(`/admin/users/${params.id}`, data);
    router.push("/users");
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) {
    return <div className="text-error">{t("users.editPage.notFound")}</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">
          {t("users.editPage.title")}
        </h1>
        <p className="text-text-muted">{t("users.editPage.subtitle")}</p>
      </div>

      <UserForm user={user} onSubmit={handleSubmit} />
    </div>
  );
}
