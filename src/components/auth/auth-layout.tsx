import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/branding";

export function AuthLayout({
  children,
  heading,
  subheading,
}: {
  children: React.ReactNode;
  heading: string;
  subheading?: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden w-1/2 flex-col justify-between bg-brand-600 p-12 text-white lg:flex">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{PRODUCT_NAME}</h1>
        </div>
        <div>
          <blockquote className="text-lg font-medium leading-relaxed text-brand-100">
            &ldquo;{PRODUCT_TAGLINE}.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-brand-200">
            Streamline prior authorizations, generate appeal letters with AI,
            and recover denied revenue — all from one dashboard.
          </p>
        </div>
        <p className="text-xs text-brand-300">
          &copy; {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold text-brand-600 lg:hidden">
              {PRODUCT_NAME}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">{heading}</h2>
            {subheading && (
              <p className="mt-2 text-sm text-muted-foreground">{subheading}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
