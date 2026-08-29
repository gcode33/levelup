"use client";

import { useRouter } from "next/navigation";
import { updatePreferences } from "./personalize-actions";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const BACKGROUNDS = [
  { value: "#ffffff", label: "White" },
  { value: "#eff6ff", label: "Blue" },
  { value: "#f0fdf4", label: "Green" },
  { value: "#fff7ed", label: "Warm" },
  { value: "#faf5ff", label: "Purple" },
];

export default function PersonalizeForm({
  theme,
  background,
}: {
  theme: string | null;
  background: string | null;
}) {
  const router = useRouter();

  async function apply(nextTheme: string, nextBackground: string) {
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    await updatePreferences(nextTheme, nextBackground);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 card p-6">
      <h2 className="text-xl font-medium">Personalize</h2>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Theme</span>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => apply(t.value, background ?? "#ffffff")}
              className={`rounded border px-3 py-1 text-sm ${
                theme === t.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-black/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Background</span>
        <div className="flex gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              onClick={() => apply(theme ?? "light", b.value)}
              title={b.label}
              className={`h-8 w-8 rounded-full border ${
                background === b.value ? "ring-2 ring-blue-500" : "border-black/10"
              }`}
              style={{ backgroundColor: b.value }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
