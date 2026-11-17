import { cn } from "../lib/utils";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function stringToColor(_str: string): string {
  return "bg-primary";
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  className,
}: AvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || "Avatar"}
        className={cn(
          "rounded-full object-cover",
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium",
        sizeClasses[size],
        // Dark initials on the bright primary (8.3:1); light on the fallback.
        name
          ? cn(stringToColor(name), "text-primary-foreground")
          : "bg-surface-elevated text-text",
        className,
      )}
    >
      {name ? getInitials(name) : "?"}
    </div>
  );
}
