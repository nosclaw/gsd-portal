"use client";

import { RouterProvider } from "@heroui/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      richColors
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <SessionProvider>
      <RouterProvider navigate={(path: string) => router.push(path as Parameters<typeof router.push>[0])}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </RouterProvider>
    </SessionProvider>
  );
}
