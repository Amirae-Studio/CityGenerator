export function Logo({ className = "" }: { className?: string }) {
  return <img src="./logo.webp" alt="City Generator" width={1078} height={435} className={`w-auto ${className}`} />;
}
