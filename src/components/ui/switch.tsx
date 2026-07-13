"use client";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={cn("relative h-6 w-11 rounded-full bg-secondary outline-none transition data-[state=checked]:bg-primary focus-visible:ring-2 focus-visible:ring-primary/60", className)} {...props}>
    <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
  </SwitchPrimitive.Root>;
}
