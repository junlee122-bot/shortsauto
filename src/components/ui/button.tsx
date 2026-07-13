import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(124,92,255,.22)] hover:bg-primary/90",
        secondary: "border border-border bg-secondary text-foreground hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        danger: "bg-destructive/15 text-destructive hover:bg-destructive/25",
      },
      size: { sm: "h-8 rounded-lg px-3 text-xs", default: "h-10", lg: "h-12 px-5", icon: "size-10 px-0" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
