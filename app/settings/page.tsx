"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/lib/identity-context";
import { storeDisplayName } from "@/lib/identity";
import { DEFAULT_RECITER_FOLDER, RECITERS, RECITER_ITEMS } from "@/lib/editions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { userId, displayName } = useIdentity();
  const preferences = useQuery(api.preferences.getPreferences, userId ? { userId } : "skip");
  const updatePreferences = useMutation(api.preferences.updatePreferences);
  const updateDisplayName = useMutation(api.users.updateDisplayName);
  const resetProgress = useMutation(api.progress.resetProgress);
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState("");
  const [nameInitializedFor, setNameInitializedFor] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Fills the input once displayName resolves asynchronously from identity
  // setup, without re-overwriting it on every subsequent render (React's
  // documented render-time state-adjustment pattern, not an effect).
  if (displayName && nameInitializedFor !== displayName) {
    setNameInitializedFor(displayName);
    setName(displayName);
  }

  function handleNameBlur() {
    const trimmed = name.trim();
    if (!userId || !trimmed || trimmed === displayName) return;
    storeDisplayName(trimmed);
    updateDisplayName({ userId, displayName: trimmed });
  }

  async function handleReset() {
    if (!userId) return;
    await resetProgress({ userId });
    setConfirmReset(false);
    toast.success("Progress reset");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6 pb-44">
      <header className="pt-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            maxLength={40}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listening defaults</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Reciter</Label>
            <Select
              items={RECITER_ITEMS}
              value={preferences?.reciterFolder ?? DEFAULT_RECITER_FOLDER}
              onValueChange={(value) =>
                userId && updatePreferences({ userId, reciterFolder: value as string })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a reciter" />
              </SelectTrigger>
              <SelectContent>
                {RECITERS.map((r) => (
                  <SelectItem key={r.folder} value={r.folder}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="english-toggle">Show English translation</Label>
            <Switch
              id="english-toggle"
              checked={preferences?.showEnglish ?? false}
              onCheckedChange={(checked) =>
                userId && updatePreferences({ userId, showEnglish: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="urdu-toggle">Show Urdu translation</Label>
            <Switch
              id="urdu-toggle"
              checked={preferences?.showUrdu ?? false}
              onCheckedChange={(checked) =>
                userId && updatePreferences({ userId, showUrdu: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="pause-after-ayah-toggle">Pause after each ayah</Label>
              <p className="text-xs text-muted-foreground">
                Stop at the end of every ayah (after its translations, if on) instead of
                continuing straight to the next.
              </p>
            </div>
            <Switch
              id="pause-after-ayah-toggle"
              checked={preferences?.pauseAfterAyah ?? false}
              onCheckedChange={(checked) =>
                userId && updatePreferences({ userId, pauseAfterAyah: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="dark-toggle">Dark mode</Label>
          <Switch
            id="dark-toggle"
            checked={theme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            Reset all progress
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset all progress?</DialogTitle>
            <DialogDescription>
              This clears every ayah you&apos;ve marked as listened. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
