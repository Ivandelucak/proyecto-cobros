import { BusinessBrand } from "./BusinessBrand";

type AppLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return <BusinessBrand collapsed={compact} className={className} />;
}
