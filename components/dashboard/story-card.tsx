"use client";

import { Card, CardContent, Chip } from "@heroui/react";
import { ArrowUpRight } from "lucide-react";

export function StoryCard({
  title,
  body,
  category,
  accent
}: {
  title: string;
  body: string;
  category: string;
  accent: string;
}) {
  return (
    <Card className="surface overflow-hidden border-none shadow-none">
      <div className={`h-40 bg-gradient-to-br ${accent} p-5`}>
        <div className="surface-soft flex h-full items-end justify-between rounded-[22px] p-4 dark:bg-black/10">
          <Chip className="bg-white/70 dark:bg-white/12" size="sm" variant="soft">
            {category}
          </Chip>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-900 shadow-md dark:bg-white/10 dark:text-white">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
      </div>
      <CardContent className="gap-3 px-5 pb-5 pt-4">
        <h4 className="text-lg font-semibold tracking-tight">{title}</h4>
        <p className="text-sm leading-7 text-muted">{body}</p>
      </CardContent>
    </Card>
  );
}
