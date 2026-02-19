import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';

// Prices are fresh for one hour max
export const revalidate = 3600;

export default async function PricingPage() {
  const [prices, products] = await Promise.all([
    getStripePrices(),
    getStripeProducts(),
  ]);

  // Look for "Pro" or "AtPar" product in Stripe
  const atParPlan = products.find(
    (product) =>
      product.name === 'Pro' ||
      product.name === 'AtPar' ||
      product.name.toLowerCase().includes('atpar')
  );

  const atParPrice = prices.find(
    (price) => price.productId === atParPlan?.id
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-gray-600">
          Simple pricing, cancel anytime.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <PricingCard
          name="AtPar"
          price={atParPrice?.unitAmount || 5000}
          interval={atParPrice?.interval || 'month'}
          subtitle="$50 per team, per month"
          description="No per-seat fees. No usage limits."
          features={[
            'Up to 10 active synced Notion databases',
            'Unlimited users',
            'Unlimited Azure DevOps projects',
            'Task + status + docs sync',
            'Cancel anytime',
          ]}
          priceId={atParPrice?.id}
        />
        <EnterprisePricingCard />
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  interval,
  subtitle,
  description,
  features,
  priceId,
}: {
  name: string;
  price: number;
  interval: string;
  subtitle: string;
  description: string;
  features: string[];
  priceId?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{name}</h2>
      <p className="text-sm text-gray-500 mb-6">
        Cancel anytime
      </p>
      <p className="text-4xl font-bold text-gray-900 mb-1">
        ${price / 100}
        <span className="text-lg font-normal text-gray-500">/{interval}</span>
      </p>
      <p className="text-sm text-gray-600 mb-2">{subtitle}</p>
      <p className="text-sm text-gray-500 mb-6">{description}</p>
      <form action={checkoutAction} className="mb-6">
        <input type="hidden" name="priceId" value={priceId} />
        <SubmitButton />
      </form>
      <ul className="space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EnterprisePricingCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">AtPar Enterprise</h2>
      <p className="text-sm text-gray-500 mb-6">
        For teams with advanced needs
      </p>
      <p className="text-4xl font-bold text-gray-900 mb-1">Custom</p>
      <p className="text-sm text-gray-600 mb-2">Contact us for pricing</p>
      <p className="text-sm text-gray-500 mb-6">Tailored to your organization</p>
      <a
        href="mailto:atpar.app@gmail.com"
        className="block w-full text-center bg-gray-900 text-white rounded-lg py-3 px-4 font-medium hover:bg-gray-800 transition-colors mb-6"
      >
        Contact Sales
      </a>
      <p className="text-sm font-medium text-gray-700 mb-3">
        Everything in AtPar, plus:
      </p>
      <ul className="space-y-3">
        {[
          'Unlimited synced Notion databases',
          'Wiki page syncing',
          'Advanced security & compliance',
          'SSO / SAML authentication',
          'Dedicated support',
          'Custom integrations',
        ].map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
