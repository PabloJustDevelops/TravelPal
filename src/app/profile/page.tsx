"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import Input from "@/components/ui/Input";
import { UserCircleIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { useToast } from "@/components/ui/Toast";

export default function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    setLoading(true);
    // Timeout de seguridad local para la UI
    const timeoutId = setTimeout(() => {
      setLoading(false);
      showError("La operación ha tardado demasiado. Por favor, inténtalo de nuevo.");
    }, 30000);

    try {
      await updateProfile({
        full_name: formData.fullName,
        avatar_url: formData.avatarUrl,
      });
      showSuccess("Perfil actualizado correctamente");
      setIsEditing(false);
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      showError("Error al actualizar el perfil: " + (error instanceof Error ? error.message : "Error desconocido"));
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
      showError("La imagen no debe superar los 5MB");
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      showSuccess("Imagen subida correctamente");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      showError("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p>Cargando perfil...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageTitle title="Mi perfil" subtitle="Tu información personal y la foto de tu cuenta." />

        <Card>
          <CardHeader>
            <CardTitle headingLevel={2} className="flex items-center gap-2">
              <UserCircleIcon className="h-6 w-6" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative group">
                {formData.avatarUrl ? (
                  <img
                    src={formData.avatarUrl}
                    alt={formData.fullName || "Usuario"}
                    className="h-24 w-24 rounded-full object-cover border border-line"
                  />
                ) : (
                  <UserCircleIcon className="h-24 w-24 text-muted" />
                )}
                {isEditing && (
                  <Button
                    variant="ghost"
                    aria-label="Cambiar foto de perfil"
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
              
              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-2xl font-bold text-ink">
                  {formData.fullName || "Usuario"}
                </h2>
                <p className="text-muted">{formData.email}</p>
                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "Subiendo..." : "Subir foto"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-line">
              <div className="space-y-2">
                <label htmlFor="profile-name" className="block text-sm font-medium text-ink">
                  Nombre Completo
                </label>
                <Input
                  id="profile-name"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  disabled={!isEditing}
                  placeholder="Tu nombre completo"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="profile-email" className="block text-sm font-medium text-ink">
                  Email
                </label>
                <Input
                  id="profile-email"
                  value={formData.email}
                  disabled
                  className="bg-surface cursor-not-allowed"
                />
              </div>

              {isEditing && (
                <div className="md:col-span-2 space-y-2">
                  <label htmlFor="profile-avatar" className="block text-sm font-medium text-ink">
                    URL del Avatar (Opcional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="profile-avatar"
                      value={formData.avatarUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, avatarUrl: e.target.value })
                      }
                      placeholder="https://..."
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Puedes subir una foto o pegar una URL directa a una imagen.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-line gap-3">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
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
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={loading || uploading}>
                    {loading ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>
                  Editar Perfil
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
