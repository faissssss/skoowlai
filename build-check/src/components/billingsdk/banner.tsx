'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type BannerVariant = 'default' | 'minimal' | 'popup';

export interface BannerProps {
  title: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  variant?: BannerVariant;
  className?: string;
}

export function Banner({
  title,
  description,
  buttonText = 'Get Started',
  buttonLink = '#',
  variant = 'default',
  className,
}: BannerProps) {
  if (variant === 'minimal') {
    return (
      <div className={cn('w-full py-2 text-sm flex items-center justify-center gap-3', className)}>
        <span className="text-foreground/90">{title}</span>
        {buttonText && (
          <Link
            href={buttonLink}
            className="text-primary underline underline-offset-4 hover:opacity-90 transition"
          >
            {buttonText}
          </Link>
        )}
      </div>
    );
  }

  if (variant === 'popup') {
    return (
      <div className={cn('mx-auto max-w-2xl rounded-xl border bg-background p-4 shadow-lg', className)}>
        <div className="flex flex-col gap-2 text-center">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {buttonText && (
            <div className="pt-1">
              <Link
                href={buttonLink}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                {buttonText}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // default
  return (
    <div
      className={cn(
        'w-full rounded-md border bg-card px-4 py-3 text-sm',
        'flex items-center justify-between gap-3',
        className
      )}
    >
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        {description && <div className="text-muted-foreground">{description}</div>}
      </div>
      {buttonText && (
        <Link
          href={buttonLink}
          className="shrink-0 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition"
        >
          {buttonText}
        </Link>
      )}
    </div>
  );
}

export default Banner;