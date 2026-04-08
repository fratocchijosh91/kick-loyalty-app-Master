import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useOrganization } from '../contexts/OrganizationContext';
import { CreditCard, Check, AlertCircle, ExternalLink } from 'lucide-react';

const BillingPage = () => {
  const { currentOrg, loadBillingInfo, upgradePlan, cancelSubscription, loading, error } = useOrganization();
  const [billing, setBilling] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!currentOrg?.slug) return;
    loadData();
  }, [currentOrg]);

  const loadData = async () => {
    try {
      const data = await loadBillingInfo(currentOrg.slug);
      setBilling(data);
    } catch (err) {
      console.error('Errore caricamento billing:', err);
    }
  };

  const handleUpgrade = async (planSlug) => {
    setActionError('');
    setActionLoading(true);

    try {
      const result = await upgradePlan(currentOrg.slug, planSlug);
      
      if (result.sessionUrl) {
        // Redirect to Stripe
        window.location.href = result.sessionUrl;
      } else if (result.success) {
        // Local upgrade (free plan)
        setBilling(prev => ({
          ...prev,
          currentPlan: { ...prev.currentPlan, slug: planSlug }
        }));
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Errore nell\'upgrade');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Sei sicuro di voler cancellare la subscription? Tornerai al piano Free.')) return;

    setActionError('');
    setActionLoading(true);

    try {
      await cancelSubscription(currentOrg.slug);
      loadData();
    } catch (err) {
      setActionError(err.message || 'Errore nella cancellazione');
    } finally {
      setActionLoading(false);
    }
  };

  const currentPlan = billing?.currentPlan;
  const plans = billing?.availablePlans || [];

  const planDetails = {
    free: {
      color: 'from-gray-600 to-gray-700',
      icon: '🌱',
      description: 'Perfetto per iniziare',
      badge: null
    },
    pro: {
      color: 'from-brand-600 to-brand-500',
      icon: '🚀',
      description: 'Più popolare',
      badge: '🔥 PIÙ POPOLARE'
    },
    business: {
      color: 'from-purple-600 to-purple-700',
      icon: '⚡',
      description: 'Per professionisti',
      badge: null
    },
    enterprise: {
      color: 'from-red-600 to-red-700',
      icon: '💎',
      description: 'Soluzione personalizzata',
      badge: null
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">Gestione Billing</h1>
        <p className="text-text-muted">Visualizza e gestisci il tuo piano di abbonamento</p>
      </div>

      {/* Current Plan */}
      {currentPlan && (
        <div className="card mb-8 p-8 relative overflow-hidden">
          {/* Background gradient */}
          <div
            className={`absolute inset-0 bg-gradient-to-r ${planDetails[currentPlan.slug]?.color || 'from-gray-600 to-gray-700'} opacity-5`}
          />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-sm text-text-muted mb-2">PIANO ATTUALE</p>
                <h2 className="text-4xl font-bold text-text capitalize">
                  {planDetails[currentPlan.slug]?.icon} {currentPlan.name || currentPlan.slug}
                </h2>
                <p className="text-text-muted text-lg mt-2">
                  {planDetails[currentPlan.slug]?.description}
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold text-brand-600">
                  {currentPlan.price ? `€${currentPlan.price}` : 'Gratis'}
                </div>
                {currentPlan.price && (
                  <p className="text-text-muted">/mese</p>
                )}
              </div>
            </div>

            {/* Subscription Status */}
            {currentOrg?.subscription && (
              <div className="mb-6 p-4 bg-surface-2 rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-text-muted">Status</p>
                    <p className="text-text font-semibold capitalize flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${
                        currentOrg.subscription.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      {currentOrg.subscription.status}
                    </p>
                  </div>
                  {currentOrg.subscription.renewalDate && (
                    <div>
                      <p className="text-text-muted">Prossimo Rinnovo</p>
                      <p className="text-text font-semibold mt-1">
                        {new Date(currentOrg.subscription.renewalDate).toLocaleDateString('it-IT', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quotas */}
            {currentPlan.quotas && (
              <div>
                <h3 className="text-lg font-semibold text-text mb-4">Caratteristiche Incluse</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Max Rewards', value: currentPlan.quotas.maxRewards },
                    { label: 'Team Members', value: currentPlan.quotas.maxTeamMembers },
                    { label: 'API Calls/Mese', value: currentPlan.quotas.maxApiCallsPerMonth ? `${(currentPlan.quotas.maxApiCallsPerMonth / 1000).toFixed(0)}K` : '∞' },
                    { label: 'Webhooks', value: currentPlan.quotas.webhookIntegrations ? 'Sì' : 'No' },
                    { label: 'Analytics', value: currentPlan.quotas.advancedAnalytics ? 'Avanzate' : 'Base' },
                    { label: 'Support', value: currentPlan.quotas.prioritySupport ? 'Priority' : 'Standard' }
                  ].map(item => (
                    <div key={item.label} className="p-3 bg-surface-2 rounded-lg border border-border">
                      <p className="text-xs text-text-muted mb-1">{item.label}</p>
                      <p className="text-sm font-semibold text-text">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex gap-3">
              {currentPlan.slug !== 'free' && (
                <button
                  onClick={handleCancel}
                  className="button-secondary text-red-400 hover:text-red-300"
                  disabled={actionLoading}
                >
                  Cancella Abbonamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {(error || actionError) && (
        <div className="card mb-8 p-4 bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error || actionError}
          </p>
        </div>
      )}

      {/* All Plans */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-text mb-6">Tutti i Piani</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => {
            const isCurrentPlan = currentPlan?.slug === plan.slug;
            const details = planDetails[plan.slug] || {};

            return (
              <div
                key={plan.slug}
                className={`card p-6 relative transition-all ${isCurrentPlan ? 'ring-2 ring-brand-600' : ''}`}
              >
                {details.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {details.badge}
                  </div>
                )}

                <div className="text-3xl mb-3">{details.icon}</div>

                <h3 className="text-lg font-bold text-text capitalize mb-1">
                  {plan.displayName || plan.slug}
                </h3>
                <p className="text-xs text-text-muted mb-4">{details.description}</p>

                <div className="mb-6">
                  <div className="text-3xl font-bold text-brand-600">
                    {plan.priceMonthly ? `€${plan.priceMonthly}` : 'Gratis'}
                  </div>
                  {plan.priceMonthly && (
                    <p className="text-xs text-text-muted">/mese</p>
                  )}
                </div>

                {/* Quick Features */}
                <div className="space-y-2 mb-6">
                  {[
                    `${plan.quotas.maxRewards} rewards`,
                    `${plan.quotas.maxTeamMembers} team members`,
                    plan.quotas.advancedAnalytics ? '✓ Analytics' : '○ Analytics Base',
                    plan.quotas.prioritySupport ? '✓ Priority Support' : '○ Standard Support'
                  ].map((feature, i) => (
                    <div key={i} className="text-sm text-text-muted flex items-start gap-2">
                      {feature.includes('✓') ? (
                        <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                      ) : feature.includes('○') ? (
                        <span className="text-text-muted flex-shrink-0">○</span>
                      ) : (
                        <span className="text-brand-600 font-bold flex-shrink-0">•</span>
                      )}
                      <span>{feature.replace('✓ ', '').replace('○ ', '')}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full button-secondary opacity-50 cursor-not-allowed"
                  >
                    ✓ Piano Attuale
                  </button>
                ) : plan.slug === 'free' ? (
                  <button
                    onClick={() => handleUpgrade('free')}
                    disabled={actionLoading}
                    className="w-full button-secondary"
                  >
                    Downgrade a Free
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.slug)}
                    disabled={actionLoading}
                    className="w-full button-primary"
                  >
                    {actionLoading ? 'Caricamento...' : 'Upgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="card p-8">
        <h2 className="text-2xl font-bold text-text mb-6">Domande Frequenti</h2>
        <div className="space-y-6">
          {[
            {
              q: 'Posso cambiare piano in qualsiasi momento?',
              a: 'Sì! Puoi downgrade o upgrade il tuo piano in qualsiasi momento. I cambiamenti avranno effetto immediatamente.'
            },
            {
              q: 'Cosa succede se cancello il mio abbonamento?',
              a: 'Tornerai al piano Free. I tuoi dati rimangono salvati, ma avrai accesso solo alle funzioni Free.'
            },
            {
              q: 'Avete una prova gratuita?',
              a: 'Sì! Inizia con il piano Free per sempre. Upgrade a Pro quando sei pronto.'
            },
            {
              q: 'Serve fattura?',
              a: 'Certo! Riceverai una fattura per ogni pagamento via email.' 
            }
          ].map((faq, i) => (
            <div key={i}>
              <h4 className="font-semibold text-text mb-2">📌 {faq.q}</h4>
              <p className="text-text-muted text-sm">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div className="mt-8 card p-6 bg-surface-2 border border-brand-600/20 text-center">
        <p className="text-text-muted mb-4">Domande su pricing o funzionalità?</p>
        <a
          href="mailto:support@kickloyalty.com"
          className="button-primary inline-flex items-center gap-2"
        >
          <CreditCard size={18} />
          Contatta il Support
        </a>
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
