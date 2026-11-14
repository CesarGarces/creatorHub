"use client";

import { useRouter } from "next/navigation";
import { UserForm } from "@/components/users/user-form";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";

export default function NewUserPage() {
  const router = useRouter();
  const { t } = useI18n();

  const handleSubmit = async (data: any) => {
    await api.post("/admin/users", data);
    router.push("/users");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">
          {t("users.newPage.title")}
        </h1>
        <p className="text-text-muted">{t("users.newPage.subtitle")}</p>
      </div>

      <UserForm onSubmit={handleSubmit} />
    </div>
  );
}
