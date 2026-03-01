import { Check, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  name: string;
  description: string;
  price: number;
  period: 'monthly' | 'annual';
  features: PricingFeature[];
  isPopular?: boolean;
  ctaText?: string;
  onCtaClick?: () => void;
}

export function PricingCard({
  name,
  description,
  price,
  period,
  features,
  isPopular = false,
  ctaText = 'Start Free Trial',
  onCtaClick,
}: PricingCardProps) {
  return (
    <div
      className={`relative rounded-2xl p-6 lg:p-8 transition-all duration-300 ${
        isPopular
          ? 'bg-blue-900 text-white shadow-elevated scale-105 z-10'
          : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-soft'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
            <Sparkles className="h-4 w-4" />
            <span>Most Popular</span>
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className={`text-xl font-bold mb-2 ${isPopular ? 'text-white' : 'text-slate-900'}`}>
          {name}
        </h3>
        <p className={`text-sm ${isPopular ? 'text-blue-200' : 'text-slate-500'}`}>
          {description}
        </p>
      </div>

      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center">
          <span className={`text-4xl font-bold ${isPopular ? 'text-white' : 'text-slate-900'}`}>
            ${price}
          </span>
          <span className={`ml-2 ${isPopular ? 'text-blue-200' : 'text-slate-500'}`}>
            /{period === 'monthly' ? 'mo' : 'yr'}
          </span>
        </div>
        {period === 'annual' && (
          <p className={`text-sm mt-1 ${isPopular ? 'text-blue-300' : 'text-emerald-600'}`}>
            Save 20%
          </p>
        )}
      </div>

      <Button
        variant={isPopular ? 'secondary' : 'primary'}
        className="w-full mb-6"
        onClick={onCtaClick}
      >
        {ctaText}
      </Button>

      <ul className="space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start space-x-3">
            <Check
              className={`h-5 w-5 flex-shrink-0 ${
                feature.included
                  ? isPopular
                    ? 'text-blue-300'
                    : 'text-emerald-500'
                  : 'text-slate-300'
              }`}
            />
            <span
              className={`text-sm ${
                feature.included
                  ? isPopular
                    ? 'text-white'
                    : 'text-slate-700'
                  : 'text-slate-400 line-through'
              }`}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
