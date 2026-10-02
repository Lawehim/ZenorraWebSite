import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "gold" | "line" | "ghost" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  href?: string;
  className?: string;
  children: ReactNode;
}

export function buttonClass({ variant = "line", size = "md", block = false, className = "" }: Pick<ButtonProps, "variant" | "size" | "block" | "className">) {
  return ["btn", `btn-${variant}`, size === "sm" && "btn-sm", block && "btn-block", className].filter(Boolean).join(" ");
}

export function Button({ variant = "line", size = "md", block, href, className, children, type = "button", ...rest }: ButtonProps) {
  const cls = buttonClass({ variant, size, block, className });
  if (href) {
    const external = /^(https?:|tel:|mailto:)/.test(href);
    return external ? (
      <a href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
