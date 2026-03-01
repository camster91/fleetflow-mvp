import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className = '' }: FeatureCardProps) {
  return (
    <div
      className={`group p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all duration-300 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

interface FeatureCardLargeProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  imagePosition?: 'left' | 'right';
}

export function FeatureCardLarge({
  icon: Icon,
  title,
  description,
  features,
  imagePosition = 'right',
}: FeatureCardLargeProps) {
  const content = (
    <div className="flex flex-col justify-center">
      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 mb-4 leading-relaxed">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center space-x-2 text-sm text-slate-600">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const imagePlaceholder = (
    <div className="relative aspect-video rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-200 opacity-50"></div>
      <div className="relative text-center">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-soft flex items-center justify-center mx-auto mb-3">
          <Icon className="h-10 w-10 text-blue-600" />
        </div>
        <span className="text-sm text-slate-500 font-medium">Feature Preview</span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
      {imagePosition === 'left' ? (
        <>
          {imagePlaceholder}
          {content}
        </>
      ) : (
        <>
          {content}
          {imagePlaceholder}
        </>
      )}
    </div>
  );
}
