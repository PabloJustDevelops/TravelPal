"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AccountTabs from "@/components/layout/AccountTabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import Input from "@/components/ui/Input";
import { UserCircleIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/ui/Toast";
import { avatarUrlSchema } from "@/lib/avatar-url";
import { useI18n } from '@/lib/i18n/LocaleProvider';

export function ProfilePageContent({t}: Pick<ReturnType<typeof useI18n>, 't'>) {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    avatarUrl: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.full_name || "",
        email: user.email || "",
        avatarUrl: user.avatar_url || "",
      });
    }
  }, [user]);

  const handleSave = async () => {
    const avatar = avatarUrlSchema.safeParse(formData.avatarUrl);
    if (!avatar.success) {
      setAvatarError(t('avatarUrlError'));
      return;
    }
    setAvatarError("");
    setLoading(true);
    // Timeout de seguridad local para la UI
    const timeoutId = setTimeout(() => {
      setLoading(false);
      showError(t('profileOperationTimeout'), t('errorToastTitle'), t('toastDismiss'));
    }, 30000);

    try {
      await updateProfile({
        full_name: formData.fullName,
        avatar_url: avatar.data ?? "",
      });
      showSuccess(t('profileUpdated'), t('noticeTitle'), t('toastDismiss'));
      setIsEditing(false);
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      showError(t('profileUpdateError'), t('errorToastTitle'), t('toastDismiss'));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError(t('avatarTooLarge'), t('errorToastTitle'), t('toastDismiss'));
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      setAvatarError("");
      showSuccess(t('avatarUploaded'), t('noticeTitle'), t('toastDismiss'));
    } catch (error) {
      console.error("Error uploading avatar:", error);
      showError(t('avatarUploadError'), t('errorToastTitle'), t('toastDismiss'));
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout skeleton="profile">
        <div className="flex items-center justify-center h-full">
          <p>{t('profileLoading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout skeleton="profile">
      <div className="mx-auto space-y-7">
        <PageTitle title={t('profileTitle')} subtitle={t('profileSubtitle')} />
        <AccountTabs active="profile" />

        <Card className="rounded-none border-0 bg-transparent">
          <CardHeader className="border-0 px-0 pt-0">
            <CardTitle headingLevel={2} className="flex items-center gap-2">
              <UserCircleIcon className="h-6 w-6" />
              {t('profilePhoto')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-7 px-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="relative group">
                {formData.avatarUrl && avatarUrlSchema.safeParse(formData.avatarUrl).success ? (
                  <img
                    src={formData.avatarUrl}
                    alt={formData.fullName || t('user')}
                    className="h-24 w-24 rounded-full object-cover border border-line"
                  />
                ) : (
                  <UserCircleIcon className="h-24 w-24 text-muted" />
                )}
                {isEditing && (
                  <Button
                    variant="ghost"
                    aria-label={t('profileChangePhoto')}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex h-full w-full items-center justify-center bg-ink/60 rounded-full opacity-0 group-hover:opacity-100 hover:!bg-ink/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-opacity cursor-pointer"
                  >
                    <PhotoIcon className="h-8 w-8 text-paper" />
                  </Button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={!isEditing || uploading}
                />
              </div>
              
              <div className="flex-1 text-left space-y-2">
                <h2 className="text-2xl font-bold text-ink">
                  {formData.fullName || t('user')}
                </h2>
                <p className="text-muted">{formData.email}</p>
                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="md"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? t('profileUploading') : t('profileUploadPhoto')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid max-w-3xl grid-cols-1 gap-6 pt-6 border-t border-line">
              <h2 className="text-2xl font-bold text-ink">{t('accountDetails')}</h2>
              <div className="space-y-2">
                <label htmlFor="profile-name" className="block text-sm font-medium text-ink">
                  {t('fullName')}
                </label>
                <Input
                  id="profile-name"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  disabled={!isEditing}
                  placeholder={t('fullNamePlaceholder')}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="profile-email" className="block text-sm font-medium text-ink">
                  {t('email')}
                </label>
                <Input
                  id="profile-email"
                  value={formData.email}
                  disabled
                  className="bg-surface cursor-not-allowed"
                />
              </div>

              {isEditing && (
                <div className="space-y-2">
                  <label htmlFor="profile-avatar" className="block text-sm font-medium text-ink">
                    {t('avatarUrlLabel')}
                  </label>
                    <Input
                      id="profile-avatar"
                      value={formData.avatarUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, avatarUrl: e.target.value });
                        setAvatarError("");
                      }}
                      aria-invalid={!!avatarError}
                      aria-describedby={avatarError ? "profile-avatar-error" : "profile-avatar-help"}
                      placeholder="https://..."
                      className="min-h-11"
                    />
                  {avatarError && <p id="profile-avatar-error" role="alert" className="text-sm text-danger">{avatarError}</p>}
                  <p id="profile-avatar-help" className="text-xs text-muted">
                    {t('avatarUrlHelp')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-start pt-6 border-t border-line gap-3">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    className="transition-none"
                    onClick={() => {
                      setIsEditing(false);
                      setAvatarError("");
                      // Reset form data to current user data
                      if (user) {
                        setFormData({
                          fullName: user.full_name || "",
                          email: user.email || "",
                          avatarUrl: user.avatar_url || "",
                        });
                      }
                    }}
                    disabled={loading || uploading}
                  >
                    {t('profileCancel')}
                  </Button>
                  <Button onClick={handleSave} disabled={loading || uploading}>
                    {loading ? t('profileSaving') : t('profileSave')}
                  </Button>
                </>
              ) : (
                <Button className="transition-none" onClick={() => setIsEditing(true)}>
                  {t('profileEdit')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function ProfilePage() {
  const i18n = useI18n()
  return <ProfilePageContent {...i18n} />
}
